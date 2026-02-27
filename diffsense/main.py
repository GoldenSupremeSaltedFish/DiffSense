import argparse
import json
import sys
import os
import re
from typing import Dict, Any, List, Tuple
from core.parser import DiffParser
from core.rules import RuleEngine
from core.evaluator import ImpactEvaluator
from core.composer import DecisionComposer
from core.renderer import MarkdownRenderer, HtmlRenderer
from core.ast_detector import ASTDetector

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

def main():
    parser = argparse.ArgumentParser(description="DiffSense: Event-driven MR Audit Analyzer")
    parser.add_argument("diff_file", help="Path to the diff file")
    parser.add_argument("--rules", default="config/rules.yaml", help="Path to rules: single YAML file or directory of YAML files")
    parser.add_argument("--format", choices=["json", "markdown"], default="json", help="Output format")
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

    args = parser.parse_args()
    
    # 1. Read Diff
    try:
        with open(args.diff_file, 'r', encoding='utf-8') as f:
            diff_content = f.read()
    except FileNotFoundError:
        print(f"Error: File {args.diff_file} not found.")
        sys.exit(1)
        
    # 2. Parse Diff
    diff_parser = DiffParser()
    diff_data = diff_parser.parse(diff_content)
    
    # 2.5 Detect AST Signals
    ast_detector = ASTDetector()
    ast_signals = ast_detector.detect_signals(diff_data)
    
    # 3. Init Engine & Evaluator
    # Use absolute path for default rules if relative path fails
    rules_path = args.rules
    if not os.path.exists(rules_path):
        # try relative to script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        rules_path = os.path.join(script_dir, args.rules)
        
    quality_config = {
        "auto_tune": args.quality_auto_tune,
        "disable_threshold": args.quality_disable_threshold,
        "degrade_threshold": args.quality_downgrade_threshold,
        "min_samples": args.quality_min_samples
    }
    rule_engine = RuleEngine(rules_path, profile=args.profile, config={"rule_quality": quality_config})
    evaluator = ImpactEvaluator(rule_engine)
    
    # 4. Evaluate Impact
    # Now returns a list of triggered rules (List[Dict])
    triggered_rules = evaluator.evaluate(diff_data, ast_signals)
    if args.baseline:
        _save_baseline(args.baseline_file, _baseline_items(triggered_rules))
    if args.since_baseline:
        baseline_data = _load_baseline(args.baseline_file)
        baseline_keys = _baseline_set(baseline_data)
        triggered_rules = [r for r in triggered_rules if _baseline_key(r) not in baseline_keys]
    
    # 5. Compose Decision
    composer = DecisionComposer()
    # Now takes triggered_rules and list of files
    result = composer.compose(triggered_rules, diff_data.get('files', []))
    
    # Add Rule Performance & Cache Metrics
    result['_metrics'] = rule_engine.get_metrics()
    result['_metrics']['cache'] = {
        "diff": diff_parser.metrics,
        "ast": ast_detector.metrics
    }
    result["_rule_quality"] = rule_engine.get_rule_quality_metrics()
    result["_quality_warnings"] = rule_engine.get_quality_warnings()
    
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
    # Total saved = (hits * avg_parse_time_from_misses)
    # Since we only track duration on miss, we use it as the estimate for hits.
    d_saved = d_m["hits"] * d_m["saved_ms"]
    a_saved = a_m["hits"] * (a_m["saved_ms"] / a_m["misses"] if a_m["misses"] > 0 else 0)
    total_saved = (d_saved + a_saved) / 1000
    sys.stderr.write(f"⏱️  Estimated Saved Time: {total_saved:.2f}s\n")
    
    # Slowest Rules
    sys.stderr.write("\n🐢 Top 3 Slowest Rules:\n")
    r_metrics = rule_engine.get_metrics()
    sorted_rules = sorted(r_metrics.items(), key=lambda x: x[1].get('time_ns', 0), reverse=True)
    for r_id, r_m in sorted_rules[:3]:
        r_time_ms = r_m.get('time_ns', 0) / 1_000_000
        sys.stderr.write(f"  - {r_id}: {r_time_ms:.2f}ms\n")
    for w in result["_quality_warnings"]:
        sys.stderr.write(f"⚠️ Low quality rule: {w.get('rule_id')} precision {w.get('precision'):.2f} (hits {w.get('hits')})\n")
    sys.stderr.write("="*40 + "\n\n")
    rule_engine.persist_rule_quality()
 
    # 7. Output Result
    inline_comments = _build_inline_comments(triggered_rules, diff_data)
    _write_json(args.report_json, result)
    html_report = HtmlRenderer().render(result)
    with open(args.report_html, "w", encoding="utf-8") as f:
        f.write(html_report)
    _write_json(args.comments_json, inline_comments)

    if args.format == "json":
        print(json.dumps(result, indent=2))
    elif args.format == "markdown":
        renderer = MarkdownRenderer()
        print(renderer.render(result))

if __name__ == "__main__":
    main()
