import unittest
from diffsense.core.ast_detector import ASTDetector
from diffsense.core.parser import DiffParser
from diffsense.core.rules import RuleEngine
from diffsense.tests.regression_helpers import get_fixture_path, get_rules_path

class TestTypeDowngrade(unittest.TestCase):
    def setUp(self):
        self.detector = ASTDetector()
        self.parser = DiffParser()
        self.rules_engine = RuleEngine(get_rules_path())

    def test_concurrent_map_downgrade(self):
        fixture_path = get_fixture_path("ast_cases/critical/type_downgrade.diff")
        diff_content = fixture_path.read_text(encoding="utf-8")

        # Parse
        diff_data = self.parser.parse(diff_content)
        
        # Detect Signals
        signals = self.detector.detect_signals(diff_data)
        
        # Verify Signal
        downgrade_signal = next((s for s in signals if s.id == "runtime.concurrency.thread_safety_downgrade"), None)
        self.assertIsNotNone(downgrade_signal, "Should detect thread safety downgrade signal")
        self.assertEqual(downgrade_signal.action, "downgrade")
        self.assertEqual(downgrade_signal.meta['var'], "cache")
        self.assertEqual(downgrade_signal.meta['from'], "ConcurrentHashMap")
        self.assertEqual(downgrade_signal.meta['to'], "HashMap")
        
        # Evaluate Rules
        triggered = self.rules_engine.evaluate(diff_data, signals)
        
        # Verify Critical Rule
        critical_rule = next((r for r in triggered if r['id'] == 'runtime.concurrency.thread_safety_downgrade'), None)
        self.assertIsNotNone(critical_rule, "Should trigger CRITICAL rule for downgrade")
        self.assertEqual(critical_rule['severity'], 'critical')
        
        print("\nSUCCESS: Detected Thread Safety Downgrade (ConcurrentHashMap -> HashMap)!")
        print(f"Signal Meta: {downgrade_signal.meta}")

if __name__ == '__main__':
    unittest.main()
