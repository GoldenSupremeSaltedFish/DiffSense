import re
import fnmatch
from typing import Dict, Any, List, Optional
from core.rule_base import Rule

class YamlRule(Rule):
    """
    Adapter to treat legacy YAML rules as first-class Plugins.
    """
    def __init__(self, rule_dict: Dict[str, Any]):
        self._rule_dict = rule_dict

    @property
    def id(self) -> str:
        return self._rule_dict.get('id', 'unknown')

    @property
    def severity(self) -> str:
        return self._rule_dict.get('severity', 'low')

    @property
    def impact(self) -> str:
        return self._rule_dict.get('impact', 'general')

    @property
    def rationale(self) -> str:
        return self._rule_dict.get('rationale', '')

    def evaluate(self, diff_data: Dict[str, Any], ast_signals: List[Any]) -> Optional[Dict[str, Any]]:
        # Logic extracted from old RuleEngine._match_rule
        
        # 0. Check AST Signals (New First-Class Check)
        if 'signal' in self._rule_dict:
            target_signal = self._rule_dict['signal']
            # Look for this signal in ast_signals
            for sig in ast_signals:
                if sig.id == target_signal:
                    # Signal Matched!
                    
                    # Check action constraint if present in rule
                    if 'action' in self._rule_dict:
                        if self._rule_dict['action'] != sig.action:
                            continue # Action mismatch
                    
                    # Check if there are other constraints (like file)
                    if 'file' in self._rule_dict:
                        if not fnmatch.fnmatch(sig.file, self._rule_dict['file']):
                            continue # Signal found but file doesn't match
                    
                    return {"file": sig.file}
            
            # If we are looking for a signal but didn't find it, rule fails
            return None

        # Fallback to old regex/file matching logic
        
        # 1. Check File Pattern
        matched_files = []
        if 'file' in self._rule_dict:
            pattern = self._rule_dict['file']
            for f in diff_data.get('files', []):
                if fnmatch.fnmatch(f, pattern):
                    matched_files.append(f)
            
            if not matched_files:
                return None # File pattern constraint failed
        else:
            # If no file pattern, consider all files
            matched_files = diff_data.get('files', [])

        # 2. Check Content Match (Regex)
        if 'match' in self._rule_dict:
            content_regex = self._rule_dict['match']
            raw_diff = diff_data.get('raw_diff', "")
            
            if not re.search(content_regex, raw_diff, re.MULTILINE):
                return None

        # Return the first matched file for reporting purposes
        file_report = matched_files[0] if matched_files else "unknown"
        return {"file": file_report}
