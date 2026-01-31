import javalang
from javalang.tree import SynchronizedStatement, MethodInvocation, FieldDeclaration, MethodDeclaration
from typing import List, Set, Dict, Any
from .signal_model import Signal

class ASTDetector:
    def __init__(self):
        pass

    def detect_signals(self, diff_data: Dict[str, Any]) -> List[Signal]:
        """
        Analyzes the diff data (with file patches) and returns a list of Signal objects.
        """
        signals = []
        
        # We expect 'file_patches' in diff_data from the upgraded parser
        file_patches = diff_data.get('file_patches', [])
        
        # Fallback if parser isn't upgraded or used differently
        if not file_patches and 'raw_diff' in diff_data:
            # Fallback to single chunk with unknown file (old behavior compatibility)
            file_patches = [{'file': 'unknown', 'patch': diff_data['raw_diff']}]

        for entry in file_patches:
            filename = entry.get('file', 'unknown')
            patch_content = entry.get('patch', '')
            
            # Skip non-java files for this detector
            if not filename.endswith('.java') and filename != 'unknown':
                continue
            
            detected_results = self._detect_in_patch(patch_content)
            
            for result in detected_results:
                signals.append(Signal(
                    id=result["id"],
                    file=filename,
                    confidence=1.0,
                    action=result["action"]
                ))
                
        return signals

    def _detect_in_patch(self, patch_content: str) -> List[Dict[str, str]]:
        """
        Analyzes a single file patch content.
        Returns a list of dicts: {"id": signal_id, "action": "added"|"removed"}
        """
        detected_results = []
        
        # 1. Extract added and removed lines
        added_lines = []
        removed_lines = []
        
        for line in patch_content.splitlines():
            if line.startswith('+') and not line.startswith('+++'):
                added_lines.append(line[1:].strip())
            elif line.startswith('-') and not line.startswith('---'):
                removed_lines.append(line[1:].strip())
        
        # Analyze Added
        if added_lines:
            signals_added = self._analyze_snippet(added_lines)
            for sig in signals_added:
                detected_results.append({"id": sig, "action": "added"})

        # Analyze Removed
        if removed_lines:
            signals_removed = self._analyze_snippet(removed_lines)
            for sig in signals_removed:
                detected_results.append({"id": sig, "action": "removed"})
                
        return detected_results

    def _analyze_snippet(self, lines: List[str]) -> Set[str]:
        """
        Analyzes a list of code lines for signals.
        """
        signals = set()
        code_snippet = "\n".join(lines)
        
        # 2. Tokenizer based detection
        try:
            tokens = list(javalang.tokenizer.tokenize(code_snippet))
        except:
            return signals

        token_values = [t.value for t in tokens]
        
        if "synchronized" in token_values:
             signals.add("runtime.concurrency.synchronized")

        if "volatile" in token_values:
            signals.add("runtime.concurrency.volatile")

        if "ConcurrentHashMap" in token_values:
            signals.add("runtime.concurrency.concurrent_map")

        for i in range(len(tokens) - 2):
            if (tokens[i].value == "." and 
                tokens[i+1].value == "lock" and 
                tokens[i+2].value == "("):
                signals.add("runtime.concurrency.lock")

        # 3. AST Parsing
        parsed = False
        
        # Try Class Body context
        wrapper_class = f"class Dummy {{ {code_snippet} }}"
        try:
            tree = javalang.parse.parse(wrapper_class)
            self._analyze_tree(tree, signals)
            parsed = True
        except Exception:
            pass

        if not parsed:
            # Try Method Body context
            wrapper_method = f"class Dummy {{ void dummy() {{ {code_snippet} }} }}"
            try:
                tree = javalang.parse.parse(wrapper_method)
                self._analyze_tree(tree, signals)
                parsed = True
            except Exception:
                pass
        
        return signals

    def _analyze_tree(self, tree, signals: Set[str]):
        for path, node in tree:
            if isinstance(node, SynchronizedStatement):
                signals.add("runtime.concurrency.synchronized")
            
            if isinstance(node, MethodDeclaration):
                if 'synchronized' in node.modifiers:
                    signals.add("runtime.concurrency.synchronized")

            if isinstance(node, FieldDeclaration):
                if 'volatile' in node.modifiers:
                    signals.add("runtime.concurrency.volatile")
                
                # Check for ConcurrentHashMap type
                if node.type and node.type.name == "ConcurrentHashMap":
                    signals.add("runtime.concurrency.concurrent_map")
            
            if isinstance(node, MethodInvocation):
                if node.member == "lock":
                    signals.add("runtime.concurrency.lock")
