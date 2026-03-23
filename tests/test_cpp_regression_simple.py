import sys
import os
from pathlib import Path

# Add the parent directory to the Python path
_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))


def test_cpp_cve_converter():
    """Test C++ CVE converter initialization and conversion."""
    from diffsense.converters.cpp_cve_converter import CPPCVEConverter
    
    # Initialize converter
    converter = CPPCVEConverter()
    
    # Test with sample CVE data
    test_cve_data = {
        "cve_id": "CVE-2023-1234",
        "description": "Buffer overflow in C++ application",
        "cvss_score": 7.5,
        "affected_versions": ["1.0", "1.1"],
        "patch_url": "https://example.com/patch"
    }
    
    converted_rule = converter.convert_cve_to_prorule(test_cve_data)
    assert converted_rule is not None, "CVE conversion returned empty result"
    assert converted_rule.get('id') is not None, "Generated rule should have an id"
    assert converted_rule.get('severity') is not None, "Generated rule should have severity"


if __name__ == "__main__":
    # Run as standalone script
    print("==================================================")
    print("C++ CVE REGRESSION TEST")
    print("==================================================")
    print("Starting C++ CVE Regression Test")
    
    try:
        test_cpp_cve_converter()
        print("[SUCCESS] C++ CVE Converter initialized successfully")
        print("[SUCCESS] CVE conversion completed successfully")
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