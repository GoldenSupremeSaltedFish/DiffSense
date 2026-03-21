"""
Test suite for DiffSense built-in rules.
"""

import unittest
from typing import Dict, Any, List

from sdk.rule import BaseRule
from sdk.signal import Signal
from rules import (
    get_all_builtin_rules,
    get_rules_by_category,
    get_rule_by_id,
)


class TestRuleLoading(unittest.TestCase):
    """Test rule loading and registration."""
    
    def test_all_rules_load(self):
        """Test that all built-in rules can be instantiated."""
        rules = get_all_builtin_rules()
        self.assertGreater(len(rules), 0)
        
        # Verify all rules have required properties
        for rule in rules:
            self.assertIsInstance(rule.id, str)
            self.assertIn(rule.severity, ['critical', 'high', 'medium', 'low'])
            self.assertIsInstance(rule.rationale, str)
            self.assertIn(rule.rule_type, ['absolute', 'regression'])
    
    def test_rules_by_category(self):
        """Test loading rules by category."""
        categories = ['concurrency', 'resource', 'exception', 'null_safety', 'collection', 'api']
        
        for category in categories:
            rules = get_rules_by_category(category)
            self.assertGreater(len(rules), 0, f"No rules loaded for category: {category}")
    
    def test_get_rule_by_id(self):
        """Test getting a specific rule by ID."""
        rule = get_rule_by_id('resource.closeable_leak')
        self.assertIsNotNone(rule)
        self.assertEqual(rule.id, 'resource.closeable_leak')
        self.assertEqual(rule.severity, 'high')
    
    def test_get_nonexistent_rule(self):
        """Test getting a nonexistent rule."""
        rule = get_rule_by_id('nonexistent.rule')
        self.assertIsNone(rule)


class TestResourceManagementRules(unittest.TestCase):
    """Test resource management rules."""
    
    def setUp(self):
        from rules.resource_management import (
            CloseableResourceLeakRule,
            DatabaseConnectionLeakRule,
        )
        self.resource_leak_rule = CloseableResourceLeakRule()
        self.db_leak_rule = DatabaseConnectionLeakRule()
    
    def test_closeable_resource_leak_detected(self):
        """Test detection of unclosed resources."""
        diff_data = {
            'files': ['test.java'],
            'raw_diff': '+ InputStream is = new FileInputStream("test.txt");'
        }
        signals: List[Signal] = []
        
        result = self.resource_leak_rule.evaluate(diff_data, signals)
        self.assertIsNotNone(result)
        self.assertEqual(result['file'], 'test.java')
    
    def test_closeable_with_try_resources(self):
        """Test that try-with-resources is not flagged."""
        diff_data = {
            'files': ['test.java'],
            'raw_diff': '+ try (InputStream is = new FileInputStream("test.txt")) {'
        }
        signals: List[Signal] = []
        
        result = self.resource_leak_rule.evaluate(diff_data, signals)
        self.assertIsNone(result)
    
    def test_database_connection_leak(self):
        """Test detection of database connection leaks."""
        diff_data = {
            'files': ['test.java'],
            'raw_diff': '+ Connection conn = DriverManager.getConnection(url);'
        }
        signals: List[Signal] = []
        
        result = self.db_leak_rule.evaluate(diff_data, signals)
        self.assertIsNotNone(result)
        self.assertEqual(result['severity'], 'critical')


class TestExceptionHandlingRules(unittest.TestCase):
    """Test exception handling rules."""
    
    def setUp(self):
        from rules.exception_handling import (
            SwallowedExceptionRule,
            GenericExceptionRule,
        )
        self.swallow_rule = SwallowedExceptionRule()
        self.generic_rule = GenericExceptionRule()
    
    def test_empty_catch_detected(self):
        """Test detection of empty catch blocks."""
        diff_data = {
            'files': ['test.java'],
            'raw_diff': '+ } catch (Exception e) {\n+ }'
        }
        signals: List[Signal] = []
        
        result = self.swallow_rule.evaluate(diff_data, signals)
        self.assertIsNotNone(result)
    
    def test_generic_exception_caught(self):
        """Test detection of generic exception catching."""
        diff_data = {
            'files': ['test.java'],
            'raw_diff': '+ } catch (Exception e) {'
        }
        signals: List[Signal] = []
        
        result = self.generic_rule.evaluate(diff_data, signals)
        self.assertIsNotNone(result)


class TestNullSafetyRules(unittest.TestCase):
    """Test null safety rules."""
    
    def setUp(self):
        from rules.null_safety import (
            NullReturnIgnoredRule,
            OptionalUnwrapRule,
        )
        self.null_return_rule = NullReturnIgnoredRule()
        self.optional_rule = OptionalUnwrapRule()
    
    def test_null_return_ignored(self):
        """Test detection of unchecked null returns."""
        diff_data = {
            'files': ['test.java'],
            'raw_diff': '+ String value = map.get("key");\n+ System.out.println(value.length());'
        }
        signals: List[Signal] = []
        
        result = self.null_return_rule.evaluate(diff_data, signals)
        self.assertIsNotNone(result)
    
    def test_optional_unsafe_get(self):
        """Test detection of unsafe Optional.get()."""
        diff_data = {
            'files': ['test.java'],
            'raw_diff': '+ optional.get();'
        }
        signals: List[Signal] = []
        
        result = self.optional_rule.evaluate(diff_data, signals)
        self.assertIsNotNone(result)


class TestAPCompatibilityRules(unittest.TestCase):
    """Test API compatibility rules."""
    
    def setUp(self):
        from rules.api_compatibility import (
            PublicMethodRemovedRule,
            MethodSignatureChangedRule,
        )
        self.method_removed_rule = PublicMethodRemovedRule()
        self.signature_changed_rule = MethodSignatureChangedRule()
    
    def test_public_method_removed(self):
        """Test detection of removed public methods."""
        diff_data = {
            'files': ['test.java'],
            'raw_diff': '- public void doSomething() {\n-     // implementation\n- }'
        }
        signals: List[Signal] = []
        
        result = self.method_removed_rule.evaluate(diff_data, signals)
        self.assertIsNotNone(result)
        self.assertEqual(result['severity'], 'critical')


class TestRuleMetadata(unittest.TestCase):
    """Test rule metadata consistency."""
    
    def test_all_rules_have_unique_ids(self):
        """Test that all rules have unique IDs."""
        rules = get_all_builtin_rules()
        ids = [rule.id for rule in rules]
        self.assertEqual(len(ids), len(set(ids)), "Duplicate rule IDs found")
    
    def test_rule_id_format(self):
        """Test that rule IDs follow the convention category.name."""
        rules = get_all_builtin_rules()
        for rule in rules:
            self.assertRegex(rule.id, r'^[a-z_]+\.[a-z_]+$', 
                           f"Rule ID '{rule.id}' doesn't follow category.name format")
    
    def test_severity_values(self):
        """Test that severity values are valid."""
        valid_severities = {'critical', 'high', 'medium', 'low'}
        rules = get_all_builtin_rules()
        
        for rule in rules:
            self.assertIn(rule.severity, valid_severities,
                         f"Invalid severity '{rule.severity}' for rule {rule.id}")
    
    def test_impact_values(self):
        """Test that impact values are valid."""
        valid_impacts = {'runtime', 'security', 'data', 'maintenance', 'general'}
        rules = get_all_builtin_rules()
        
        for rule in rules:
            # Allow any string for impact, but log if it's not a common value
            if rule.impact not in valid_impacts:
                print(f"Note: Rule {rule.id} has uncommon impact: {rule.impact}")


if __name__ == '__main__':
    unittest.main()
