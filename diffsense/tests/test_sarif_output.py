"""Tests for SARIF 2.1.0 output (agent-surface phase 3, contract D5).

Covers:
- severity -> SARIF level mapping (critical/high -> error, medium -> warning, low -> note)
- ruleId prefixing (``diffsense/<rule_id>``)
- location uri projection and rule descriptor aggregation
- the extra ``diffsense/review_level`` result (level + blocked semantics)
- end-to-end: ``main.py --format sarif`` emits a single clean SARIF log on stdout
  and matches the checked-in golden for the lock-removal fixture.
"""

import json
import os
import subprocess
import sys

import pytest

from sarif import (
    build_sarif_report,
    findings_to_results,
    review_level_result,
    severity_to_level,
    REVIEW_LEVEL_PROPERTY,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(BASE_DIR)
FIXTURE_CRITICAL = os.path.join(
    BASE_DIR, "fixtures", "ast_cases", "critical", "lock_removal.diff"
)
GOLDEN = os.path.join(BASE_DIR, "goldens", "sarif", "lock_removal.sarif.json")


def _fixture_detail(rule_id, severity, file=None, rationale=None, impact=None, precision=None):
    return {
        "rule_id": rule_id,
        "severity": severity,
        "file": file,
        "rationale": rationale or f"rationale for {rule_id}",
        "impact": impact,
        "precision": precision,
    }


# --- unit: severity mapping (contract D5) ---------------------------------

@pytest.mark.parametrize(
    "severity,expected",
    [
        ("critical", "error"),
        ("high", "error"),
        ("medium", "warning"),
        ("low", "note"),
        ("unknown", "note"),
        (None, "note"),
        ("HIGH", "error"),
        (42, "note"),
    ],
)
def test_severity_to_level(severity, expected):
    assert severity_to_level(severity) == expected


def test_finding_result_shape_and_prefixed_rule_id():
    detail = _fixture_detail(
        "runtime.concurrency.lock_removed",
        "high",
        file="src/Foo.java",
        rationale="lock removed",
        impact="race",
        precision="high",
    )
    results = findings_to_results([detail])
    assert len(results) == 1
    res = results[0]
    assert res["ruleId"] == "diffsense/runtime.concurrency.lock_removed"
    assert res["level"] == "error"
    assert res["message"]["text"] == "lock removed"
    assert res["locations"][0]["physicalLocation"]["artifactLocation"]["uri"] == "src/Foo.java"
    assert res["properties"]["severity"] == "high"
    assert res["properties"]["impact"] == "race"
    assert res["properties"]["precision"] == "high"


def test_finding_without_file_omits_locations():
    results = findings_to_results([_fixture_detail("r1", "low")])
    assert results[0]["locations"] == []


def test_findings_omit_private_telemetry():
    detail = _fixture_detail("r.metric", "medium", file="a.py")
    results = findings_to_results([detail])
    dumped = json.dumps(results)
    assert "_metrics" not in dumped
    assert "_rule_quality" not in dumped


# --- unit: review_level verdict result ------------------------------------

@pytest.mark.parametrize(
    "review_level,expected_level,expected_blocked",
    [
        ("critical", "error", True),
        ("elevated", "warning", False),
        ("normal", "note", False),
        ("low", "note", False),
    ],
)
def test_review_level_result(review_level, expected_level, expected_blocked):
    res = review_level_result({"review_level": review_level, "meta": {"confidence": 0.9}})
    assert res["ruleId"] == REVIEW_LEVEL_PROPERTY
    assert res["level"] == expected_level
    assert res["properties"]["review_level"] == review_level
    assert res["properties"]["blocked"] is expected_blocked
    assert res["properties"]["confidence"] == 0.9


# --- integration: build_sarif_report --------------------------------------

def test_build_sarif_report_structure():
    report = build_sarif_report(
        {
            "review_level": "critical",
            "meta": {"confidence": 0.8, "suggested_action": "block_pr"},
            "details": [
                _fixture_detail("runtime.concurrency.lock_removed", "critical", file="RaftNode.java", rationale="P0"),
                _fixture_detail("style.formatting", "low", file="RaftNode.java", rationale="fmt"),
            ],
        }
    )
    assert report["version"] == "2.1.0"
    assert report["$schema"] == "https://json.schemastore.org/sarif-2.1.0.json"
    run = report["runs"][0]
    rule_ids = [r["ruleId"] for r in run["results"]]
    assert "diffsense/runtime.concurrency.lock_removed" in rule_ids
    assert REVIEW_LEVEL_PROPERTY in rule_ids

    driver_rules = {r["id"] for r in run["tool"]["driver"]["rules"]}
    assert driver_rules == set(rule_ids)
    assert run["tool"]["driver"]["name"] == "DiffSense"

    blocked_result = next(r for r in run["results"] if r["ruleId"] == REVIEW_LEVEL_PROPERTY)
    assert blocked_result["properties"]["blocked"] is True
    assert run["properties"]["blocked"] is True


def test_build_sarif_report_missing_details_is_safe():
    report = build_sarif_report({})
    run = report["runs"][0]
    assert run["results"] == []
    assert run["tool"]["driver"]["rules"] == []
    assert report["version"] == "2.1.0"


def test_build_sarif_report_normal_default_verdict():
    report = build_sarif_report({"review_level": "normal"})
    run = report["runs"][0]
    verdict = run["results"][0]
    assert verdict["ruleId"] == REVIEW_LEVEL_PROPERTY
    assert verdict["level"] == "note"
    assert verdict["properties"]["blocked"] is False


# --- integration: main.py --format sarif on the real CLI -------------------

def test_main_sarif_stdout_is_single_clean_json(monkeypatch):
    golden = json.load(open(GOLDEN, encoding="utf-8"))
    proc = subprocess.run(
        [sys.executable, "main.py", FIXTURE_CRITICAL, "--format", "sarif"],
        cwd=REPO_DIR,
        capture_output=True,
        text=True,
        timeout=180,
    )
    # exit code remains 1 (blocked finding) regardless of format
    assert proc.returncode == 1
    parsed = json.loads(proc.stdout)  # must be a single clean JSON object
    assert parsed["version"] == "2.1.0"
    run = parsed["runs"][0]
    verdict = next(r for r in run["results"] if r["ruleId"] == REVIEW_LEVEL_PROPERTY)
    assert verdict["properties"]["review_level"] == "critical"
    assert verdict["properties"]["blocked"] is True
    assert verdict["level"] == "error"
    assert parsed == golden


def test_main_json_stdout_stays_clean(monkeypatch):
    proc = subprocess.run(
        [sys.executable, "main.py", FIXTURE_CRITICAL, "--format", "json"],
        cwd=REPO_DIR,
        capture_output=True,
        text=True,
        timeout=180,
    )
    parsed = json.loads(proc.stdout)
    assert parsed.get("review_level") == "critical"
    assert len(proc.stdout.strip()) > 0