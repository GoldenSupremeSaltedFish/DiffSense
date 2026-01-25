import pytest
import os
from diffsense.core.ast_detector import ASTDetector

# Path to cases
CASES_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "ast_cases")

def load_diff(category, filename):
    path = os.path.join(CASES_DIR, category, filename)
    print(f"DEBUG: Loading file from {path}")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

class TestSignalConsistency:
    
    def setup_method(self):
        self.detector = ASTDetector()

    def test_concurrency_synchronized(self):
        """
        Contract: `synchronized` keyword (method or block) triggers `runtime.concurrency.synchronized`
        """
        diff = load_diff("concurrency", "synchronized.diff")
        # Mock diff_data structure as expected by new ASTDetector
        diff_data = {'raw_diff': diff}
        
        signals = self.detector.detect_signals(diff_data)
        signal_ids = {s.id for s in signals}
        
        assert "runtime.concurrency.synchronized" in signal_ids
        assert len(signals) == 1

    def test_concurrency_lock(self):
        """
        Contract: `lock.lock()` calls trigger `runtime.concurrency.lock`
        """
        diff = load_diff("concurrency", "lock.diff")
        diff_data = {'raw_diff': diff}
        
        signals = self.detector.detect_signals(diff_data)
        signal_ids = {s.id for s in signals}
        
        assert "runtime.concurrency.lock" in signal_ids

    def test_concurrency_volatile(self):
        """
        Contract: `volatile` field modifier triggers `runtime.concurrency.volatile`
        """
        diff = load_diff("concurrency", "volatile.diff")
        diff_data = {'raw_diff': diff}
        
        signals = self.detector.detect_signals(diff_data)
        signal_ids = {s.id for s in signals}
        
        assert "runtime.concurrency.volatile" in signal_ids

    def test_noise_formatting(self):
        """
        Contract: Whitespace/formatting changes MUST NOT trigger any signals.
        """
        diff = load_diff("noise", "formatting.diff")
        diff_data = {'raw_diff': diff}
        
        signals = self.detector.detect_signals(diff_data)
        assert len(signals) == 0, f"Found unexpected signals in noise: {signals}"
