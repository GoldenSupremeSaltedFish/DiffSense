import ast
from typing import List, Dict, Any, Optional
from .base_parser import BaseParser

class PythonParser(BaseParser):
    """
    Python-specific parser implementation using Python's built-in ast module.
    """
    
    def __init__(self):
        super().__init__("python")
    
    def parse_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """
        Parse Python file and return AST representation using built-in ast module.
        """
        try:
            parsed_ast = ast.parse(content, filename=file_path)
            return {
                "file": file_path,
                "language": "python",
                "ast_type": "python_module",
                "ast": parsed_ast,
                "nodes": self._extract_nodes(parsed_ast),
                "imports": self._extract_imports(parsed_ast),
                "functions": self._extract_functions(parsed_ast),
                "classes": self._extract_classes(parsed_ast)
            }
        except SyntaxError as e:
            # Handle syntax errors gracefully
            return {
                "file": file_path,
                "language": "python",
                "ast_type": "python_module",
                "error": str(e),
                "nodes": [],
                "imports": [],
                "functions": [],
                "classes": []
            }
    
    def _extract_nodes(self, parsed_ast) -> List[Dict[str, Any]]:
        """Extract relevant nodes from Python AST."""
        nodes = []
        for node in ast.walk(parsed_ast):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, 
                               ast.Import, ast.ImportFrom, ast.Call, ast.Assign)):
                nodes.append({
                    "type": type(node).__name__,
                    "lineno": getattr(node, 'lineno', 0),
                    "col_offset": getattr(node, 'col_offset', 0)
                })
        return nodes
    
    def _extract_imports(self, parsed_ast) -> List[str]:
        """Extract import statements."""
        imports = []
        for node in ast.walk(parsed_ast):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module)
        return imports
    
    def _extract_functions(self, parsed_ast) -> List[Dict[str, Any]]:
        """Extract function definitions."""
        functions = []
        for node in ast.walk(parsed_ast):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                functions.append({
                    "name": node.name,
                    "lineno": node.lineno,
                    "async": isinstance(node, ast.AsyncFunctionDef),
                    "decorators": [d.id if isinstance(d, ast.Name) else str(d) for d in node.decorator_list]
                })
        return functions
    
    def _extract_classes(self, parsed_ast) -> List[Dict[str, Any]]:
        """Extract class definitions."""
        classes = []
        for node in ast.walk(parsed_ast):
            if isinstance(node, ast.ClassDef):
                classes.append({
                    "name": node.name,
                    "lineno": node.lineno,
                    "bases": [b.id if isinstance(b, ast.Name) else str(b) for b in node.bases]
                })
        return classes
    
    def extract_signals(self, ast_data: Dict[str, Any], diff_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract Python-specific semantic signals from AST.
        """
        signals = []
        file_path = ast_data.get("file", "unknown")
        
        # Get changed lines from diff context
        changed_lines = set()
        for change in diff_context.get("changes", []):
            if change.get("file") == file_path:
                changed_lines.update(range(change.get("start_line", 0), change.get("end_line", 0) + 1))
        
        # Extract Python-specific signals from changed lines
        if "ast" in ast_data and not ast_data.get("error"):
            parsed_ast = ast_data["ast"]
            
            # Look for specific patterns in changed lines
            for node in ast.walk(parsed_ast):
                node_lineno = getattr(node, 'lineno', 0)
                if node_lineno in changed_lines:
                    if isinstance(node, ast.Call):
                        # Function calls in changed lines
                        if hasattr(node.func, 'id'):
                            signals.append({
                                "id": f"python.function_call.{node.func.id}",
                                "action": "added",
                                "file": file_path,
                                "line": node_lineno,
                                "language": "python"
                            })
                    
                    elif isinstance(node, ast.Import) or isinstance(node, ast.ImportFrom):
                        # Import statements in changed lines
                        signals.append({
                            "id": "python.import_added",
                            "action": "added", 
                            "file": file_path,
                            "line": node_lineno,
                            "language": "python"
                        })
                    
                    elif isinstance(node, ast.Assign):
                        # Variable assignments in changed lines
                        signals.append({
                            "id": "python.assignment_added",
                            "action": "added",
                            "file": file_path,
                            "line": node_lineno,
                            "language": "python"
                        })
        
        return signals
    
    def get_file_extensions(self) -> List[str]:
        return [".py", ".pyi"]