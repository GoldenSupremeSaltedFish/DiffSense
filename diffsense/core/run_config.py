"""
Load run config from repo .diffsense.yaml or diffsense-ignore.yaml.
Used as defaults for profile, auto_tune, rule_quality, pro_rules_path.
CLI / main / run_audit override these with explicit args when provided.
Also resolves pro_rules_path (super rules) for formal DiffSense runs.
"""
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional

def _warn(msg: str) -> None:
    """Emit a config warning on stderr (respects DIFFSENSE_QUIET)."""
    if os.environ.get("DIFFSENSE_QUIET"):
        return
    try:
        sys.stderr.write(f"WARNING: {msg}\n")
        sys.stderr.flush()
    except Exception:
        pass


_TRUE_STRINGS = {"true", "yes", "on", "1"}
_FALSE_STRINGS = {"false", "no", "off", "0", ""}


def _coerce_bool(value: Any, key: str, fname: str) -> Optional[bool]:
    """Strictly coerce a YAML boolean config value (#94).

    bool -> used as-is; quoted strings "true"/"false"/"yes"/"no"/"1"/"0" ->
    converted to the user's obvious intent; anything else -> warning + None
    (caller falls back to its own default) instead of a silent truthy flip.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in _TRUE_STRINGS:
            return True
        if lowered in _FALSE_STRINGS:
            return False
        _warn(f"{fname}: {key}: {value!r} is not a boolean; falling back to default. Use unquoted true/false.")
        return None
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    _warn(f"{fname}: {key}: {value!r} is not a boolean; falling back to default.")
    return None


def _is_number(value: Any) -> bool:
    """True for int/float (bool excluded) values usable as thresholds (#95)."""
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, str):
        try:
            float(value.strip())
            return True
        except (ValueError, AttributeError):
            return False
    return False


def _load_yaml(path: str) -> Optional[Dict[str, Any]]:
    if not os.path.isfile(path):
        return None
    try:
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return None

# Keys that existed in older releases but are no longer consumed anywhere (#93).
# Loading them silently would give users a false sense of configuration control,
# so we warn instead of pretending to honor them.
_DEPRECATED_CONFIG_KEYS = ("ci_fail_level", "cache", "scheduler")

def get_run_config(repo_root: str = ".") -> Dict[str, Any]:
    """
    Load run config from repo_root. Prefer .diffsense.yaml, then diffsense-ignore.yaml.
    Returns dict with keys: profile, auto_tune, rule_quality, pro_rules_path, dependency_versions.
    Missing keys are absent (caller uses own defaults).
    """
    out: Dict[str, Any] = {}
    # #107: the pre-2.2 config file was silently ignored after the rename to
    # .diffsense.yaml; warn so users know their settings are not being applied.
    for _legacy in ("diffsense.config.json", ".diffsense.config.json"):
        legacy_path = os.path.join(repo_root, _legacy)
        if os.path.isfile(legacy_path):
            _warn(
                f"Found legacy config file '{_legacy}' which is no longer read since 2.2. "
                f"Migrate its settings to .diffsense.yaml (issue #107)."
            )
    for fname in (".diffsense.yaml", "diffsense-ignore.yaml"):
        path = os.path.join(repo_root, fname)
        data = _load_yaml(path)
        if not data:
            continue
        for dep_key in _DEPRECATED_CONFIG_KEYS:
            if dep_key in data:
                _warn(
                    f"{fname}: '{dep_key}' is no longer a supported config key and is ignored "
                    f"(see issue #93). Remove it from {fname}."
                )
        if data.get("profile") is not None:
            profile_val = str(data["profile"]).strip()
            # Unknown profile names would fail deep inside the rules engine with
            # an unclear error; warn and ignore them here (#95).
            if profile_val in ("lightweight", "standard", "strict"):
                out["profile"] = profile_val or None
            else:
                _warn(
                    f"{fname}: profile: {data['profile']!r} is not a valid profile "
                    f"(expected lightweight/standard/strict); ignoring it (#95)"
                )
        if data.get("auto_tune") is not None:
            coerced = _coerce_bool(data["auto_tune"], "auto_tune", fname)
            if coerced is not None:
                out["auto_tune"] = coerced
        rq = data.get("rule_quality")
        if isinstance(rq, dict):
            rq_clean = dict(rq)
            # rule_quality thresholds must be numeric; warn and drop invalid
            # values instead of letting them blow up at engine init (#95).
            for rq_key in ("degrade_threshold", "disable_threshold", "min_samples"):
                if rq_key in rq_clean and not _is_number(rq_clean[rq_key]):
                    _warn(f"{fname}: rule_quality.{rq_key}: {rq_clean[rq_key]!r} is not a number; ignoring it (#95)")
                    rq_clean.pop(rq_key)
            if rq_clean:
                out["rule_quality"] = rq_clean
        elif rq is not None:
            _warn(f"{fname}: rule_quality: {rq!r} is not a mapping; ignoring it (#95)")
        if data.get("pro_rules_path") is not None:
            out["pro_rules_path"] = str(data["pro_rules_path"]).strip() or None
        if isinstance(data.get("dependency_versions"), dict):
            # 用户配置的依赖版本，用于 CVE 规则精确匹配：ecosystem -> package_name -> version
            # 例如: dependency_versions: { npm: { lodash: "4.17.21" }, maven: { "org.apache.tomcat:tomcat-catalina": "9.0.72" } }
            out["dependency_versions"] = {k: dict(v) for k, v in data["dependency_versions"].items() if isinstance(v, dict)}
        break
    return out


def get_pro_rules_path(cwd: Optional[str] = None) -> Optional[str]:
    """
    解析 PRO 规则（超级规则）目录路径，供正式 audit/main 加载。
    优先级: 环境变量 DIFFSENSE_PRO_RULES > 仓库 .diffsense.yaml 的 pro_rules_path >
            相对 diffsense 包上级的 pro-rules（开发/同仓部署）。
    仅当路径存在时返回，否则返回 None。
    """
    cwd = cwd or os.getcwd()
    # 1. 环境变量
    env_path = os.environ.get("DIFFSENSE_PRO_RULES", "").strip()
    if env_path and os.path.isdir(env_path):
        return os.path.normpath(env_path)
    # 2. 仓库配置
    run_cfg = get_run_config(cwd)
    cfg_path = run_cfg.get("pro_rules_path")
    if cfg_path and os.path.isdir(os.path.normpath(cfg_path)):
        return os.path.normpath(cfg_path)
    if cfg_path:
        abs_cfg = os.path.normpath(os.path.join(cwd, cfg_path))
        if os.path.isdir(abs_cfg):
            return abs_cfg
    # 3. 默认：与 diffsense 包同级的 pro-rules（源码/同仓）
    try:
        import diffsense
        base = Path(diffsense.__file__).resolve().parent.parent
    except Exception:
        base = Path(__file__).resolve().parent.parent.parent
    default = base / "pro-rules"
    if default.is_dir():
        return str(default)
    return None
