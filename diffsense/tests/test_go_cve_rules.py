# -*- coding: utf-8 -*-
"""
Go CVE 规则集成测试：校验 pro-rules/cve/Go 下的规则能被引擎加载，并可参与 evaluate。
运行: pytest diffsense/tests/test_go_cve_rules.py -v
与主回归一起: pytest diffsense/tests/test_regression.py diffsense/tests/test_go_cve_rules.py -v
"""
import os
from pathlib import Path

import pytest

# 解析 pro-rules 路径（与 regression_helpers 一致：diffsense 包上级）
try:
    import diffsense
    _BASE = Path(diffsense.__file__).resolve().parent.parent
except Exception:
    _BASE = Path(__file__).resolve().parent.parent.parent
_PRO_RULES = _BASE / "pro-rules"
_GO_CVE_DIR = _PRO_RULES / "cve" / "Go"


def _get_pro_rules_path():
    env = os.environ.get("DIFFSENSE_PRO_RULES", "").strip()
    if env and os.path.isdir(env):
        return os.path.normpath(env)
    if _PRO_RULES.is_dir():
        return str(_PRO_RULES)
    return None


def _get_rules_path():
    cand = _BASE / "diffsense" / "config" / "rules.yaml"
    if cand.exists():
        return str(cand)
    cand = Path(__file__).resolve().parent.parent / "config" / "rules.yaml"
    if cand.exists():
        return str(cand)
    return str(_BASE / "diffsense" / "config" / "rules.yaml")


@pytest.fixture(scope="module")
def rule_engine_with_pro_rules():
    """加载带 pro-rules 的 RuleEngine（含 cve/Go）。"""
    from diffsense.core.rules import RuleEngine
    pro_path = _get_pro_rules_path()
    if not pro_path:
        pytest.skip("pro-rules 目录不存在，跳过 Go CVE 规则测试")
    rules_path = _get_rules_path()
    return RuleEngine(rules_path=rules_path, pro_rules_path=pro_path)


def test_go_cve_rules_loaded(rule_engine_with_pro_rules):
    """至少有一条 Go CVE 规则被加载（id 形如 prorule.go_*_go）。"""
    engine = rule_engine_with_pro_rules
    go_cve_rules = [r for r in engine.rules if getattr(r, "id", "").startswith("prorule.go_")]
    assert len(go_cve_rules) >= 1, (
        "未加载任何 pro-rules/cve/Go 规则，请先运行: python scripts/fetch_go_cve_from_vulndb.py"
    )


def test_go_cve_rule_has_language_go(rule_engine_with_pro_rules):
    """已加载的 Go CVE 规则 language 为 go。"""
    engine = rule_engine_with_pro_rules
    go_cve_rules = [r for r in engine.rules if getattr(r, "id", "").startswith("prorule.go_")]
    for r in go_cve_rules[:5]:
        assert getattr(r, "language", "") == "go", f"Rule {r.id} 应有 language=go"


def test_go_cve_engine_evaluate_no_crash(rule_engine_with_pro_rules):
    """对包含 Go 文件的 diff 执行 evaluate 不崩溃（不强制触发某条规则）。"""
    from diffsense.core.parser import DiffParser
    from diffsense.core.ast_detector import ASTDetector
    engine = rule_engine_with_pro_rules
    parser = DiffParser()
    detector = ASTDetector()
    diff_content = """
--- a/main.go
+++ b/main.go
@@ -1,3 +1,5 @@
 package main
+
+import "golang.org/x/net/http2"
 
 func main() {}
"""
    diff_data = parser.parse(diff_content)
    diff_data.setdefault("file_patches", [])
    if not diff_data.get("file_patches") and diff_content.strip():
        diff_data["file_patches"].append({"file": "main.go", "patch": diff_content})
    diff_data["raw_diff"] = diff_content
    signals = detector.detect_signals(diff_data)
    triggered = engine.evaluate(diff_data, signals)
    assert isinstance(triggered, list)
