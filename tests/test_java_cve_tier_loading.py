#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test Java CVE tier-based loading
Verifies that rules are loaded correctly based on profile and tier classification
"""
import os
import sys
from pathlib import Path

# Add project root to path
_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))

from diffsense.core.rules import RuleEngine


def get_pro_rules_dir():
    return _ROOT / "pro-rules"


def test_tier_loading_lightweight():
    """Test lightweight profile loads only Tier 1 (Critical) rules"""
    pro_dir = get_pro_rules_dir()
    if not pro_dir.is_dir():
        print("[SKIP] pro-rules directory not found")
        return
    
    # Create engine with lightweight profile
    engine = RuleEngine(pro_rules_path=str(pro_dir), profile="lightweight")
    
    # Count rules by severity
    severity_counts = {}
    for rule in engine.rules:
        sev = getattr(rule, 'severity', 'unknown')
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
    
    # Verify only critical rules are loaded
    assert severity_counts.get('critical', 0) > 0, "Should load critical rules"
    assert severity_counts.get('high', 0) == 0, "Should NOT load high rules in lightweight mode"
    assert severity_counts.get('medium', 0) == 0, "Should NOT load medium rules in lightweight mode"
    assert severity_counts.get('low', 0) == 0, "Should NOT load low rules in lightweight mode"
    
    total_rules = sum(severity_counts.values())
    print(f"[OK] Lightweight profile: {total_rules} rules loaded")
    print(f"     Critical: {severity_counts.get('critical', 0)}")
    print(f"     High: {severity_counts.get('high', 0)} (expected: 0)")
    print(f"     Medium: {severity_counts.get('medium', 0)} (expected: 0)")
    print(f"     Low: {severity_counts.get('low', 0)} (expected: 0)")


def test_tier_loading_standard():
    """Test standard profile loads Tier 1 + Tier 2 (Critical + High) rules"""
    pro_dir = get_pro_rules_dir()
    if not pro_dir.is_dir():
        print("[SKIP] pro-rules directory not found")
        return
    
    # Create engine with standard profile
    engine = RuleEngine(pro_rules_path=str(pro_dir), profile="standard")
    
    # Count rules by severity
    severity_counts = {}
    for rule in engine.rules:
        sev = getattr(rule, 'severity', 'unknown')
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
    
    # Verify critical and high rules are loaded
    assert severity_counts.get('critical', 0) > 0, "Should load critical rules"
    assert severity_counts.get('high', 0) > 0, "Should load high rules"
    assert severity_counts.get('medium', 0) == 0, "Should NOT load medium rules in standard mode"
    assert severity_counts.get('low', 0) == 0, "Should NOT load low rules in standard mode"
    
    total_rules = sum(severity_counts.values())
    print(f"[OK] Standard profile: {total_rules} rules loaded")
    print(f"     Critical: {severity_counts.get('critical', 0)}")
    print(f"     High: {severity_counts.get('high', 0)}")
    print(f"     Medium: {severity_counts.get('medium', 0)} (expected: 0)")
    print(f"     Low: {severity_counts.get('low', 0)} (expected: 0)")


def test_tier_loading_strict():
    """Test strict profile loads all tiers"""
    pro_dir = get_pro_rules_dir()
    if not pro_dir.is_dir():
        print("[SKIP] pro-rules directory not found")
        return
    
    # Create engine with strict profile (or no profile = all rules)
    engine = RuleEngine(pro_rules_path=str(pro_dir), profile="strict")
    
    # Count rules by severity
    severity_counts = {}
    for rule in engine.rules:
        sev = getattr(rule, 'severity', 'unknown')
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
    
    # Verify all rules are loaded
    assert severity_counts.get('critical', 0) > 0, "Should load critical rules"
    assert severity_counts.get('high', 0) > 0, "Should load high rules"
    # Medium and low may or may not be present depending on data
    
    total_rules = sum(severity_counts.values())
    print(f"[OK] Strict profile: {total_rules} rules loaded")
    print(f"     Critical: {severity_counts.get('critical', 0)}")
    print(f"     High: {severity_counts.get('high', 0)}")
    print(f"     Medium: {severity_counts.get('medium', 0)}")
    print(f"     Low: {severity_counts.get('low', 0)}")


def test_tier_directory_structure():
    """Test that tier directories exist and contain YAML files"""
    java_tier_base = get_pro_rules_dir() / "cve" / "java"
    if not java_tier_base.is_dir():
        print("[SKIP] pro-rules/cve/java directory not found")
        return
    
    tier_dirs = {
        'tier1_critical': java_tier_base / "tier1_critical",
        'tier2_high': java_tier_base / "tier2_high",
        'tier3_medium': java_tier_base / "tier3_medium",
        'tier4_low': java_tier_base / "tier4_low"
    }
    
    print("\n[Tier Directory Structure]:")
    for tier_name, tier_path in tier_dirs.items():
        if tier_path.is_dir():
            yaml_count = len(list(tier_path.glob("*.yaml")))
            print(f"  {tier_name:20s}: {yaml_count:5d} YAML files")
        else:
            print(f"  {tier_name:20s}: NOT FOUND")


def main():
    print("=" * 80)
    print("Java CVE Tier Loading Tests")
    print("=" * 80)
    
    # First check tier structure
    test_tier_directory_structure()
    
    print("\n" + "=" * 80)
    print("Running tier loading tests...")
    print("=" * 80)
    
    try:
        print("\n[Test 1] Lightweight Profile (Tier 1 only)")
        print("-" * 80)
        test_tier_loading_lightweight()
        
        print("\n[Test 2] Standard Profile (Tier 1 + Tier 2)")
        print("-" * 80)
        test_tier_loading_standard()
        
        print("\n[Test 3] Strict Profile (All Tiers)")
        print("-" * 80)
        test_tier_loading_strict()
        
        print("\n" + "=" * 80)
        print("[SUCCESS] All tier loading tests passed!")
        print("=" * 80)
        
    except AssertionError as e:
        print(f"\n[FAILED] {str(e)}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
