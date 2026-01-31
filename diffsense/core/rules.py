import yaml
import re
import fnmatch
from typing import Dict, List, Any

class RuleEngine:
    def __init__(self, rules_path: str):
        self.rules = self._load_rules(rules_path)

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
            match_details = self._match_rule(rule, diff_data, ast_signals)
            if match_details:
                # Clone rule and add match context
                triggered = rule.copy()
                triggered['matched_file'] = match_details.get('file')
                triggered_rules.append(triggered)
                
        return triggered_rules

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
                    
                    # Check action constraint if present in rule
                    if 'action' in rule:
                        if rule['action'] != sig.action:
                            continue # Action mismatch (e.g. rule wants 'removed', signal is 'added')
                    
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
