"""DiffSense MCP server (read-only thin shell).

Exposes the DiffSense audit engine over the Model Context Protocol using the
official ``mcp`` SDK and stdio transport. Install/run with::

    pip install "diffsense[mcp]"
    diffsense-mcp

Tools (all read-only; thin wrappers over existing DiffSense capabilities):

- ``audit_diff``   run the audit pipeline on a raw diff text (no disk writes)
- ``audit_replay`` run the audit pipeline on a local .diff file path
- ``list_rules``   list loaded rule metadata (built-in + YAML + pro)
- ``explain_rule`` describe a single rule by id

``record_feedback`` is intentionally deferred to a later batch; nothing in this
server mutates the repo, the rules engine, or any report artifacts.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

from mcp.server.mcpserver import MCPServer

from cli import _default_rules_path

mcp = MCPServer("diffsense")


def _resolve_rules_path(rules: Optional[str]) -> str:
    """Resolve --rules-ish argument the same way the CLI does."""
    if rules and os.path.exists(rules):
        return rules
    return _default_rules_path()


def _list_rules_core(rules: Optional[str], profile: Optional[str]) -> List[Dict[str, Any]]:
    from core.rules import RuleEngine

    path = _resolve_rules_path(rules)
    pro_path = None
    try:
        from core.run_config import get_pro_rules_path
        pro_path = get_pro_rules_path(os.getcwd())
    except Exception:
        pass
    engine = RuleEngine(path, profile=profile, pro_rules_path=pro_path)
    rows = []
    for r in engine.rules:
        rows.append(
            {
                "id": _attr(r, "id"),
                "severity": _attr(r, "severity"),
                "impact": _attr(r, "impact"),
                "status": _attr(r, "status"),
                "is_blocking": _attr(r, "is_blocking"),
                "rule_type": _attr(r, "rule_type"),
            }
        )
    return rows


def _attr(rule: Any, name: str, default: Any = "") -> Any:
    try:
        return getattr(rule, name, default)
    except Exception:
        return default


@mcp.tool()
def audit_diff(diff: str, rules: str = "", profile: str = "") -> str:
    """Run a DiffSense audit on the given diff text and return the JSON report.

    Args:
        diff: Unified git diff content (e.g. the body of a MR/PR diff).
        rules: Optional path to rules (single YAML file or directory). Empty = built-in defaults.
        profile: Optional profile filter (strict | lightweight). Empty = default profile.

    Returns:
        JSON report: schema_version, review_level, details, _metrics, _performance.
    """
    from main import analyze_diff

    try:
        result = analyze_diff(
            diff,
            _resolve_rules_path(rules),
            profile=profile or None,
            write_files=False,
        )
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:  # thin shell: surface errors as JSON, never crash the server
        return json.dumps({"schema_version": "1.0", "error": str(e), "review_level": "error", "details": []})


@mcp.tool()
def audit_replay(diff_path: str, rules: str = "", profile: str = "") -> str:
    """Run a DiffSense audit on a local .diff file and return the JSON report (offline replay).

    Args:
        diff_path: Path to a unified diff file (read-only access).
        rules: Optional path to rules (single YAML file or directory). Empty = built-in defaults.
        profile: Optional profile filter (strict | lightweight). Empty = default profile.

    Returns:
        JSON report: schema_version, review_level, details, _metrics, _performance.
    """
    from main import analyze_diff

    try:
        with open(diff_path, "r", encoding="utf-8") as f:
            diff = f.read()
        result = analyze_diff(
            diff,
            _resolve_rules_path(rules),
            profile=profile or None,
            write_files=False,
        )
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"schema_version": "1.0", "error": str(e), "review_level": "error", "details": []})


@mcp.tool()
def list_rules(rules: str = "", profile: str = "") -> str:
    """List loaded DiffSense rules (built-in + YAML) with their metadata.

    Args:
        rules: Optional path to rules (single YAML file or directory). Empty = built-in defaults.
        profile: Optional profile filter (strict | lightweight). Empty = default profile.

    Returns:
        JSON array of rules: id, severity, impact, status, is_blocking, rule_type.
    """
    try:
        return json.dumps(_list_rules_core(rules or None, profile or None), ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def explain_rule(rule_id: str, rules: str = "", profile: str = "") -> str:
    """Explain a single DiffSense rule by id.

    Args:
        rule_id: Rule id, e.g. "runtime.concurrency.lock_removed".
        rules: Optional path to rules (single YAML file or directory). Empty = built-in defaults.
        profile: Optional profile filter (strict | lightweight). Empty = default profile.

    Returns:
        JSON object with the rule's metadata and rationale (or an error object).
    """
    try:
        from core.rules import RuleEngine

        path = _resolve_rules_path(rules)
        pro_path = None
        try:
            from core.run_config import get_pro_rules_path
            pro_path = get_pro_rules_path(os.getcwd())
        except Exception:
            pass
        engine = RuleEngine(path, profile=profile or None, pro_rules_path=pro_path)
        for r in engine.rules:
            if _attr(r, "id") == rule_id:
                detail = {
                    "id": _attr(r, "id"),
                    "severity": _attr(r, "severity"),
                    "impact": _attr(r, "impact"),
                    "status": _attr(r, "status"),
                    "is_blocking": _attr(r, "is_blocking"),
                    "rule_type": _attr(r, "rule_type"),
                    "rationale": _attr(r, "rationale"),
                }
                return json.dumps(detail, ensure_ascii=False, indent=2)
        return json.dumps({"error": f"rule not found: {rule_id}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


def main() -> None:
    """Entry point for the ``diffsense-mcp`` console script (stdio transport)."""
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()