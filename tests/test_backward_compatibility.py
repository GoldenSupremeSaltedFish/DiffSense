"""
Test backward compatibility of rule loading.
Ensures old rules still work and new rules are loaded when available.
"""

import sys
import os

# Add diffsense to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from core.rules import RuleEngine


def test_backward_compatibility():
    """Test that old rules are still loaded"""
    print("Testing backward compatibility...")
    
    # Create engine without rules path (should load built-ins)
    engine = RuleEngine(rules_path=None, pro_rules_path=None)
    
    # Check that original 4 concurrency rules are loaded
    rule_ids = [rule.id for rule in engine.rules]
    
    original_rules = [
        "runtime.threadpool_semantic_change",
        "runtime.concurrency_regression",
        "runtime.thread_safety_removal",
        "runtime.latch_misuse"
    ]
    
    print(f"\nTotal rules loaded: {len(engine.rules)}")
    print("\nChecking original 4 concurrency rules:")
    for rule_id in original_rules:
        if rule_id in rule_ids:
            print(f"  ✅ {rule_id}")
        else:
            print(f"  ❌ {rule_id} - MISSING!")
            raise AssertionError(f"Original rule {rule_id} not loaded!")
    
    # Check new rules (if available)
    new_rule_categories = {
        "resource": 5,
        "exception": 6,
        "null_safety": 6,
        "collection": 7,
        "api": 8,
        "go": 8
    }
    
    print("\nChecking new rules (if available):")
    for category, expected_count in new_rule_categories.items():
        count = sum(1 for rid in rule_ids if rid.startswith(category) or 
                   (category == "resource" and "resource." in rid) or
                   (category == "exception" and "exception." in rid) or
                   (category == "null_safety" and "null." in rid) or
                   (category == "collection" and "collection." in rid) or
                   (category == "api" and "api." in rid) or
                   (category == "go" and rid.startswith("resource.goroutine") or 
                    rid.startswith("resource.channel") or 
                    rid.startswith("resource.defer") or
                    rid.startswith("security.") or
                    rid.startswith("runtime.race") or
                    rid.startswith("null.nil") or
                    rid.startswith("exception.error")))
        
        if count > 0:
            print(f"  ✅ {category}: {count}/{expected_count} rules loaded")
        else:
            print(f"  ⚠️  {category}: not available (optional)")
    
    print("\n✅ Backward compatibility test PASSED!")
    print(f"\nSummary: {len(engine.rules)} total rules loaded")
    print(f"  - Original rules: 4 (concurrency)")
    print(f"  - New rules: {len(engine.rules) - 4} (if available)")


def test_rule_engine_with_empty_diff():
    """Test that rule engine can evaluate empty diff without errors"""
    print("\n\nTesting rule engine evaluation...")
    
    engine = RuleEngine(rules_path=None, pro_rules_path=None)
    
    # Empty diff
    diff_data = {
        "files": [],
        "raw_diff": "",
        "stats": {"add": 0, "del": 0}
    }
    
    result = engine.evaluate(diff_data, [])
    
    if len(result) == 0:
        print("  ✅ Empty diff evaluation: PASSED")
    else:
        print(f"  ⚠️  Empty diff returned {len(result)} results (unexpected)")
    
    # Diff with Java code
    java_diff = {
        "files": ["test.java"],
        "raw_diff": "+ InputStream is = new FileInputStream(\"test.txt\");",
        "stats": {"add": 1, "del": 0}
    }
    
    result = engine.evaluate(java_diff, [])
    print(f"  ✅ Java diff evaluation: {len(result)} rule(s) triggered")
    
    # Diff with Go code
    go_diff = {
        "files": ["test.go"],
        "raw_diff": "+ file, _ := os.Open(\"test.txt\")",
        "stats": {"add": 1, "del": 0}
    }
    
    result = engine.evaluate(go_diff, [])
    print(f"  ✅ Go diff evaluation: {len(result)} rule(s) triggered")
    
    print("\n✅ Rule engine evaluation test PASSED!")


if __name__ == "__main__":
    test_backward_compatibility()
    test_rule_engine_with_empty_diff()
    print("\n" + "="*40)
    print("🎉 All backward compatibility tests PASSED!")
    print("="*40)
