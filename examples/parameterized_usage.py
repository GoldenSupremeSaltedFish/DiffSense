#!/usr/bin/env python3
"""
Example usage of DiffSense with parameterized PRO rules path.

This demonstrates how to use the new pro_rules_path parameter to 
load PRO rules from a custom location.
"""

from diffsense.core.rules import RuleEngine

def main():
    # Example 1: Simple rules only (no PRO rules)
    print("=== Example 1: Simple Rules Only ===")
    engine_simple = RuleEngine()
    
    normal_rules = [rule for rule in engine_simple.rules if not hasattr(rule, 'id') or not rule.id.startswith('prorule.')]
    pro_rules = [rule for rule in engine_simple.rules if hasattr(rule, 'id') and rule.id.startswith('prorule.')]
    
    print(f"Normal rules: {len(normal_rules)}")
    print(f"PRO rules: {len(pro_rules)}")
    
    # Example 2: Load PRO rules from custom path
    print("\n=== Example 2: With PRO Rules ===")
    pro_rules_path = "pro-rules"
    engine_pro = RuleEngine(pro_rules_path=pro_rules_path)
    
    normal_rules_pro = [rule for rule in engine_pro.rules if not hasattr(rule, 'id') or not rule.id.startswith('prorule.')]
    pro_rules_pro = [rule for rule in engine_pro.rules if hasattr(rule, 'id') and rule.id.startswith('prorule.')]
    
    print(f"Normal rules: {len(normal_rules_pro)}")
    print(f"PRO rules: {len(pro_rules_pro)}")
    
    # Example 3: Categorize PRO rules by domain
    print("\n=== Example 3: PRO Rules by Domain ===")
    domains = {}
    for rule in pro_rules_pro:
        if hasattr(rule, 'id'):
            # Extract domain from rule ID (e.g., prorule.runtime.concurrency -> runtime)
            parts = rule.id.split('.')
            if len(parts) >= 2 and parts[0] == 'prorule':
                domain = parts[1]
                domains[domain] = domains.get(domain, 0) + 1
    
    for domain, count in sorted(domains.items()):
        print(f"  {domain}: {count}")
    
    print(f"\nTotal PRO rules: {len(pro_rules_pro)}")

if __name__ == "__main__":
    main()