import unittest
import textwrap
from diffsense.core.rules import RuleEngine
from diffsense.core.parser import DiffParser
from diffsense.sdk.signal import Signal

class TestAdaptiveScheduling(unittest.TestCase):
    def setUp(self):
        # We use the config directory which now contains absolute.yaml and rules.yaml
        import os
        from pathlib import Path
        self.rules_path = str(Path(__file__).resolve().parent.parent / "config")

    def test_new_file_triggers_absolute_rule(self):
        # A diff that adds a new file with 'new Thread()'
        diff_content = textwrap.dedent("""\
            diff --git a/NewFile.java b/NewFile.java
            new file mode 100644
            index 0000000..e69de29
            --- /dev/null
            +++ b/NewFile.java
            @@ -0,0 +1 @@
            +public class NewFile { void foo() { new Thread().start(); } }
            """)
        parser = DiffParser()
        diff_data = parser.parse(diff_content)
        
        engine = RuleEngine(self.rules_path)
        triggered = engine.evaluate(diff_data, [])
        
        ids = [t["id"] for t in triggered]
        # Should trigger absolute.concurrency.new_thread (from absolute/concurrency.yaml)
        self.assertIn("absolute.concurrency.new_thread", ids)

    def test_new_file_skips_regression_rule(self):
        # A diff that adds a new file with 'HashMap'
        # Normally, ConcurrencyRegressionRule might check for HashMap, 
        # but since it's a new file, it should be skipped.
        diff_content = textwrap.dedent("""\
            diff --git a/NewFile.py b/NewFile.py
            new file mode 100644
            index 0000000..e69de29
            --- /dev/null
            +++ b/NewFile.py
            @@ -0,0 +1 @@
            +import java.util.HashMap
            """)
        parser = DiffParser()
        diff_data = parser.parse(diff_content)
        
        engine = RuleEngine(self.rules_path)
        triggered = engine.evaluate(diff_data, [])
        
        ids = [t["id"] for t in triggered]
        # ConcurrencyRegressionRule is regression type, so it should be skipped in a "mostly new" diff
        self.assertNotIn("runtime.concurrency_regression", ids)

    def test_modified_file_runs_regression_rule(self):
        # A diff that modifies a file, removing ConcurrentHashMap and adding HashMap
        diff_content = textwrap.dedent("""\
            diff --git a/OldFile.java b/OldFile.java
            index 1234567..89abcdef 100644
            --- a/OldFile.java
            +++ b/OldFile.java
            @@ -1,2 +1,2 @@
            -import java.util.concurrent.ConcurrentHashMap;
            +import java.util.HashMap;
            """)
        parser = DiffParser()
        diff_data = parser.parse(diff_content)
        
        # This is NOT a "mostly new" diff (1 del, 1 add)
        engine = RuleEngine(self.rules_path)
        triggered = engine.evaluate(diff_data, [])
        
        ids = [t["id"] for t in triggered]
        self.assertIn("runtime.concurrency_regression", ids)

    def test_blocking_rule_sets_critical_level(self):
        # A diff that triggers a blocking rule (e.g. plaintext token)
        diff_content = textwrap.dedent("""\
            diff --git a/Secret.py b/Secret.py
            --- a/Secret.py
            +++ b/Secret.py
            @@ -1 +1 @@
            +API_KEY = "sk-abcdef1234567890abcdef1234567890"
            """)
        parser = DiffParser()
        diff_data = parser.parse(diff_content)
        
        engine = RuleEngine(self.rules_path)
        triggered = engine.evaluate(diff_data, [])
        
        from diffsense.core.composer import DecisionComposer
        composer = DecisionComposer()
        result = composer.compose(triggered)
        
        self.assertEqual(result["review_level"], "critical")
        self.assertEqual(result["meta"]["suggested_action"], "block_pr")
        self.assertIn("absolute.security.plaintext_token", result["reasons"])

if __name__ == "__main__":
    unittest.main()
