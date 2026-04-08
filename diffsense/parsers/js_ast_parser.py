"""
JavaScript/TypeScript AST Parser for DiffSense using tree-sitter

Provides true AST parsing for JavaScript/TypeScript code with semantic analysis.
Detects security vulnerabilities, async patterns, and framework-specific issues.
"""

import re
from typing import List, Dict, Any, Optional, Set
from tree_sitter import Parser, Language
from tree_sitter_javascript import language as js_language
from .base_parser import BaseParser


class JavaScriptASTParser(BaseParser):
    """
    JavaScript/TypeScript parser implementation using tree-sitter for true AST parsing.
    Provides semantic-level analysis for JS/TS code changes.
    """
    
    _parser_instance = None
    _initialized = False
    
    def __init__(self):
        super().__init__("javascript")
        self._init_parser()
        
        # JavaScript specific security keywords
        self._security_keywords = {
            'eval', 'exec', 'Function', 'setTimeout', 'setInterval',
            'document.write', 'innerHTML', 'outerHTML', '__proto__', 'constructor.prototype'
        }
        
        # Async patterns
        self._async_keywords = {'Promise', 'async', 'await', 'fetch', 'axios'}
        
        # Dangerous patterns
        self._dangerous_patterns = {
            'hardcoded_secret': ['password', 'secret', 'token', 'api_key', 'apikey'],
            'xss': ['innerHTML', 'outerHTML', 'document.write', 'eval'],
            'prototype_pollution': ['__proto__', 'constructor.prototype'],
            'code_injection': ['eval', 'Function', 'setTimeout', 'setInterval']
        }
    
    @classmethod
    def _init_parser(cls):
        """Initialize tree-sitter parser with JavaScript language."""
        if cls._initialized:
            return
            
        try:
            language = Language(js_language())
            cls._parser_instance = Parser(language)
            cls._initialized = True
        except ImportError:
            # Fallback to import
            try:
                from tree_sitter_javascript import language as js_lang
                language = Language(js_lang())
                cls._parser_instance = Parser(language)
                cls._initialized = True
            except Exception as e:
                print(f"Warning: Failed to initialize tree-sitter-javascript: {e}")
                cls._parser_instance = None
                cls._initialized = True
        except Exception as e:
            print(f"Warning: Failed to initialize tree-sitter-javascript: {e}")
            cls._parser_instance = None
            cls._initialized = True
    
    def parse_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """
        Parse JavaScript/TypeScript file and return AST representation.
        """
        if not self._parser_instance:
            return self._parse_fallback(file_path, content)
        
        try:
            tree = self._parser_instance.parse(bytes(content, 'utf8'))
            return {
                "file": file_path,
                "language": "javascript",
                "ast_type": "javascript_ast",
                "tree": tree,
                "root_node": tree.root_node,
                "functions": self._extract_functions(tree.root_node, content),
                "classes": self._extract_classes(tree.root_node, content),
                "imports": self._extract_imports(tree.root_node, content),
                "exports": self._extract_exports(tree.root_node, content),
                "async_patterns": self._extract_async_patterns(tree.root_node, content),
                "security_patterns": self._extract_security_patterns(tree.root_node, content),
                "event_handlers": self._extract_event_handlers(tree.root_node, content),
                "dom_operations": self._extract_dom_operations(tree.root_node, content),
            }
        except Exception as e:
            return self._parse_fallback(file_path, content)
    
    def _parse_fallback(self, file_path: str, content: str) -> Dict[str, Any]:
        """Fallback to regex-based parsing."""
        parsed_data = {
            "file": file_path,
            "language": "javascript",
            "ast_type": "javascript_file_fallback",
            "functions": [],
            "classes": [],
            "imports": [],
            "exports": [],
            "async_patterns": [],
            "security_patterns": [],
            "event_handlers": [],
            "dom_operations": []
        }
        
        lines = content.split('\n')
        
        # Extract function definitions
        func_patterns = [
            r'function\s+(\w+)',
            r'const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>',
            r'(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>\s*{',
        ]
        for line_num, line in enumerate(lines, 1):
            for pattern in func_patterns:
                matches = re.findall(pattern, line)
                for match in matches[:1]:  # Limit to first match per line
                    if isinstance(match, str) and match:
                        parsed_data["functions"].append({"name": match, "line": line_num})
        
        # Extract class definitions
        class_pattern = r'class\s+(\w+)'
        for line_num, line in enumerate(lines, 1):
            matches = re.findall(class_pattern, line)
            for class_name in matches:
                parsed_data["classes"].append({"name": class_name, "line": line_num})
        
        # Extract imports
        import_pattern = r'import\s+(?:{[^}]+}|\w+)\s+from\s+[\'"]([^\'"]+)[\'"]'
        for line_num, line in enumerate(lines, 1):
            matches = re.findall(import_pattern, line)
            for imp in matches:
                parsed_data["imports"].append({"module": imp, "line": line_num})
        
        # Extract exports
        export_pattern = r'export\s+(?:default\s+)?(?:const|let|var|function|class)'
        for line_num, line in enumerate(lines, 1):
            if re.search(export_pattern, line):
                parsed_data["exports"].append({"line": line_num, "code": line.strip()})
        
        # Extract async patterns
        for line_num, line in enumerate(lines, 1):
            if 'async ' in line or 'await ' in line or 'Promise' in line:
                parsed_data["async_patterns"].append({"line": line_num, "code": line.strip()})
        
        # Extract security patterns
        for line_num, line in enumerate(lines, 1):
            if 'eval(' in line:
                parsed_data["security_patterns"].append({"line": line_num, "code": line.strip(), "type": "code_injection"})
            if 'innerHTML' in line or 'outerHTML' in line:
                parsed_data["security_patterns"].append({"line": line_num, "code": line.strip(), "type": "xss"})
            if '__proto__' in line or 'constructor.prototype' in line:
                parsed_data["security_patterns"].append({"line": line_num, "code": line.strip(), "type": "prototype_pollution"})
        
        # Extract event handlers
        event_pattern = r'\.(?:on|addEventListener)\s*\('
        for line_num, line in enumerate(lines, 1):
            if re.search(event_pattern, line):
                parsed_data["event_handlers"].append({"line": line_num, "code": line.strip()})
        
        # Extract DOM operations
        dom_patterns = ['document.getElementById', 'document.querySelector', 'document.createElement']
        for line_num, line in enumerate(lines, 1):
            if any(p in line for p in dom_patterns):
                parsed_data["dom_operations"].append({"line": line_num, "code": line.strip()})
        
        return parsed_data
    
    def _extract_nodes_by_type(self, root_node, node_type: str, content: str) -> List[Dict]:
        """Extract all nodes of a specific type."""
        nodes = []
        
        def traverse(node):
            if node.type == node_type:
                nodes.append({
                    "type": node_type,
                    "start_point": node.start_point,
                    "end_point": node.end_point,
                    "text": node.text.decode('utf8') if node.text else ""
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return nodes
    
    def _extract_functions(self, root_node, content: str) -> List[Dict]:
        """Extract function definitions."""
        functions = []
        
        def traverse(node):
            text = node.text.decode('utf8') if node.text else ''
            if node.type in ['function_declaration', 'arrow_function']:
                functions.append({
                    "type": node.type,
                    "line": node.start_point[0] + 1,
                    "text": text[:100]
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return functions
    
    def _extract_classes(self, root_node, content: str) -> List[Dict]:
        """Extract class definitions."""
        classes = []
        
        def traverse(node):
            text = node.text.decode('utf8') if node.text else ''
            if node.type == 'class_declaration':
                classes.append({
                    "type": "class",
                    "line": node.start_point[0] + 1,
                    "text": text[:100]
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return classes
    
    def _extract_imports(self, root_node, content: str) -> List[Dict]:
        """Extract import statements."""
        imports = []
        
        def traverse(node):
            text = node.text.decode('utf8') if node.text else ''
            if node.type == 'import_statement':
                imports.append({
                    "type": "import",
                    "line": node.start_point[0] + 1,
                    "text": text[:100]
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return imports
    
    def _extract_exports(self, root_node, content: str) -> List[Dict]:
        """Extract export statements."""
        exports = []
        
        def traverse(node):
            text = node.text.decode('utf8') if node.text else ''
            if node.type == 'export_statement':
                exports.append({
                    "type": "export",
                    "line": node.start_point[0] + 1,
                    "text": text[:100]
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return exports
    
    def _extract_async_patterns(self, root_node, content: str) -> List[Dict]:
        """Extract async/await and Promise patterns."""
        async_patterns = []
        
        def traverse(node):
            text = node.text.decode('utf8') if node.text else ''
            if any(kw in text for kw in ['Promise', 'async', 'await', 'fetch', 'then', 'catch']):
                async_patterns.append({
                    "type": "async",
                    "line": node.start_point[0] + 1,
                    "text": text[:100]
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return async_patterns
    
    def _extract_security_patterns(self, root_node, content: str) -> List[Dict]:
        """Extract security-related patterns."""
        security = []
        
        def traverse(node):
            text = node.text.decode('utf8') if node.text else ''
            
            if 'eval(' in text or 'Function(' in text:
                security.append({"type": "code_injection", "line": node.start_point[0] + 1, "text": text[:100]})
            if 'innerHTML' in text or 'outerHTML' in text or 'document.write' in text:
                security.append({"type": "xss", "line": node.start_point[0] + 1, "text": text[:100]})
            if '__proto__' in text or 'constructor.prototype' in text:
                security.append({"type": "prototype_pollution", "line": node.start_point[0] + 1, "text": text[:100]})
            if any(sec in text.lower() for sec in ['password', 'secret', 'token', 'api_key']) and '=' in text:
                security.append({"type": "hardcoded_secret", "line": node.start_point[0] + 1, "text": text[:100]})
            
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return security
    
    def _extract_event_handlers(self, root_node, content: str) -> List[Dict]:
        """Extract event handler registrations."""
        handlers = []
        
        def traverse(node):
            text = node.text.decode('utf8') if node.text else ''
            if '.on(' in text or 'addEventListener' in text:
                handlers.append({
                    "type": "event_handler",
                    "line": node.start_point[0] + 1,
                    "text": text[:100]
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return handlers
    
    def _extract_dom_operations(self, root_node, content: str) -> List[Dict]:
        """Extract DOM manipulation operations."""
        dom_ops = []
        
        def traverse(node):
            text = node.text.decode('utf8') if node.text else ''
            if any(p in text for p in ['getElementById', 'querySelector', 'createElement', 'innerHTML']):
                dom_ops.append({
                    "type": "dom_operation",
                    "line": node.start_point[0] + 1,
                    "text": text[:100]
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return dom_ops
    
    def extract_signals(self, ast_data: Dict[str, Any], diff_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract JavaScript specific semantic signals from AST based on diff context.
        """
        signals = []
        file_path = ast_data.get("file", "unknown")
        
        # Get changed lines from diff context
        changed_lines = set()
        for change in diff_context.get("changes", []):
            if change.get("file") == file_path:
                start_line = change.get("start_line", 0)
                end_line = change.get("end_line", 0)
                changed_lines.update(range(start_line, end_line + 1))
        
        # Check for async patterns
        for pattern in ast_data.get("async_patterns", []):
            if pattern.get("line") in changed_lines:
                signals.append({
                    "id": "runtime.async_pattern",
                    "action": "added",
                    "file": file_path,
                    "line": pattern.get("line"),
                    "meta": {"type": "async", "code": pattern.get("text", "")}
                })
        
        # Check for security patterns
        for sec in ast_data.get("security_patterns", []):
            if sec.get("line") in changed_lines:
                sec_type = sec.get("type", "unknown")
                signal_id = {
                    "code_injection": "security.code_injection",
                    "xss": "security.xss",
                    "prototype_pollution": "security.prototype_pollution",
                    "hardcoded_secret": "security.hardcoded_secret"
                }.get(sec_type, "security.unknown")
                
                signals.append({
                    "id": signal_id,
                    "action": "added",
                    "file": file_path,
                    "line": sec.get("line"),
                    "meta": {"type": sec_type, "code": sec.get("text", "")}
                })
        
        # Check for event handlers
        for handler in ast_data.get("event_handlers", []):
            if handler.get("line") in changed_lines:
                signals.append({
                    "id": "runtime.event_handler",
                    "action": "added",
                    "file": file_path,
                    "line": handler.get("line"),
                    "meta": {"type": "event", "code": handler.get("text", "")}
                })
        
        # Check for DOM operations
        for op in ast_data.get("dom_operations", []):
            if op.get("line") in changed_lines:
                signals.append({
                    "id": "runtime.dom_operation",
                    "action": "added",
                    "file": file_path,
                    "line": op.get("line"),
                    "meta": {"type": "dom", "code": op.get("text", "")}
                })
        
        return signals
    
    def get_file_extensions(self) -> List[str]:
        return [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]