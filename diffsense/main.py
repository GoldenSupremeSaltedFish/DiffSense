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
    parser.add_argument("--rules", default="config/rules.yaml", help="Path to rules config")
    parser.add_argument("--format", choices=["json", "markdown"], default="json", help="Output format")
    
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
        
    rule_engine = RuleEngine(rules_path)
    evaluator = ImpactEvaluator(rule_engine)
    
    # 4. Evaluate Impact
    # Now returns a list of triggered rules (List[Dict])
    triggered_rules = evaluator.evaluate(diff_data, ast_signals)
    
    # 5. Compose Decision
    composer = DecisionComposer()
    # Now takes triggered_rules and list of files
    result = composer.compose(triggered_rules, diff_data.get('files', []))
    
    # Add Rule Performance Metrics (Hidden field for replay tool)
    result['_metrics'] = rule_engine.get_metrics()

    # 6. Output
    if args.format == "json":
        print(json.dumps(result, indent=2))
    elif args.format == "markdown":
        renderer = MarkdownRenderer()
        print(renderer.render(result))

if __name__ == "__main__":
    main()
