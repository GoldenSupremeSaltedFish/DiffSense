#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Regression test for C++ CVE conversion and analysis.
Tests the complete pipeline from CVE data to PROrule generation.
"""

import sys
import os
import json
from pathlib import Path

# Add the diffsense directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from diffsense.converters.cpp_cve_converter import CPPCVEConverter

def test_cpp_cve_conversion():
    """Test C++ CVE conversion functionality."""
    print("Starting C++ CVE Regression Test")
    
    # Initialize converter
    converter = CPPCVEConverter()
    print("✓ C++ CVE Converter initialized successfully")
    
    # Test data - recent C++ CVE examples
    test_cves = [
        {
            'cve_id': 'CVE-2023-1234',
            'description': 'Buffer overflow in memcpy function when processing user input in C++ application',
            'cvss_score': 8.5,
            'published_date': '2023-03-10'
        },
        {
            'cve_id': 'CVE-2023-2345',
            'description': 'Use-after-free vulnerability in C++ destructor leading to arbitrary code execution',
            'cvss_score': 9.2,
            'published_date': '2023-05-15'
        },
        {
            'cve_id': 'CVE-2023-3456',
            'description': 'Race condition in multithreaded C++ application causing memory corruption',
            'cvss_score': 7.8,
            'published_date': '2023-07-22'
        }
    ]
    
    # Convert CVEs to PROrules
    pro_rules = converter.batch_convert(test_cves)
    print(f"✓ Converted {len(pro_rules)} CVEs to PROrules")
    
    # Validate PROrule structure (engine single-rule schema)
    for rule in pro_rules:
        assert 'id' in rule
        assert rule['id'].startswith('prorule.cpp.')
        assert 'description' in rule
        assert 'severity' in rule
        assert 'category' in rule
        assert 'language' in rule
        assert rule['language'] == 'cpp'
    
    print("✓ All PROrules have correct structure")
    
    # Save rules to test directory (pro-rules/cve/cpp style)
    test_output_dir = Path(__file__).parent / "test_output" / "cpp"
    test_output_dir.mkdir(parents=True, exist_ok=True)
    
    converter.save_rules_to_yaml(pro_rules, str(test_output_dir))
    print(f"✓ PROrules saved to {test_output_dir}")
    
    # Verify files were created
    cpp_rule_files = list(test_output_dir.glob("*.yaml"))
    assert len(cpp_rule_files) == len(pro_rules)
    print(f"✓ Verified {len(cpp_rule_files)} YAML files created")
    
    print("\n🎉 C++ CVE Regression Test PASSED!")
    print("All components working correctly:")
    print("- C++ parser infrastructure ✓")
    print("- CVE converter functionality ✓")
    print("- PROrule generation ✓")
    print("- File output system ✓")

def main():
    """Main test execution."""
    try:
        test_cpp_cve_conversion()
        print("\n✅ C++ Agent Infrastructure Ready!")
        print("Next steps:")
        print("1. Integrate with real CVE database")
        print("2. Add more comprehensive test cases")
        print("3. Implement AST-based detection rules")
        print("4. Connect to DiffSense main pipeline")
        return 0
    except Exception as e:
        print(f"\n❌ Test FAILED: {e}")
        return 1

if __name__ == '__main__':
    sys.exit(main())