"""Tests for loading rules from a directory of YAML files. Uses only temp dirs."""
import os
import tempfile
import unittest

from diffsense.core.rules import RuleEngine


class TestRulesDirectory(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.tmp_path = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def _write_yaml(self, path: str, content: str):
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def test_directory_loads_all_yaml_files(self):
        self._write_yaml(
            os.path.join(self.tmp_path, "a.yaml"),
            """
rules:
  - id: rule.from.a
    severity: low
    impact: runtime
    rationale: a
    file: "**"
"""
        )
        self._write_yaml(
            os.path.join(self.tmp_path, "b.yaml"),
            """
rules:
  - id: rule.from.b
    severity: low
    impact: runtime
    rationale: b
    file: "**"
"""
        )
        engine = RuleEngine(self.tmp_path)
        ids = [r.id for r in engine.rules]
        self.assertIn("rule.from.a", ids)
        self.assertIn("rule.from.b", ids)
        # Built-ins + 2 from YAML
        self.assertGreaterEqual(len(engine.rules), 2)

    def test_single_file_still_works(self):
        single = os.path.join(self.tmp_path, "single.yaml")
        self._write_yaml(
            single,
            """
rules:
  - id: single.file.rule
    severity: low
    impact: runtime
    rationale: x
    file: "**"
"""
        )
        engine = RuleEngine(single)
        self.assertIn("single.file.rule", [r.id for r in engine.rules])


if __name__ == "__main__":
    unittest.main()
