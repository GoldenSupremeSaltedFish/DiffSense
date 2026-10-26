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
from mcp_types import ToolAnnotations

from cli import _default_rules_path
from sarif import _tool_version


def _build_annotations() -> ToolAnnotations:
    """#123: every tool is a read-only, repeatable query against a fixed corpus."""
    return ToolAnnotations(readOnlyHint=True, idempotentHint=True, openWorldHint=False)


# #126: advertise the package version so MCP clients can identify the server build.
mcp = MCPServer("diffsense", version=_tool_version())


# #153/#154: audit_replay only accepts diff files with these extensions.
_DIFF_FILE_EXTENSIONS = {".diff", ".patch"}


def _allowed_roots() -> List[str]:
    """#153/#154: absolute roots a user-supplied path may resolve inside.

    Defaults to the MCP server working directory (the audited project). Operators
    can widen it with DIFFSENSE_MCP_ALLOWED_ROOTS (os.pathsep-separated list).
    """
    roots = [os.path.realpath(os.getcwd())]
    extra = os.environ.get("DIFFSENSE_MCP_ALLOWED_ROOTS", "")
    for part in extra.split(os.pathsep):
        if part.strip():
            roots.append(os.path.realpath(os.path.expanduser(part.strip())))
    return roots


def _assert_within_allowed_roots(real: str, what: str) -> None:
    """#153/#154: reject paths resolving outside every allowed root (traversal guard)."""
    import contextlib

    for root in _allowed_roots():
        with contextlib.suppress(ValueError):
            if os.path.commonpath([real, root]) == root:
                return
    raise ValueError(
        f"{what} resolves outside the allowed roots "
        f"({'; '.join(_allowed_roots())}): {real!r}. "
        "Set DIFFSENSE_MCP_ALLOWED_ROOTS to add trusted directories (#153/#154)."
    )


def _resolve_rules_path(rules: Optional[str]) -> str:
    """Resolve --rules-ish argument the same way the CLI does.

    #127: an explicitly provided rules path that does not exist is a hard error
    (surfaced as a tool error, see #124) instead of a silent fallback to the
    built-in defaults, which used to hide typos and wrong mounts.
    #154: an explicitly provided rules path must also stay inside the allowed
    roots — a remote MCP client must not be able to load rule definitions from
    arbitrary filesystem locations.
    """
    if rules:
        if os.path.exists(rules):
            real = os.path.realpath(os.path.expanduser(rules))
            _assert_within_allowed_roots(real, "rules path")
            return real
        raise ValueError(f"rules path does not exist: {rules!r}")
    return _default_rules_path()


def _validate_diff_file_path(diff_path: str) -> str:
    """#153/#154: audit_replay input hardening.

    Rejects empty paths, non-files, anything not carrying a diff/patch
    extension, and paths that resolve outside the allowed roots, so a bare
    directory, an unrelated file, or ``..\..\..\Windows\win.ini`` is never
    silently parsed as a diff.
    """
    if not diff_path or not diff_path.strip():
        raise ValueError("diff_path must be a non-empty path to a .diff/.patch file")
    real = os.path.realpath(os.path.expanduser(diff_path))
    _assert_within_allowed_roots(real, "diff_path")
    if not os.path.exists(real):
        raise ValueError(f"diff_path does not exist: {diff_path!r}")
    if not os.path.isfile(real):
        raise ValueError(f"diff_path is not a file: {diff_path!r}")
    if os.path.splitext(real)[1].lower() not in _DIFF_FILE_EXTENSIONS:
        raise ValueError(
            f"diff_path must point to a .diff or .patch file, got: {os.path.splitext(real)[1]!r}"
        )
    return real


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
        lang = _attr(r, "language")
        # #91: expose name/language/platform. DiffSense has no separate
        # "platform" dimension; the target language IS the platform (e.g. go,
        # java, typescript). "*" means language-agnostic.
        rows.append(
            {
                "id": _attr(r, "id"),
                "name": _attr(r, "title"),
                "language": lang,
                "platform": "" if lang in ("", "*") else lang,
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


@mcp.tool(annotations=_build_annotations())
def audit_diff(diff: str, rules: str = "", profile: str = "") -> str:
    """Run a DiffSense audit on the given diff text and return the JSON report.

    Args:
        diff: Unified git diff content (e.g. the body of a MR/PR diff). Must be non-empty.
        rules: Optional path to rules (single YAML file or directory). Empty = built-in defaults.
        profile: Optional profile filter (strict | lightweight). Empty = default profile.

    Returns:
        JSON report: schema_version, review_level, details, _metrics, _performance.

    Raises:
        ValueError: #125 when ``diff`` is empty/whitespace; #127 when ``rules`` points
            to a non-existent path. The MCP SDK converts these into tool errors
            (``isError=true``) so agents can distinguish failures from clean reports (#124).
    """
    from main import analyze_diff

    if not diff or not diff.strip():
        raise ValueError("diff is empty: provide the unified diff text to audit")
    result = analyze_diff(
        diff,
        _resolve_rules_path(rules),
        profile=profile or None,
        write_files=False,
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool(annotations=_build_annotations())
def audit_replay(diff_path: str, rules: str = "", profile: str = "") -> str:
    """Run a DiffSense audit on a local .diff file and return the JSON report (offline replay).

    Args:
        diff_path: Path to a unified diff file (``.diff``/``.patch``, read-only access).
        rules: Optional path to rules (single YAML file or directory). Empty = built-in defaults.
        profile: Optional profile filter (strict | lightweight). Empty = default profile.

    Returns:
        JSON report: schema_version, review_level, details, _metrics, _performance.

    Raises:
        ValueError: #153/#154 when ``diff_path`` is missing, not a file, or lacks a
            .diff/.patch extension; #127 when ``rules`` points to a non-existent path.
            The MCP SDK surfaces these as tool errors (``isError=true``) (#124).
    """
    from main import analyze_diff

    real = _validate_diff_file_path(diff_path)
    with open(real, "r", encoding="utf-8") as f:
        diff = f.read()
    if not diff.strip():
        # #125: an empty file is an input error, not a clean "no findings" report.
        raise ValueError(f"diff file is empty: {diff_path!r}")
    result = analyze_diff(
        diff,
        _resolve_rules_path(rules),
        profile=profile or None,
        write_files=False,
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool(annotations=_build_annotations())
def list_rules(rules: str = "", profile: str = "") -> str:
    """List loaded DiffSense rules (built-in + YAML) with their metadata.

    Args:
        rules: Optional path to rules (single YAML file or directory). Empty = built-in defaults.
        profile: Optional profile filter (strict | lightweight). Empty = default profile.

    Returns:
        JSON array of rules: id, name, language, platform, severity, impact,
        status, is_blocking, rule_type (#91).

    Raises:
        ValueError: #127 when ``rules`` points to a non-existent path (tool error, #124).
    """
    return json.dumps(_list_rules_core(rules or None, profile or None), ensure_ascii=False, indent=2)


@mcp.tool(annotations=_build_annotations())
def explain_rule(rule_id: str, rules: str = "", profile: str = "") -> str:
    """Explain a single DiffSense rule by id.

    Args:
        rule_id: Rule id, e.g. "runtime.concurrency.lock_removed".
        rules: Optional path to rules (single YAML file or directory). Empty = built-in defaults.
        profile: Optional profile filter (strict | lightweight). Empty = default profile.

    Returns:
        JSON object with the rule's metadata and rationale.

    Raises:
        LookupError: #124 when ``rule_id`` matches no loaded rule (tool error instead
            of a JSON ``{"error": ...}`` payload).
        ValueError: #127 when ``rules`` points to a non-existent path.
    """
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
    raise LookupError(f"rule not found: {rule_id}")


def main() -> None:
    """Entry point for the ``diffsense-mcp`` console script (stdio transport)."""
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()