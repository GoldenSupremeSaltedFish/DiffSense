"""
Load run config from repo .diffsense.yaml or diffsense-ignore.yaml.
Used as defaults for profile, auto_tune, ci_fail_level, cache, scheduler, rule_quality.
CLI / main / run_audit override these with explicit args when provided.
Also resolves pro_rules_path (super rules) for formal DiffSense runs.
"""
import os
from pathlib import Path
from typing import Dict, Any, Optional

def _load_yaml(path: str) -> Optional[Dict[str, Any]]:
    if not os.path.isfile(path):
        return None
    try:
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return None

def get_run_config(repo_root: str = ".") -> Dict[str, Any]:
    """
    Load run config from repo_root. Prefer .diffsense.yaml, then diffsense-ignore.yaml.
    Returns dict with keys: profile, auto_tune, ci_fail_level, cache, scheduler, rule_quality.
    Missing keys are absent (caller uses own defaults).
    """
    out: Dict[str, Any] = {}
    for fname in (".diffsense.yaml", "diffsense-ignore.yaml"):
        path = os.path.join(repo_root, fname)
        data = _load_yaml(path)
        if not data:
            continue
        if data.get("profile") is not None:
            out["profile"] = str(data["profile"]).strip() or None
        if data.get("auto_tune") is not None:
            out["auto_tune"] = bool(data["auto_tune"])
        if data.get("ci_fail_level") is not None:
            out["ci_fail_level"] = str(data["ci_fail_level"]).strip() or None
        if data.get("cache") is not None:
            out["cache"] = bool(data["cache"])
        if data.get("scheduler") is not None:
            out["scheduler"] = bool(data["scheduler"])
        if isinstance(data.get("rule_quality"), dict):
            out["rule_quality"] = dict(data["rule_quality"])
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
