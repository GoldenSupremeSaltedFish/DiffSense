import pytest
from diffsense.core.ast_detector import ASTDetector
from diffsense.tests.regression_helpers import get_fixture_path


def _load_diff(rel_path):
    path = get_fixture_path(rel_path)
    return path.read_text(encoding="utf-8")

class TestSignalConsistency:
    
    def setup_method(self):
        self.detector = ASTDetector()

    def test_concurrency_synchronized(self):
        """
        Contract: `synchronized` keyword (method or block) triggers `runtime.concurrency.synchronized`
        """
        diff = _load_diff("ast_cases/concurrency/synchronized.diff")
        # ASTDetector requires file_patches with a .java file; fallback 'unknown' is skipped
        diff_data = {'raw_diff': diff, 'file_patches': [{'file': 'Dummy.java', 'patch': diff}]}
        
        signals = self.detector.detect_signals(diff_data)
        signal_ids = {s.id for s in signals}
        
        assert "runtime.concurrency.synchronized" in signal_ids
        assert len(signals) == 1

    def test_concurrency_lock(self):
        """
        Contract: `lock.lock()` calls trigger `runtime.concurrency.lock`
        """
        diff = _load_diff("ast_cases/concurrency/lock.diff")
        diff_data = {'raw_diff': diff, 'file_patches': [{'file': 'Dummy.java', 'patch': diff}]}
        
        signals = self.detector.detect_signals(diff_data)
        signal_ids = {s.id for s in signals}
        
        assert "runtime.concurrency.lock" in signal_ids

    def test_concurrency_volatile(self):
        """
        Contract: `volatile` field modifier triggers `runtime.concurrency.volatile`
        """
        diff = _load_diff("ast_cases/concurrency/volatile.diff")
        diff_data = {'raw_diff': diff, 'file_patches': [{'file': 'Dummy.java', 'patch': diff}]}
        
        signals = self.detector.detect_signals(diff_data)
        signal_ids = {s.id for s in signals}
        
        assert "runtime.concurrency.volatile" in signal_ids

    def test_noise_formatting(self):
        """
        Contract: Whitespace/formatting changes MUST NOT trigger any signals.
        """
        diff = _load_diff("ast_cases/noise/formatting.diff")
        diff_data = {'raw_diff': diff, 'file_patches': [{'file': 'Dummy.java', 'patch': diff}]}
        
        signals = self.detector.detect_signals(diff_data)
        assert len(signals) == 0, f"Found unexpected signals in noise: {signals}"
