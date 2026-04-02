"""
Python Language Adapter for DiffSense

Provides Python-specific patterns and constructs for rule development.
"""

import re
from typing import List, Set, Pattern, Dict
from .language_adapter import LanguageAdapter


class PythonAdapter(LanguageAdapter):
    """
    Language adapter for Python.
    
    Provides Python-specific patterns for concurrency, resource management,
    error handling, and other language constructs.
    """
    
    def __init__(self):
        super().__init__("python")
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Pre-compile commonly used patterns."""
        # Thread Safety / Concurrency Patterns
        self._lock_patterns = [
            re.compile(r'threading\.Lock\(\)'),
            re.compile(r'threading\.RLock\(\)'),
            re.compile(r'with\s+self\._lock:'),
            re.compile(r'with\s+self\.lock:'),
            re.compile(r'with\s+lock:'),
        ]
        
        self._unlock_patterns = [
            re.compile(r'\.release\(\)'),
        ]
        
        self._volatile_patterns = [
            re.compile(r'from\s+threading\s+import\s+Event'),
            re.compile(r'threading\.Event\(\)'),
        ]
        
        # Resource Management Patterns
        self._resource_creation = [
            re.compile(r'open\('),
            re.compile(r'with\s+open\('),
            re.compile(r'socket\.socket\('),
            re.compile(r'urllib\.request\.urlopen\('),
            re.compile(r'requests\.(?:get|post)\('),
        ]
        
        # Error Handling Patterns
        self._error_check = [
            re.compile(r'except\s*(?:Exception)?(?:\s+as\s+\w+)?:'),
            re.compile(r'if\s+\w+\s+is\s+None'),
            re.compile(r'if\s+\w+\s+is\s+not\s+None'),
            re.compile(r'if\s+hasattr\('),
            re.compile(r'if\s+hasattr\([^,]+,\s*[\'"]\w+[\'"]\)'),
        ]
        
        self._error_ignore = [
            re.compile(r'except\s*:\s*$', re.MULTILINE),
            re.compile(r'except\s+Exception:\s*$', re.MULTILINE),
            re.compile(r'pass\s*$', re.MULTILINE),
        ]
        
        # Thread Creation Patterns
        self._thread_creation = [
            re.compile(r'threading\.Thread\('),
            re.compile(r'with\s+ThreadPoolExecutor'),
            re.compile(r'with\s+ProcessPoolExecutor'),
            re.compile(r'concurrent\.futures\.(?:Thread|Process)PoolExecutor'),
            re.compile(r'asyncio\.create_task\('),
        ]
        
        # Security Patterns
        self._security = {
            'command_injection': [
                re.compile(r'os\.system\('),
                re.compile(r'os\.popen\('),
                re.compile(r'subprocess\.call\('),
                re.compile(r'subprocess\.run\([^,]+shell\s*=\s*True'),
                re.compile(r'subprocess\.Popen\('),
            ],
            'hardcoded_secret': [
                re.compile(r'password\s*=\s*["\'][^"\']+["\']'),
                re.compile(r'api[_-]?key\s*=\s*["\'][^"\']+["\']'),
                re.compile(r'secret\s*=\s*["\'][^"\']+["\']'),
                re.compile(r'token\s*=\s*["\'][^"\']+["\']'),
                re.compile(r'aws[_-]?secret'),
            ],
            'sql_injection': [
                re.compile(r'cursor\.execute\([^)]*%[^)]*\)'),
                re.compile(r'cursor\.execute\([^)]*\+[^)]*\)'),
                re.compile(r'f["\']SELECT.*\{'),
                re.compile(r'["\']SELECT.*\%'),
            ],
            'deserialization': [
                re.compile(r'pickle\.load\('),
                re.compile(r'yaml\.load\('),
                re.compile(r'yaml\.unsafe_load\('),
                re.compile(r'marshal\.load\('),
            ],
            'EvalUsage': [
                re.compile(r'\beval\('),
                re.compile(r'\bexec\('),
            ],
        }
    
    # ==================== Thread Safety ====================
    
    def get_thread_safe_types(self) -> Set[str]:
        return {
            'threading.Lock', 'threading.RLock', 'threading.Semaphore',
            'threading.Event', 'threading.Condition', 'threading.Barrier',
            'queue.Queue', 'collections.Queue',
            'concurrent.futures.ThreadPoolExecutor',
            'asyncio.Lock', 'asyncio.Event', 'asyncio.Condition',
            'multiprocessing.Lock', 'multiprocessing.Manager',
        }
    
    def get_unsafe_types(self) -> Set[str]:
        return {
            'list', 'dict', 'set', 'tuple',
            'str', 'int', 'float', 'bool',
        }
    
    def get_lock_patterns(self) -> List[Pattern]:
        return self._lock_patterns
    
    def get_unlock_patterns(self) -> List[Pattern]:
        return self._unlock_patterns
    
    def get_volatile_patterns(self) -> List[Pattern]:
        return self._volatile_patterns
    
    # ==================== Resource Management ====================
    
    def get_cleanup_keywords(self) -> Set[str]:
        return {
            'with', 'finally', '__exit__', '__aenter__', '__aexit__',
            'close()', '.close()', 'contextmanager'
        }
    
    def get_resource_creation_patterns(self) -> List[Pattern]:
        return self._resource_creation
    
    # ==================== Error Handling ====================
    
    def get_error_types(self) -> Set[str]:
        return {
            'Exception', 'BaseException', 'RuntimeError',
            'ValueError', 'TypeError', 'KeyError', 'IndexError',
            'IOError', 'OSError', 'AttributeError'
        }
    
    def get_error_check_patterns(self) -> List[Pattern]:
        return self._error_check
    
    def get_error_ignore_patterns(self) -> List[Pattern]:
        return self._error_ignore
    
    # ==================== Null Safety ====================
    
    def get_null_checks(self) -> Set[str]:
        return {
            '== None', 'is None', 'is not None', '!= None',
            'if x:', 'if not x:', 'if x is not None:',
            'hasattr()', 'getattr()', 'try/except'
        }
    
    def get_null_pointer_types(self) -> Set[str]:
        return {
            'object', 'None', 'Any', 'Optional',
        }
    
    # ==================== Concurrency Primitives ====================
    
    def get_concurrency_primitives(self) -> Set[str]:
        return {
            'threading', 'Thread', 'Lock', 'RLock', 'Semaphore',
            'concurrent.futures', 'ThreadPoolExecutor', 'ProcessPoolExecutor',
            'asyncio', 'async', 'await', 'create_task',
            'multiprocessing', 'Process', 'Queue', 'Manager',
            'queue', 'Queue'
        }
    
    def get_thread_creation_patterns(self) -> List[Pattern]:
        return self._thread_creation
    
    # ==================== Security ====================
    
    def get_dangerous_patterns(self) -> Dict[str, List[Pattern]]:
        return self._security