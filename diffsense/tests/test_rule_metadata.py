"""Tests for rule metadata (category, enabled, tags) and enabled filtering. Uses only temp dirs."""
import os
import tempfile
import unittest

from diffsense.core.rules import RuleEngine
from diffsense.rules.yaml_adapter import YamlRule


class TestRuleMetadata(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.tmp_path = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def _write_yaml(self, path: str, content: str):
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def test_yaml_rule_has_category_and_tags(self):
        yaml_path = os.path.join(self.tmp_path, "r.yaml")
        self._write_yaml(
            yaml_path,
            """
rules:
  - id: test.meta.rule
    category: concurrency
    severity: high
    impact: runtime
    rationale: test
    tags: [p0, concurrency]
    enabled: true
    file: "**"
"""
        )
        engine = RuleEngine(yaml_path)
        yaml_rules = [r for r in engine.rules if r.id == "test.meta.rule"]
        self.assertEqual(len(yaml_rules), 1)
        self.assertEqual(yaml_rules[0].category, "concurrency")
        self.assertEqual(yaml_rules[0].tags, ["p0", "concurrency"])
        self.assertTrue(yaml_rules[0].enabled)

    def test_enabled_false_rule_not_evaluated(self):
        yaml_path = os.path.join(self.tmp_path, "r.yaml")
        self._write_yaml(
            yaml_path,
            """
rules:
  - id: test.enabled.rule
    severity: high
    impact: runtime
    rationale: should trigger
    file: "**"
    enabled: true
  - id: test.disabled.rule
    severity: critical
    impact: runtime
    rationale: should not trigger
    file: "**"
    enabled: false
"""
        )
        engine = RuleEngine(yaml_path)
        diff_data = {"files": ["foo.java"], "raw_diff": ""}
        triggered = engine.evaluate(diff_data, [])
        ids_triggered = [t["id"] for t in triggered]
        self.assertIn("test.enabled.rule", ids_triggered)
        self.assertNotIn("test.disabled.rule", ids_triggered)


if __name__ == "__main__":
    unittest.main()
