import re
import fnmatch
import os
from typing import Dict, Any, List, Optional
from core.rule_base import Rule

def _match_file_pattern(filename: str, pattern: str) -> bool:
    """Match file against pattern, supporting ** for recursive matching."""
    if pattern == '**' or pattern == '*':
        return True
    # Handle **/*.py style patterns
    if pattern.startswith('**'):
        # Convert **/*.py to *.py for fnmatch
        pattern = pattern[2:].lstrip('/')
    # Also handle patterns like *.py, test.py, etc.
    return fnmatch.fnmatch(filename, pattern)

class YamlRule(Rule):
    """
    Adapter to treat legacy YAML rules as first-class Plugins.
    Supports full rule metadata: category, confidence, tags, enabled, language, scope.
    """
    def __init__(self, rule_dict: Dict[str, Any]):
        self._rule_dict = rule_dict
        self._file_pattern = self._rule_dict.get('file')
        self._compiled_match = None
        content_regex = self._rule_dict.get('match')
        if content_regex:
            flags = re.MULTILINE
            if self._rule_dict.get('case_insensitive', False):
                flags |= re.IGNORECASE
            try:
                self._compiled_match = re.compile(content_regex, flags)
            except re.error:
                self._compiled_match = None

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
    def title(self) -> str:
        return self._rule_dict.get('title', self.id)

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
    def package(self) -> Optional[Dict[str, Any]]:
        """CVE 规则：package.ecosystem + package.name 用于与 dependency_versions 精确匹配。"""
        return self._rule_dict.get('package')

    @property
    def versions(self) -> Optional[Dict[str, Any]]:
        """CVE 规则：versions.introduced / versions.fixed 定义受影响版本区间。"""
        return self._rule_dict.get('versions')

    @property
    def status(self) -> str:
        return str(self._rule_dict.get('status', 'stable')).lower()

    @property
    def is_blocking(self) -> bool:
        # Default to True for 'critical' absolute rules, or if explicitly set
        explicit = self._rule_dict.get('is_blocking')
        if explicit is not None:
            return bool(explicit)
        
        # Absolute critical rules are blocking by default
        if self.rule_type == 'absolute' and self.severity == 'critical':
            return True
        return False

    @property
    def rule_type(self) -> str:
        """
        Determines if the rule is 'regression' or 'absolute'.
        Defaults to 'regression' if action is 'removed' or 'changed'.
        """
        explicit = self._rule_dict.get('rule_type')
        if explicit:
            return str(explicit)
        
        action = self._rule_dict.get('action', '').lower()
        if action in ['removed', 'deleted', 'changed', 'modified']:
            return 'regression'
        
        return 'absolute'

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
                        # Use _match_file_pattern to check if sig.file matches pattern
                        if rule_file_pattern != "**" and not _match_file_pattern(sig.file, rule_file_pattern):
                            continue

                    return {"file": sig.file}
            
            # If we are looking for a signal but didn't find it, rule fails
            return None

        # Fallback to old regex/file matching logic
        
        # 1. Check File Pattern
        matched_files = []
        if self._file_pattern:
            pattern = self._file_pattern
            for f in diff_data.get('files', []):
                if _match_file_pattern(f, pattern):
                    matched_files.append(f)

            if not matched_files:
                return None # File pattern constraint failed
        else:
            # If no file pattern, consider all files
            matched_files = diff_data.get('files', [])

        # 2. Check Content Match (Regex)
        if self._rule_dict.get('match'):
            # Get raw diff from file_patches
            file_patches = diff_data.get('file_patches', [])
            raw_diff = ""
            for fp in file_patches:
                raw_diff += fp.get('patch', '')
            
            if not self._compiled_match:
                return None
            if not self._compiled_match.search(raw_diff):
                return None

        # Return the first matched file for reporting purposes
        file_report = matched_files[0] if matched_files else "unknown"
        return {"file": file_report}
