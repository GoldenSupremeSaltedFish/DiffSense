"""Tests for entry_point rule discovery. Mocks importlib.metadata.entry_points."""
import os
import tempfile
import unittest
from unittest.mock import patch, MagicMock

from diffsense.core.rules import RuleEngine
from diffsense.rules.yaml_adapter import YamlRule


class TestEntryPointRules(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.tmp_path = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def _write_yaml(self, path: str, content: str):
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def test_entry_point_returning_list_of_rules_is_loaded(self):
        """When an entry point callable returns List[Rule], those rules are added to the engine."""
        plugin_rule = YamlRule(
            {
                "id": "plugin.rule",
                "severity": "high",
                "impact": "runtime",
                "rationale": "from plugin",
                "file": "**",
            }
        )

        def get_rules():
            return [plugin_rule]

        mock_ep = MagicMock()
        mock_ep.load.return_value = get_rules
        mock_eps = [mock_ep]

        with patch("diffsense.core.rules.entry_points") as mock_entry_points:
            mock_entry_points.return_value = mock_eps

            yaml_path = os.path.join(self.tmp_path, "empty.yaml")
            self._write_yaml(yaml_path, "rules: []\n")
            engine = RuleEngine(yaml_path)

        ids = [r.id for r in engine.rules]
        self.assertIn("plugin.rule", ids)

    def test_entry_point_returning_path_loads_yaml(self):
        """When an entry point callable returns a str path, that path is loaded as YAML."""
        yaml_path = os.path.join(self.tmp_path, "extra.yaml")
        self._write_yaml(
            yaml_path,
            """
rules:
  - id: from.entry.point.path
    severity: medium
    impact: runtime
    rationale: path
    file: "**"
"""
        )

        def get_rules():
            return yaml_path

        mock_ep = MagicMock()
        mock_ep.load.return_value = get_rules
        mock_eps = [mock_ep]

        with patch("diffsense.core.rules.entry_points") as mock_entry_points:
            mock_entry_points.return_value = mock_eps

            main_path = os.path.join(self.tmp_path, "main.yaml")
            self._write_yaml(main_path, "rules: []\n")
            engine = RuleEngine(main_path)

        ids = [r.id for r in engine.rules]
        self.assertIn("from.entry.point.path", ids)

    def test_broken_entry_point_does_not_break_engine(self):
        """A failing entry point is skipped; engine still loads other rules."""
        def broken():
            raise RuntimeError("broken plugin")

        mock_ep = MagicMock()
        mock_ep.load.return_value = broken
        mock_eps = [mock_ep]

        with patch("diffsense.core.rules.entry_points") as mock_entry_points:
            mock_entry_points.return_value = mock_eps

            yaml_path = os.path.join(self.tmp_path, "r.yaml")
            self._write_yaml(
                yaml_path,
                """
rules:
  - id: from.yaml
    severity: low
    impact: runtime
    rationale: y
    file: "**"
"""
            )
            engine = RuleEngine(yaml_path)

        self.assertIn("from.yaml", [r.id for r in engine.rules])


if __name__ == "__main__":
    unittest.main()
