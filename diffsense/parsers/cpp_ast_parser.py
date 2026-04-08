"""
C++ AST Parser for DiffSense using tree-sitter

Provides true AST parsing for C++ code with semantic analysis.
Detects memory management issues, concurrency problems, and security risks.
"""

import re
from typing import List, Dict, Any, Optional, Set
from tree_sitter import Parser, Language
from tree_sitter_cpp import language as cpp_language
from .base_parser import BaseParser


class CppASTParser(BaseParser):
    """
    C++ parser implementation using tree-sitter for true AST parsing.
    Provides semantic-level analysis for C++ code changes.
    """
    
    _parser_instance = None
    _initialized = False
    
    def __init__(self):
        super().__init__("cpp")
        self._init_parser()
        
        # C++ specific keywords and patterns
        self._memory_keywords = {'new', 'delete', 'malloc', 'free', 'calloc', 'realloc'}
        self._smart_pointers = {'unique_ptr', 'shared_ptr', 'weak_ptr', 'auto_ptr'}
        self._thread_keywords = {'thread', 'mutex', 'lock_guard', 'unique_lock', 'condition_variable'}
        self._security_keywords = {'strcpy', 'strcat', 'sprintf', 'scanf', 'gets', 'memcpy', 'malloc'}
    
    @classmethod
    def _init_parser(cls):
        """Initialize tree-sitter parser with C++ language."""
        if cls._initialized:
            return
            
        try:
            language = Language(cpp_language())
            cls._parser_instance = Parser(language)
            cls._initialized = True
        except ImportError:
            # Fallback to import
            try:
                from tree_sitter_cpp import language as cpp_lang
                language = Language(cpp_lang())
                cls._parser_instance = Parser(language)
                cls._initialized = True
            except Exception as e:
                print(f"Warning: Failed to initialize tree-sitter-cpp: {e}")
                cls._parser_instance = None
                cls._initialized = True
        except Exception as e:
            print(f"Warning: Failed to initialize tree-sitter-cpp: {e}")
            cls._parser_instance = None
            cls._initialized = True
    
    def parse_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """
        Parse C++ file and return AST representation using tree-sitter.
        """
        if not self._parser_instance:
            return self._parse_fallback(file_path, content)
        
        try:
            tree = self._parser_instance.parse(bytes(content, 'utf8'))
            return {
                "file": file_path,
                "language": "cpp",
                "ast_type": "cpp_ast",
                "tree": tree,
                "root_node": tree.root_node,
                "functions": self._extract_functions(tree.root_node, content),
                "classes": self._extract_classes(tree.root_node, content),
                "templates": self._extract_templates(tree.root_node, content),
                "memory_operations": self._extract_memory_operations(tree.root_node, content),
                "smart_pointers": self._extract_smart_pointers(tree.root_node, content),
                "thread_operations": self._extract_thread_operations(tree.root_node, content),
                "security_patterns": self._extract_security_patterns(tree.root_node, content),
            }
        except Exception as e:
            return self._parse_fallback(file_path, content)
    
    def _parse_fallback(self, file_path: str, content: str) -> Dict[str, Any]:
        """Fallback to regex-based parsing."""
        parsed_data = {
            "file": file_path,
            "language": "cpp",
            "ast_type": "cpp_file_fallback",
            "functions": [],
            "classes": [],
            "templates": [],
            "memory_operations": [],
            "smart_pointers": [],
            "thread_operations": [],
            "security_patterns": []
        }
        
        lines = content.split('\n')
        
        # Extract function definitions
        func_pattern = r'(?:void|int|bool|char|float|double|long|short|string|auto)\s+\*?\s*(\w+)\s*\('
        for line_num, line in enumerate(lines, 1):
            matches = re.findall(func_pattern, line)
            for func_name in matches:
                parsed_data["functions"].append({"name": func_name, "line": line_num})
        
        # Extract class definitions
        class_pattern = r'class\s+(\w+)'
        for line_num, line in enumerate(lines, 1):
            matches = re.findall(class_pattern, line)
            for class_name in matches:
                parsed_data["classes"].append({"name": class_name, "line": line_num})
        
        # Extract memory operations
        for line_num, line in enumerate(lines, 1):
            if ' new ' in line or ' delete ' in line or 'malloc' in line:
                parsed_data["memory_operations"].append({"line": line_num, "code": line.strip()})
        
        # Extract smart pointers
        for line_num, line in enumerate(lines, 1):
            if 'unique_ptr' in line or 'shared_ptr' in line or 'weak_ptr' in line:
                parsed_data["smart_pointers"].append({"line": line_num, "code": line.strip()})
        
        # Extract thread operations
        for line_num, line in enumerate(lines, 1):
            if 'std::thread' in line or 'std::mutex' in line:
                parsed_data["thread_operations"].append({"line": line_num, "code": line.strip()})
        
        # Extract security patterns
        for line_num, line in enumerate(lines, 1):
            if any(p in line for p in ['strcpy', 'strcat', 'sprintf', 'gets']):
                parsed_data["security_patterns"].append({"line": line_num, "code": line.strip(), "type": "unsafe_function"})
        
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
        return self._extract_nodes_by_type(root_node, 'function_definition', content)
    
    def _extract_classes(self, root_node, content: str) -> List[Dict]:
        """Extract class definitions."""
        return self._extract_nodes_by_type(root_node, 'class_specifier', content)
    
    def _extract_templates(self, root_node, content: str) -> List[Dict]:
        """Extract template declarations."""
        return self._extract_nodes_by_type(root_node, 'template_declaration', content)
    
    def _extract_memory_operations(self, root_node, content: str) -> List[Dict]:
        """Extract memory allocation/deallocation operations."""
        memory_ops = []
        
        def traverse(node):
            if node.type in ['new_expression', 'delete_expression']:
                memory_ops.append({
                    "type": node.type,
                    "start_point": node.start_point,
                    "line": node.start_point[0] + 1,
                    "text": node.text.decode('utf8')[:100] if node.text else ""
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return memory_ops
    
    def _extract_smart_pointers(self, root_node, content: str) -> List[Dict]:
        """Extract smart pointer usage."""
        pointers = []
        
        def traverse(node):
            text = node.text.decode('utf8') if node.text else ''
            if 'unique_ptr' in text or 'shared_ptr' in text or 'weak_ptr' in text:
                pointers.append({
                    "type": "smart_pointer",
                    "line": node.start_point[0] + 1,
                    "text": text[:100]
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return pointers
    
    def _extract_thread_operations(self, root_node, content: str) -> List[Dict]:
        """Extract thread and synchronization operations."""
        thread_ops = []
        
        def traverse(node):
            text = node.text.decode('utf8') if node.text else ''
            if any(kw in text for kw in ['std::thread', 'std::mutex', 'std::lock', 'std::condition']):
                thread_ops.append({
                    "type": "thread_operation",
                    "line": node.start_point[0] + 1,
                    "text": text[:100]
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return thread_ops
    
    def _extract_security_patterns(self, root_node, content: str) -> List[Dict]:
        """Extract security-related patterns."""
        security = []
        
        def traverse(node):
            text = node.text.decode('utf8') if node.text else ''
            if any(p in text for p in ['strcpy', 'strcat', 'sprintf', 'gets', 'scanf', 'memcpy']):
                security.append({
                    "type": "unsafe_function",
                    "line": node.start_point[0] + 1,
                    "text": text[:100]
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return security
    
    def extract_signals(self, ast_data: Dict[str, Any], diff_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract C++ specific semantic signals from AST based on diff context.
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
        
        # Check for memory operations
        for op in ast_data.get("memory_operations", []):
            if op.get("line") in changed_lines:
                signals.append({
                    "id": "runtime.memory_operation",
                    "action": "added",
                    "file": file_path,
                    "line": op.get("line"),
                    "meta": {"type": op.get("type"), "code": op.get("text", "")}
                })
        
        # Check for smart pointers
        for ptr in ast_data.get("smart_pointers", []):
            if ptr.get("line") in changed_lines:
                signals.append({
                    "id": "runtime.smart_pointer",
                    "action": "added",
                    "file": file_path,
                    "line": ptr.get("line"),
                    "meta": {"type": "smart_pointer", "code": ptr.get("text", "")}
                })
        
        # Check for thread operations
        for op in ast_data.get("thread_operations", []):
            if op.get("line") in changed_lines:
                signals.append({
                    "id": "runtime.concurrency.thread_operation",
                    "action": "added",
                    "file": file_path,
                    "line": op.get("line"),
                    "meta": {"type": "thread", "code": op.get("text", "")}
                })
        
        # Check for security patterns
        for sec in ast_data.get("security_patterns", []):
            if sec.get("line") in changed_lines:
                signals.append({
                    "id": "security.unsafe_function",
                    "action": "added",
                    "file": file_path,
                    "line": sec.get("line"),
                    "meta": {"type": "unsafe", "code": sec.get("text", "")}
                })
        
        return signals
    
    def get_file_extensions(self) -> List[str]:
        return [".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx", ".c", ".h++"]