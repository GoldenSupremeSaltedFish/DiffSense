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
            
            detected_ids = self._detect_in_patch(patch_content)
            
            for sig_id in detected_ids:
                signals.append(Signal(
                    id=sig_id,
                    file=filename,
                    confidence=1.0
                ))
                
        return signals

    def _detect_in_patch(self, patch_content: str) -> Set[str]:
        """
        Analyzes a single file patch content.
        """
        signals = set()
        
        # 1. Extract added lines
        added_lines = []
        for line in patch_content.splitlines():
            if line.startswith('+') and not line.startswith('+++'):
                added_lines.append(line[1:].strip())
        
        if not added_lines:
            return signals

        code_snippet = "\n".join(added_lines)

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
            
            if isinstance(node, MethodInvocation):
                if node.member == "lock":
                    signals.add("runtime.concurrency.lock")
