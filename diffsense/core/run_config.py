"""
Load run config from repo .diffsense.yaml or diffsense-ignore.yaml.
Used as defaults for profile, auto_tune, ci_fail_level, cache, scheduler, rule_quality.
CLI / main / run_audit override these with explicit args when provided.
"""
import os
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
        break
    return out
