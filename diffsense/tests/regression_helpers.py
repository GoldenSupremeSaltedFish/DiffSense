"""
回归检测公共逻辑：路径解析、清单加载、单用例执行。
供 test_regression.py 与其它需要跑「diff → signals → rules」的测试复用。
"""
import os
import yaml
from pathlib import Path

# 测试目录与 fixtures 根（相对 tests/）
TESTS_DIR = Path(__file__).resolve().parent
FIXTURES_BASE = TESTS_DIR / "fixtures"


def get_fixture_path(rel_path: str) -> Path:
    """回归用例里 fixture 为相对 tests/fixtures 的路径，如 ast_cases/concurrency/lock.diff"""
    return FIXTURES_BASE / rel_path


def get_rules_path() -> str:
    """解析 rules.yaml 路径：优先 repo 下的 diffsense/config，否则 tests 同级的 config。"""
    # 1) 以 diffsense 为包运行时：repo_root 在 sys.path，diffsense/config/rules.yaml
    repo_root = TESTS_DIR.parent.parent  # .../DiffSense
    candidate = repo_root / "diffsense" / "config" / "rules.yaml"
    if candidate.exists():
        return str(candidate)
    # 2) 仅 diffsense 目录
    candidate = TESTS_DIR.parent / "config" / "rules.yaml"
    if candidate.exists():
        return str(candidate)
    return str(repo_root / "diffsense" / "config" / "rules.yaml")


def load_regression_manifest() -> list:
    """加载 regression_manifest.yaml，返回 cases 列表。"""
    manifest_path = TESTS_DIR / "regression_manifest.yaml"
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data.get("cases", [])


def run_one_regression_case(case: dict):
    """
    执行单条回归用例：读 diff → parse → detect_signals → evaluate rules。
    返回 (diff_data, signals, triggered)；
    若 fixture 不存在或执行异常，则 raise。
    """
    from diffsense.core.parser import DiffParser
    from diffsense.core.ast_detector import ASTDetector
    from diffsense.core.rules import RuleEngine

    rel = case.get("fixture")
    if not rel:
        raise ValueError("case missing 'fixture'")
    path = get_fixture_path(rel)
    if not path.exists():
        raise FileNotFoundError(f"Fixture not found: {path}")

    content = path.read_text(encoding="utf-8")
    parser = DiffParser()
    diff_data = parser.parse(content)
    if not diff_data.get("file_patches") and content.strip():
        diff_data.setdefault("file_patches", [])
        fname = case.get("file_for_patch", "Dummy.java")
        diff_data["file_patches"].append({"file": fname, "patch": content})
    if "raw_diff" not in diff_data:
        diff_data["raw_diff"] = content

    detector = ASTDetector()
    signals = detector.detect_signals(diff_data)
    engine = RuleEngine(get_rules_path())
    triggered = engine.evaluate(diff_data, signals)
    return diff_data, list(signals), triggered


def assert_regression_case(case: dict, signals: list, triggered: list) -> None:
    """
    根据 case 的 expect_* 字段断言。
    失败时抛出 AssertionError。
    """
    signal_ids = [getattr(s, "id", s) for s in signals]
    rule_ids = [r["id"] for r in triggered]

    if case.get("expect_no_signals"):
        assert len(signals) == 0, f"Expected no signals, got: {signal_ids}"

    for sid in case.get("expect_signals", []):
        assert sid in signal_ids, f"Expected signal {sid} in {signal_ids}"

    for rid in case.get("expect_rules_contain", []):
        assert rid in rule_ids, f"Expected rule {rid} in {rule_ids}"

    for sid in case.get("expect_signals_contain", []):
        assert any(sid in s for s in signal_ids), f"Expected signal containing {sid} in {signal_ids}"

    if case.get("expect_signal_count") is not None:
        assert len(signals) == case["expect_signal_count"], (
            f"Expected {case['expect_signal_count']} signals, got {len(signals)}: {signal_ids}"
        )

    if case.get("expect_critical_rule"):
        critical = [r for r in triggered if r.get("severity") == "critical"]
        assert len(critical) > 0, f"Expected at least one critical rule, got: {triggered}"

    if case.get("expect_critical_rule_id_contains"):
        sub = case["expect_critical_rule_id_contains"]
        critical = [r for r in triggered if r.get("severity") == "critical"]
        ok = any(sub in r.get("id", "") for r in critical)
        assert ok, f"Expected a critical rule id containing '{sub}', got: {critical}"
