import unittest
import os
from diffsense.core.ast_detector import ASTDetector
from diffsense.core.parser import DiffParser
from diffsense.core.rules import RuleEngine

class TestTypeDowngrade(unittest.TestCase):
    def setUp(self):
        self.detector = ASTDetector()
        self.parser = DiffParser()
        self.rules_engine = RuleEngine("diffsense/config/rules.yaml")

    def test_concurrent_map_downgrade(self):
        # Load the downgrade case diff
        fixture_path = os.path.join(os.path.dirname(__file__), "fixtures/ast_cases/critical/type_downgrade.diff")
        with open(fixture_path, 'r') as f:
            diff_content = f.read()

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
