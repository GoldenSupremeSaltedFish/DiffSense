import os
import json
import shutil
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from core.parser import DiffParser
from core.ast_detector import ASTDetector
from core.rules import RuleEngine
from core.rule_base import Rule
from core import CACHE_VERSION

class MockRule(Rule):
    def __init__(self, rule_id, lang='*', scope='**'):
        self._id = rule_id
        self._lang = lang
        self._scope = scope
        self.evaluated = False

    @property
    def id(self): return self._id
    @property
    def severity(self): return "high"
    @property
    def impact(self): return "runtime"
    @property
    def rationale(self): return "test"
    @property
    def language(self): return self._lang
    @property
    def scope(self): return self._scope

    def evaluate(self, diff_data, ast_signals):
        self.evaluated = True
        return None

class TestCacheAndScheduling(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        os.environ["DIFFSENSE_CACHE_DIR"] = self.test_dir

    def tearDown(self):
        shutil.rmtree(self.test_dir)
        if "DIFFSENSE_CACHE_DIR" in os.environ:
            del os.environ["DIFFSENSE_CACHE_DIR"]

    def test_cache_versioning_isolation(self):
        """验证缓存版本隔离：不同版本应该存放在不同目录"""
        parser = DiffParser()
        # 路径应包含当前版本号
        expected_path_part = os.path.join(CACHE_VERSION, "diff")
        self.assertIn(expected_path_part, parser.cache_dir)
        
        # 模拟版本变更后的行为
        with patch("core.parser.CACHE_VERSION", "v999"):
            parser_v999 = DiffParser()
            self.assertIn("v999", parser_v999.cache_dir)
            self.assertNotEqual(parser.cache_dir, parser_v999.cache_dir)

    def test_atomic_write_logic(self):
        """验证原子写逻辑：检查是否使用了临时文件并成功替换"""
        parser = DiffParser()
        diff_content = "diff --git a/test.py b/test.py\n+new line"
        
        # 拦截 os.replace 来确认它被调用了
        with patch("os.replace") as mock_replace:
            parser.parse(diff_content)
            # 应该调用了 os.replace(tmp_path, final_path)
            self.assertTrue(mock_replace.called)
            args, _ = mock_replace.call_args
            self.assertTrue(args[0].endswith(".tmp")) # 第一个参数是 tmp 文件
            self.assertTrue(args[1].endswith(".json")) # 第二个参数是目标 json

    def test_incremental_scheduling(self):
        """验证增量调度：规则应该根据语言和路径过滤"""
        # 准备 Diff 数据
        diff_data = {
            "files": ["src/main.java", "README.md"],
            "change_types": ["logic", "doc"]
        }
        
        # 创建规则：一个匹配，两个不匹配
        java_rule = MockRule("java_rule", lang="java")
        go_rule = MockRule("go_rule", lang="go")
        scope_rule = MockRule("scope_rule", scope="internal") # 不匹配 src/main.java
        
        engine = RuleEngine("config/rules.yaml") # 路径不重要，我们会手动注入规则
        engine.rules = [java_rule, go_rule, scope_rule]
        
        engine.evaluate(diff_data)
        
        self.assertTrue(java_rule.evaluated, "Java 规则应该被执行")
        self.assertFalse(go_rule.evaluated, "Go 规则不应该被执行")
        self.assertFalse(scope_rule.evaluated, "Scope 不匹配的规则不应该被执行")

    def test_cache_metrics_tracking(self):
        """验证缓存可观测性指标统计"""
        parser = DiffParser()
        diff_content = "diff --git a/a.txt b/a.txt\n+hello"
        
        # 第一次解析：Miss
        parser.parse(diff_content)
        self.assertEqual(parser.metrics["misses"], 1)
        self.assertEqual(parser.metrics["hits"], 0)
        self.assertGreater(parser.metrics["saved_ms"], 0)
        
        # 第二次解析：Hit
        parser.parse(diff_content)
        self.assertEqual(parser.metrics["misses"], 1)
        self.assertEqual(parser.metrics["hits"], 1)

if __name__ == "__main__":
    unittest.main()
