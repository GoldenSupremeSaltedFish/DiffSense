import unittest
from diffsense.parsers.js_parser import JavaScriptParser

class TestJavaScriptParser(unittest.TestCase):
    def setUp(self):
        self.parser = JavaScriptParser()
    
    def test_basic_parsing(self):
        """Test basic JavaScript file parsing"""
        js_code = """
function vulnerableFunction(input) {
    // XSS vulnerability
    document.write(input);
    
    // Prototype pollution
    Object.prototype.polluted = true;
    
    // Command execution
    const { exec } = require('child_process');
    exec('ls ' + input);
}
        """
        
        signals = self.parser.parse_file_content(js_code, "test_vulnerable.js")
        
        # Check if parser extracted signals correctly
        self.assertTrue(len(signals) > 0)
        self.assertIn("xss.document_write", [s['type'] for s in signals])
        self.assertIn("prototype_pollution.object_prototype", [s['type'] for s in signals])
        self.assertIn("command_execution.child_process_exec", [s['type'] for s in signals])
    
    def test_supports_file(self):
        """Test file extension support"""
        self.assertTrue(self.parser.supports_file("test.js"))
        self.assertTrue(self.parser.supports_file("app.jsx"))
        self.assertFalse(self.parser.supports_file("test.py"))
        self.assertFalse(self.parser.supports_file("README.md"))

if __name__ == '__main__':
    unittest.main()