import argparse
import json
import sys
import os
from core.parser import DiffParser
from core.rules import RuleEngine
from core.evaluator import ImpactEvaluator
from core.composer import DecisionComposer

def main():
    parser = argparse.ArgumentParser(description="DiffSense: Event-driven MR Audit Analyzer")
    parser.add_argument("diff_file", help="Path to the diff file")
    parser.add_argument("--rules", default="config/rules.yaml", help="Path to rules config")
    
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
    impacts = evaluator.evaluate(diff_data)
    
    # 5. Compose Decision
    composer = DecisionComposer()
    result = composer.compose(impacts)
    
    # 6. Output JSON
    output = {
        "audit_result": result,
        "details": {
            "files_changed": diff_data["files"],
            "stats": diff_data["stats"],
            "raw_impacts": impacts
        }
    }
    
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
