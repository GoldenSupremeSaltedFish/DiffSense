#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
JS CVE 规则集成测试：校验 pro-rules/cve/JavaScript 规则能被正确加载且 language=javascript。
"""
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))

from diffsense.core.rules import RuleEngine


def get_js_fixture_dir():
    return _ROOT / "tests" / "fixtures" / "pro_rules_js_sample"


def get_pro_rules_dir():
    return _ROOT / "pro-rules"


def test_js_cve_language_recognized_from_fixture():
    """从 fixture 加载 JS 规则，校验 language=javascript 被识别。"""
    fixture_dir = get_js_fixture_dir()
    if not fixture_dir.is_dir():
        raise AssertionError(f"Fixture not found: {fixture_dir}")
    engine = RuleEngine(pro_rules_path=str(fixture_dir))
    js_rules = [r for r in engine.rules if getattr(r, "language", None) == "javascript"]
    assert len(js_rules) >= 1, "Fixture should yield at least one rule with language=javascript"
    rid = getattr(js_rules[0], "id", "")
    assert rid.startswith("prorule."), f"Rule id should start with prorule.: {rid}"
    print(f"[OK] JS CVE language recognized from fixture: {len(js_rules)} rule(s), e.g. {rid}")


def test_js_cve_rules_have_language_javascript():
    """所有 id 为 prorule.javascript.* 的规则，其 language 应为 javascript。"""
    pro_dir = get_pro_rules_dir()
    if not pro_dir.is_dir():
        return
    if os.environ.get("DIFFSENSE_FULL_PRO_RULES_TEST", "").lower() not in ("1", "true", "yes"):
        return
    engine = RuleEngine(pro_rules_path=str(pro_dir))
    for r in engine.rules:
        rid = getattr(r, "id", "")
        if rid.startswith("prorule.javascript."):
            lang = getattr(r, "language", None)
            assert lang == "javascript", f"Rule {rid} should have language=javascript, got {lang!r}"
    js_count = sum(1 for r in engine.rules if getattr(r, "id", "").startswith("prorule.javascript."))
    print(f"[OK] All {js_count} prorule.javascript.* rules have language=javascript")


if __name__ == "__main__":
    test_js_cve_language_recognized_from_fixture()
    test_js_cve_rules_have_language_javascript()
    print("[OK] JS CVE integration tests passed.")
