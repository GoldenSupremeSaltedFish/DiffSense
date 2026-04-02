"""
Concurrency Rules using Language Adapter

This module demonstrates how to use LanguageAdapter to write
language-agnostic concurrency rules that work across Java, Go, and Python.

Key advantage: One rule implementation can detect the same semantic issue
in multiple languages without duplicating logic.
"""

import re
from typing import Dict, Any, List, Optional, Set
from sdk.rule import BaseRule
from sdk.signal import Signal
from sdk.language_adapter import AdapterFactory, LanguageAdapter


class ConcurrencyRegressionRuleAdapter(BaseRule):
    """
    Concurrency Regression Rule - Adapter Version.
    
    Detects when code is downgraded from thread-safe to non-thread-safe types.
    
    Works for:
    - Java: ConcurrentHashMap -> HashMap, AtomicInteger -> Integer
    - Go: sync.Map -> map, chan -> (removed)
    - Python: threading.Lock -> (removed)
    """
    
    def __init__(self, language: str = "java"):
        """
        Initialize with specific language adapter.
        
        Args:
            language: One of 'java', 'go', 'python'
        """
        self._adapter = AdapterFactory.get_adapter(language)
        self._language = language
        
        # Build regression pairs based on adapter
        self._build_regression_pairs()
    
    def _build_regression_pairs(self):
        """Build language-specific regression detection patterns."""
        self._regressions = []
        
        # Get language-specific types
        safe_types = self._adapter.get_thread_safe_types()
        unsafe_types = self._adapter.get_unsafe_types()
        
        # Build pairs for detection
        if self._language == "java":
            # Java-specific: common downgrade pairs
            pairs = [
                ("ConcurrentHashMap", "HashMap"),
                ("ConcurrentMap", "HashMap"),
                ("CopyOnWriteArrayList", "ArrayList"),
                ("CopyOnWriteArraySet", "HashSet"),
                ("AtomicInteger", "Integer"),
                ("AtomicLong", "Long"),
                ("AtomicBoolean", "Boolean"),
            ]
        elif self._language == "go":
            # Go-specific: sync.Map -> map
            pairs = [
                ("sync.Map", "map"),
                ("sync.Mutex", "(mutex removed)"),
                ("chan", "(channel removed)"),
            ]
        elif self._language == "python":
            # Python-specific
            pairs = [
                ("threading.Lock", "(lock removed)"),
                ("threading.RLock", "(lock removed)"),
                ("queue.Queue", "(queue removed)"),
            ]
        else:
            pairs = []
        
        for strong, weak in pairs:
            # Build patterns for diff detection
            strong_re = re.compile(r'^[-\+].*' + re.escape(strong))
            weak_re = re.compile(r'^[\-+].*' + re.escape(weak))
            self._regressions.append((strong, weak, strong_re, weak_re))
    
    @property
    def id(self) -> str:
        return "runtime.concurrency_regression"
    
    @property
    def severity(self) -> str:
        return "high"
    
    @property
    def impact(self) -> str:
        return "runtime"
    
    @property
    def rationale(self) -> str:
        return "Downgrade from thread-safe to non-thread-safe implementation"
    
    @property
    def language(self) -> str:
        return self._language
    
    @property
    def rule_type(self) -> str:
        return "regression"
    
    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        # First, try signal-based detection
        for sig in signals:
            if sig.id == "runtime.concurrency.thread_safety_downgrade":
                return {"file": sig.file}
        
        # Fallback: regex-based detection
        raw_diff = diff_data.get('raw_diff', "")
        
        for strong, weak, strong_re, weak_re in self._regressions:
            has_removed_safe = strong_re.search(raw_diff)
            has_added_unsafe = weak_re.search(raw_diff)
            
            if has_removed_safe and has_added_unsafe:
                return {"file": f"regression_{strong}_to_{weak}"}
        
        return None


class ThreadSafetyRemovalRuleAdapter(BaseRule):
    """
    Thread Safety Removal Rule - Adapter Version.
    
    Detects removal of synchronization primitives (locks, volatile, etc.)
    """
    
    def __init__(self, language: str = "java"):
        self._adapter = AdapterFactory.get_adapter(language)
        self._language = language
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile patterns using adapter."""
        lock_pats = self._adapter.get_lock_patterns()
        unlock_pats = self._adapter.get_unlock_patterns()
        volatile_pats = self._adapter.get_volatile_patterns()
        
        # Build regex strings
        lock_strs = [p.pattern for p in lock_pats]
        unlock_strs = [p.pattern for p in unlock_pats]
        volatile_strs = [p.pattern for p in volatile_pats]
        
        self._removed_lock_re = re.compile(
            r'^-\s.*(?:' + '|'.join(lock_strs) + ')', re.MULTILINE
        )
        self._added_lock_re = re.compile(
            r'^\+\s.*(?:' + '|'.join(lock_strs) + ')', re.MULTILINE
        )
        self._removed_unlock_re = re.compile(
            r'^-\s.*(?:' + '|'.join(unlock_strs) + ')', re.MULTILINE
        )
        self._added_unlock_re = re.compile(
            r'^\+\s.*(?:' + '|'.join(unlock_strs) + ')', re.MULTILINE
        )
        
        if volatile_strs:
            self._removed_volatile_re = re.compile(
                r'^-\s.*(?:' + '|'.join(volatile_strs) + ')', re.MULTILINE
            )
            self._added_volatile_re = re.compile(
                r'^\+\s.*(?:' + '|'.join(volatile_strs) + ')', re.MULTILINE
            )
        else:
            self._removed_volatile_re = None
            self._added_volatile_re = None
    
    @property
    def id(self) -> str:
        return "runtime.thread_safety_removal"
    
    @property
    def severity(self) -> str:
        return "high"
    
    @property
    def impact(self) -> str:
        return "runtime"
    
    @property
    def rationale(self) -> str:
        return "Removal of synchronization primitives may cause race conditions"
    
    @property
    def language(self) -> str:
        return self._language
    
    @property
    def rule_type(self) -> str:
        return "regression"
    
    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        # Check lock removal vs addition
        removed_locks = len(self._removed_lock_re.findall(raw_diff))
        added_locks = len(self._added_lock_re.findall(raw_diff))
        
        if removed_locks > added_locks:
            return {"file": "lock_removed"}
        
        # Check unlock removal
        removed_unlocks = len(self._removed_unlock_re.findall(raw_diff))
        added_unlocks = len(self._added_unlock_re.findall(raw_diff))
        
        if removed_unlocks > added_unlocks:
            return {"file": "unlock_removed"}
        
        # Check volatile/atomic removal (if applicable)
        if self._removed_volatile_re:
            removed_vol = len(self._removed_volatile_re.findall(raw_diff))
            added_vol = len(self._added_volatile_re.findall(raw_diff))
            
            if removed_vol > added_vol:
                return {"file": "volatile_removed"}
        
        return None


# Convenience function to create language-specific rules
def create_concurrency_rule(rule_class, language: str):
    """Create a concurrency rule for the specified language."""
    return rule_class(language=language)


# Example: Create rules for different languages
def get_all_language_concurrency_rules():
    """
    Get all concurrency rules for all supported languages.
    
    Returns:
        Dict[str, List[BaseRule]]: Rules grouped by language
    """
    rules = {}
    
    for lang in ['java', 'go', 'python']:
        rules[lang] = [
            ConcurrencyRegressionRuleAdapter(language=lang),
            ThreadSafetyRemovalRuleAdapter(language=lang),
        ]
    
    return rules