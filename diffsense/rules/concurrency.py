import re
from typing import Dict, Any, List, Optional
from sdk.rule import BaseRule
from sdk.signal import Signal

class ThreadPoolSemanticChangeRule(BaseRule):
    def __init__(self):
        self._tpe_pattern = re.compile(r'new\s+ThreadPoolExecutor\s*\(\s*0\s*,\s*Integer\.MAX_VALUE')
        self._sync_queue_pattern = re.compile(r'new\s+SynchronousQueue')
    @property
    def id(self) -> str:
        return "runtime.threadpool_semantic_change"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "High risk thread pool configuration detected (unbounded or zero core)"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if 'new ThreadPoolExecutor' not in raw_diff:
            return None
            
        lines = raw_diff.splitlines()
        for line in lines:
            if line.startswith('+') and 'new ThreadPoolExecutor' in line:
                if self._tpe_pattern.search(line):
                    return {"file": self._find_file_for_line(line, diff_data)}
        
        if self._tpe_pattern.search(raw_diff):
             return {"file": "detected_in_diff"}
             
        if self._sync_queue_pattern.search(raw_diff) and 'new ThreadPoolExecutor' in raw_diff:
             return {"file": "detected_in_diff"}
             
        return None

    def _find_file_for_line(self, line: str, diff_data: Dict[str, Any]) -> str:
        return diff_data.get('files', ["unknown"])[0]


class ConcurrencyRegressionRule(BaseRule):
    def __init__(self):
        self._regressions = []
        pairs = [
            ("ConcurrentHashMap", "HashMap"),
            ("ConcurrentMap", "HashMap"),
            ("CopyOnWriteArrayList", "ArrayList"),
            ("CopyOnWriteArraySet", "HashSet"),
            ("AtomicInteger", "Integer"),
            ("AtomicLong", "Long"),
            ("AtomicBoolean", "Boolean")
        ]
        for strong, weak in pairs:
            strong_re = re.compile(r'^-\s.*' + re.escape(strong), re.MULTILINE)
            if "HashMap" in weak:
                weak_pattern = r'^\+\s.*(?<!Concurrent)' + re.escape(weak)
            elif "ArrayList" in weak:
                weak_pattern = r'^\+\s.*(?<!CopyOnWrite)' + re.escape(weak)
            elif "Integer" in weak or "Long" in weak or "Boolean" in weak:
                weak_pattern = r'^\+\s.*(?<!Atomic)' + re.escape(weak)
            else:
                weak_pattern = r'^\+\s.*' + re.escape(weak)
            weak_re = re.compile(weak_pattern, re.MULTILINE)
            self._regressions.append((strong, weak, strong_re, weak_re))
    @property
    def id(self) -> str:
        return "runtime.concurrency_regression"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Downgrade from concurrent/atomic type to non-thread-safe implementation"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        # Prefer Signal-based detection if available
        for sig in signals:
            if sig.id == "runtime.concurrency.thread_safety_downgrade":
                return {"file": sig.file}

        # Fallback to Regex (Legacy logic)
        raw_diff = diff_data.get('raw_diff', "")
        
        for strong, weak, strong_re, weak_re in self._regressions:
            if strong_re.search(raw_diff) and weak_re.search(raw_diff):
                return {"file": f"regression_{strong}_to_{weak}"}
             
        return None


class ThreadSafetyRemovalRule(BaseRule):
    def __init__(self):
        self._removed_sync_re = re.compile(r'^-\s.*synchronized', re.MULTILINE)
        self._added_sync_re = re.compile(r'^\+\s.*synchronized', re.MULTILINE)
        self._removed_vol_re = re.compile(r'^-\s.*volatile', re.MULTILINE)
        self._added_vol_re = re.compile(r'^\+\s.*volatile', re.MULTILINE)
        self._removed_lock_re = re.compile(r'^-\s.*\.(lock|unlock|tryLock)\(.*\)', re.MULTILINE)
        self._added_lock_re = re.compile(r'^\+\s.*\.(lock|unlock|tryLock)\(.*\)', re.MULTILINE)
    @property
    def id(self) -> str:
        return "runtime.thread_safety_removal"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Removal of synchronization (synchronized, volatile, locks) from shared code"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._removed_sync_re.search(raw_diff):
            removed_sync_count = len(self._removed_sync_re.findall(raw_diff))
            added_sync_count = len(self._added_sync_re.findall(raw_diff))
            
            if removed_sync_count > added_sync_count:
                return {"file": "synchronized_removed"}

        if self._removed_vol_re.search(raw_diff):
            removed_vol_count = len(self._removed_vol_re.findall(raw_diff))
            added_vol_count = len(self._added_vol_re.findall(raw_diff))
            
            if removed_vol_count > added_vol_count:
                return {"file": "volatile_removed"}
                
        if self._removed_lock_re.search(raw_diff):
            removed_lock_calls = len(self._removed_lock_re.findall(raw_diff))
            added_lock_calls = len(self._added_lock_re.findall(raw_diff))
            
            if removed_lock_calls > added_lock_calls:
                 return {"file": "explicit_lock_removed"}

        return None


class LatchMisuseRule(BaseRule):
    def __init__(self):
        self._removed_count_re = re.compile(r'^-\s.*\.countDown\(\)', re.MULTILINE)
        self._added_count_re = re.compile(r'^\+\s.*\.countDown\(\)', re.MULTILINE)
    @property
    def id(self) -> str:
        return "runtime.latch_misuse"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Removal of CountDownLatch.countDown() - potential deadlock or hang"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._removed_count_re.search(raw_diff):
            removed_count = len(self._removed_count_re.findall(raw_diff))
            added_count = len(self._added_count_re.findall(raw_diff))
            
            if removed_count > added_count:
                return {"file": "latch_countdown_removed"}
                
        return None
