"""Golden contract tests (spec D6 / phase 5).

Every file under ``tests/goldens/`` is a checked-in, static machine-readable
sample of the DiffSense agent surface. These tests pin the samples to the
normative contracts:

- ``json/*.json`` — JSON reports (audit-report.schema.json + docs/cli-contract.md §3);
- ``sarif/*.sarif.json`` — SARIF 2.1.0 logs (docs/cli-contract.md §5).

Unlike unit tests that regenerate output at runtime, these fixtures are the
stable "golden" baseline consumers may diff against.
"""

import json
from pathlib import Path

import jsonschema
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
GOLDENS = REPO_ROOT / "tests" / "goldens"
SCHEMA = REPO_ROOT / "schemas" / "audit-report.schema.json"


def load_schema() -> dict:
    with open(SCHEMA, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def schema() -> dict:
    return load_schema()


def all_golden_json() -> list[Path]:
    return sorted((GOLDENS / "json").glob("*.json"))


def all_golden_sarif() -> list[Path]:
    return sorted((GOLDENS / "sarif").glob("*.sarif.json"))


def test_goldens_are_parseable_json() -> None:
    for p in (*all_golden_json(), *all_golden_sarif()):
        json.loads(p.read_text(encoding="utf-8"))


def test_valid_report_golden_has_schema_version_first(schema: dict) -> None:
    data = json.loads((GOLDENS / "json" / "report-valid.json").read_text(encoding="utf-8"))
    assert list(data.keys())[0] == "schema_version"
    assert data["schema_version"] == "1.0"
    jsonschema.validate(data, schema)


def test_valid_report_golden_drops_private_telemetry() -> None:
    """Private '_'-prefixed fields are out of contract and must not appear in goldens."""
    data = json.loads((GOLDENS / "json" / "report-valid.json").read_text(encoding="utf-8"))
    assert not any(k.startswith("_") for k in data), "golden sample leaked private telemetry"


def test_invalid_report_golden_is_rejected(schema: dict) -> None:
    data = json.loads((GOLDENS / "json" / "invalid-report.json").read_text(encoding="utf-8"))
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(data, schema)


@pytest.mark.parametrize("path", ["sarif/lock_removal.sarif.json", "sarif/low_risk.sarif.json"])
def test_sarif_goldens_conform_to_section5(path, schema: dict) -> None:
    doc = json.loads((GOLDENS / path).read_text(encoding="utf-8"))
    assert doc["version"] == "2.1.0"
    assert len(doc["runs"]) == 1
    run = doc["runs"][0]
    assert run["tool"]["driver"]["name"] == "DiffSense"
    results = run["results"]
    assert any(r.get("ruleId") == "diffsense/review_level" for r in results), "review_level result missing"
    for r in results:
        assert r.get("ruleId", "").startswith("diffsense/"), r.get("ruleId")
        assert r["level"] in ("error", "warning", "note")
        if r["ruleId"] == "diffsense/review_level":
            assert r["properties"]["review_level"] in ("normal", "low", "critical", "elevated")
            assert "blocked" in r["properties"]