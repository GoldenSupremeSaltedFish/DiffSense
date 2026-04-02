from typing import List, Dict, Any, Optional, Set, Tuple
from tree_sitter import Language, Parser
from tree_sitter_go import language as go_language
from .base_parser import BaseParser
import os


class ChangeKind:
    """Represents the type of change detected in the diff."""
    GOROUTINE_ADDED = "GOROUTINE_ADDED"
    GOROUTINE_REMOVED = "GOROUTINE_REMOVED"
    CHANNEL_ADDED = "CHANNEL_ADDED"
    CHANNEL_REMOVED = "CHANNEL_REMOVED"
    LOCK_ADDED = "LOCK_ADDED"
    LOCK_REMOVED = "LOCK_REMOVED"
    DEFER_ADDED = "DEFER_ADDED"
    DEFER_REMOVED = "DEFER_REMOVED"
    UNSAFE_ADDED = "UNSAFE_ADDED"
    UNSAFE_REMOVED = "UNSAFE_REMOVED"
    GO_STATEMENT_ADDED = "GO_STATEMENT_ADDED"
    GO_STATEMENT_REMOVED = "GO_STATEMENT_REMOVED"
    PANIC_ADDED = "PANIC_ADDED"
    PANIC_REMOVED = "PANIC_REMOVED"
    ERROR_CHECK_REMOVED = "ERROR_CHECK_REMOVED"
    RESOURCE_LEAK = "RESOURCE_LEAK"
    SELECT_ADDED = "SELECT_ADDED"
    CONTEXT_USAGE_CHANGED = "CONTEXT_USAGE_CHANGED"


class GoChange:
    """Represents a detected change in Go code."""
    def __init__(self, kind: str, file: str, symbol: str = None, 
                 line: int = None, before: str = None, after: str = None, 
                 meta: Dict = None):
        self.kind = kind
        self.file = file
        self.symbol = symbol
        self.line = line
        self.before = before
        self.after = after
        self.meta = meta or {}


class GoASTParser(BaseParser):
    """
    Go-specific parser implementation using tree-sitter for true AST parsing.
    Provides semantic-level analysis for Go code changes.
    """
    
    _parser_instance = None
    _initialized = False
    
    def __init__(self):
        super().__init__("go")
        self._init_parser()
        
        # Go-specific keywords and patterns
        self.go_keywords = {
            'chan', 'defer', 'select', 'interface', 'struct',
            'map', 'range', 'make', 'new', 'unsafe', 'go', 'mutex',
            'waitgroup', 'once', 'pool', 'map', 'context'
        }
        
        # Thread-safe types in Go
        self.thread_safe_types = {
            'sync.Mutex', 'sync.RWMutex', 'sync.WaitGroup', 
            'sync.Cond', 'sync.Once', 'sync.Pool',
            'chan', 'sync.Map'
        }
        
        # Not thread-safe types
        self.unsafe_types = {
            'map', 'slice', '[]'  # Regular map/slice without sync
        }
        
        # Dangerous function calls
        self.dangerous_calls = {
            'exec.Command', 'syscall.Exec', 'os/exec',
            'unsafe.Pointer', 'reflect.DeepEqual',
            'gob.Decode', 'json.Unmarshal', 'xml.Unmarshal'
        }
    
    @classmethod
    def _init_parser(cls):
        """Initialize tree-sitter parser with Go language."""
        if cls._initialized:
            return
            
        try:
            # Get the language from tree-sitter-go
            language = Language(go_language())
            cls._parser_instance = Parser(language)
            cls._initialized = True
        except Exception as e:
            print(f"Warning: Failed to initialize tree-sitter-go: {e}")
            cls._parser_instance = None
            cls._initialized = True
    
    def parse_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """
        Parse Go file and return AST representation using tree-sitter.
        """
        if not self._parser_instance:
            # Fallback to enhanced regex parser
            return self._parse_fallback(file_path, content)
        
        try:
            tree = self._parser_instance.parse(bytes(content, 'utf8'))
            return {
                "file": file_path,
                "language": "go",
                "ast_type": "go_ast",
                "tree": tree,
                "root_node": tree.root_node,
                "functions": self._extract_functions(tree.root_node, content),
                "structs": self._extract_structs(tree.root_node, content),
                "interfaces": self._extract_interfaces(tree.root_node, content),
                "imports": self._extract_imports(tree.root_node, content),
                "goroutines": self._extract_goroutines(tree.root_node, content),
                "channels": self._extract_channels(tree.root_node, content),
                "defers": self._extract_defers(tree.root_node, content),
                "selects": self._extract_selects(tree.root_node, content),
                "mutexes": self._extract_mutexes(tree.root_node, content),
                "panic_calls": self._extract_panic_calls(tree.root_node, content),
            }
        except Exception as e:
            return self._parse_fallback(file_path, content)
    
    def _parse_fallback(self, file_path: str, content: str) -> Dict[str, Any]:
        """Fallback to enhanced regex-based parsing."""
        import re
        
        parsed_data = {
            "file": file_path,
            "language": "go",
            "ast_type": "go_file_fallback",
            "imports": [],
            "functions": [],
            "structs": [],
            "interfaces": [],
            "goroutines": [],
            "channels": [],
            "defers": [],
            "selects": [],
            "mutexes": [],
            "panic_calls": []
        }
        
        lines = content.split('\n')
        
        # Extract imports
        for line_num, line in enumerate(lines, 1):
            if '"' in line:
                imports = re.findall(r'"([^"]+)"', line)
                parsed_data["imports"].extend(imports)
        
        # Extract function definitions
        func_pattern = r'func\s+(?:\([^)]+\)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\('
        for line_num, line in enumerate(lines, 1):
            matches = re.findall(func_pattern, line)
            for func_name in matches:
                parsed_data["functions"].append({"name": func_name, "line": line_num})
        
        # Extract goroutine usage
        for line_num, line in enumerate(lines, 1):
            if ' go ' in line or line.strip().startswith('go '):
                parsed_data["goroutines"].append({"line": line_num, "code": line.strip()})
        
        # Extract defer
        for line_num, line in enumerate(lines, 1):
            if 'defer ' in line:
                parsed_data["defers"].append({"line": line_num, "code": line.strip()})
        
        # Extract channel operations
        for line_num, line in enumerate(lines, 1):
            if '<-' in line or 'make(chan' in line:
                parsed_data["channels"].append({"line": line_num, "code": line.strip()})
        
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
        return self._extract_nodes_by_type(root_node, 'function_declaration', content)
    
    def _extract_structs(self, root_node, content: str) -> List[Dict]:
        """Extract struct definitions."""
        return self._extract_nodes_by_type(root_node, 'type_spec', content)
    
    def _extract_interfaces(self, root_node, content: str) -> List[Dict]:
        """Extract interface definitions."""
        return self._extract_nodes_by_type(root_node, 'interface_type', content)
    
    def _extract_imports(self, root_node, content: str) -> List[str]:
        """Extract import statements."""
        imports = []
        
        def traverse(node):
            if node.type == 'import_declaration':
                for child in node.children:
                    if child.type == 'import_spec':
                        if child.text:
                            imports.append(child.text.decode('utf8').strip('"'))
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return imports
    
    def _extract_goroutines(self, root_node, content: str) -> List[Dict]:
        """Extract goroutine creations (go statements)."""
        goroutines = []
        
        def traverse(node):
            if node.type == 'go_statement':
                goroutines.append({
                    "type": "go_statement",
                    "start_point": node.start_point,
                    "end_point": node.end_point,
                    "line": node.start_point[0] + 1,
                    "text": node.text.decode('utf8')[:100] if node.text else ""
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return goroutines
    
    def _extract_channels(self, root_node, content: str) -> List[Dict]:
        """Extract channel operations."""
        channels = []
        
        def traverse(node):
            if node.type in ['channel_type', 'send_statement', 'receive_statement']:
                channels.append({
                    "type": node.type,
                    "start_point": node.start_point,
                    "line": node.start_point[0] + 1,
                    "text": node.text.decode('utf8')[:100] if node.text else ""
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return channels
    
    def _extract_defers(self, root_node, content: str) -> List[Dict]:
        """Extract defer statements."""
        defers = []
        
        def traverse(node):
            if node.type == 'defer_statement':
                defers.append({
                    "type": "defer_statement",
                    "start_point": node.start_point,
                    "line": node.start_point[0] + 1,
                    "text": node.text.decode('utf8')[:100] if node.text else ""
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return defers
    
    def _extract_selects(self, root_node, content: str) -> List[Dict]:
        """Extract select statements."""
        selects = []
        
        def traverse(node):
            if node.type == 'select_statement':
                selects.append({
                    "type": "select_statement",
                    "start_point": node.start_point,
                    "line": node.start_point[0] + 1,
                    "text": node.text.decode('utf8')[:100] if node.text else ""
                })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return selects
    
    def _extract_mutexes(self, root_node, content: str) -> List[Dict]:
        """Extract mutex/sync operations."""
        mutexes = []
        
        def traverse(node):
            if node.type in ['call_expression', 'selector_expression']:
                text = node.text.decode('utf8') if node.text else ''
                if 'Lock' in text or 'Unlock' in text or 'RLock' in text or 'RUnlock' in text:
                    mutexes.append({
                        "type": "mutex_operation",
                        "start_point": node.start_point,
                        "line": node.start_point[0] + 1,
                        "text": text
                    })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return mutexes
    
    def _extract_panic_calls(self, root_node, content: str) -> List[Dict]:
        """Extract panic calls."""
        panics = []
        
        def traverse(node):
            if node.type == 'call_expression':
                text = node.text.decode('utf8') if node.text else ''
                if text.startswith('panic'):
                    panics.append({
                        "type": "panic_call",
                        "start_point": node.start_point,
                        "line": node.start_point[0] + 1,
                        "text": text[:100]
                    })
            for child in node.children:
                traverse(child)
        
        traverse(root_node)
        return panics
    
    def extract_signals(self, ast_data: Dict[str, Any], diff_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract Go-specific semantic signals from AST based on diff context.
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
        
        # Check for goroutine changes in changed lines
        for goroutine in ast_data.get("goroutines", []):
            if goroutine.get("line") in changed_lines:
                signals.append({
                    "id": "runtime.concurrency.goroutine_created",
                    "action": "added",
                    "file": file_path,
                    "line": goroutine.get("line"),
                    "meta": {"type": "goroutine", "code": goroutine.get("text", "")}
                })
        
        # Check for defer changes
        for defer in ast_data.get("defers", []):
            if defer.get("line") in changed_lines:
                signals.append({
                    "id": "runtime.resource.defer_statement",
                    "action": "added",
                    "file": file_path,
                    "line": defer.get("line"),
                    "meta": {"type": "defer", "code": defer.get("text", "")}
                })
        
        # Check for channel operations
        for channel in ast_data.get("channels", []):
            if channel.get("line") in changed_lines:
                signals.append({
                    "id": "runtime.concurrency.channel_operation",
                    "action": "added",
                    "file": file_path,
                    "line": channel.get("line"),
                    "meta": {"type": "channel", "code": channel.get("text", "")}
                })
        
        # Check for mutex operations
        for mutex in ast_data.get("mutexes", []):
            if mutex.get("line") in changed_lines:
                signals.append({
                    "id": "runtime.concurrency.mutex_operation",
                    "action": "added",
                    "file": file_path,
                    "line": mutex.get("line"),
                    "meta": {"type": "mutex", "code": mutex.get("text", "")}
                })
        
        # Check for select statements
        for select in ast_data.get("selects", []):
            if select.get("line") in changed_lines:
                signals.append({
                    "id": "runtime.concurrency.select_statement",
                    "action": "added",
                    "file": file_path,
                    "line": select.get("line"),
                    "meta": {"type": "select", "code": select.get("text", "")}
                })
        
        # Check for panic calls
        for panic in ast_data.get("panic_calls", []):
            if panic.get("line") in changed_lines:
                signals.append({
                    "id": "runtime.error.panic_called",
                    "action": "added",
                    "file": file_path,
                    "line": panic.get("line"),
                    "meta": {"type": "panic", "code": panic.get("text", "")}
                })
        
        # Check for unsafe package usage
        imports = ast_data.get("imports", [])
        for imp in imports:
            if 'unsafe' in imp:
                signals.append({
                    "id": "runtime.security.unsafe_package_used",
                    "action": "imported",
                    "file": file_path,
                    "line": 0,
                    "meta": {"package": imp}
                })
        
        return signals
    
    def get_file_extensions(self) -> List[str]:
        return [".go"]