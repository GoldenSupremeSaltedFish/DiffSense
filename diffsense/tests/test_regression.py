"""
回归检测入口：按 regression_manifest.yaml 执行所有用例，用于规则/引擎改动后的全量回归。
运行: pytest diffsense/tests/test_regression.py -v
"""
import pytest

from diffsense.tests.regression_helpers import (
    load_regression_manifest,
    run_one_regression_case,
    assert_regression_case,
)


def _get_cases():
    cases = load_regression_manifest()
    return [c for c in cases if c.get("id")]


@pytest.mark.parametrize("case", _get_cases(), ids=[c["id"] for c in _get_cases()])
def test_regression_case(case):
    """单条回归用例：加载 diff → 解析 → 检测 signals → 跑规则 → 按 manifest 断言。"""
    _, signals, triggered = run_one_regression_case(case)
    assert_regression_case(case, signals, triggered)
