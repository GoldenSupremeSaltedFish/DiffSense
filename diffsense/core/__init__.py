# Core version for cache invalidation
# Increment this whenever the parser logic, AST detection logic, or data structures change.
CACHE_VERSION = "v2.2.0-rev1"

import os
import json
import time
from typing import Dict, Any, List, Optional, Tuple


def get_cache_max_age_seconds() -> int:
    """Return cache TTL in seconds; 0 means no expiry. From env DIFFSENSE_CACHE_MAX_AGE_DAYS."""
    try:
        days = os.environ.get("DIFFSENSE_CACHE_MAX_AGE_DAYS", "")
        if not days:
            return 0
        return max(0, int(float(days) * 86400))
    except (ValueError, TypeError):
        return 0


def analyze_diff(
    diff_content: str,
    rules_path: str = "config",
    profile: Optional[str] = None,
    quality_config: Optional[Dict[str, Any]] = None,
    pro_rules_path: Optional[str] = None,
    experimental: bool = False,
    experimental_report_only: bool = True,
    baseline_file: Optional[str] = None,
    since_baseline: bool = False,
) -> Dict[str, Any]:
    """
    核心分析函数 - 纯函数式接口，输入 diff 内容，返回结构化审计结果。
    
    Args:
        diff_content: Git unified diff 内容
        rules_path: 规则配置文件或目录路径
        profile: 规则 profile (strict, lightweight, 或 None)
        quality_config: 规则质量配置
        pro_rules_path: 高级规则路径
        experimental: 是否启用实验性规则
        experimental_report_only: 实验性规则是否仅报告
        baseline_file: baseline 文件路径
        since_baseline: 是否只报告 baseline 之后的增量
    
    Returns:
        包含 review_level, details, _metrics 等字段的审计结果字典
    """
    from .parser import DiffParser
    from .ast_detector import ASTDetector
    from .rules import RuleEngine
    from .evaluator import ImpactEvaluator
    from .composer import DecisionComposer
    
    # 1. Parse Diff
    diff_parser = DiffParser()
    diff_data = diff_parser.parse(diff_content)
    
    # 2. Detect AST Signals
    ast_detector = ASTDetector()
    ast_signals = ast_detector.detect_signals(diff_data)
    
    # 3. Init Engine & Evaluator
    if quality_config is None:
        quality_config = {
            "auto_tune": False,
            "disable_threshold": 0.3,
            "degrade_threshold": 0.5,
            "min_samples": 30
        }
    
    engine_config = {
        "rule_quality": quality_config,
        "experimental": {"enabled": experimental, "report_only": experimental_report_only},
    }
    
    # Try to load dependency_versions from run_config
    try:
        from .run_config import get_run_config
        run_cfg = get_run_config(os.getcwd())
        if run_cfg.get("dependency_versions"):
            engine_config["dependency_versions"] = run_cfg["dependency_versions"]
    except Exception:
        pass
    
    # Resolve pro_rules_path if not provided
    if pro_rules_path is None:
        try:
            from .run_config import get_pro_rules_path
            pro_rules_path = get_pro_rules_path(os.getcwd())
        except Exception:
            pass
    
    rule_engine = RuleEngine(
        rules_path,
        profile=profile,
        config=engine_config,
        pro_rules_path=pro_rules_path,
    )
    evaluator = ImpactEvaluator(rule_engine)
    
    # 4. Evaluate Impact
    triggered_rules = evaluator.evaluate(diff_data, ast_signals)
    
    # 5. Baseline filtering
    if baseline_file and since_baseline:
        baseline_data = _load_baseline(baseline_file)
        baseline_keys = _baseline_set(baseline_data)
        triggered_rules = [r for r in triggered_rules if _baseline_key(r) not in baseline_keys]
    
    # 6. Compose Decision
    composer = DecisionComposer()
    result = composer.compose(triggered_rules, diff_data.get('files', []))
    
    # 7. Add Metrics
    result['_metrics'] = dict(rule_engine.get_metrics())
    result['_metrics']['cache'] = {
        "diff": diff_parser.metrics,
        "ast": ast_detector.metrics
    }
    result['_metrics']['rule_stats'] = rule_engine.get_rule_stats()
    result['_rule_quality'] = rule_engine.get_rule_quality_metrics()
    result['_quality_warnings'] = rule_engine.get_quality_warnings()
    
    # 8. Performance metrics
    result["_performance"] = {
        "cache_hit_rate_pct": _calc_cache_hit_rate(diff_parser.metrics, ast_detector.metrics),
        "rules_executed_pct": _calc_rules_executed_pct(rule_engine.get_rule_stats()),
    }
    
    return result


def _calc_cache_hit_rate(diff_metrics: Dict, ast_metrics: Dict) -> float:
    d_total = diff_metrics.get("hits", 0) + diff_metrics.get("misses", 0)
    a_total = ast_metrics.get("hits", 0) + ast_metrics.get("misses", 0)
    total = d_total + a_total
    if total == 0:
        return 0.0
    hits = diff_metrics.get("hits", 0) + ast_metrics.get("hits", 0)
    return round(hits / total * 100, 2)


def _calc_rules_executed_pct(rule_stats: Dict) -> float:
    total = rule_stats.get("total_rules", 0)
    executed = rule_stats.get("executed_count", 0)
    if total == 0:
        return 0.0
    return round(executed / total * 100, 2)


def _baseline_key(rule: Dict[str, Any]) -> str:
    return f"{rule.get('id', '')}::{rule.get('matched_file', '')}"


def _load_baseline(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        return {"items": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("items"), list):
                return data
    except Exception:
        pass
    return {"items": []}


def _baseline_set(data: Dict[str, Any]) -> set:
    items = data.get("items", [])
    return {f"{i.get('rule_id', '')}::{i.get('file', '')}" for i in items}


def build_inline_comments(triggered_rules: List[Dict[str, Any]], diff_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    构建内联评论（用于 AI Agent 场景）
    
    Args:
        triggered_rules: 触发的规则列表
        diff_data: 解析后的 diff 数据
    
    Returns:
        内联评论列表，每条包含 path, line, body, rule_id
    """
    import re
    
    patches = {p.get("file"): p.get("patch", "") for p in diff_data.get("file_patches", [])}
    comments = []
    
    for r in triggered_rules:
        path = r.get("matched_file", "")
        patch_text = patches.get(path, "")
        if not patch_text and diff_data.get("file_patches"):
            for p in diff_data.get("file_patches", []):
                if p.get("file"):
                    path = p.get("file")
                    patch_text = p.get("patch", "")
                    break
        
        position, line = _first_added_position(patch_text) if patch_text else (1, 1)
        body = f"{r.get('severity', '').upper()} {r.get('id', '')}: {r.get('rationale', '')}"
        comments.append({
            "path": path,
            "position": position,
            "line": line,
            "body": body,
            "rule_id": r.get("id", "")
        })
    return comments


def _first_added_position(patch_text: str) -> Tuple[int, int]:
    lines = patch_text.splitlines()
    position = 1
    new_line = None
    for i, line in enumerate(lines, start=1):
        if line.startswith("@@"):
            m = re.search(r"\+(\d+)", line)
            if m:
                try:
                    new_line = int(m.group(1))
                except Exception:
                    new_line = None
            position = i
            continue
        if line.startswith("+") and not line.startswith("+++"):
            if new_line is None:
                new_line = 1
            return i, new_line
        if line.startswith("-") and not line.startswith("---"):
            continue
        if new_line is not None:
            new_line += 1
    return position, new_line or 1
