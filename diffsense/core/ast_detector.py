import re
import javalang
from javalang.tree import SynchronizedStatement, MethodInvocation, FieldDeclaration, MethodDeclaration, LocalVariableDeclaration, VariableDeclarator, ForStatement, WhileStatement, DoStatement, ClassCreator
from typing import List, Set, Dict, Any, Tuple, Optional
from .signal_model import Signal
from .change import Change, ChangeKind
from .knowledge import is_thread_safe, is_lock_type

class ASTDetector:
    def __init__(self):
        self.pagination_vars = {"pageNo", "pageSize", "start", "limit", "offset"}
        self.critical_calls = {"encode", "decode", "validate", "check", "normalize", "sanitize"}
        self.risky_executors = {"newFixedThreadPool", "newCachedThreadPool", "newSingleThreadExecutor"}
    
    def detect_changes(self, diff_data: Dict[str, Any]) -> List[Change]:
        """
        New Entry Point: Returns semantic changes instead of raw signals.
        """
        changes = []
        file_patches = diff_data.get('file_patches', [])
        
        # Fallback if parser isn't upgraded
        if not file_patches and 'raw_diff' in diff_data:
             file_patches = [{'file': 'unknown', 'patch': diff_data['raw_diff']}]
             
        # Determine Analysis Tier
        java_files = [f for f in file_patches if f.get('file', '').endswith('.java')]
        num_java_files = len(java_files)
        
        # Tier 3: Metadata Only (Mega Diff / Refactor)
        if num_java_files > 30:
            return [Change(kind=ChangeKind.UNKNOWN, file="meta", symbol="LargeRefactor", meta={"tier": 3})]
            
        # Tier 2: Lightweight (Tokenizer Only)
        analysis_mode = "deep"
        if 10 < num_java_files <= 30:
            analysis_mode = "light"
            
        for entry in file_patches:
            filename = entry.get('file', 'unknown')
            patch_content = entry.get('patch', '')
            
            # Strict check: must be .java
            if not filename.endswith('.java'):
                print(f"DEBUG: Skipping non-Java file: {filename}")
                continue
            
            print(f"DEBUG: Analyzing Java file: {filename}")
            file_changes = self._detect_changes_in_patch(filename, patch_content, mode=analysis_mode)
            changes.extend(file_changes)
            
        # Deduplicate changes
        unique_changes = []
        seen = set()
        for ch in changes:
            # Create a tuple for hashing
            meta_items = []
            for k, v in sorted(ch.meta.items()):
                if isinstance(v, list):
                    v = tuple(v)
                meta_items.append((k, v))
            
            key = (ch.kind, ch.file, ch.symbol, ch.before, ch.after, ch.line_no, tuple(meta_items))
            if key not in seen:
                seen.add(key)
                unique_changes.append(ch)
                
        return unique_changes

    def detect_signals(self, diff_data: Dict[str, Any]) -> List[Signal]:
        """
        Legacy Adapter: Converts Changes -> Signals for backward compatibility with RuleEngine.
        """
        changes = self.detect_changes(diff_data)
        signals = []
        
        for ch in changes:
            # Handle Tier 3 Signal
            if ch.symbol == "LargeRefactor":
                signals.append(Signal(
                    id="meta.large_refactor",
                    file="meta",
                    confidence=1.0,
                    action="detected",
                    meta=ch.meta
                ))
                continue

            # Map Change -> Signal ID
            sig_id = self._map_change_to_signal_id(ch)
            if sig_id:
                # Check for inline ignores
                ignored_rules = ch.meta.get('ignores', [])
                if sig_id in ignored_rules or 'all' in ignored_rules:
                    # Signal is suppressed
                    continue

                # Map ChangeKind -> Action string
                action = self._map_kind_to_action(ch.kind)
                
                signals.append(Signal(
                    id=sig_id,
                    file=ch.file,
                    confidence=1.0,
                    action=action,
                    meta=ch.meta,
                    line=ch.line_no
                ))
        return signals

    def _map_change_to_signal_id(self, change: Change) -> Optional[str]:
        # Mapping logic (Change -> Signal ID)
        if change.kind == ChangeKind.TYPE_CHANGED:
            if change.meta.get('downgrade'):
                return "runtime.concurrency.thread_safety_downgrade"
        
        if change.kind == ChangeKind.FIELD_ADDED:
             if change.meta.get('static_unsafe'):
                 return "runtime.concurrency.static_unsafe_collection"
        
        if change.symbol == "lock" or change.symbol == "unlock":
             return "runtime.concurrency.lock"
             
        if change.symbol == "synchronized":
             return "runtime.concurrency.synchronized"
             
        if change.symbol == "volatile":
             return "runtime.concurrency.volatile"

        if change.kind == ChangeKind.CALL_ADDED:
            if change.symbol == "sleep":
                return "runtime.performance.sleep_added"
            if change.symbol == "remove" and change.meta.get("in_loop"):
                return "runtime.collection_mutation_inside_loop"
            if change.symbol == "newFixedThreadPool" or change.symbol == "newCachedThreadPool":
                return "runtime.concurrency.executors_factory_risk"
            if change.symbol == "get" and change.meta.get("blocking_get"):
                return "runtime.concurrency.future_get_without_timeout"

        if change.kind == ChangeKind.OBJECT_CREATION:
            if change.symbol == "ThreadPoolExecutor":
                return "runtime.concurrency.threadpool_creation"

        if change.kind == ChangeKind.CALL_REMOVED:
            if change.symbol in self.critical_calls:
                return "runtime.input_normalization_removed"

        if change.symbol == "ConcurrentHashMap":
             return "runtime.concurrency.concurrent_map"
             
        if change.symbol in self.pagination_vars:
            return "data.pagination_semantic_change"

        return None

    def _map_kind_to_action(self, kind: ChangeKind) -> str:
        if kind in [ChangeKind.CALL_ADDED, ChangeKind.FIELD_ADDED, ChangeKind.MODIFIER_ADDED, ChangeKind.OBJECT_CREATION]:
            return "added"
        if kind in [ChangeKind.CALL_REMOVED, ChangeKind.FIELD_REMOVED, ChangeKind.MODIFIER_REMOVED]:
            return "removed"
        if kind == ChangeKind.TYPE_CHANGED:
            return "downgrade" # Specific mapping for now
        if kind == ChangeKind.UNKNOWN and "action" in kind.name: # Fallback?
             return "changed"
        return "changed"

    def _detect_changes_in_patch(self, filename: str, patch_content: str, mode: str = "deep") -> List[Change]:
        changes = []
        
        added_lines = []
        removed_lines = []
        
        for line in patch_content.splitlines():
            if line.startswith('+') and not line.startswith('+++'):
                added_lines.append(line[1:].strip())
            elif line.startswith('-') and not line.startswith('---'):
                removed_lines.append(line[1:].strip())
        
        # Analyze Removed
        removed_vars = {} 
        removed_calls = set()
        removed_modifiers = set()
        
        if removed_lines:
             self._analyze_snippet_for_changes(removed_lines, filename, is_added=False, 
                                               var_map=removed_vars, call_set=removed_calls, mod_set=removed_modifiers, changes=changes, mode=mode)

        # Analyze Added
        added_vars = {}
        added_calls = set()
        added_modifiers = set()
        
        if added_lines:
             self._analyze_snippet_for_changes(added_lines, filename, is_added=True,
                                               var_map=added_vars, call_set=added_calls, mod_set=added_modifiers, changes=changes, mode=mode)
        
        # Cross-Analyze: Type Downgrade (Only in Deep Mode or if we have enough info)
        # Tokenizer might not give us full type info, so this is best effort in light mode
        for var_name, old_type in removed_vars.items():
            if var_name in added_vars:
                new_type = added_vars[var_name]
                if is_thread_safe(old_type) and not is_thread_safe(new_type):
                    changes.append(Change(
                        kind=ChangeKind.TYPE_CHANGED,
                        file=filename,
                        symbol=var_name,
                        before=old_type,
                        after=new_type,
                        meta={"downgrade": True, "from": old_type, "to": new_type}
                    ))
        
        return changes

    def _analyze_snippet_for_changes(self, lines: List[str], filename: str, is_added: bool, 
                                     var_map: Dict, call_set: Set, mod_set: Set, changes: List[Change], mode: str = "deep"):
        
        start_change_idx = len(changes)
        
        # 1. Scan for Ignores
        ignores_map = {} # line_idx (0-based) -> set(rule_ids)
        ignore_pattern = re.compile(r"//\s*diffsense-ignore:\s*([\w\.]+)")
        
        for i, line in enumerate(lines):
            match = ignore_pattern.search(line)
            if match:
                rule_id = match.group(1)
                # Apply to current line
                if i not in ignores_map: ignores_map[i] = set()
                ignores_map[i].add(rule_id)
                # Apply to next line (often comments are above)
                if i + 1 < len(lines):
                    if i + 1 not in ignores_map: ignores_map[i+1] = set()
                    ignores_map[i+1].add(rule_id)

        code_snippet = "\n".join(lines)
        
        # 2. Tokenizer
        try:
            tokens = list(javalang.tokenizer.tokenize(code_snippet))
        except:
            return

        # token_values = [t.value for t in tokens] 
        # Iterate tokens directly to get position
        
        # Raw Token Checks (Legacy/Simple)
        for token in tokens:
            token_val = token.value
            line_no = token.position.line # 1-based relative to snippet
            
            if token_val == "synchronized":
                kind = ChangeKind.MODIFIER_ADDED if is_added else ChangeKind.MODIFIER_REMOVED
                changes.append(Change(kind=kind, file=filename, symbol="synchronized", line_no=line_no))
                
            if token_val == "volatile":
                kind = ChangeKind.MODIFIER_ADDED if is_added else ChangeKind.MODIFIER_REMOVED
                changes.append(Change(kind=kind, file=filename, symbol="volatile", line_no=line_no))
                
            if token_val == "ConcurrentHashMap":
                 if not is_added:
                     changes.append(Change(kind=ChangeKind.UNKNOWN, file=filename, symbol="ConcurrentHashMap", meta={"action": "removed"}, line_no=line_no))

            if token_val in self.pagination_vars:
                kind = ChangeKind.UNKNOWN
                changes.append(Change(kind=kind, file=filename, symbol=token_val, meta={"action": "changed"}, line_no=line_no))

        # Check for sequences
        for i in range(len(tokens) - 2):
            if (tokens[i].value == "." and 
                tokens[i+1].value == "lock" and 
                tokens[i+2].value == "("):
                kind = ChangeKind.CALL_ADDED if is_added else ChangeKind.CALL_REMOVED
                changes.append(Change(kind=kind, file=filename, symbol="lock", line_no=tokens[i+1].position.line))
            
            if (tokens[i].value == "Thread" and 
                tokens[i+1].value == "." and 
                tokens[i+2].value == "sleep"):
                kind = ChangeKind.CALL_ADDED if is_added else ChangeKind.CALL_REMOVED
                changes.append(Change(kind=kind, file=filename, symbol="sleep", line_no=tokens[i+2].position.line))

        # Critical Calls
        for i in range(len(tokens) - 1):
            if tokens[i].value in self.critical_calls and tokens[i+1].value == "(":
                kind = ChangeKind.CALL_ADDED if is_added else ChangeKind.CALL_REMOVED
                changes.append(Change(kind=kind, file=filename, symbol=tokens[i].value, line_no=tokens[i].position.line))

        # Stop here if mode is 'light'
        if mode == "light":
            self._apply_ignores(changes, start_change_idx, ignores_map)
            return

        # 3. AST Parsing
        parsed = False
        wrapper_class = f"class Dummy {{\n{code_snippet}\n}}" # Offset 1 line
        offset = 1
        try:
            tree = javalang.parse.parse(wrapper_class)
            self._analyze_tree_changes(tree, filename, is_added, var_map, changes, offset)
            parsed = True
        except Exception:
            pass

        if not parsed:
            wrapper_method = f"class Dummy {{ void dummy() {{\n{code_snippet}\n}} }}" # Offset 2 lines
            offset = 2
            try:
                tree = javalang.parse.parse(wrapper_method)
                self._analyze_tree_changes(tree, filename, is_added, var_map, changes, offset)
                parsed = True
            except Exception:
                pass
                
        # Apply Ignores
        self._apply_ignores(changes, start_change_idx, ignores_map)

    def _apply_ignores(self, changes: List[Change], start_idx: int, ignores_map: Dict[int, Set[str]]):
        for i in range(start_idx, len(changes)):
            ch = changes[i]
            if ch.line_no:
                # line_no is 1-based, ignores_map is 0-based
                idx = ch.line_no - 1
                if idx in ignores_map:
                    ch.meta['ignores'] = list(ignores_map[idx])

    def _analyze_tree_changes(self, tree, filename: str, is_added: bool, var_map: Dict, changes: List[Change], offset: int = 0):
        for path, node in tree:
            line_no = (node.position.line - offset) if node.position else None
            
            if isinstance(node, SynchronizedStatement):
                kind = ChangeKind.MODIFIER_ADDED if is_added else ChangeKind.MODIFIER_REMOVED
                changes.append(Change(kind=kind, file=filename, symbol="synchronized", line_no=line_no))
            
            if isinstance(node, MethodDeclaration):
                if 'synchronized' in node.modifiers:
                    kind = ChangeKind.MODIFIER_ADDED if is_added else ChangeKind.MODIFIER_REMOVED
                    changes.append(Change(kind=kind, file=filename, symbol="synchronized", line_no=line_no))

            if isinstance(node, FieldDeclaration):
                if 'volatile' in node.modifiers:
                    kind = ChangeKind.MODIFIER_ADDED if is_added else ChangeKind.MODIFIER_REMOVED
                    changes.append(Change(kind=kind, file=filename, symbol="volatile", line_no=line_no))
                
                if node.type:
                    for declarator in node.declarators:
                        var_map[declarator.name] = node.type.name
                        
                        if is_added and 'static' in node.modifiers:
                            if not is_thread_safe(node.type.name):
                                risky_static_types = {"HashMap", "ArrayList", "HashSet", "TreeMap", "LinkedList"}
                                base_type = node.type.name.split('<')[0]
                                if base_type in risky_static_types:
                                     changes.append(Change(
                                         kind=ChangeKind.FIELD_ADDED,
                                         file=filename,
                                         symbol=declarator.name,
                                         meta={"static_unsafe": True},
                                         line_no=line_no
                                     ))

            if isinstance(node, LocalVariableDeclaration):
                 if node.type:
                     for declarator in node.declarators:
                         var_map[declarator.name] = node.type.name

            if isinstance(node, MethodInvocation):
                call_name = node.member
                qualifier = node.qualifier
                
                # General call tracking
                kind = ChangeKind.CALL_ADDED if is_added else ChangeKind.CALL_REMOVED
                
                # Special checks
                if call_name == "lock":
                    changes.append(Change(kind=kind, file=filename, symbol="lock", line_no=line_no))
                elif call_name == "sleep":
                    changes.append(Change(kind=kind, file=filename, symbol="sleep", line_no=line_no))
                
                # Dubbo P0: Executors factory methods
                if qualifier == "Executors" and call_name in ["newFixedThreadPool", "newCachedThreadPool"]:
                     changes.append(Change(kind=kind, file=filename, symbol=call_name, meta={"risk": "threadpool_factory"}, line_no=line_no))

                # Dubbo P0: Future.get() without timeout
                # Heuristic: method is "get" and has 0 arguments. 
                # Ideally check variable type in var_map, but qualifier might be complex expression.
                if call_name == "get" and not node.arguments:
                    # Optional: Check if qualifier is known Future/CompletableFuture (if simple var)
                    # For now, aggressive match for P0
                    changes.append(Change(kind=kind, file=filename, symbol="get", meta={"blocking_get": True}, line_no=line_no))

                # Critical calls (input/validation)
                if call_name in self.critical_calls and not is_added:
                    changes.append(Change(kind=kind, file=filename, symbol=call_name, line_no=line_no))
                
                # Collection mutation in loop
                if call_name == "remove" and is_added:
                    # Check if inside a loop
                    if self._is_inside_loop(path):
                        changes.append(Change(kind=kind, file=filename, symbol="remove", meta={"in_loop": True}, line_no=line_no))

            if isinstance(node, ClassCreator):
                if node.type.name == "ThreadPoolExecutor":
                    kind = ChangeKind.OBJECT_CREATION if is_added else ChangeKind.UNKNOWN # Only care about addition/change usually
                    if is_added:
                        # Could analyze arguments here for corePoolSize=0 etc.
                        changes.append(Change(kind=kind, file=filename, symbol="ThreadPoolExecutor", line_no=line_no))


    def _is_inside_loop(self, path: Tuple) -> bool:
        """
        Check if the current node (at the end of path) is inside a loop structure.
        path is a list/tuple of parent nodes.
        """
        for node in reversed(path):
            if isinstance(node, (ForStatement, WhileStatement, DoStatement)):
                return True
        return False
