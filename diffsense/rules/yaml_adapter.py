import re
import fnmatch
from typing import Dict, Any, List, Optional
from core.rule_base import Rule

class YamlRule(Rule):
    """
    Adapter to treat legacy YAML rules as first-class Plugins.
    Supports full rule metadata: category, confidence, tags, enabled, language, scope.
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

    @property
    def category(self) -> str:
        return self._rule_dict.get('category', 'general')

    @property
    def confidence(self) -> float:
        v = self._rule_dict.get('confidence', 1.0)
        if isinstance(v, (int, float)):
            return float(v)
        return 1.0

    @property
    def tags(self) -> List[str]:
        t = self._rule_dict.get('tags', [])
        return list(t) if isinstance(t, (list, tuple)) else []

    @property
    def enabled(self) -> bool:
        return self._rule_dict.get('enabled', True) is True

    @property
    def language(self) -> str:
        return self._rule_dict.get('language', '*')

    @property
    def scope(self) -> str:
        return self._rule_dict.get('scope', self._rule_dict.get('file', '**'))

    @property
    def status(self) -> str:
        return str(self._rule_dict.get('status', 'experimental')).lower()

    def evaluate(self, diff_data: Dict[str, Any], ast_signals: List[Any]) -> Optional[Dict[str, Any]]:
        # Logic extracted from old RuleEngine._match_rule
        
        # 0. Check AST Signals (New First-Class Check)
        target_signal = self._rule_dict.get('signal')
        if target_signal:
            # Look for this signal in ast_signals
            for sig in ast_signals:
                if sig.id == target_signal:
                    # Signal Matched!
                    
                    # Check action constraint if present in rule
                    rule_action = self._rule_dict.get('action')
                    if rule_action and rule_action != sig.action:
                         continue # Action mismatch
                    
                    # Check if there are other constraints (like file)
                    # We match file pattern against the signal's file
                    rule_file_pattern = self._rule_dict.get('file')
                    if rule_file_pattern:
                        # Use fnmatch to check if sig.file matches pattern
                        # But handle "**" and similar
                        if rule_file_pattern != "**" and not fnmatch.fnmatch(sig.file, rule_file_pattern):
                             continue
                    
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
