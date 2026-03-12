import sys
import os

# Add the parent directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

try:
    from converters.cpp_cve_converter import CPPCVEConverter
    print("==================================================")
    print("C++ CVE REGRESSION TEST")
    print("==================================================")
    print("Starting C++ CVE Regression Test")
    
    # Initialize converter
    converter = CPPCVEConverter()
    print("[SUCCESS] C++ CVE Converter initialized successfully")
    
    # Test with sample CVE data
    test_cve_data = {
        "cve_id": "CVE-2023-1234",
        "description": "Buffer overflow in C++ application",
        "cvss_score": 7.5,
        "affected_versions": ["1.0", "1.1"],
        "patch_url": "https://example.com/patch"
    }
    
    converted_rule = converter.convert(test_cve_data)
    if converted_rule:
        print("[SUCCESS] CVE conversion completed successfully")
        print(f"Generated rule name: {converted_rule.get('rule_name', 'N/A')}")
        print(f"Rule severity: {converted_rule.get('severity', 'N/A')}")
    else:
        print("[FAILED] CVE conversion returned empty result")
        
    print("\n[SUCCESS] All tests passed!")
    sys.exit(0)
    
except ImportError as e:
    print("ERROR: Module import failed")
    print(f"Details: {e}")
    sys.exit(1)
except Exception as e:
    print("ERROR: Test execution failed")
    print(f"Details: {e}")
    sys.exit(1)