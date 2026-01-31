import re
from typing import Dict, Any, List, Optional
from core.rule_base import Rule

class ThreadPoolSemanticChangeRule(Rule):
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

    def evaluate(self, diff_data: Dict[str, Any], ast_signals: List[Any]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if 'new ThreadPoolExecutor' not in raw_diff:
            return None
            
        lines = raw_diff.splitlines()
        for line in lines:
            if line.startswith('+') and 'new ThreadPoolExecutor' in line:
                if re.search(r'new\s+ThreadPoolExecutor\s*\(\s*0\s*,\s*Integer\.MAX_VALUE', line):
                    return {"file": self._find_file_for_line(line, diff_data)}
        
        if re.search(r'new\s+ThreadPoolExecutor\s*\(\s*0\s*,\s*Integer\.MAX_VALUE', raw_diff, re.MULTILINE):
             return {"file": "detected_in_diff"}
             
        if re.search(r'new\s+SynchronousQueue', raw_diff) and re.search(r'new\s+ThreadPoolExecutor', raw_diff):
             return {"file": "detected_in_diff"}
             
        return None

    def _find_file_for_line(self, line: str, diff_data: Dict[str, Any]) -> str:
        return diff_data.get('files', ["unknown"])[0]


class ConcurrencyRegressionRule(Rule):
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

    def evaluate(self, diff_data: Dict[str, Any], ast_signals: List[Any]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        regressions = [
            ("ConcurrentHashMap", "HashMap"),
            ("ConcurrentMap", "HashMap"),
            ("CopyOnWriteArrayList", "ArrayList"),
            ("CopyOnWriteArraySet", "HashSet"),
            ("AtomicInteger", "Integer"),
            ("AtomicLong", "Long"),
            ("AtomicBoolean", "Boolean")
        ]
        
        for strong, weak in regressions:
            has_strong_removed = re.search(r'^-\s.*' + re.escape(strong), raw_diff, re.MULTILINE)
            
            if "HashMap" in weak:
                weak_pattern = r'^\+\s.*(?<!Concurrent)' + re.escape(weak)
            elif "ArrayList" in weak:
                weak_pattern = r'^\+\s.*(?<!CopyOnWrite)' + re.escape(weak)
            elif "Integer" in weak or "Long" in weak or "Boolean" in weak:
                weak_pattern = r'^\+\s.*(?<!Atomic)' + re.escape(weak)
            else:
                weak_pattern = r'^\+\s.*' + re.escape(weak)
                
            has_weak_added = re.search(weak_pattern, raw_diff, re.MULTILINE)
            
            if has_strong_removed and has_weak_added:
                return {"file": f"regression_{strong}_to_{weak}"}
             
        return None


class ThreadSafetyRemovalRule(Rule):
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

    def evaluate(self, diff_data: Dict[str, Any], ast_signals: List[Any]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if re.search(r'^-\s.*synchronized', raw_diff, re.MULTILINE):
            removed_sync_count = len(re.findall(r'^-\s.*synchronized', raw_diff, re.MULTILINE))
            added_sync_count = len(re.findall(r'^\+\s.*synchronized', raw_diff, re.MULTILINE))
            
            if removed_sync_count > added_sync_count:
                return {"file": "synchronized_removed"}

        if re.search(r'^-\s.*volatile', raw_diff, re.MULTILINE):
            removed_vol_count = len(re.findall(r'^-\s.*volatile', raw_diff, re.MULTILINE))
            added_vol_count = len(re.findall(r'^\+\s.*volatile', raw_diff, re.MULTILINE))
            
            if removed_vol_count > added_vol_count:
                return {"file": "volatile_removed"}
                
        if re.search(r'^-\s.*\.(lock|unlock|tryLock)\(.*\)', raw_diff, re.MULTILINE):
            removed_lock_calls = len(re.findall(r'^-\s.*\.(lock|unlock|tryLock)\(.*\)', raw_diff, re.MULTILINE))
            added_lock_calls = len(re.findall(r'^\+\s.*\.(lock|unlock|tryLock)\(.*\)', raw_diff, re.MULTILINE))
            
            if removed_lock_calls > added_lock_calls:
                 return {"file": "explicit_lock_removed"}

        return None


class LatchMisuseRule(Rule):
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

    def evaluate(self, diff_data: Dict[str, Any], ast_signals: List[Any]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if re.search(r'^-\s.*\.countDown\(\)', raw_diff, re.MULTILINE):
            removed_count = len(re.findall(r'^-\s.*\.countDown\(\)', raw_diff, re.MULTILINE))
            added_count = len(re.findall(r'^\+\s.*\.countDown\(\)', raw_diff, re.MULTILINE))
            
            if removed_count > added_count:
                return {"file": "latch_countdown_removed"}
                
        return None
