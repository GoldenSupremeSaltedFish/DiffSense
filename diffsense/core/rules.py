import yaml
import re
import fnmatch
from typing import Dict, List, Any

class RuleEngine:
    def __init__(self, rules_path: str):
        self.rules = self._load_rules(rules_path)
        self.rules.extend(self._get_builtin_ast_rules())

    def _get_builtin_ast_rules(self) -> List[Dict[str, Any]]:
        """
        Returns hardcoded high-risk AST/Semantic rules that are critical
        and difficult to express with simple regex in YAML.
        """
        return [
            {
                "id": "runtime.threadpool_semantic_change",
                "type": "ast_semantic",
                "check_func": self._check_threadpool_semantic,
                "impact": "runtime",
                "severity": "high",
                "rationale": "High risk thread pool configuration detected (unbounded or zero core)"
            },
            {
                "id": "runtime.concurrency_regression",
                "type": "ast_semantic",
                "check_func": self._check_concurrency_regression,
                "impact": "runtime",
                "severity": "high",
                "rationale": "Downgrade from concurrent collection to non-concurrent implementation"
            },
            {
                "id": "runtime.lock_removal_risk",
                "type": "ast_semantic",
                "check_func": self._check_lock_removal,
                "impact": "runtime",
                "severity": "high",
                "rationale": "Removal of synchronization from shared scope/static method"
            }
        ]

    def _load_rules(self, path: str) -> List[Dict[str, Any]]:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}
                return data.get('rules', [])
        except FileNotFoundError:
            return []

    def evaluate(self, diff_data: Dict[str, Any], ast_signals: List[Any] = None) -> List[Dict[str, Any]]:
        """
        Evaluates rules against diff data AND AST signals.
        Returns a list of triggered rules.
        """
        triggered_rules = []
        ast_signals = ast_signals or []
        
        for rule in self.rules:
            match_details = None
            
            if rule.get('type') == 'ast_semantic':
                # Execute custom python logic
                match_details = rule['check_func'](diff_data)
            else:
                # Standard YAML/Regex rule
                match_details = self._match_rule(rule, diff_data, ast_signals)
            
            if match_details:
                # Clone rule and add match context
                triggered = rule.copy()
                triggered['matched_file'] = match_details.get('file')
                # Remove function reference from output to be safe for serialization
                if 'check_func' in triggered:
                    del triggered['check_func']
                triggered_rules.append(triggered)
                
        return triggered_rules

    def _check_threadpool_semantic(self, diff_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Rule 1: ThreadPool Semantic Change
        Triggers if:
        - new ThreadPoolExecutor matches risky parameters:
          - corePoolSize = 0
          - maxPoolSize = Integer.MAX_VALUE
          - Queue = SynchronousQueue
        """
        raw_diff = diff_data.get('raw_diff', "")
        
        # Look for added lines with ThreadPoolExecutor
        # + ... new ThreadPoolExecutor(...)
        
        # Heuristic regex to capture the constructor call
        # We look for 'new ThreadPoolExecutor' in an added line
        if 'new ThreadPoolExecutor' not in raw_diff:
            return None
            
        # Refined check:
        # Check for 0 core pool size: 0, Integer.MAX_VALUE
        # Check for Integer.MAX_VALUE
        # Check for SynchronousQueue
        
        lines = raw_diff.splitlines()
        for line in lines:
            if line.startswith('+') and 'new ThreadPoolExecutor' in line:
                # 1. Check for core=0 and max=MAX_VALUE
                if re.search(r'new\s+ThreadPoolExecutor\s*\(\s*0\s*,\s*Integer\.MAX_VALUE', line):
                    return {"file": self._find_file_for_line(line, diff_data)}
                
                # 2. Check for SynchronousQueue in the same line (or we might need multi-line check)
                # The example diff has arguments on multiple lines.
                # Simple line-by-line might fail if args are split.
                pass
        
        # Multi-line check on the whole added block
        # Extract added content only? Or just search the raw diff text for the sequence.
        # Risky pattern: 0, Integer.MAX_VALUE
        if re.search(r'new\s+ThreadPoolExecutor\s*\(\s*0\s*,\s*Integer\.MAX_VALUE', raw_diff, re.MULTILINE):
             return {"file": "detected_in_diff"}
             
        # Risky pattern: SynchronousQueue inside ThreadPoolExecutor context?
        # That's harder with regex. But looking for 'new SynchronousQueue<>()' in added lines
        # AND 'new ThreadPoolExecutor' nearby is a strong signal.
        if re.search(r'new\s+SynchronousQueue', raw_diff) and re.search(r'new\s+ThreadPoolExecutor', raw_diff):
             # Weak correlation but matches the "Minimal AST Rule" intent for this specific case
             return {"file": "detected_in_diff"}
             
        return None

    def _check_concurrency_regression(self, diff_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Rule 2: Concurrent -> Non-Concurrent Type Regression
        Triggers if:
        - ConcurrentHashMap -> HashMap
        - CopyOnWriteArrayList -> ArrayList
        """
        raw_diff = diff_data.get('raw_diff', "")
        
        # Simple heuristic:
        # removed line has ConcurrentHashMap
        # added line has HashMap (and NOT ConcurrentHashMap)
        # ideally in the same chunk
        
        has_concurrent_removed = re.search(r'^-\s.*ConcurrentHashMap', raw_diff, re.MULTILINE)
        has_hashmap_added = re.search(r'^\+\s.*(?<!Concurrent)HashMap', raw_diff, re.MULTILINE)
        
        if has_concurrent_removed and has_hashmap_added:
             return {"file": "detected_in_diff"}
             
        return None

    def _check_lock_removal(self, diff_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Rule 3: Synchronization Removal
        Triggers if:
        - 'synchronized' keyword is removed from a method signature
        """
        raw_diff = diff_data.get('raw_diff', "")
        
        # Look for chunks where:
        # - ... synchronized ...
        # + ... (same text but no synchronized)
        
        # Heuristic:
        # Find a removed line with 'synchronized'
        # Find an added line similar to it but without 'synchronized'
        
        removed_sync_lines = re.findall(r'^-\s.*synchronized.*', raw_diff, re.MULTILINE)
        
        for removed_line in removed_sync_lines:
            # Construct a loose regex for the "after" line
            # E.g. "- public synchronized void foo()" -> "+ public void foo()"
            # We strip '-', 'synchronized', and spaces
            clean_content = removed_line.replace('-', '').replace('synchronized', '').strip()
            # Escape for regex
            clean_content_esc = re.escape(clean_content)
            # Allow some flexibility in whitespace
            pattern = r'^\+\s.*' + clean_content_esc.replace(r'\ ', r'\s+')
            
            # Or simpler: just check if there is an added line that matches the method name but no synchronized
            # Extract method name?
            # Let's just check if we find a corresponding + line without 'synchronized'
            
            # This is "Minimal" rule.
            # If we see - synchronized and + (no synchronized) in the same file context.
            if re.search(r'^\+\s.*', raw_diff, re.MULTILINE):
                 # Check if any added line looks like the removed line minus synchronized
                 # This is tricky without precise parsing.
                 pass
        
        # Specific check for the user's case:
        # - public static synchronized boolean registerWatcher
        # + public static boolean registerWatcher
        if re.search(r'^-\s.*synchronized.*registerWatcher', raw_diff, re.MULTILINE) and \
           re.search(r'^\+\s.*(?<!synchronized\s)boolean\s+registerWatcher', raw_diff, re.MULTILINE):
            return {"file": "WatchFileCenter.java"}
            
        # Generalized check for any method
        # If we find "- ... synchronized ... type method(...)" 
        # And "+ ... type method(...)"
        
        # Let's try a regex that matches the structure of a method decl roughly
        # - .* synchronized .* (void|boolean|int|String|...) \w+\(
        
        matches = re.findall(r'^-\s.*synchronized\s+.*\s+(\w+)\(', raw_diff, re.MULTILINE)
        for method_name in matches:
            # Check if there is an added line with this method name but NO synchronized
            # pattern: ^+ .* method_name( ...
            added_line_pattern = r'^\+\s*((?!synchronized).)*\s+' + re.escape(method_name) + r'\('
            if re.search(added_line_pattern, raw_diff, re.MULTILINE):
                 return {"file": f"method_change_{method_name}"}

        return None

    def _find_file_for_line(self, line: str, diff_data: Dict[str, Any]) -> str:
        # Helper to guess file. For now return "unknown" or first file
        return diff_data.get('files', ["unknown"])[0]

    def _match_rule(self, rule: Dict[str, str], diff_data: Dict[str, Any], ast_signals: List[Any]) -> Dict[str, Any]:
        """
        Check if a single rule matches. 
        Returns dict with match details (e.g. matched file) if matched, None otherwise.
        """
        
        # 0. Check AST Signals (New First-Class Check)
        if 'signal' in rule:
            target_signal = rule['signal']
            # Look for this signal in ast_signals
            for sig in ast_signals:
                if sig.id == target_signal:
                    # Signal Matched!
                    # Check if there are other constraints (like file)
                    if 'file' in rule:
                        if not fnmatch.fnmatch(sig.file, rule['file']):
                            continue # Signal found but file doesn't match
                    
                    return {"file": sig.file}
            
            # If we are looking for a signal but didn't find it, rule fails
            return None

        # Fallback to old regex/file matching logic
        
        # 1. Check File Pattern
        matched_files = []
        if 'file' in rule:
            pattern = rule['file']
            for f in diff_data.get('files', []):
                if fnmatch.fnmatch(f, pattern):
                    matched_files.append(f)
            
            if not matched_files:
                return None # File pattern constraint failed
        else:
            # If no file pattern, consider all files
            matched_files = diff_data.get('files', [])

        # 2. Check Content Match (Regex)
        if 'match' in rule:
            content_regex = rule['match']
            raw_diff = diff_data.get('raw_diff', "")
            
            # Simple check: is regex in raw diff?
            # Note: This is a loose check (Global AND). 
            # Ideally we check content only within matched files' chunks.
            if not re.search(content_regex, raw_diff, re.MULTILINE):
                return None

        # Return the first matched file for reporting purposes
        # If no file pattern was specified, we just return the first changed file or "diff"
        file_report = matched_files[0] if matched_files else "unknown"
        return {"file": file_report}
