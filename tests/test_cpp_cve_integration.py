#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
C++ CVE 规则集成测试：
1. 使用 CVE JSON 5 或扁平 CVE 数据生成 PROrule，写入临时目录；
2. 用 RuleEngine 加载该目录，断言存在 language=cpp 且 id 为 prorule.cpp.* 的规则。
"""
import os
import sys
import tempfile
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))

from diffsense.converters.cpp_cve_converter import (
    CPPCVEConverter,
    parse_cve_json5_to_flat,
    is_cpp_related_cve,
)


# 最小 CVE JSON 5 样本（用于解析与转换）
SAMPLE_CVE_JSON5 = {
    "cveMetadata": {
        "cveId": "CVE-2024-12345",
        "datePublished": "2024-06-15T00:00:00Z",
    },
    "containers": {
        "cna": {
            "descriptions": [{"lang": "en", "value": "Buffer overflow in C++ library when parsing user input."}],
            "references": [{"url": "https://nvd.nist.gov/vuln/detail/CVE-2024-12345"}],
            "affected": [{"vendor": "Example", "product": "Example C++ Parser"}],
            "metrics": [{"cvssV3_1": {"baseScore": 8.5}}],
            "problemTypes": [{"descriptions": [{"cweId": "CWE-120"}]}],
        }
    },
}


def test_cpp_cve_json5_parse_and_convert():
    """CVE JSON 5 解析为扁平结构并转换为 PROrule。"""
    flat = parse_cve_json5_to_flat(SAMPLE_CVE_JSON5)
    assert flat is not None
    assert flat.get("cve_id") == "CVE-2024-12345"
    assert "C++" in (flat.get("description") or "")
    assert flat.get("cvss_score") == 8.5

    converter = CPPCVEConverter()
    rule = converter.from_cve_json5(SAMPLE_CVE_JSON5)
    assert rule is not None
    assert rule.get("language") == "cpp"
    assert rule.get("id", "").startswith("prorule.cpp.")
    assert rule.get("severity") in ("critical", "high", "medium", "low")
    print("[OK] CVE JSON 5 -> PROrule conversion")


def test_cpp_related_filter():
    """C++ 相关性筛选：描述含 C++ 关键词则通过。"""
    assert is_cpp_related_cve("Buffer overflow in C++ library") is True
    assert is_cpp_related_cve("Vulnerability in std::string implementation") is True
    assert is_cpp_related_cve("Issue in Python requests library") is False
    print("[OK] is_cpp_related_cve filter")


def test_cpp_rules_loadable_by_engine():
    """生成若干条 C++ PROrule 写入临时目录，用 RuleEngine 加载并断言 language=cpp。"""
    from diffsense.core.rules import RuleEngine

    converter = CPPCVEConverter()
    flat_list = [
        {"cve_id": "CVE-2024-A001", "description": "Use-after-free in C++ code.", "references": [], "published_date": "2024-01-01"},
        {"cve_id": "CVE-2024-A002", "description": "Race condition in multithreaded C++ app.", "references": [], "published_date": "2024-02-01"},
    ]
    pro_rules = converter.batch_convert(flat_list)
    assert len(pro_rules) == 2

    with tempfile.TemporaryDirectory(prefix="diffsense_cpp_cve_") as tmp:
        out_dir = Path(tmp) / "cve" / "cpp"
        converter.save_rules_to_yaml(pro_rules, str(out_dir))
        yaml_files = list(out_dir.glob("*.yaml"))
        assert len(yaml_files) == 2

        engine = RuleEngine(pro_rules_path=str(out_dir.parent.parent))
        cpp_rules = [r for r in engine.rules if getattr(r, "language", None) == "cpp"]
        assert len(cpp_rules) >= 2, f"Expected at least 2 cpp rules, got {len(cpp_rules)}"
        for r in cpp_rules:
            rid = getattr(r, "id", "")
            assert rid.startswith("prorule.cpp."), f"cpp rule id should start with prorule.cpp.: {rid}"
    print("[OK] C++ PROrules loadable by RuleEngine with language=cpp")


def test_full_pro_rules_cpp_if_present():
    """若存在 pro-rules/cve/cpp 目录，完整加载 pro-rules 时应包含 language=cpp 的规则。"""
    if os.environ.get("DIFFSENSE_FULL_PRO_RULES_TEST", "").lower() not in ("1", "true", "yes"):
        return
    pro_dir = _ROOT / "pro-rules"
    cpp_dir = pro_dir / "cve" / "cpp"
    if not cpp_dir.is_dir() or not list(cpp_dir.glob("*.yaml")):
        return  # 未生成 cpp 规则时跳过
    from diffsense.core.rules import RuleEngine
    engine = RuleEngine(pro_rules_path=str(pro_dir))
    cpp_rules = [r for r in engine.rules if getattr(r, "language", None) == "cpp"]
    assert len(cpp_rules) > 0, "pro-rules/cve/cpp should be loaded and have language=cpp"
    print(f"[OK] Full pro-rules: {len(cpp_rules)} cpp rule(s) loaded")


if __name__ == "__main__":
    test_cpp_cve_json5_parse_and_convert()
    test_cpp_related_filter()
    test_cpp_rules_loadable_by_engine()
    test_full_pro_rules_cpp_if_present()
    print("[OK] All C++ CVE integration tests passed.")
