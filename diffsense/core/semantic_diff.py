"""
Semantic Analysis Engine for DiffSense

Multi-language semantic analysis supporting Java, Go, Python, C++, and JavaScript.
Uses language-specific parsers and adapters to extract semantic signals.
"""

from typing import List, Set, Dict, Any, Tuple, Optional
from sdk.signal import Signal

# Import parsers registry (lazy import to avoid circular dependency)
def _get_parser_for_file(filename: str):
    try:
        from diffsense.parsers.registry import get_parser_for_file
        return get_parser_for_file(filename)
    except ImportError:
        return None


class SemanticDiff:
    """
    L2 Semantic Analysis Engine (Multi-Language Version).
    
    Responsibility: Parse Diff -> Extract Semantic Signals.
    Does NOT execute rules.
    
    Supports: Java, Go, Python, C++, JavaScript
    """
    
    def __init__(self):
        # Language-specific semantic analysis (currently only Java has deep support)
        # Other languages use parser-level signals
        self._language_extensions = {
            '.java': 'java',
            '.go': 'go',
            '.py': 'python',
            '.pyi': 'python',
            '.cpp': 'cpp',
            '.cc': 'cpp',
            '.cxx': 'cpp',
            '.h': 'cpp',
            '.hpp': 'cpp',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'javascript',
            '.tsx': 'javascript',
            '.mjs': 'javascript',
            '.cjs': 'javascript',
        }
        
        # Pagination variables (for Java)
        self._pagination_vars = {"pageNo", "pageSize", "start", "limit", "offset"}
        
        # Critical calls (for Java)
        self._critical_calls = {"encode", "decode", "validate", "check", "normalize", "sanitize"}
    
    def get_language(self, filename: str) -> str:
        """Detect language from filename extension."""
        ext = '.' + filename.split('.')[-1] if '.' in filename else ''
        return self._language_extensions.get(ext, 'unknown')
    
    def detect_signals(self, diff_data: Dict[str, Any]) -> List[Signal]:
        """
        Main Entry Point: Returns semantic signals for all languages.
        """
        signals = []
        file_patches = diff_data.get('file_patches', [])
        
        # Fallback if parser isn't upgraded
        if not file_patches and 'raw_diff' in diff_data:
            file_patches = [{'file': 'unknown', 'patch': diff_data['raw_diff']}]
        
        # Group files by language
        files_by_language: Dict[str, List[Dict]] = {}
        for entry in file_patches:
            filename = entry.get('file', 'unknown')
            language = self.get_language(filename)
            if language not in files_by_language:
                files_by_language[language] = []
            files_by_language[language].append(entry)
        
        # Analyze each language's files
        for language, files in files_by_language.items():
            if language == 'java':
                # Java: Use existing semantic analysis
                java_signals = self._detect_java_signals(files)
                signals.extend(java_signals)
            elif language != 'unknown':
                # Other languages: Use parser-level signals
                parser_signals = self._detect_parser_signals(files, language, diff_data)
                signals.extend(parser_signals)
        
        return signals
    
    def _detect_java_signals(self, file_patches: List[Dict]) -> List[Signal]:
        """
        Java-specific semantic analysis (deep analysis).
        """
        # Import Java-specific modules lazily to avoid issues
        from javalang.tree import (
            SynchronizedStatement, MethodInvocation, FieldDeclaration, 
            MethodDeclaration, LocalVariableDeclaration, VariableDeclarator,
            ForStatement, WhileStatement, DoStatement
        )
        from .change import Change, ChangeKind
        from .knowledge import is_thread_safe, is_lock_type
        
        signals = []
        
        # Determine Analysis Tier based on Java file count
        if len(file_patches) > 30:
            return [Signal(
                id="meta.large_refactor",
                file="meta",
                action="detected",
                line=None,
                meta={"tier": 3, "language": "java"}
            )]
        
        analysis_mode = "deep"
        if 10 < len(file_patches) <= 30:
            analysis_mode = "light"
        
        for entry in file_patches:
            filename = entry.get('file', 'unknown')
            patch_content = entry.get('patch', '')
            
            if not filename.endswith('.java'):
                continue
            
            file_changes = self._detect_changes_in_patch(
                filename, patch_content, mode=analysis_mode
            )
            
            for ch in file_changes:
                sig = self._convert_change_to_signal(ch)
                if sig:
                    signals.append(sig)
        
        return signals
    
    def _detect_parser_signals(self, file_patches: List[Dict], language: str, diff_data: Dict) -> List[Signal]:
        """
        Use language-specific parsers to extract signals for non-Java languages.
        """
        signals = []
        
        # Get parser for this language
        parser = None
        for entry in file_patches:
            filename = entry.get('file', 'unknown')
            parser = _get_parser_for_file(filename)
            if parser:
                break
        
        if not parser:
            return signals
        
        # Get diff context
        changes_context = []
        if 'changes' in diff_data:
            changes_context = diff_data['changes']
        
        diff_context = {'changes': changes_context}
        
        # Parse each file and extract signals
        for entry in file_patches:
            filename = entry.get('file', 'unknown')
            content = entry.get('content', '')
            
            if content:
                # Parse the file
                ast_data = parser.parse_file(filename, content)
                
                # Extract signals
                if hasattr(parser, 'extract_signals'):
                    file_signals = parser.extract_signals(ast_data, diff_context)
                    for sig_dict in file_signals:
                        signal = Signal(
                            id=sig_dict.get('id', 'unknown'),
                            file=filename,
                            action=sig_dict.get('action', 'unknown'),
                            line=sig_dict.get('line'),
                            meta=sig_dict.get('meta', {})
                        )
                        signals.append(signal)
        
        return signals
    
    def _detect_changes_in_patch(self, filename: str, patch_content: str, mode: str = "deep") -> List[Any]:
        """
        Detect changes in a patch (Java-specific implementation).
        This is the existing logic from the original semantic_diff.py
        """
        # Lazy import to avoid circular dependency
        from javalang import parse as javalang_parse
        from javalang.tree import (
            SynchronizedStatement, MethodInvocation, FieldDeclaration,
            MethodDeclaration, LocalVariableDeclaration, VariableDeclarator,
            ForStatement, WhileStatement, DoStatement
        )
        
        changes = []
        added_lines = []
        removed_lines = []
        
        for line in patch_content.splitlines():
            if line.startswith('+') and not line.startswith('+++'):
                added_lines.append(line[1:].strip())
            elif line.startswith('-') and not line.startswith('---'):
                removed_lines.append(line[1:].strip())
        
        # Analyze removed lines
        if removed_lines:
            self._analyze_snippet_for_changes(
                removed_lines, filename, is_added=False, 
                changes=changes, mode=mode
            )
        
        # Analyze added lines
        if added_lines:
            self._analyze_snippet_for_changes(
                added_lines, filename, is_added=True,
                changes=changes, mode=mode
            )
        
        return changes
    
    def _analyze_snippet_for_changes(self, lines: List[str], filename: str, is_added: bool, 
                                     changes: List, mode: str = "deep"):
        """Analyze a code snippet for semantic changes (Java)."""
        from .change import Change, ChangeKind
        
        try:
            import javalang
            from javalang.tree import (
                SynchronizedStatement, MethodInvocation, FieldDeclaration,
                MethodDeclaration, LocalVariableDeclaration
            )
        except ImportError:
            return
        
        code_snippet = "\n".join(lines)
        
        try:
            tokens = list(javalang.tokenizer.tokenize(code_snippet))
        except:
            return
        
        token_values = [t.value for t in tokens]
        
        # Quick token-based checks
        if "synchronized" in token_values:
            kind = ChangeKind.MODIFIER_ADDED if is_added else ChangeKind.MODIFIER_REMOVED
            changes.append(Change(kind=kind, file=filename, symbol="synchronized"))
            
        if "volatile" in token_values:
            kind = ChangeKind.MODIFIER_ADDED if is_added else ChangeKind.MODIFIER_REMOVED
            changes.append(Change(kind=kind, file=filename, symbol="volatile"))
        
        # Check for pattern matches
        for i in range(len(tokens) - 2):
            if (tokens[i].value == "." and 
                tokens[i+1].value == "lock" and 
                tokens[i+2].value == "("):
                kind = ChangeKind.CALL_ADDED if is_added else ChangeKind.CALL_REMOVED
                changes.append(Change(kind=kind, file=filename, symbol="lock"))
            
            if (tokens[i].value == "Thread" and 
                tokens[i+1].value == "." and 
                tokens[i+2].value == "sleep"):
                kind = ChangeKind.CALL_ADDED if is_added else ChangeKind.CALL_REMOVED
                changes.append(Change(kind=kind, file=filename, symbol="sleep"))
        
        # Skip deep analysis in light mode
        if mode == "light":
            return
        
        # Deep AST analysis
        wrapper_class = f"class Dummy {{ {code_snippet} }}"
        try:
            tree = javalang_parse.parse(wrapper_class)
            self._analyze_tree_changes(tree, filename, is_added, {}, changes)
        except:
            pass
    
    def _analyze_tree_changes(self, tree, filename: str, is_added: bool, var_map: Dict, changes: List):
        """Analyze AST tree for changes (Java)."""
        from .change import Change, ChangeKind
        
        try:
            from javalang.tree import (
                SynchronizedStatement, MethodInvocation, FieldDeclaration,
                MethodDeclaration, LocalVariableDeclaration, ForStatement, WhileStatement, DoStatement
            )
        except ImportError:
            return
        
        for path, node in tree:
            if isinstance(node, SynchronizedStatement):
                kind = ChangeKind.MODIFIER_ADDED if is_added else ChangeKind.MODIFIER_REMOVED
                changes.append(Change(kind=kind, file=filename, symbol="synchronized"))
            
            if isinstance(node, MethodDeclaration):
                if 'synchronized' in node.modifiers:
                    kind = ChangeKind.MODIFIER_ADDED if is_added else ChangeKind.MODIFIER_REMOVED
                    changes.append(Change(kind=kind, file=filename, symbol="synchronized"))
            
            if isinstance(node, FieldDeclaration):
                if 'volatile' in node.modifiers:
                    kind = ChangeKind.MODIFIER_ADDED if is_added else ChangeKind.MODIFIER_REMOVED
                    changes.append(Change(kind=kind, file=filename, symbol="volatile"))
                
                if node.type:
                    for declarator in node.declarators:
                        var_map[declarator.name] = node.type.name
    
    def _convert_change_to_signal(self, change) -> Optional[Signal]:
        """Convert internal Change to Signal (Java)."""
        from .change import ChangeKind
        
        if not hasattr(change, 'kind'):
            return None
        
        # Map Change -> Signal ID
        sig_id = None
        if hasattr(change, 'symbol'):
            if change.symbol == "lock" or change.symbol == "unlock":
                sig_id = "runtime.concurrency.lock"
            elif change.symbol == "synchronized":
                sig_id = "runtime.concurrency.synchronized"
            elif change.symbol == "volatile":
                sig_id = "runtime.concurrency.volatile"
            elif change.symbol == "sleep":
                sig_id = "runtime.performance.sleep_added"
        
        if not sig_id and change.kind == ChangeKind.TYPE_CHANGED:
            if change.meta.get('downgrade'):
                sig_id = "runtime.concurrency.thread_safety_downgrade"
        
        if not sig_id:
            return None
        
        # Map ChangeKind -> Action
        action = "changed"
        if change.kind in [ChangeKind.CALL_ADDED, ChangeKind.FIELD_ADDED, ChangeKind.MODIFIER_ADDED]:
            action = "added"
        elif change.kind in [ChangeKind.CALL_REMOVED, ChangeKind.FIELD_REMOVED, ChangeKind.MODIFIER_REMOVED]:
            action = "removed"
        elif change.kind == ChangeKind.TYPE_CHANGED:
            action = "downgrade"
        
        return Signal(
            id=sig_id,
            file=change.file,
            action=action,
            line=getattr(change, 'line_no', None),
            meta=getattr(change, 'meta', {})
        )