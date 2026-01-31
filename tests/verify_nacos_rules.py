import sys
import os
import unittest

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from diffsense.core.rules import RuleEngine

class TestNacosRules(unittest.TestCase):
    def setUp(self):
        # Initialize engine with empty config, as we rely on builtin rules
        self.engine = RuleEngine("dummy_path")
        self.fixtures_dir = os.path.join(os.path.dirname(__file__), 'fixtures', 'ast_cases', 'nacos')

    def load_diff(self, filename):
        with open(os.path.join(self.fixtures_dir, filename), 'r', encoding='utf-8') as f:
            return f.read()

    def test_threadpool_semantic_change(self):
        diff_content = self.load_diff('dump_all_processor.diff')
        diff_data = {
            "files": ["config/src/main/java/com/alibaba/nacos/config/server/service/dump/processor/DumpAllProcessor.java"],
            "raw_diff": diff_content
        }
        
        results = self.engine.evaluate(diff_data)
        ids = [r['id'] for r in results]
        
        print(f"DumpAllProcessor Rules Triggered: {ids}")
        self.assertIn('runtime.threadpool_semantic_change', ids)

    def test_concurrency_regression(self):
        diff_content = self.load_diff('health_check_reactor.diff')
        diff_data = {
            "files": ["naming/src/main/java/com/alibaba/nacos/naming/healthcheck/HealthCheckReactor.java"],
            "raw_diff": diff_content
        }
        
        results = self.engine.evaluate(diff_data)
        ids = [r['id'] for r in results]
        
        print(f"HealthCheckReactor Rules Triggered: {ids}")
        self.assertIn('runtime.concurrency_regression', ids)

    def test_lock_removal(self):
        diff_content = self.load_diff('watch_file_center.diff')
        diff_data = {
            "files": ["sys/src/main/java/com/alibaba/nacos/sys/file/WatchFileCenter.java"],
            "raw_diff": diff_content
        }
        
        results = self.engine.evaluate(diff_data)
        ids = [r['id'] for r in results]
        
        print(f"WatchFileCenter Rules Triggered: {ids}")
        self.assertIn('runtime.lock_removal_risk', ids)

if __name__ == '__main__':
    unittest.main()
