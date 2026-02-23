import unittest
from diffsense.core.ast_detector import ASTDetector
from diffsense.core.rules import RuleEngine
from diffsense.core.change import ChangeKind

class TestSemanticRegression(unittest.TestCase):
    def setUp(self):
        self.detector = ASTDetector()
        # Mock rule engine just to check if signals map to IDs defined in rules.yaml (optional, but good practice)
        # For this test, we mainly verify ASTDetector generates the correct Signal IDs.

    def test_input_normalization_removed(self):
        patch = """
@@ -10,2 +10,2 @@
-        String safe = Encoder.encode(input);
+        String safe = input;
         process(safe);
"""
        diff_data = {
            "file_patches": [
                {"file": "src/main/java/com/example/Service.java", "patch": patch}
            ]
        }
        
        signals = self.detector.detect_signals(diff_data)
        
        # Look for 'runtime.input_normalization_removed'
        found = next((s for s in signals if s.id == "runtime.input_normalization_removed"), None)
        self.assertIsNotNone(found, "Should detect removal of encode() call")
        self.assertEqual(found.action, "removed")
        print("\nSUCCESS: Detected Input Normalization Removal")

    def test_pagination_semantic_change(self):
        patch = """
@@ -5,2 +5,3 @@
-        int start = 0;
+        int start = pageNo * pageSize;
+        if (services.size() < pageSize) {
"""
        diff_data = {
            "file_patches": [
                {"file": "src/main/java/com/example/Pagination.java", "patch": patch}
            ]
        }
        
        signals = self.detector.detect_signals(diff_data)
        
        # Look for 'data.pagination_semantic_change'
        found = next((s for s in signals if s.id == "data.pagination_semantic_change"), None)
        self.assertIsNotNone(found, "Should detect usage of pageSize/pageNo in changes")
        print("\nSUCCESS: Detected Pagination Semantic Change")

    def test_collection_mutation_inside_loop(self):
        patch = """
@@ -20,0 +21,4 @@
+        for (String item : items) {
+            if (check(item)) {
+                items.remove(item);
+            }
+        }
"""
        diff_data = {
            "file_patches": [
                {"file": "src/main/java/com/example/Loop.java", "patch": patch}
            ]
        }
        
        signals = self.detector.detect_signals(diff_data)
        
        # Look for 'runtime.collection_mutation_inside_loop'
        found = next((s for s in signals if s.id == "runtime.collection_mutation_inside_loop"), None)
        self.assertIsNotNone(found, "Should detect remove() inside loop")
        self.assertTrue(found.meta.get('in_loop'), "Meta should indicate in_loop")
        print("\nSUCCESS: Detected Collection Mutation Inside Loop")

    def test_security_file_change(self):
        # This tests RuleEngine directly since ASTDetector doesn't generate signals for file paths alone
        # We need to simulate RuleEngine evaluation
        from diffsense.core.rules import RuleEngine
        from diffsense.tests.regression_helpers import get_rules_path

        rule_engine = RuleEngine(get_rules_path())
        
        diff_data = {
            "files": ["src/main/java/com/example/auth/LoginService.java"],
            "raw_diff": "+ // some change"
        }
        
        triggered = rule_engine.evaluate(diff_data, [])
        
        # Look for 'security.behavior_change_auth'
        found = next((r for r in triggered if r['id'] == "security.behavior_change_auth"), None)
        self.assertIsNotNone(found, "Should detect change in auth directory")
        print("\nSUCCESS: Detected Security/Auth File Change")

if __name__ == '__main__':
    unittest.main()
