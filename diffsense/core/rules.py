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

    def evaluate(self, diff_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Evaluates rules against diff data and returns a list of triggered rules.
        """
        triggered_rules = []
        
        for rule in self.rules:
            match_details = self._match_rule(rule, diff_data)
            if match_details:
                # Clone rule and add match context
                triggered = rule.copy()
                triggered['matched_file'] = match_details.get('file')
                triggered_rules.append(triggered)
                
        return triggered_rules

    def _match_rule(self, rule: Dict[str, str], diff_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Check if a single rule matches. 
        Returns dict with match details (e.g. matched file) if matched, None otherwise.
        """
        
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
