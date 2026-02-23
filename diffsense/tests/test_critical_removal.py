import unittest
from diffsense.core.ast_detector import ASTDetector
from diffsense.core.parser import DiffParser
from diffsense.core.rules import RuleEngine
from diffsense.tests.regression_helpers import get_fixture_path, get_rules_path

class TestLockRemoval(unittest.TestCase):
    def setUp(self):
        self.detector = ASTDetector()
        self.parser = DiffParser()
        self.rules_engine = RuleEngine(get_rules_path())

    def test_lock_removal_critical(self):
        fixture_path = get_fixture_path("ast_cases/critical/lock_removal.diff")
        diff_content = fixture_path.read_text(encoding="utf-8")

        # Parse
        diff_data = self.parser.parse(diff_content)
        
        # Detect Signals
        signals = self.detector.detect_signals(diff_data)
        
        # Verify Signals: detector emits id "runtime.concurrency.lock_removed" for lock removal
        lock_removed_signals = [
            s for s in signals
            if s.id == "runtime.concurrency.lock_removed" or (s.id == "runtime.concurrency.lock" and s.action == "removed")
        ]
        self.assertTrue(len(lock_removed_signals) > 0, "Should detect lock removal signal")
        
        # Evaluate Rules
        triggered = self.rules_engine.evaluate(diff_data, signals)
        
        # Verify Critical Rule (rule id may be runtime.concurrency_lock_removed_critical or similar)
        critical_rules = [
            r for r in triggered
            if r["severity"] == "critical"
            and ("lock_removed" in r["id"] or r["id"] == "runtime.concurrency_lock_removed_critical")
        ]
        
        self.assertTrue(len(critical_rules) > 0, "Should trigger CRITICAL severity rule for lock removal")
        print("\nSUCCESS: Detected Critical Lock Removal!")
        for r in critical_rules:
            print(f"Triggered: {r['id']} (Severity: {r['severity']})")

if __name__ == '__main__':
    unittest.main()
