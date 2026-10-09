"""SARIF 2.1.0 output for DiffSense audit reports.

Phase 3 of the agent-surface design (docs/superpowers/specs/2026-10-09-agent-surface-design.md).

Maps the machine-readable JSON audit report to SARIF 2.1.0 per contract D5:

- Each finding becomes a result with ``ruleId`` prefixed by ``diffsense/``.
- Severity maps to SARIF level: critical|high -> error, medium -> warning, low -> note.
- An extra ``diffsense/review_level`` result carries the overall verdict: its
  ``properties.review_level`` is the composed level and ``properties.blocked``
  states whether the report blocks the merge (critical only, matching EXIT_RISK).

The output is intentionally lossless for the fields agents care about
(ruleId, level, message, location uri, severity, impact, precision) while
leaving out private telemetry keys (``_metrics`` and friends).
"""

from typing import Any, Dict, List

# SARIF 2.1.0 log schema (schema store is the stable published location).
SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json"
SARIF_VERSION = "2.1.0"

# Contract D5: severity -> SARIF level.
SEVERITY_TO_LEVEL: Dict[str, str] = {
    "critical": "error",
    "high": "error",
    "medium": "warning",
    "low": "note",
}
DEFAULT_LEVEL = "note"

# DiffSense JSON report review levels that block the merge (matches EXIT_RISK).
BLOCKING_REVIEW_LEVELS = ("critical",)

REVIEW_LEVEL_PROPERTY = "diffsense/review_level"


def severity_to_level(severity: Any) -> str:
    """Map a DiffSense severity string to a SARIF 2.1.0 level."""
    if not isinstance(severity, str):
        return DEFAULT_LEVEL
    return SEVERITY_TO_LEVEL.get(severity.lower().strip(), DEFAULT_LEVEL)


def _detail_rule_id(detail: Dict[str, Any]) -> str:
    return detail.get("rule_id") or detail.get("id") or "unknown"


def _detail_severity(detail: Dict[str, Any]) -> str:
    return detail.get("severity") or "unknown"


def _detail_message(detail: Dict[str, Any]) -> str:
    return detail.get("rationale") or detail.get("message") or detail.get("title") or _detail_rule_id(detail)


def _detail_uri(detail: Dict[str, Any]) -> str:
    return detail.get("file") or detail.get("matched_file") or ""


def _blocked_for(review_level: Any) -> bool:
    return str(review_level).lower().strip() in BLOCKING_REVIEW_LEVELS


def _review_level_level(review_level: Any) -> str:
    """Map the overall review level to a SARIF level.

    critical blocks (error), elevated is a warning, normal/low are informational.
    """
    rl = str(review_level).lower().strip()
    if rl in BLOCKING_REVIEW_LEVELS:
        return "error"
    if rl == "elevated":
        return "warning"
    return "note"


def _confidence(result: Dict[str, Any]) -> Any:
    meta = result.get("meta") or {}
    return meta.get("confidence")


def findings_to_results(details: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert report details into SARIF results (one result per finding)."""
    results: List[Dict[str, Any]] = []
    for detail in details or []:
        if not isinstance(detail, dict):
            continue
        uri = _detail_uri(detail)
        location: Dict[str, Any] = {}
        if uri:
            location = {
                "physicalLocation": {
                    "artifactLocation": {"uri": uri},
                }
            }
        results.append({
            "ruleId": f"diffsense/{_detail_rule_id(detail)}",
            "level": severity_to_level(_detail_severity(detail)),
            "message": {"text": _detail_message(detail)},
            "locations": [location] if location else [],
            "properties": {
                "ruleId": _detail_rule_id(detail),
                "severity": _detail_severity(detail),
                "impact": detail.get("impact"),
                "precision": detail.get("precision"),
            },
        })
    return results


def review_level_result(result: Dict[str, Any]) -> Dict[str, Any]:
    """Build the extra ``diffsense/review_level`` result carrying the verdict."""
    review_level = result.get("review_level", "normal")
    blocked = _blocked_for(review_level)
    return {
        "ruleId": REVIEW_LEVEL_PROPERTY,
        "level": _review_level_level(review_level),
        "message": {"text": f"Overall review level: {review_level}"},
        "properties": {
            "review_level": review_level,
            "confidence": _confidence(result),
            "blocked": blocked,
        },
    }


def _rule_descriptors(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rules: Dict[str, str] = {}
    for r in results:
        rule_id = r["ruleId"]
        message = r.get("message", {}).get("text", rule_id)
        rules.setdefault(rule_id, message)
    return [
        {"id": rule_id, "shortDescription": {"text": message}}
        for rule_id, message in sorted(rules.items())
    ]


def build_sarif_report(result: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a DiffSense JSON audit report into a SARIF 2.1.0 log object."""
    details = result.get("details") or []
    findings = findings_to_results(details if isinstance(details, list) else [])
    reviews = [review_level_result(result)] if result.get("review_level") else []

    runs = [
        {
            "tool": {
                "driver": {
                    "name": "DiffSense",
                    "informationUri": "https://github.com/GoldenSupremeSaltedFish/DiffSense",
                    "rules": _rule_descriptors(findings + reviews),
                }
            },
            "results": findings + reviews,
            "properties": {
                "review_level": result.get("review_level", "normal"),
                "confidence": _confidence(result),
                "blocked": _blocked_for(result.get("review_level", "normal")),
            },
        }
    ]
    return {
        "$schema": SARIF_SCHEMA,
        "version": SARIF_VERSION,
        "runs": runs,
    }