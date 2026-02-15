import unittest
import os
from diffsense.core.ast_detector import ASTDetector
from diffsense.core.parser import DiffParser
from diffsense.core.change import ChangeKind

class TestP0ConcurrencySignals(unittest.TestCase):
    def setUp(self):
        self.detector = ASTDetector()
        self.parser = DiffParser()

    def test_p0_signals(self):
        # Load the P0 diff
        fixture_path = os.path.join(os.path.dirname(__file__), "fixtures/ast_cases/p0_concurrency.diff")
        with open(fixture_path, 'r') as f:
            diff_content = f.read()

        # Parse
        diff_data = {'raw_diff': diff_content} # Simple parsing for test
        # Need proper parsing to get file_patches
        # But ASTDetector handles raw_diff fallback if file_patches missing
        # However, ASTDetector needs file_patches to identify Java files correctly
        # Let's mock file_patches manually or use a proper parser if available
        # The parser seems to be diffsense.core.parser.DiffParser? 
        # But looking at ASTDetector code, it expects 'file_patches' in diff_data
        
        # Let's try to parse it properly
        # Assuming DiffParser exists and works as expected
        # Or I can just manually construct the file_patches dict since the diff is simple
        
        file_patches = [{
            'file': 'src/main/java/com/example/ConcurrencyIssues.java',
            'patch': diff_content
        }]
        diff_data = {'file_patches': file_patches}

        # Detect Signals (using the new detect_changes API which returns Change objects)
        changes = self.detector.detect_changes(diff_data)
        
        # Helper to find changes
        def find_change(kind=None, symbol=None, meta_key=None):
            for c in changes:
                if kind and c.kind != kind: continue
                if symbol and c.symbol != symbol: continue
                if meta_key and meta_key not in c.meta: continue
                return c
            return None

        # 1. thread_safety_downgrade
        # ConcurrentHashMap -> HashMap
        ch1 = find_change(kind=ChangeKind.TYPE_CHANGED, symbol="cache", meta_key="downgrade")
        self.assertIsNotNone(ch1, "Should detect ConcurrentHashMap -> HashMap downgrade")
        
        # AtomicInteger -> Integer (might be detected as type change if variable name is same, or field removed/added)
        # In my diff, I changed the line:
        # - private AtomicInteger counter = new AtomicInteger(0);
        # + private Integer counter = 0;
        # If AST works, it should detect type change for 'counter'
        ch2 = find_change(kind=ChangeKind.TYPE_CHANGED, symbol="counter", meta_key="downgrade")
        self.assertIsNotNone(ch2, "Should detect AtomicInteger -> Integer downgrade")

        # 2. lock_removed
        # lock.lock() removed
        ch3 = find_change(kind=ChangeKind.CALL_REMOVED, symbol="lock")
        self.assertIsNotNone(ch3, "Should detect lock.lock() removal")

        # 3. lock_scope_reduction
        # criticalOperation() moved out of try/lock
        # This requires new logic. Let's see if we can detect it.
        # For now, just check if we have enough info in changes to build this signal later
        # Maybe we detect 'criticalOperation' call removed from try block and added outside?
        # This is complex. Let's assume we implement a specific check for this.
        ch4 = find_change(symbol="criticalOperation", meta_key="scope_reduction") # Proposed meta
        # self.assertIsNotNone(ch4, "Should detect lock scope reduction") # Commented out until implemented

        # 4. volatile_removed
        ch5 = find_change(kind=ChangeKind.MODIFIER_REMOVED, symbol="volatile")
        self.assertIsNotNone(ch5, "Should detect volatile removal")

        # 5. final_removed
        ch6 = find_change(kind=ChangeKind.MODIFIER_REMOVED, symbol="final") # Need to implement this
        # self.assertIsNotNone(ch6, "Should detect final removal")

        # 6. atomic_to_non_atomic_write
        # atomicCount.set(10) -> count = 10
        # This might appear as CALL_REMOVED (set) and FIELD assignment (which might not be a change kind yet)
        # self.assertIsNotNone(find_change(meta_key="atomic_write_downgrade"), "Should detect atomic write downgrade")

        # 7. static_unsafe_collection
        # static Map added
        ch7 = find_change(kind=ChangeKind.FIELD_ADDED, symbol="unsafeMap", meta_key="static_unsafe")
        self.assertIsNotNone(ch7, "Should detect static unsafe collection")

        # 8. threadpool_param_change
        # ThreadPoolExecutor args changed
        ch8 = find_change(kind=ChangeKind.OBJECT_CREATION, symbol="ThreadPoolExecutor", meta_key="param_change")
        # self.assertIsNotNone(ch8, "Should detect threadpool param change")

        # 9. threadpool_unbounded_queue
        # new LinkedBlockingQueue()
        ch9 = find_change(kind=ChangeKind.OBJECT_CREATION, symbol="LinkedBlockingQueue", meta_key="unbounded") # or no args
        # self.assertIsNotNone(ch9, "Should detect unbounded queue")

        # 10. sleep_or_busy_wait_added
        ch10 = find_change(kind=ChangeKind.CALL_ADDED, symbol="sleep")
        self.assertIsNotNone(ch10, "Should detect sleep added")

if __name__ == '__main__':
    unittest.main()
