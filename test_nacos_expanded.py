#!/usr/bin/env python3
"""扩展测试 Nacos 提交"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import subprocess
sys.path.insert(0, r"C:\Users\30871\Desktop\diffsense-work-space\DiffSense\diffsense")

from core.parser import DiffParser
from core.ast_detector import ASTDetector
from core.rules import RuleEngine
from core.evaluator import ImpactEvaluator
from core.composer import DecisionComposer

NACOS_PATH = r"C:\Users\30871\Desktop\diffsense-work-space\DiffSense\test-space\nacos"

# 测试更多提交
TEST_COMMITS = [
    "1fae1be", "c87f888", "4042231", "9e031f1", "2f89bb21",
    "374c25698", "dd381f544", "35c58e65c", "a606f2815", "ff2767e6b",
    "a1ab77c29", "1ffcff66e", "fd7e13200", "11240e8d9", "50670df76",
    "d04b91c69", "0003a1882", "26ec64dcc", "b715a70a9", "4f95dd4f9"
]

def get_diff(h):
    r = subprocess.run(["git", "show", h], cwd=NACOS_PATH, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    return r.stdout

def run_audit(diff):
    parser = DiffParser()
    diff_data = parser.parse(diff)
    if not diff_data.get('files'):
        return None
    
    detector = ASTDetector()
    ast_signals = detector.detect_signals(diff_data)
    
    engine = RuleEngine(r"C:\Users\30871\Desktop\diffsense-work-space\DiffSense\diffsense\config\rules.yaml")
    evaluator = ImpactEvaluator(engine)
    impacts = evaluator.evaluate(diff_data, ast_signals=ast_signals)
    
    composer = DecisionComposer()
    decision = composer.compose(impacts)
    
    return {"level": decision.get("review_level"), "impacts": impacts}

print(f"Testing {len(TEST_COMMITS)} Nacos commits...\n")

rule_counts = {}
high_issues = []

for i, commit in enumerate(TEST_COMMITS, 1):
    diff = get_diff(commit)
    if not diff:
        continue
    
    result = run_audit(diff)
    if not result:
        continue
    
    triggered = result["impacts"]
    level = result["level"]
    
    print(f"[{i}] {commit[:8]}: level={level}, triggers={len(triggered)}")
    
    for t in triggered:
        rid = t.get("id", "?")
        sev = t.get("severity", "?")
        rule_counts[rid] = rule_counts.get(rid, 0) + 1
        
        if sev in ["critical", "high"]:
            high_issues.append({"commit": commit, "rule": rid, "severity": sev})

print("\n" + "="*60)
print("SUMMARY")
print("="*60)
print(f"Total commits tested: {len(TEST_COMMITS)}")
print(f"Total rule triggers: {sum(rule_counts.values())}")
print(f"HIGH/CRITICAL issues: {len(high_issues)}")

if rule_counts:
    print("\nTop triggered rules:")
    for r, c in sorted(rule_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"  {r}: {c}")

if high_issues:
    print("\nHIGH/CRITICAL issues:")
    for iss in high_issues[:10]:
        print(f"  {iss['commit'][:8]}: [{iss['severity']}] {iss['rule']}")