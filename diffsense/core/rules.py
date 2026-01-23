import yaml
import re
import fnmatch
from typing import Dict, List, Any

class RuleEngine:
    def __init__(self, rules_path: str):
        self.rules = self._load_rules(rules_path)

    def _load_rules(self, path: str) -> Dict[str, Any]:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        except FileNotFoundError:
            return {}

    def evaluate(self, diff_data: Dict[str, Any]) -> Dict[str, str]:
        """
        Evaluates rules against diff data and returns impact levels per dimension.
        Output example: {"runtime": "high", "data": "medium"}
        """
        impacts = {}
        
        # rules structure:
        # dimension:
        #   level:
        #     - match: "regex"
        #     - file: "glob"
        
        for dimension, levels in self.rules.items():
            impacts[dimension] = "low" # Default to low
            
            # Check levels in order (assuming high/medium/low are keys)
            # We want to find the highest severity. 
            # A simple way is to check specific keys if they exist.
            
            # Order of severity
            severity_order = ["critical", "high", "medium", "low"]
            
            matched_level = None
            
            for level in severity_order:
                if level in levels:
                    rules_list = levels[level]
                    if self._check_rules(rules_list, diff_data):
                        matched_level = level
                        break # Found highest severity match
            
            if matched_level:
                impacts[dimension] = matched_level
                
        return impacts

    def _check_rules(self, rules_list: List[Dict[str, str]], diff_data: Dict[str, Any]) -> bool:
        """
        Check if ANY rule in the list matches.
        """
        for rule in rules_list:
            if self._match_rule(rule, diff_data):
                return True
        return False

    def _match_rule(self, rule: Dict[str, str], diff_data: Dict[str, Any]) -> bool:
        """
        Check if a single rule matches. 
        A rule can have 'match' (content regex) AND/OR 'file' (file glob).
        If both are present, typically it means "content match IN file match" or "content match OR file match"?
        PRD says:
          - match: "thread|async|lock"
          - file: "**/core/**"
        It looks like a list of conditions where ANY match triggers the level?
        PRD says:
           high:
             - match: ...
             - file: ...
        The structure implies a list of independent criteria. If any criteria in the list is met, the level is triggered.
        So this function checks one criteria.
        """
        
        # Check file pattern
        if 'file' in rule:
            pattern = rule['file']
            matched_file = False
            for f in diff_data.get('files', []):
                if fnmatch.fnmatch(f, pattern):
                    matched_file = True
                    break
            if matched_file:
                # If 'match' is NOT present, file match is enough
                if 'match' not in rule:
                    return True
            else:
                # If file pattern didn't match any file, and 'match' is present, 
                # strictly speaking, if it's an AND condition, we should fail.
                # But if it's independent, the outer loop handles it.
                # Let's assume the list in YAML is OR.
                # Inside a single list item, if multiple keys exist, they might be AND.
                # Example: match "foo" in file "bar".
                pass

        # If both 'file' and 'match' are in the same dict item, treat as AND.
        # If they are separate items in the list, they are OR.
        
        file_condition = True
        if 'file' in rule:
            pattern = rule['file']
            # Check if any changed file matches
            file_condition = any(fnmatch.fnmatch(f, pattern) for f in diff_data.get('files', []))

        content_condition = True
        if 'match' in rule:
            # Check if regex matches raw diff
            # Ideally we should only check content of matched files if 'file' is specified,
            # but for MVP we search global diff or we need to parse diff per file.
            # Our parser currently returns raw_diff of everything.
            # For MVP, let's search in raw_diff.
            # IMPROVEMENT: If file_condition is set, we should strictly limit search scope.
            # But since parser is simple, let's just check raw_diff.
            regex = rule['match']
            content_condition = re.search(regex, diff_data.get('raw_diff', ''), re.MULTILINE) is not None
            
        if 'file' in rule and 'match' in rule:
            return file_condition and content_condition
        elif 'file' in rule:
            return file_condition
        elif 'match' in rule:
            return content_condition
            
        return False
