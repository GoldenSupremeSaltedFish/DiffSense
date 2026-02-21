"""Tests for profile (strict vs lightweight). Uses only temp dirs."""
import os
import tempfile
import unittest

from diffsense.core.rules import RuleEngine


class TestProfile(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.tmp_path = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def _write_yaml(self, path: str, content: str):
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def test_lightweight_only_critical_rules_active(self):
        yaml_path = os.path.join(self.tmp_path, "r.yaml")
        self._write_yaml(
            yaml_path,
            """
rules:
  - id: crit.rule
    severity: critical
    impact: runtime
    rationale: c
    file: "**"
  - id: high.rule
    severity: high
    impact: runtime
    rationale: h
    file: "**"
"""
        )
        engine_none = RuleEngine(yaml_path, profile=None)
        engine_strict = RuleEngine(yaml_path, profile="strict")
        engine_light = RuleEngine(yaml_path, profile="lightweight")

        ids_none = [r.id for r in engine_none.rules]
        ids_strict = [r.id for r in engine_strict.rules]
        ids_light = [r.id for r in engine_light.rules]

        self.assertIn("crit.rule", ids_none)
        self.assertIn("high.rule", ids_none)
        self.assertIn("crit.rule", ids_strict)
        self.assertIn("high.rule", ids_strict)
        self.assertIn("crit.rule", ids_light)
        self.assertNotIn("high.rule", ids_light)

    def test_evaluate_lightweight_only_triggers_critical(self):
        yaml_path = os.path.join(self.tmp_path, "r.yaml")
        self._write_yaml(
            yaml_path,
            """
rules:
  - id: crit.rule
    severity: critical
    impact: runtime
    rationale: c
    file: "**"
  - id: high.rule
    severity: high
    impact: runtime
    rationale: h
    file: "**"
"""
        )
        diff_data = {"files": ["x.java"], "raw_diff": ""}
        engine_full = RuleEngine(yaml_path, profile=None)
        engine_light = RuleEngine(yaml_path, profile="lightweight")

        triggered_full = engine_full.evaluate(diff_data, [])
        triggered_light = engine_light.evaluate(diff_data, [])

        self.assertGreater(len(triggered_full), 0)
        self.assertGreater(len(triggered_light), 0)
        for t in triggered_light:
            self.assertEqual(t["severity"], "critical")


if __name__ == "__main__":
    unittest.main()
