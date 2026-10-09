import argparse
import json
import sys
import os
import re
import time
from typing import Dict, Any, List, Tuple
from core.parser import DiffParser
from core.rules import RuleEngine
from core.evaluator import ImpactEvaluator
from core.composer import DecisionComposer
from core.renderer import MarkdownRenderer, HtmlRenderer
from core.ast_detector import ASTDetector
from constants import SCHEMA_VERSION, EXIT_OK, EXIT_RISK, EXIT_ERROR, exit_code_for_review_level
from sarif import build_sarif_report

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
        return {"items": []}
    return {"items": []}

def _save_baseline(path: str, items: List[Dict[str, Any]]) -> None:
    data = {"items": items}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _baseline_items(triggered_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    items = []
    for r in triggered_rules:
        items.append({
            "rule_id": r.get("id", ""),
            "file": r.get("matched_file", "")
        })
    return items

def _baseline_set(data: Dict[str, Any]) -> set:
    items = data.get("items", [])
    return {f"{i.get('rule_id', '')}::{i.get('file', '')}" for i in items}

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

def _build_inline_comments(triggered_rules: List[Dict[str, Any]], diff_data: Dict[str, Any]) -> List[Dict[str, Any]]:
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

def _write_json(path: str, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def analyze_diff(
    diff_content: str,
    rules_path: str,
    profile=None,
    baseline=False,
    since_baseline=False,
    baseline_file=".diffsense-baseline.json",
    report_json="diffsense-report.json",
    report_html="diffsense-report.html",
    comments_json="diffsense-comments.json",
    quality_auto_tune=False,
    quality_disable_threshold=0.3,
    quality_downgrade_threshold=0.5,
    quality_min_samples=30,
    experimental=False,
    experimental_report_only=True,
    format="json",
    write_files=True,
):
    """Run the full audit pipeline on raw diff text and return the report dict.

    Shared by the CLI entrypoint (``main()``) and the MCP thin shell
    (``mcp_server``) so the machine-readable report contract stays in one
    place. The report is never printed to stdout here; callers own rendering
    and exit codes.
    """
    # Apply official recommended config from .diffsense.yaml when not overridden
    try:
        from core.run_config import get_run_config
        run_cfg = get_run_config(os.getcwd())
        if profile is None and run_cfg.get("profile"):
            profile = run_cfg["profile"]
        if not quality_auto_tune and run_cfg.get("auto_tune"):
            quality_auto_tune = True
        rq = run_cfg.get("rule_quality") or {}
        if quality_downgrade_threshold == 0.5 and "degrade_threshold" in rq:
            try:
                quality_downgrade_threshold = float(rq["degrade_threshold"])
            except (TypeError, ValueError):
                pass
        if quality_disable_threshold == 0.3 and "disable_threshold" in rq:
            try:
                quality_disable_threshold = float(rq["disable_threshold"])
            except (TypeError, ValueError):
                pass
        if quality_min_samples == 30 and "min_samples" in rq:
            try:
                quality_min_samples = int(rq["min_samples"])
            except (TypeError, ValueError):
                pass
    except Exception:
        pass

    wall_start = time.perf_counter()

    # 2. Parse Diff
    diff_parser = DiffParser()
    diff_data = diff_parser.parse(diff_content)

    # 2.5 Detect AST Signals
    ast_detector = ASTDetector()
    ast_signals = ast_detector.detect_signals(diff_data)

    # 3. Init Engine & Evaluator
    # Use absolute path for default rules if relative path fails
    if not os.path.exists(rules_path):
        # try relative to script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        rules_path = os.path.join(script_dir, rules_path)

    quality_config = {
        "auto_tune": quality_auto_tune,
        "disable_threshold": quality_disable_threshold,
        "degrade_threshold": quality_downgrade_threshold,
        "min_samples": quality_min_samples
    }
    pro_rules_path = None
    try:
        from core.run_config import get_pro_rules_path
        pro_rules_path = get_pro_rules_path(os.getcwd())
    except Exception:
        pass
    engine_config = {
        "rule_quality": quality_config,
        "experimental": {"enabled": experimental, "report_only": experimental_report_only},
    }
    try:
        from core.run_config import get_run_config
        _rc = get_run_config(os.getcwd())
        if _rc.get("dependency_versions"):
            engine_config["dependency_versions"] = _rc["dependency_versions"]
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
    if baseline:
        _save_baseline(baseline_file, _baseline_items(triggered_rules))
    if since_baseline:
        baseline_data = _load_baseline(baseline_file)
        baseline_keys = _baseline_set(baseline_data)
        triggered_rules = [r for r in triggered_rules if _baseline_key(r) not in baseline_keys]

    # 5. Compose Decision
    composer = DecisionComposer()
    composed = composer.compose(triggered_rules, diff_data.get('files', []))
    # Machine-readable contract: schema_version MUST be the first field.
    result = {"schema_version": SCHEMA_VERSION}
    result.update(composed)

    # Add Rule Performance & Cache Metrics (copy so we don't mutate engine.metrics)
    result['_metrics'] = dict(rule_engine.get_metrics())
    result['_metrics']['cache'] = {
        "diff": diff_parser.metrics,
        "ast": ast_detector.metrics
    }
    result["_metrics"]["rule_stats"] = rule_engine.get_rule_stats()
    result["_rule_quality"] = rule_engine.get_rule_quality_metrics()
    result["_quality_warnings"] = rule_engine.get_quality_warnings()

    # Structured performance for CI (machine-readable)
    wall_s = time.perf_counter() - wall_start
    d_m = diff_parser.metrics
    a_m = ast_detector.metrics
    d_total = d_m["hits"] + d_m["misses"]
    a_total = a_m["hits"] + a_m["misses"]
    total_ops = d_total + a_total
    cache_hit_rate_pct = ((d_m["hits"] + a_m["hits"]) / total_ops * 100) if total_ops > 0 else 0.0
    r_stats = result["_metrics"].get("rule_stats", {})
    total_rules = r_stats.get("total_rules", 0)
    executed_count = r_stats.get("executed_count", 0)
    rules_executed_pct = (executed_count / total_rules * 100) if total_rules else 0.0
    result["_performance"] = {
        "wall_clock_s": round(wall_s, 3),
        "cache": {"diff": dict(d_m), "ast": dict(a_m)},
        "cache_hit_rate_pct": round(cache_hit_rate_pct, 2),
        "rules_executed": executed_count,
        "rules_total": total_rules,
        "rules_executed_pct": round(rules_executed_pct, 2),
    }

    # 6. Output report summary to stderr for CI visibility
    sys.stderr.write("\n" + "="*40 + "\n")
    sys.stderr.write("🚀 DiffSense Performance Report\n")
    sys.stderr.write("="*40 + "\n")

    # Diff Cache
    d_m = diff_parser.metrics
    d_total = d_m["hits"] + d_m["misses"]
    d_rate = (d_m["hits"] / d_total * 100) if d_total > 0 else 0
    sys.stderr.write(f"🔹 Diff Cache Hit: {d_rate:.1f}% ({d_m['hits']}/{d_total})\n")

    # AST Cache
    a_m = ast_detector.metrics
    a_total = a_m["hits"] + a_m["misses"]
    a_rate = (a_m["hits"] / a_total * 100) if a_total > 0 else 0
    sys.stderr.write(f"🔹 AST Cache Hit:  {a_rate:.1f}% ({a_m['hits']}/{a_total})\n")

    # Saved Time (Estimated)
    d_saved = d_m["hits"] * d_m["saved_ms"]
    a_saved = a_m["hits"] * (a_m["saved_ms"] / a_m["misses"] if a_m["misses"] > 0 else 0)
    total_saved = (d_saved + a_saved) / 1000
    sys.stderr.write(f"⏱️  Estimated Saved Time: {total_saved:.2f}s\n")

    # Rules executed (Q1/Q2 visibility)
    r_stats = result["_metrics"].get("rule_stats", {})
    total_rules = r_stats.get("total_rules", 0)
    executed_count = r_stats.get("executed_count", 0)
    exec_pct = (executed_count / total_rules * 100) if total_rules else 0
    sys.stderr.write(f"🔹 Rules executed: {executed_count} / {total_rules} ({exec_pct:.0f}%)\n")
    if total_rules and exec_pct > 30:
        sys.stderr.write("   💡 Consider enabling more profile/scheduler filters to reduce executed rules.\n")

    # Slowest Rules
    sys.stderr.write("\n🐢 Top 3 Slowest Rules:\n")
    r_stats = result["_metrics"].get("rule_stats", {}).get("top_slow", [])
    for r in r_stats[:3]:
        r_id = r.get("rule_id")
        r_time_ms = r.get("time_ms", 0)
        sys.stderr.write(f"  - {r_id}: {r_time_ms:.2f}ms\n")
    for w in result["_quality_warnings"]:
        sys.stderr.write(f"⚠️ Low quality rule: {w.get('rule_id')} precision {w.get('precision'):.2f} (hits {w.get('hits')})\n")

    # Triggered rules summary
    if triggered_rules:
        sys.stderr.write("\n🎯 Triggered Rules Summary:\n")
        for r in triggered_rules:
            sys.stderr.write(f"  - {r.get('severity', '').upper()} {r.get('id', '')}: {r.get('matched_file', '')}\n")

    sys.stderr.write("="*40 + "\n\n")
    rule_engine.persist_rule_quality()

    if write_files:
        # 7. Persist machine-readable artifacts (report JSON/HTML + inline comments)
        inline_comments = _build_inline_comments(triggered_rules, diff_data)
        _write_json(report_json, result)
        html_report = HtmlRenderer().render(result)
        with open(report_html, "w", encoding="utf-8") as f:
            f.write(html_report)
        _write_json(comments_json, inline_comments)

    return result


def main():
    parser = argparse.ArgumentParser(description="DiffSense: Event-driven MR Audit Analyzer")
    parser.add_argument("diff_file", help="Path to the diff file")
    parser.add_argument("--rules", default="config", help="Path to rules: single YAML file or directory of YAML files")
    parser.add_argument("--format", choices=["json", "markdown", "sarif"], default="json", help="Output format: json | markdown | sarif")
    parser.add_argument("--profile", default=None, help="Profile: strict or lightweight")
    parser.add_argument("--baseline", action="store_true", help="Generate baseline file for existing issues")
    parser.add_argument("--since-baseline", action="store_true", help="Only report findings not in baseline")
    parser.add_argument("--baseline-file", default=".diffsense-baseline.json", help="Baseline file path")
    parser.add_argument("--report-json", default="diffsense-report.json", help="Report JSON output path")
    parser.add_argument("--report-html", default="diffsense-report.html", help="Report HTML output path")
    parser.add_argument("--comments-json", default="diffsense-comments.json", help="Inline comments JSON output path")
    parser.add_argument("--quality-auto-tune", action="store_true", help="Enable quality auto tune (skip/downgrade)")
    parser.add_argument("--quality-disable-threshold", type=float, default=0.3, help="Disable threshold")
    parser.add_argument("--quality-downgrade-threshold", type=float, default=0.5, help="Downgrade threshold")
    parser.add_argument("--quality-min-samples", type=int, default=30, help="Minimum samples before actions")
    parser.add_argument("--experimental", action="store_true", help="Include experimental rules (report-only by default)")
    parser.add_argument("--experimental-report-only", dest="experimental_report_only", action="store_true", default=True, help="Do not affect decision with experimental rules")
    parser.add_argument("--experimental-affect-decision", dest="experimental_report_only", action="store_false", help="Allow experimental rules to affect decision")

    args = parser.parse_args()
    # 1. Read Diff
    try:
        with open(args.diff_file, 'r', encoding='utf-8') as f:
            diff_content = f.read()
    except FileNotFoundError:
        print(f"Error: File {args.diff_file} not found.")
        sys.exit(EXIT_ERROR)

    # 2-6. Run the shared analysis pipeline (parse -> AST -> rules -> decision -> report)
    result = analyze_diff(
        diff_content,
        args.rules,
        profile=args.profile,
        baseline=args.baseline,
        since_baseline=args.since_baseline,
        baseline_file=args.baseline_file,
        report_json=args.report_json,
        report_html=args.report_html,
        comments_json=args.comments_json,
        quality_auto_tune=args.quality_auto_tune,
        quality_disable_threshold=args.quality_disable_threshold,
        quality_downgrade_threshold=args.quality_downgrade_threshold,
        quality_min_samples=args.quality_min_samples,
        experimental=args.experimental,
        experimental_report_only=args.experimental_report_only,
        format=args.format,
    )

    # 7. Output Result
    if args.format == "json":
        print(json.dumps(result, indent=2))
    elif args.format == "markdown":
        renderer = MarkdownRenderer()
        print(renderer.render(result))
    elif args.format == "sarif":
        print(json.dumps(build_sarif_report(result), indent=2))

    # Machine-readable exit code: 0 = pass, 1 = blocked findings, 2 = tool error.
    sys.exit(exit_code_for_review_level(result.get("review_level", "normal")))

if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(EXIT_ERROR)
