import unittest
import os
from diffsense.core.ast_detector import ASTDetector
from diffsense.core.parser import DiffParser
from diffsense.core.rules import RuleEngine

class TestLockRemoval(unittest.TestCase):
    def setUp(self):
        self.detector = ASTDetector()
        self.parser = DiffParser()
        # Point to real rules file
        self.rules_engine = RuleEngine("diffsense/config/rules.yaml")

    def test_lock_removal_critical(self):
        # Load the critical case diff
        fixture_path = os.path.join(os.path.dirname(__file__), "fixtures/ast_cases/critical/lock_removal.diff")
        with open(fixture_path, 'r') as f:
            diff_content = f.read()

        # Parse
        diff_data = self.parser.parse(diff_content)
        
        # Detect Signals
        signals = self.detector.detect_signals(diff_data)
        
        # Verify Signals
        # Expect: lock removed
        lock_removed_signals = [s for s in signals if s.id == "runtime.concurrency.lock" and s.action == "removed"]
        self.assertTrue(len(lock_removed_signals) > 0, "Should detect lock removal signal")
        
        # Evaluate Rules
        triggered = self.rules_engine.evaluate(diff_data, signals)
        
        # Verify Critical Rule
        critical_rules = [r for r in triggered if r['severity'] == 'critical' and r['id'] == 'runtime.concurrency_lock_removed_critical']
        
        self.assertTrue(len(critical_rules) > 0, "Should trigger CRITICAL severity rule for lock removal")
        print("\nSUCCESS: Detected Critical Lock Removal!")
        for r in critical_rules:
            print(f"Triggered: {r['id']} (Severity: {r['severity']})")

if __name__ == '__main__':
    unittest.main()
