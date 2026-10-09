"""Contract tests for the DiffSense machine-readable report (docs/cli-contract.md).

Covered guarantees:
1. audit/replay JSON reports carry schema_version as the first field;
2. reports validate against schemas/audit-report.schema.json (draft 2020-12);
3. exit codes are exactly 0 (pass) / 1 (blocked) / 2 (tool error);
4. the schema itself is valid and rejects incomplete reports.
"""

import json
import subprocess
import sys
from pathlib import Path

import jsonschema
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA = REPO_ROOT / "schemas" / "audit-report.schema.json"
FIXTURES = REPO_ROOT / "tests" / "fixtures"

LOW_RISK_DIFF = FIXTURES / "misc" / "low_risk.diff"
CRITICAL_DIFF = FIXTURES / "ast_cases" / "critical" / "lock_removal.diff"


def load_schema() -> dict:
    with open(SCHEMA, "r", encoding="utf-8") as f:
        return json.load(f)


def run_main(diff: Path, report_json: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "main.py", str(diff), "--report-json", str(report_json)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=180,
    )


def read_report(report_json: Path) -> dict:
    with open(report_json, "r", encoding="utf-8") as f:
        return json.load(f)


def test_schema_is_valid_draft2020_12() -> None:
    jsonschema.Draft202012Validator.check_schema(load_schema())


def test_report_has_schema_version_first_and_validates(tmp_path) -> None:
    report = tmp_path / "report.json"
    proc = run_main(LOW_RISK_DIFF, report)
    assert proc.returncode == 0
    data = read_report(report)
    assert list(data.keys())[0] == "schema_version"
    assert data["schema_version"] == "1.0"
    jsonschema.validate(data, load_schema())


def test_exit_zero_on_low_risk(tmp_path) -> None:
    proc = run_main(LOW_RISK_DIFF, tmp_path / "low.json")
    assert proc.returncode == 0
    assert read_report(tmp_path / "low.json")["review_level"] in ("normal", "low")


def test_exit_one_on_blocked_critical(tmp_path) -> None:
    report = tmp_path / "critical.json"
    proc = run_main(CRITICAL_DIFF, report)
    assert proc.returncode == 1
    data = read_report(report)
    assert data["review_level"] == "critical"
    assert data["meta"]["suggested_action"] == "block_pr"
    jsonschema.validate(data, load_schema())


def test_exit_two_on_missing_diff(tmp_path) -> None:
    missing = tmp_path / "no_such.diff"
    proc = run_main(missing, tmp_path / "missing.json")
    assert proc.returncode == 2


def test_schema_rejects_report_without_schema_version() -> None:
    data = {"review_level": "normal", "details": []}
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(data, load_schema())


def test_schema_allows_private_underscore_fields() -> None:
    """Forward-compat guarantee: private fields must never break consumers."""
    data = {
        "schema_version": "1.0",
        "review_level": "normal",
        "details": [],
        "_metrics": {"anything": True},
        "_rule_quality": {"future": "shape"},
    }
    jsonschema.validate(data, load_schema())