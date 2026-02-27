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
from main import _baseline_items, _baseline_set, _baseline_key

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

class MatchRule(Rule):
    def __init__(self, rule_id, severity="high"):
        self._id = rule_id
        self._severity = severity
        self.evaluated = False

    @property
    def id(self): return self._id
    @property
    def severity(self): return self._severity
    @property
    def impact(self): return "runtime"
    @property
    def rationale(self): return "test"
    @property
    def language(self): return "*"
    @property
    def scope(self): return "**"

    def evaluate(self, diff_data, ast_signals):
        self.evaluated = True
        return {"file": diff_data.get("files", ["unknown"])[0]}

class TestCacheAndScheduling(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        os.environ["DIFFSENSE_CACHE_DIR"] = self.test_dir

    def tearDown(self):
        shutil.rmtree(self.test_dir)
        if "DIFFSENSE_CACHE_DIR" in os.environ:
            del os.environ["DIFFSENSE_CACHE_DIR"]
        if "DIFFSENSE_RULE_METRICS" in os.environ:
            del os.environ["DIFFSENSE_RULE_METRICS"]

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

    def test_rule_quality_disable(self):
        metrics_path = os.path.join(self.test_dir, "rule_metrics.json")
        os.environ["DIFFSENSE_RULE_METRICS"] = metrics_path
        rule = MatchRule("quality_rule")
        engine = RuleEngine("config/rules.yaml", config={"rule_quality": {"auto_tune": True, "min_samples": 1}})
        engine.rules = [rule]
        engine.ignore_manager.ignores = [{"rule": "quality_rule", "files": ["*"]}]
        diff_data = {"files": ["a.py"]}
        engine.evaluate(diff_data, [])
        engine.persist_rule_quality()
        engine2 = RuleEngine("config/rules.yaml", config={"rule_quality": {"auto_tune": True, "min_samples": 1}})
        engine2.rules = [MatchRule("quality_rule")]
        engine2.evaluate(diff_data, [])
        self.assertFalse(engine2.rules[0].evaluated)

    def test_rule_quality_degrade(self):
        metrics_path = os.path.join(self.test_dir, "rule_metrics.json")
        os.environ["DIFFSENSE_RULE_METRICS"] = metrics_path
        data = {"rules": {"quality_rule": {"hits": 10, "confirmed": 4, "false_positive": 6, "precision": 0.4}}}
        with open(metrics_path, "w", encoding="utf-8") as f:
            json.dump(data, f)
        rule = MatchRule("quality_rule", severity="high")
        engine = RuleEngine("config/rules.yaml", config={"rule_quality": {"auto_tune": True, "min_samples": 1}})
        engine.rules = [rule]
        diff_data = {"files": ["a.py"]}
        triggered = engine.evaluate(diff_data, [])
        self.assertEqual(len(triggered), 1)
        self.assertEqual(triggered[0]["severity"], "medium")

    def test_baseline_helpers(self):
        rules = [{"id": "r1", "matched_file": "a.py"}, {"id": "r2", "matched_file": "b.py"}]
        items = _baseline_items(rules)
        data = {"items": items}
        keys = _baseline_set(data)
        self.assertIn(_baseline_key(rules[0]), keys)

if __name__ == "__main__":
    unittest.main()
