#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
集成测试：检验 pro-rules 中的规则能否按语言正确识别。
- 快速路径：用 fixture 目录加载少量 Java 单条规则，断言 language=java。
- 完整路径（可选）：加载完整 pro-rules，断言按 language 分组且含 java。
"""
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))

from diffsense.core.rules import RuleEngine


def get_pro_rules_dir():
    return _ROOT / "pro-rules"


def get_java_sample_fixture_dir():
    return _ROOT / "tests" / "fixtures" / "pro_rules_java_sample"


def test_java_language_recognized_from_fixture():
    """快速测试：从 fixture 加载单条 Java 规则，校验能按 language=java 识别。"""
    fixture_dir = get_java_sample_fixture_dir()
    if not fixture_dir.is_dir():
        raise AssertionError(f"Fixture not found: {fixture_dir}")
    engine = RuleEngine(pro_rules_path=str(fixture_dir))
    java_rules = [r for r in engine.rules if getattr(r, "language", None) == "java"]
    assert len(java_rules) >= 1, "Fixture should yield at least one rule with language=java"
    rid = getattr(java_rules[0], "id", "")
    assert rid.startswith("prorule."), f"Rule id should start with prorule.: {rid}"
    print(f"[OK] Java language recognized from fixture: {len(java_rules)} rule(s), e.g. {rid}")


def test_pro_rules_load_and_language_recognition():
    """加载完整 pro-rules，校验能按语言识别。需 DIFFSENSE_FULL_PRO_RULES_TEST=1 才执行（较慢）。"""
    if os.environ.get("DIFFSENSE_FULL_PRO_RULES_TEST", "").lower() not in ("1", "true", "yes"):
        return
    pro_dir = get_pro_rules_dir()
    if not pro_dir.is_dir():
        raise AssertionError(f"pro-rules directory not found: {pro_dir}")
    engine = RuleEngine(pro_rules_path=str(pro_dir))
    # 按 language 分组
    by_lang = {}
    for r in engine.rules:
        lang = getattr(r, "language", "*")
        by_lang.setdefault(lang, []).append(r)
    # 应存在多种 language（根目录规则多为 *，cve/java 等为 java）
    assert len(engine.rules) > 0, "pro-rules should load at least one rule"
    # 若存在 cve/java 等单条规则，应有 language=java
    java_rules = by_lang.get("java", [])
    star_rules = by_lang.get("*", [])
    # 至少有一种语言分布（* 或 java 等）
    assert by_lang, "rules should have language attribute"
    # 若有 java 规则，其 id 建议为 prorule.java.*
    for r in java_rules:
        rid = getattr(r, "id", "")
        assert rid.startswith("prorule."), f"java rule id should start with prorule.: {rid}"
    # 汇总输出，便于 CI 查看
    print(f"Total rules: {len(engine.rules)}")
    print("By language:", {k: len(v) for k, v in sorted(by_lang.items())})
    if java_rules:
        print(f"Java rules: {len(java_rules)} (e.g. {getattr(java_rules[0], 'id', '')})")


def test_java_rules_have_language_java():
    """所有 id 为 prorule.java.* 的规则，其 language 属性应为 java。需 DIFFSENSE_FULL_PRO_RULES_TEST=1 才执行。"""
    if os.environ.get("DIFFSENSE_FULL_PRO_RULES_TEST", "").lower() not in ("1", "true", "yes"):
        return
    pro_dir = get_pro_rules_dir()
    if not pro_dir.is_dir():
        return  # skip if no pro-rules
    engine = RuleEngine(pro_rules_path=str(pro_dir))
    for r in engine.rules:
        rid = getattr(r, "id", "")
        if rid.startswith("prorule.java."):
            lang = getattr(r, "language", None)
            assert lang == "java", f"Rule {rid} should have language=java, got {lang!r}"


if __name__ == "__main__":
    # 默认只跑快速 fixture 测试；完整 pro-rules 测试较慢（约 3 分钟），设 DIFFSENSE_FULL_PRO_RULES_TEST=1 启用
    run_full = os.environ.get("DIFFSENSE_FULL_PRO_RULES_TEST", "").lower() in ("1", "true", "yes")
    test_java_language_recognized_from_fixture()
    if run_full:
        test_pro_rules_load_and_language_recognition()
        test_java_rules_have_language_java()
    print("[OK] pro-rules language integration tests passed.")
