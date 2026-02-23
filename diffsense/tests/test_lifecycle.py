"""Tests for lifecycle integration in RuleEngine (status: disabled/deprecated)."""
import os
import tempfile
import unittest

from diffsense.core.rules import RuleEngine


class TestLifecycleInRuleEngine(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.tmp_path = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def _write_yaml(self, path: str, content: str):
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def test_status_disabled_rule_not_evaluated(self):
        yaml_path = os.path.join(self.tmp_path, "r.yaml")
        self._write_yaml(
            yaml_path,
            """
rules:
  - id: stable.rule
    severity: high
    impact: runtime
    rationale: run
    file: "**"
    status: stable
  - id: disabled.rule
    severity: critical
    impact: runtime
    rationale: should not run
    file: "**"
    status: disabled
"""
        )
        engine = RuleEngine(yaml_path)
        diff_data = {"files": ["x.java"], "raw_diff": ""}
        triggered = engine.evaluate(diff_data, [])
        ids = [t["id"] for t in triggered]
        self.assertIn("stable.rule", ids)
        self.assertNotIn("disabled.rule", ids)

    def test_status_deprecated_severity_downgraded_to_low(self):
        yaml_path = os.path.join(self.tmp_path, "r.yaml")
        self._write_yaml(
            yaml_path,
            """
rules:
  - id: deprecated.rule
    severity: high
    impact: runtime
    rationale: deprecated
    file: "**"
    status: deprecated
"""
        )
        engine = RuleEngine(yaml_path)
        diff_data = {"files": ["x.java"], "raw_diff": ""}
        triggered = engine.evaluate(diff_data, [])
        self.assertEqual(len(triggered), 1)
        self.assertEqual(triggered[0]["id"], "deprecated.rule")
        self.assertEqual(triggered[0]["severity"], "low")

    def test_config_override_disabled_by_id(self):
        yaml_path = os.path.join(self.tmp_path, "r.yaml")
        self._write_yaml(
            yaml_path,
            """
rules:
  - id: overridable.rule
    severity: high
    impact: runtime
    rationale: can be turned off by config
    file: "**"
"""
        )
        config = {"overridable.rule": {"enabled": False}}
        engine = RuleEngine(yaml_path, config=config)
        diff_data = {"files": ["x.java"], "raw_diff": ""}
        triggered = engine.evaluate(diff_data, [])
        ids = [t["id"] for t in triggered]
        self.assertNotIn("overridable.rule", ids)


if __name__ == "__main__":
    unittest.main()
