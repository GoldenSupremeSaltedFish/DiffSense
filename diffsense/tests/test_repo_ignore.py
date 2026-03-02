import unittest
import os
import tempfile
import shutil
from core.ignore_manager import IgnoreManager

class TestRepoIgnore(unittest.TestCase):
    def setUp(self):
        # Create a dummy .diffsense.yaml (legacy name; diffsense-ignore.yaml 优先时不会用到)
        with open(".diffsense.yaml", "w") as f:
            f.write("""
ignore:
  - rule: runtime.concurrency.*
    files: 
      - "**/test/**"
  - rule: specific.rule
    files:
      - "legacy.java"
""")
        self.manager = IgnoreManager(".")

    def tearDown(self):
        if os.path.exists(".diffsense.yaml"):
            os.remove(".diffsense.yaml")

    def test_diffsense_ignore_yaml_loaded_when_present(self):
        """当存在 diffsense-ignore.yaml 时优先加载（路线图规范化）"""
        tmp = tempfile.mkdtemp()
        try:
            with open(os.path.join(tmp, "diffsense-ignore.yaml"), "w") as f:
                f.write("""
ignore:
  - rule: my.rule
    files: ["foo.java"]
""")
            mgr = IgnoreManager(tmp)
            self.assertTrue(mgr.is_ignored("my.rule", "foo.java"))
            self.assertFalse(mgr.is_ignored("my.rule", "bar.java"))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_ignore_logic(self):
        # Test 1: Ignored by wildcard rule and file pattern
        self.assertTrue(self.manager.is_ignored("runtime.concurrency.lock", "src/test/MyTest.java"))
        
        # Test 2: NOT ignored (file mismatch)
        self.assertFalse(self.manager.is_ignored("runtime.concurrency.lock", "src/main/MyClass.java"))
        
        # Test 3: NOT ignored (rule mismatch)
        self.assertFalse(self.manager.is_ignored("runtime.performance.sleep", "src/test/MyTest.java"))
        
        # Test 4: Exact match
        self.assertTrue(self.manager.is_ignored("specific.rule", "legacy.java"))

if __name__ == '__main__':
    unittest.main()
