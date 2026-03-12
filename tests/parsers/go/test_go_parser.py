#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Go Parser Regression Tests

This test suite validates the GoParser functionality including:
1. Basic AST parsing capabilities
2. CVE rule detection and matching
3. Signal extraction from Go code changes
4. Integration with PROrule format
"""

import os
import sys
import unittest
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from diffsense.parsers.go_parser import GoParser
from diffsense.rules.rule_engine import RuleEngine


class TestGoParserRegression(unittest.TestCase):
    """Regression tests for GoParser functionality."""
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        self.parser = GoParser()
        self.test_data_dir = Path(__file__).parent / "testdata"
        
        # Ensure test data directory exists
        self.test_data_dir.mkdir(exist_ok=True)
    
    def test_basic_parsing(self):
        """Test basic Go code parsing functionality."""
        go_code = """
package main

import (
    "fmt"
    "net/http"
)

func vulnerableHandler(w http.ResponseWriter, r *http.Request) {
    // Simulate a vulnerable pattern
    userInput := r.URL.Query().Get("input")
    fmt.Fprintf(w, userInput) // Potential XSS vulnerability
}

func main() {
    http.HandleFunc("/test", vulnerableHandler)
    http.ListenAndServe(":8080", nil)
}
"""
        try:
            ast_result = self.parser.parse(go_code)
            self.assertIsNotNone(ast_result)
            self.assertTrue(hasattr(ast_result, 'tree'))
        except Exception as e:
            self.fail(f"Basic parsing failed: {e}")
    
    def test_cve_rule_loading(self):
        """Test loading of Go CVE rules from pro-rules directory."""
        # Test that the rule engine can load Go-specific rules
        rule_engine = RuleEngine(rulesets=["go_only"])
        go_rules = rule_engine.get_active_rules()
        
        # Should have loaded some Go rules
        self.assertGreater(len(go_rules), 0, "No Go rules loaded")
        
        # Check that rules have proper structure
        for rule in go_rules[:5]:  # Check first 5 rules
            self.assertIn('id', rule, f"Rule missing 'id': {rule}")
            self.assertIn('conditions', rule, f"Rule missing 'conditions': {rule}")
            self.assertIn('language', rule, f"Rule missing 'language': {rule}")
            self.assertEqual(rule['language'], 'go', f"Rule language should be 'go', got: {rule['language']}")
    
    def test_signal_extraction(self):
        """Test signal extraction from Go code changes."""
        # Create a simple diff that should trigger signals
        diff_content = """
--- a/main.go
+++ b/main.go
@@ -1,5 +1,7 @@
 package main
 
+import "unsafe"
+
 func main() {
     // Some code
 }
"""
        signals = self.parser.extract_signals_from_diff(diff_content)
        
        # Should detect unsafe import
        unsafe_detected = any(
            'unsafe' in str(signal) or 'import' in str(signal).lower()
            for signal in signals
        )
        self.assertTrue(unsafe_detected, "Should detect unsafe import in diff")
    
    def test_vulnerable_pattern_detection(self):
        """Test detection of known vulnerable patterns."""
        # Test with a pattern similar to GO-2022-0463 (beego vulnerability)
        vulnerable_code = """
package main

import (
    "github.com/beego/beego/v2"
)

func main() {
    // Simulate vulnerable beego usage
    beego.Run()
}
"""
        signals = self.parser.extract_signals(vulnerable_code)
        
        # Should detect beego-related signals
        beego_detected = any(
            'beego' in str(signal).lower() 
            for signal in signals
        )
        self.assertTrue(beego_detected, "Should detect beego framework usage")
    
    def test_pro_rule_integration(self):
        """Test integration with PROrule format."""
        # Load a specific Go CVE rule and test against matching code
        rule_engine = RuleEngine(rulesets=["go_only"])
        
        # Find a specific rule to test
        test_rules = [rule for rule in rule_engine.get_active_rules() 
                     if 'GO-' in rule.get('id', '')]
        
        if test_rules:
            test_rule = test_rules[0]
            rule_id = test_rule['id']
            
            # Create test code that should match this rule
            # This is a simplified test - in practice, you'd need
            # actual vulnerable code patterns for each CVE
            test_code = "// Test code for " + rule_id
            
            # Test that the rule can be evaluated
            result = rule_engine.evaluate(test_code, language='go')
            self.assertIsNotNone(result)
    
    def test_error_handling(self):
        """Test error handling for malformed Go code."""
        malformed_code = """
package main
func main() {
    // Missing closing brace
"""
        try:
            signals = self.parser.extract_signals(malformed_code)
            # Should handle gracefully without crashing
            self.assertIsInstance(signals, list)
        except Exception as e:
            self.fail(f"Parser should handle malformed code gracefully: {e}")


if __name__ == '__main__':
    unittest.main()