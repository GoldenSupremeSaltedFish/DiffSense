"""
Language Adapter System for DiffSense

This module provides language-agnostic abstractions for rule development.
The LanguageAdapter isolates language-specific patterns, allowing rules
to be written in a language-independent way.

Architecture:
    - LanguageAdapter: Abstract base class defining the interface
    - AdapterFactory: Factory to get the appropriate adapter for a language
    
Usage:
    class MyConcurrencyRule(BaseRule):
        def __init__(self, adapter: LanguageAdapter = None):
            self._adapter = adapter or AdapterFactory.get_adapter("java")
        
        def evaluate(self, diff_data, signals):
            thread_safe_types = self._adapter.get_thread_safe_types()
            # ... use language-specific patterns
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Set, Pattern, Any
import re


class LanguageAdapter(ABC):
    """
    Abstract base class for language-specific adapters.
    
    This class defines the interface that all language adapters must implement.
    It provides language-agnostic methods for accessing language-specific patterns
    and constructs, allowing rules to be written in a language-independent way.
    """
    
    def __init__(self, language: str):
        self._language = language
        self._compiled_patterns: Dict[str, Pattern] = {}
    
    @property
    def language(self) -> str:
        """Return the language identifier (e.g., 'java', 'go', 'python')"""
        return self._language
    
    # ==================== Thread Safety ====================
    
    @abstractmethod
    def get_thread_safe_types(self) -> Set[str]:
        """
        Return set of thread-safe collection/atomic types for this language.
        
        Examples:
            Java: {'ConcurrentHashMap', 'AtomicInteger', 'CopyOnWriteArrayList'}
            Go: {'sync.Mutex', 'sync.RWMutex', 'chan', 'sync.Map'}
        """
        pass
    
    @abstractmethod
    def get_unsafe_types(self) -> Set[str]:
        """
        Return set of non-thread-safe types that could cause race conditions.
        
        Examples:
            Java: {'HashMap', 'ArrayList', 'HashSet'}
            Go: {'map', 'slice'} (without synchronization)
        """
        pass
    
    @abstractmethod
    def get_lock_patterns(self) -> List[Pattern]:
        """
        Return regex patterns for lock/synchronization constructs.
        
        Examples:
            Java: ['synchronized', r'\\.lock\\(\\)', r'\\.wait\\(\\)']
            Go: [r'\\.Lock\\(\\)', r'\\.RLock\\(\\)', r'sync\\.Mutex']
        """
        pass
    
    @abstractmethod
    def get_unlock_patterns(self) -> List[Pattern]:
        """
        Return regex patterns for unlock/release constructs.
        
        Examples:
            Java: [r'\\.unlock\\(\\)', r'\\.notify\\(\\)']
            Go: [r'\\.Unlock\\(\\)', r'\\.RUnlock\\(\\)']
        """
        pass
    
    @abstractmethod
    def get_volatile_patterns(self) -> List[Pattern]:
        r"""
        Return regex patterns for volatile/atomic modifiers.
        
        Examples:
            Java: [r'volatile', r'AtomicInteger', r'AtomicLong']
            Go: [r'atomic\.(Load|Store|Add|Swap|CompareAndSwap)']
        """
        pass
    
    # ==================== Resource Management ====================
    
    @abstractmethod
    def get_cleanup_keywords(self) -> Set[str]:
        """
        Return keywords/patterns for resource cleanup.
        
        Examples:
            Java: {'close()', 'finally', 'try-with-resources'}
            Go: {'defer', 'close()'}
        """
        pass
    
    @abstractmethod
    def get_resource_creation_patterns(self) -> List[Pattern]:
        r"""
        Return patterns for resource creation (to detect potential leaks).
        
        Examples:
            Java: [r'new\s+FileInputStream', r'new\s+Connection']
            Go: [r'make\(', r'os\.Open']
        """
        pass
    
    # ==================== Error Handling ====================
    
    @abstractmethod
    def get_error_types(self) -> Set[str]:
        """
        Return set of error/exception types for this language.
        
        Examples:
            Java: {'Exception', 'RuntimeException', 'Throwable'}
            Go: {'error'}
        """
        pass
    
    @abstractmethod
    def get_error_check_patterns(self) -> List[Pattern]:
        r"""
        Return patterns for error checking.
        
        Examples:
            Java: [r'catch\s*\(\w+', r'if\s+\w+\s*==\s*null']
            Go: [r'if\s+err\s*!=\s*nil', r'if\s+err\s*==\s*nil']
        """
        pass
    
    @abstractmethod
    def get_error_ignore_patterns(self) -> List[Pattern]:
        r"""
        Return patterns for ignoring/suppressing errors.
        
        Examples:
            Java: [r'catch\s*\(\s*Exception\s*\)', r'catch\s*\(\s*\)']
            Go: [r'_\s*=\s*\w+\s*\(']
        """
        pass
    
    # ==================== Null Safety ====================
    
    @abstractmethod
    def get_null_checks(self) -> Set[str]:
        """
        Return set of null check patterns for this language.
        
        Examples:
            Java: {'== null', '!= null', 'Objects.isNull', 'Optional.ofNullable'}
            Go: {'== nil', '!= nil'}
        """
        pass
    
    @abstractmethod
    def get_null_pointer_types(self) -> Set[str]:
        """
        Return set of types that can cause null pointer errors.
        
        Examples:
            Java: {'Object', 'String', 'List', 'Map'}
            Go: {'pointer', 'interface', 'slice', 'map', 'chan'}
        """
        pass
    
    # ==================== Concurrency Primitives ====================
    
    @abstractmethod
    def get_concurrency_primitives(self) -> Set[str]:
        """
        Return set of language-specific concurrency primitives.
        
        Examples:
            Java: {'synchronized', 'volatile', 'Thread', 'ExecutorService'}
            Go: {'go', 'chan', 'select', 'defer', 'sync.WaitGroup'}
        """
        pass
    
    @abstractmethod
    def get_thread_creation_patterns(self) -> List[Pattern]:
        r"""
        Return patterns for creating threads/goroutines.
        
        Examples:
            Java: [r'new\s+Thread', r'executor\.submit', r'CompletableFuture\.runAsync']
            Go: [r'\bgo\s+\w+', r'go\s+func']
        """
        pass
    
    # ==================== Security ====================
    
    @abstractmethod
    def get_dangerous_patterns(self) -> Dict[str, List[Pattern]]:
        r"""
        Return dictionary of security-related patterns.
        
        Keys: category names (e.g., 'command_injection', 'sql_injection', 'hardcoded_secret')
        
        Examples:
            Java: {'sql_injection': [r'Statement.*\+', r'executeQuery.*\+']}
            Go: {'command_injection': [r'exec\.Command', r'syscall\.Exec']}
        """
        pass
    
    # ==================== Utility Methods ====================
    
    def compile_pattern(self, pattern: str) -> Pattern:
        """
        Compile and cache a regex pattern.
        
        Args:
            pattern: Regular expression string
            
        Returns:
            Compiled regex pattern
        """
        if pattern not in self._compiled_patterns:
            self._compiled_patterns[pattern] = re.compile(pattern)
        return self._compiled_patterns[pattern]
    
    def find_added_lines(self, raw_diff: str) -> List[str]:
        """Extract added lines from diff."""
        return [line for line in raw_diff.split('\n') 
                if line.startswith('+') and not line.startswith('+++')]
    
    def find_removed_lines(self, raw_diff: str) -> List[str]:
        """Extract removed lines from diff."""
        return [line for line in raw_diff.split('\n') 
                if line.startswith('-') and not line.startswith('---')]
    
    def has_pattern(self, text: str, patterns: List[Pattern]) -> bool:
        """Check if text matches any of the given patterns."""
        return any(p.search(text) for p in patterns)
    
    def count_pattern(self, text: str, patterns: List[Pattern]) -> int:
        """Count occurrences of patterns in text."""
        return sum(len(p.findall(text)) for p in patterns)


class AdapterFactory:
    """
    Factory class for creating language adapters.
    
    Usage:
        java_adapter = AdapterFactory.get_adapter("java")
        go_adapter = AdapterFactory.get_adapter("go")
    """
    
    _adapters: Dict[str, LanguageAdapter] = {}
    
    @classmethod
    def register_adapter(cls, language: str, adapter: LanguageAdapter):
        """Register an adapter for a specific language."""
        cls._adapters[language] = adapter
    
    @classmethod
    def get_adapter(cls, language: str) -> Optional[LanguageAdapter]:
        """
        Get an adapter for the specified language.
        
        Args:
            language: Language identifier ('java', 'go', 'python')
            
        Returns:
            LanguageAdapter instance, or None if not supported
        """
        language = language.lower()
        
        if language in cls._adapters:
            return cls._adapters[language]
        
        # Try to load built-in adapters
        if language == "java":
            from .java_adapter import JavaAdapter
            cls._adapters[language] = JavaAdapter()
        elif language == "go":
            from .go_adapter import GoAdapter
            cls._adapters[language] = GoAdapter()
        elif language == "python":
            from .python_adapter import PythonAdapter
            cls._adapters[language] = PythonAdapter()
        
        return cls._adapters.get(language)
    
    @classmethod
    def get_supported_languages(cls) -> List[str]:
        """Get list of supported languages."""
        return list(cls._adapters.keys())