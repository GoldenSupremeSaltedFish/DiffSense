import os
import ast
from typing import List, Dict, Any, Optional
from .base_parser import BaseParser

class GoParser(BaseParser):
    """
    Enhanced Go-specific parser implementation with real AST parsing capabilities.
    This implementation uses a simplified approach to parse Go code and extract signals.
    In production, this would integrate with tree-sitter-go or golang's official parser.
    """
    
    def __init__(self):
        super().__init__("go")
        self.go_keywords = {
            'go', 'chan', 'defer', 'select', 'interface', 'struct',
            'map', 'range', 'make', 'new', 'unsafe'
        }
        self.dangerous_functions = {
            'gob.Decode', 'gob.NewDecoder', 'json.Unmarshal',
            'xml.Unmarshal', 'binary.Read', 'encoding/gob',
            'net/http', 'os/exec', 'syscall'
        }
        self.concurrency_patterns = {
            'sync.Mutex', 'sync.RWMutex', 'sync.WaitGroup',
            'context.Context', 'time.After'
        }
    
    def parse_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """
        Parse Go file and return enhanced AST representation.
        Since Python doesn't have native Go AST parsing, we use regex-based analysis.
        """
        import re
        
        parsed_data = {
            "file": file_path,
            "language": "go",
            "ast_type": "go_file",
            "imports": [],
            "functions": [],
            "structs": [],
            "interfaces": [],
            "goroutines": [],
            "channels": [],
            "unsafe_calls": [],
            "http_handlers": [],
            "exec_calls": []
        }
        
        lines = content.split('\n')
        
        # Extract imports
        import_pattern = r'import\s+(?:\(\s*|"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*)\s+"([^"]+)")'
        for line_num, line in enumerate(lines, 1):
            if 'import' in line:
                # Simple import extraction
                if '"' in line:
                    imports = re.findall(r'"([^"]+)"', line)
                    parsed_data["imports"].extend(imports)
        
        # Extract function definitions
        func_pattern = r'func\s+([a-zA-Z_][a-zA-Z0-9_]*)'
        for line_num, line in enumerate(lines, 1):
            matches = re.findall(func_pattern, line)
            for func_name in matches:
                parsed_data["functions"].append({
                    "name": func_name,
                    "line": line_num
                })
        
        # Extract struct definitions
        struct_pattern = r'type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+struct'
        for line_num, line in enumerate(lines, 1):
            matches = re.findall(struct_pattern, line)
            for struct_name in matches:
                parsed_data["structs"].append({
                    "name": struct_name,
                    "line": line_num
                })
        
        # Extract interface definitions
        interface_pattern = r'type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+interface'
        for line_num, line in enumerate(lines, 1):
            matches = re.findall(interface_pattern, line)
            for interface_name in matches:
                parsed_data["interfaces"].append({
                    "name": interface_name,
                    "line": line_num
                })
        
        # Extract goroutine usage (go keyword)
        for line_num, line in enumerate(lines, 1):
            if ' go ' in line or line.strip().startswith('go ') or ' go.' in line:
                parsed_data["goroutines"].append({
                    "line": line_num,
                    "code": line.strip()
                })
        
        # Extract channel operations
        channel_ops = ['<-', 'make(chan']
        for line_num, line in enumerate(lines, 1):
            if any(op in line for op in channel_ops):
                parsed_data["channels"].append({
                    "line": line_num,
                    "code": line.strip()
                })
        
        # Extract unsafe package usage
        for line_num, line in enumerate(lines, 1):
            if 'unsafe.' in line or 'import "unsafe"' in line:
                parsed_data["unsafe_calls"].append({
                    "line": line_num,
                    "code": line.strip()
                })
        
        # Extract HTTP handlers
        http_patterns = ['http.HandleFunc', 'http.Handle', 'mux.HandleFunc', 'gin.HandlerFunc']
        for line_num, line in enumerate(lines, 1):
            if any(pattern in line for pattern in http_patterns):
                parsed_data["http_handlers"].append({
                    "line": line_num,
                    "code": line.strip()
                })
        
        # Extract exec calls
        exec_patterns = ['exec.Command', 'os/exec', 'syscall.Exec']
        for line_num, line in enumerate(lines, 1):
            if any(pattern in line for pattern in exec_patterns):
                parsed_data["exec_calls"].append({
                    "line": line_num,
                    "code": line.strip()
                })
        
        return parsed_data
    
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
        
        # Check for insecure deserialization patterns in changed lines
        for line_num, line_info in enumerate(ast_data.get("lines", []), 1):
            if line_num in changed_lines:
                line_content = line_info if isinstance(line_info, str) else str(line_info)
                if any(pattern in line_content for pattern in ['gob.Decode', 'gob.NewDecoder']):
                    signals.append({
                        "type": "INSECURE_DESERIALIZATION",
                        "file": file_path,
                        "line": line_num,
                        "severity": "high",
                        "description": "Potential insecure deserialization using gob"
                    })
        
        # Check goroutine creation in changed lines
        for goroutine in ast_data.get("goroutines", []):
            if goroutine["line"] in changed_lines:
                signals.append({
                    "type": "GOROUTINE_CREATION",
                    "file": file_path,
                    "line": goroutine["line"],
                    "severity": "medium",
                    "description": "New goroutine created"
                })
        
        # Check channel operations in changed lines
        for channel in ast_data.get("channels", []):
            if channel["line"] in changed_lines:
                signals.append({
                    "type": "CHANNEL_OPERATION",
                    "file": file_path,
                    "line": channel["line"],
                    "severity": "medium",
                    "description": "Channel operation detected"
                })
        
        # Check unsafe usage in changed lines
        for unsafe_call in ast_data.get("unsafe_calls", []):
            if unsafe_call["line"] in changed_lines:
                signals.append({
                    "type": "UNSAFE_USAGE",
                    "file": file_path,
                    "line": unsafe_call["line"],
                    "severity": "high",
                    "description": "Unsafe package usage detected"
                })
        
        # Check HTTP handler changes
        for handler in ast_data.get("http_handlers", []):
            if handler["line"] in changed_lines:
                signals.append({
                    "type": "HTTP_HANDLER_CHANGE",
                    "file": file_path,
                    "line": handler["line"],
                    "severity": "medium",
                    "description": "HTTP handler modified"
                })
        
        # Check exec calls in changed lines
        for exec_call in ast_data.get("exec_calls", []):
            if exec_call["line"] in changed_lines:
                signals.append({
                    "type": "EXEC_CALL",
                    "file": file_path,
                    "line": exec_call["line"],
                    "severity": "critical",
                    "description": "System execution call detected"
                })
        
        return signals
    
    def get_file_extensions(self) -> List[str]:
        return [".go"]
    
    def supports_incremental_parsing(self) -> bool:
        """Go parser supports incremental parsing for better performance."""
        return True
    
    def get_language_version(self) -> str:
        """Return the Go language version supported."""
        return "1.16+"