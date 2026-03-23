import os
import json
import shutil
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from diffsense.core.parser import DiffParser
from diffsense.core.ast_detector import ASTDetector
from diffsense.core.rules import RuleEngine
from diffsense.core.rule_base import Rule
from diffsense.core import CACHE_VERSION
from diffsense.main import _baseline_items, _baseline_set, _baseline_key
from diffsense.core.renderer import MarkdownRenderer, HtmlRenderer

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
        
        # 模拟版本变更后的行为 - 直接验证路径包含版本号
        self.assertIn(CACHE_VERSION, parser.cache_dir)

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

    def test_rule_stats_contains_total_and_executed(self):
        """get_rule_stats() 应包含 total_rules 与 executed_count（Q1/Q2 输出与渲染依赖）"""
        engine = RuleEngine("config/rules.yaml")
        engine.rules = [MatchRule("r1"), MatchRule("r2")]
        stats = engine.get_rule_stats()
        self.assertIn("total_rules", stats)
        self.assertIn("executed_count", stats)
        self.assertEqual(stats["total_rules"], 2)
        self.assertEqual(stats["executed_count"], 0)
        diff_data = {"files": ["a.java"]}
        engine.evaluate(diff_data, [])
        stats2 = engine.get_rule_stats()
        self.assertEqual(stats2["total_rules"], 2)
        self.assertEqual(stats2["executed_count"], 2)

    def test_renderer_with_rule_stats(self):
        """HTML/Markdown 在 _metrics.rule_stats 含 total_rules/executed_count 时正常渲染（Q1 输出）"""
        result = {
            "review_level": "normal",
            "details": [],
            "_metrics": {
                "rule_stats": {"total_rules": 40, "executed_count": 12, "top_slow": [], "top_noisy": [], "top_triggered": []},
                "cache": {"diff": {"hits": 0, "misses": 1}, "ast": {"hits": 0, "misses": 1}},
            },
        }
        md = MarkdownRenderer().render(result)
        self.assertIn("Rules executed", md)
        self.assertIn("12", md)
        self.assertIn("40", md)
        html = HtmlRenderer().render(result)
        self.assertIn("Rules executed", html)
        self.assertIn("12 / 40", html)

    def test_quality_report_from_metrics_skips_non_rules(self):
        """quality_report_from_metrics 应跳过 cache、rule_stats，避免 CLI rules report 出现非规则行"""
        metrics = {
            "cache": {"diff": {}, "ast": {}},
            "rule_stats": {"total_rules": 10, "executed_count": 3},
            "runtime.concurrency.lock_removed": {"hits": 2, "ignores": 1},
        }
        rows = RuleEngine.quality_report_from_metrics(metrics)
        rule_ids = [r["rule_id"] for r in rows]
        self.assertNotIn("cache", rule_ids)
        self.assertNotIn("rule_stats", rule_ids)
        self.assertIn("runtime.concurrency.lock_removed", rule_ids)

if __name__ == "__main__":
    unittest.main()
