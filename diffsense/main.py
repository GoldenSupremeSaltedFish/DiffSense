import argparse
import json
import sys
import os
from core.parser import DiffParser
from core.rules import RuleEngine
from core.evaluator import ImpactEvaluator
from core.composer import DecisionComposer
from core.renderer import MarkdownRenderer
from core.ast_detector import ASTDetector

def main():
    parser = argparse.ArgumentParser(description="DiffSense: Event-driven MR Audit Analyzer")
    parser.add_argument("diff_file", help="Path to the diff file")
    parser.add_argument("--rules", default="config/rules.yaml", help="Path to rules: single YAML file or directory of YAML files")
    parser.add_argument("--format", choices=["json", "markdown"], default="json", help="Output format")
    parser.add_argument("--profile", default=None, help="Profile: strict or lightweight")

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
        
    rule_engine = RuleEngine(rules_path, profile=args.profile)
    evaluator = ImpactEvaluator(rule_engine)
    
    # 4. Evaluate Impact
    # Now returns a list of triggered rules (List[Dict])
    triggered_rules = evaluator.evaluate(diff_data, ast_signals)
    
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
    sys.stderr.write("="*40 + "\n\n")
 
    # 7. Output Result
    if args.format == "json":
        print(json.dumps(result, indent=2))
    elif args.format == "markdown":
        renderer = MarkdownRenderer()
        print(renderer.render(result))

if __name__ == "__main__":
    main()
