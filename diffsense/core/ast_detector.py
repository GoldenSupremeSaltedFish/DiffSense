import re
import os
import hashlib
import pickle
import javalang
from javalang.tokenizer import BasicType, Identifier
from javalang.tree import SynchronizedStatement, MethodInvocation, FieldDeclaration, MethodDeclaration, LocalVariableDeclaration, VariableDeclarator, ForStatement, WhileStatement, DoStatement, ClassCreator, ReferenceType, BasicType as TreeBasicType, Assignment, TryResource, TryStatement, IfStatement, BinaryOperation, Literal
from typing import List, Set, Dict, Any, Tuple, Optional
from . import CACHE_VERSION
from .signal_model import Signal
from .change import Change, ChangeKind
from .knowledge import is_thread_safe, is_lock_type

class ASTDetector:
    def __init__(self):
        self.pagination_vars = {"pageNo", "pageSize", "start", "limit", "offset"}
        self.critical_calls = {"encode", "decode", "validate", "check", "normalize", "sanitize"}
        self.risky_executors = {"newFixedThreadPool", "newCachedThreadPool", "newSingleThreadExecutor"}
        self.cache_dir = self._resolve_cache_dir()

    def _resolve_cache_dir(self) -> str:
        base_dir = os.environ.get("DIFFSENSE_CACHE_DIR")
        if not base_dir:
            base_dir = os.path.join(os.path.expanduser("~"), ".diffsense", "cache")
        return os.path.join(base_dir, CACHE_VERSION, "ast")

    def _ast_cache_key(self, wrapper_type: str, wrapper_text: str) -> str:
        hasher = hashlib.sha1()
        hasher.update(wrapper_type.encode("utf-8", errors="ignore"))
        hasher.update(wrapper_text.encode("utf-8", errors="ignore"))
        return hasher.hexdigest()

    def _cache_path(self, cache_key: str) -> str:
        return os.path.join(self.cache_dir, f"{cache_key}.pkl")

    def _load_cached_tree(self, cache_key: str) -> Optional[Dict[str, Any]]:
        path = self._cache_path(cache_key)
        if not os.path.exists(path):
            return None
        try:
            with open(path, "rb") as f:
                data = pickle.load(f)
            if isinstance(data, dict) and "ok" in data:
                return data
        except Exception:
            return None
        return None

    def _save_cached_tree(self, cache_key: str, tree: Any, ok: bool) -> None:
        os.makedirs(self.cache_dir, exist_ok=True)
        path = self._cache_path(cache_key)
        try:
            with open(path, "wb") as f:
                pickle.dump({"ok": ok, "tree": tree}, f)
        except Exception:
            pass

    def _parse_with_cache(self, wrapper_type: str, wrapper_text: str) -> Optional[Any]:
        cache_key = self._ast_cache_key(wrapper_type, wrapper_text)
        cached = self._load_cached_tree(cache_key)
        if cached is not None:
            if cached.get("ok") is False:
                return None
            return cached.get("tree")
        try:
            tree = javalang.parse.parse(wrapper_text)
            self._save_cached_tree(cache_key, tree, ok=True)
            return tree
        except Exception:
            self._save_cached_tree(cache_key, None, ok=False)
            return None
    
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
        
        if change.symbol == "lock":
             if change.kind == ChangeKind.CALL_REMOVED:
                 return "runtime.concurrency.lock_removed"
             return "runtime.concurrency.lock"
             
        if change.symbol == "synchronized":
             if change.kind == ChangeKind.MODIFIER_REMOVED:
                 return "runtime.concurrency.lock_removed"
             return "runtime.concurrency.synchronized"
             
        if change.symbol == "volatile":
             if change.kind == ChangeKind.MODIFIER_REMOVED:
                 return "runtime.concurrency.volatile_removed"
             return "runtime.concurrency.volatile"

        if change.symbol == "final":
             if change.kind == ChangeKind.MODIFIER_REMOVED:
                 return "runtime.concurrency.final_removed"

        if change.symbol == "atomic_set" and change.kind == ChangeKind.CALL_REMOVED:
             return "runtime.concurrency.atomic_to_non_atomic_write"

        if change.symbol == "ThreadPoolExecutor":
             if change.meta.get('param_change'):
                 return "runtime.concurrency.threadpool_param_change"
             if change.kind == ChangeKind.OBJECT_CREATION and change.meta.get('args_count'):
                  return "runtime.concurrency.threadpool_creation"
        
        if change.symbol == "LinkedBlockingQueue":
             if change.meta.get('unbounded'):
                 return "runtime.concurrency.threadpool_unbounded_queue"

        if change.symbol == "sleep":
            if change.kind == ChangeKind.CALL_ADDED:
                return "runtime.performance.sleep_added"
        
        if change.symbol == "while_true":
             if change.kind == ChangeKind.CALL_ADDED:
                 return "runtime.concurrency.busy_wait_added"

        # P1 Resource
        if change.symbol == "try_with_resources" and change.kind == ChangeKind.CALL_REMOVED:
             return "runtime.resource.try_with_resource_removed"

        if change.meta.get('cache_eviction'):
             return "runtime.resource.cache_eviction_removed"

        if change.meta.get('timeout_removed'):
             return "runtime.network.timeout_removed"

        # P2 Data
        if change.symbol == "null_check" and change.meta.get('action') == "removed":
             return "runtime.data.null_check_removed"

        if change.symbol == "equals_to_ref":
             return "runtime.data.equals_to_reference_compare"

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
                        meta={"downgrade": True, "from": old_type, "to": new_type, "var": var_name}
                    ))
        
        # Cross-Analyze: ThreadPoolExecutor Param Change
        tpe_removed = any(c.symbol == "ThreadPoolExecutor" and c.meta.get("action") == "removed" for c in changes)
        tpe_added = any(c.symbol == "ThreadPoolExecutor" and c.meta.get("action") == "added" for c in changes)
        
        if tpe_removed and tpe_added:
             changes.append(Change(kind=ChangeKind.UNKNOWN, file=filename, symbol="ThreadPoolExecutor", meta={"param_change": True}, line_no=None))

        # Cross-Analyze: equals -> ==
        equals_removed = any(c.symbol == "equals" and c.kind == ChangeKind.CALL_REMOVED for c in changes)
        eq_added = any(c.symbol == "==" and c.kind == ChangeKind.CALL_ADDED for c in changes)
        if equals_removed and eq_added:
             changes.append(Change(kind=ChangeKind.UNKNOWN, file=filename, symbol="equals_to_ref", meta={"semantic": True}, line_no=None))

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

        parsed = False
        wrapper_class = f"class Dummy {{\n{code_snippet}\n}}"
        offset = 1
        tree = self._parse_with_cache("class", wrapper_class)
        if tree is not None:
            self._analyze_tree_changes(tree, filename, is_added, var_map, changes, offset)
            parsed = True

        if not parsed:
            wrapper_method = f"class Dummy {{ void dummy() {{\n{code_snippet}\n}} }}"
            offset = 2
            tree = self._parse_with_cache("method", wrapper_method)
            if tree is not None:
                self._analyze_tree_changes(tree, filename, is_added, var_map, changes, offset)
                parsed = True
        
        # Fallback: Extract vars from tokens if parsing failed
        if not parsed:
             self._analyze_tokens_fallback(tokens, var_map, changes, filename, is_added)

        # Apply Ignores
        self._apply_ignores(changes, start_change_idx, ignores_map)

    def _analyze_tokens_fallback(self, tokens, var_map, changes, filename, is_added):
        i = 0
        modifiers = set()
        
        while i < len(tokens) - 1:
            token = tokens[i]
            
            # 1. Collect Modifiers
            if token.value in ['private', 'public', 'protected', 'static', 'final', 'volatile', 'transient']:
                modifiers.add(token.value)
                i += 1
                continue
            
            # 2. Check for Type
            is_type = isinstance(token, (Identifier, BasicType))
            
            if not is_type:
                modifiers = set()
                i += 1
                continue

            current_type_name = token.value
            
            # Check for Generics
            idx = i + 1
            if idx < len(tokens) and tokens[idx].value == '<':
                depth = 1
                idx += 1
                while idx < len(tokens) and depth > 0:
                    if tokens[idx].value == '<': depth += 1
                    elif tokens[idx].value == '>': depth -= 1
                    idx += 1
                if depth > 0: # Unbalanced
                    i += 1
                    continue
            
            # 3. Variable Name
            if idx < len(tokens) and isinstance(tokens[idx], Identifier):
                var_name = tokens[idx].value
                # Check what follows (should be = or ; or ,)
                idx2 = idx + 1
                if idx2 < len(tokens) and tokens[idx2].value in ['=', ';', ',']:
                    var_map[var_name] = current_type_name
                    
                    # Detect Signals
                    line_no = token.position.line
                    
                    # static_unsafe_collection
                    if is_added and 'static' in modifiers:
                         risky_static_types = {"HashMap", "ArrayList", "HashSet", "TreeMap", "LinkedList"}
                         if current_type_name in risky_static_types:
                             changes.append(Change(kind=ChangeKind.FIELD_ADDED, file=filename, symbol=var_name, meta={"static_unsafe": True}, line_no=line_no))
                    
                    # final (if looks like field)
                    is_field = any(m in modifiers for m in ['private', 'public', 'protected', 'static'])
                    if is_field and 'final' in modifiers:
                         kind = ChangeKind.MODIFIER_ADDED if is_added else ChangeKind.MODIFIER_REMOVED
                         changes.append(Change(kind=kind, file=filename, symbol="final", line_no=line_no))

                    i = idx2
                    modifiers = set()
                    continue
            
            modifiers = set()
            i += 1

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
            
            # Context
            self._update_context(node, var_map)

            # Detectors
            self._detect_concurrency_signals(node, filename, is_added, var_map, changes, line_no)
            self._detect_resource_signals(node, filename, is_added, var_map, changes, line_no, path)
            self._detect_data_signals(node, filename, is_added, var_map, changes, line_no, path)
            self._detect_general_signals(node, filename, is_added, var_map, changes, line_no, path)

    def _update_context(self, node, var_map: Dict):
        if isinstance(node, FieldDeclaration):
            if node.type:
                for declarator in node.declarators:
                    var_map[declarator.name] = node.type.name
        elif isinstance(node, LocalVariableDeclaration):
            if node.type:
                for declarator in node.declarators:
                    var_map[declarator.name] = node.type.name

    def _detect_concurrency_signals(self, node, filename: str, is_added: bool, var_map: Dict, changes: List[Change], line_no: int):
        # 1. lock_removed / synchronized / volatile / final
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
            
            if 'final' in node.modifiers:
                kind = ChangeKind.MODIFIER_ADDED if is_added else ChangeKind.MODIFIER_REMOVED
                changes.append(Change(kind=kind, file=filename, symbol="final", line_no=line_no))

            # 7. static_unsafe_collection
            if is_added and 'static' in node.modifiers and node.type:
                # Basic type check
                type_name = node.type.name if hasattr(node.type, 'name') else str(node.type)
                if not is_thread_safe(type_name):
                    risky_static_types = {"HashMap", "ArrayList", "HashSet", "TreeMap", "LinkedList"}
                    base_type = type_name.split('<')[0]
                    if base_type in risky_static_types:
                        changes.append(Change(
                            kind=ChangeKind.FIELD_ADDED,
                            file=filename,
                            symbol=node.declarators[0].name,
                            meta={"static_unsafe": True},
                            line_no=line_no
                        ))

        if isinstance(node, MethodInvocation):
            call_name = node.member
            qualifier = node.qualifier
            
            # lock.lock(), semaphore.acquire(), latch.await()
            if call_name == "lock" and (not qualifier or "lock" in qualifier.lower()):
                 kind = ChangeKind.CALL_ADDED if is_added else ChangeKind.CALL_REMOVED
                 changes.append(Change(kind=kind, file=filename, symbol="lock", line_no=line_no))
            
            if call_name == "acquire": 
                 kind = ChangeKind.CALL_ADDED if is_added else ChangeKind.CALL_REMOVED
                 changes.append(Change(kind=kind, file=filename, symbol="acquire", line_no=line_no))

            if call_name == "await": 
                 kind = ChangeKind.CALL_ADDED if is_added else ChangeKind.CALL_REMOVED
                 changes.append(Change(kind=kind, file=filename, symbol="await", line_no=line_no))
                 
            # 10. sleep
            if call_name == "sleep":
                 kind = ChangeKind.CALL_ADDED if is_added else ChangeKind.CALL_REMOVED
                 changes.append(Change(kind=kind, file=filename, symbol="sleep", line_no=line_no))
                 
            # 6. atomic_to_non_atomic_write (Call Removed: atomic.set)
            if not is_added and call_name == "set":
                 if qualifier and qualifier in var_map:
                      var_type = var_map[qualifier]
                      if var_type.startswith("Atomic"):
                           changes.append(Change(kind=ChangeKind.CALL_REMOVED, file=filename, symbol="atomic_set", meta={"var": qualifier}, line_no=line_no))

        # 8. threadpool_param_change & 9. threadpool_unbounded_queue
        if isinstance(node, ClassCreator):
             type_name = node.type.name
             if type_name == "ThreadPoolExecutor":
                  args = [str(arg) for arg in node.arguments] 
                  kind = ChangeKind.OBJECT_CREATION
                  action = "added" if is_added else "removed"
                  changes.append(Change(kind=kind, file=filename, symbol="ThreadPoolExecutor", meta={"args_count": len(args), "param_change": True, "action": action}, line_no=line_no))
             
             if type_name == "LinkedBlockingQueue":
                  if not node.arguments:
                       kind = ChangeKind.OBJECT_CREATION
                       changes.append(Change(kind=kind, file=filename, symbol="LinkedBlockingQueue", meta={"unbounded": True}, line_no=line_no))
                  elif len(node.arguments) == 1 and "Integer.MAX_VALUE" in str(node.arguments[0]):
                       kind = ChangeKind.OBJECT_CREATION
                       changes.append(Change(kind=kind, file=filename, symbol="LinkedBlockingQueue", meta={"unbounded": True}, line_no=line_no))

        # 10. while(true)
        if isinstance(node, WhileStatement):
             # Check if condition is true
             is_true = False
             if hasattr(node.condition, 'value') and node.condition.value == "true":
                 is_true = True
             if is_true:
                  kind = ChangeKind.CALL_ADDED if is_added else ChangeKind.CALL_REMOVED
                  changes.append(Change(kind=kind, file=filename, symbol="while_true", line_no=line_no))

    def _detect_resource_signals(self, node, filename: str, is_added: bool, var_map: Dict, changes: List[Change], line_no: int, path: Any):
        # 12. try_with_resource_removed
        if isinstance(node, TryStatement):
            if node.resources:
                if not is_added: # Removed
                    changes.append(Change(kind=ChangeKind.CALL_REMOVED, file=filename, symbol="try_with_resources", line_no=line_no))

        if isinstance(node, MethodInvocation):
             call_name = node.member
             qualifier = str(node.qualifier).lower() if node.qualifier else ""
             
             # 13. cache_eviction_removed
             if not is_added and call_name in ["expire", "setExpire", "setTTL", "evict", "clear"]:
                  if "cache" in filename.lower() or "redis" in filename.lower() or "map" in qualifier:
                       changes.append(Change(kind=ChangeKind.CALL_REMOVED, file=filename, symbol=call_name, meta={"cache_eviction": True}, line_no=line_no))

             # 15. timeout_removed
             if not is_added and ("timeout" in call_name.lower() or call_name == "setTimeout"): 
                  changes.append(Change(kind=ChangeKind.CALL_REMOVED, file=filename, symbol=call_name, meta={"timeout_removed": True}, line_no=line_no))

    def _detect_data_signals(self, node, filename: str, is_added: bool, var_map: Dict, changes: List[Change], line_no: int, path: Any):
        # 18. equals_to_reference_compare
        if isinstance(node, MethodInvocation):
             if node.member == "equals" and not is_added:
                  changes.append(Change(kind=ChangeKind.CALL_REMOVED, file=filename, symbol="equals", line_no=line_no))
        
        if isinstance(node, BinaryOperation):
             if node.operator == "==" and is_added:
                  changes.append(Change(kind=ChangeKind.CALL_ADDED, file=filename, symbol="==", line_no=line_no))
        
        # 19. null_check_removed
        if isinstance(node, IfStatement) and not is_added:
             cond = node.condition
             if isinstance(cond, BinaryOperation) and cond.operator == "==":
                  has_null = False
                  if isinstance(cond.operandr, Literal) and cond.operandr.value == "null": has_null = True
                  if isinstance(cond.operandl, Literal) and cond.operandl.value == "null": has_null = True
                  
                  if has_null:
                       changes.append(Change(kind=ChangeKind.UNKNOWN, file=filename, symbol="null_check", meta={"action": "removed"}, line_no=line_no))

    def _detect_general_signals(self, node, filename: str, is_added: bool, var_map: Dict, changes: List[Change], line_no: int, path: Any):
        # Original logic for critical calls etc.
        if isinstance(node, MethodInvocation):
            call_name = node.member
            qualifier = node.qualifier
            
            kind = ChangeKind.CALL_ADDED if is_added else ChangeKind.CALL_REMOVED

            # Dubbo P0: Executors factory methods
            if qualifier == "Executors" and call_name in ["newFixedThreadPool", "newCachedThreadPool"]:
                 changes.append(Change(kind=kind, file=filename, symbol=call_name, meta={"risk": "threadpool_factory"}, line_no=line_no))

            # Dubbo P0: Future.get() without timeout
            if call_name == "get" and not node.arguments:
                changes.append(Change(kind=kind, file=filename, symbol="get", meta={"blocking_get": True}, line_no=line_no))

            # Critical calls (input/validation)
            if call_name in self.critical_calls and not is_added:
                changes.append(Change(kind=kind, file=filename, symbol=call_name, line_no=line_no))
            
            # Collection mutation in loop
            if call_name == "remove" and is_added:
                if self._is_inside_loop(path):
                    changes.append(Change(kind=kind, file=filename, symbol="remove", meta={"in_loop": True}, line_no=line_no))


    def _is_inside_loop(self, path: Tuple) -> bool:
        """
        Check if the current node (at the end of path) is inside a loop structure.
        path is a list/tuple of parent nodes.
        """
        for node in reversed(path):
            if isinstance(node, (ForStatement, WhileStatement, DoStatement)):
                return True
        return False
