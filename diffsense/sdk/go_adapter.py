"""
Go Language Adapter for DiffSense

Provides Go-specific patterns and constructs for rule development.
"""

import re
from typing import List, Set, Pattern, Dict
from .language_adapter import LanguageAdapter


class GoAdapter(LanguageAdapter):
    """
    Language adapter for Go.
    
    Provides Go-specific patterns for concurrency, channel management,
    error handling, and other language constructs.
    """
    
    def __init__(self):
        super().__init__("go")
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Pre-compile commonly used patterns."""
        # Thread Safety / Concurrency Patterns
        self._lock_patterns = [
            re.compile(r'\.Lock\(\)'),
            re.compile(r'\.RLock\(\)'),
            re.compile(r'sync\.Mutex'),
            re.compile(r'sync\.RWMutex'),
            re.compile(r'sync\.Once\.Do'),
        ]
        
        self._unlock_patterns = [
            re.compile(r'\.Unlock\(\)'),
            re.compile(r'\.RUnlock\(\)'),
        ]
        
        self._volatile_patterns = [
            re.compile(r'atomic\.(?:Load|Store|Add|Swap|CompareAndSwap)'),
            re.compile(r'sync\/atomic\.'),
        ]
        
        # Resource Management Patterns
        self._resource_creation = [
            re.compile(r'make\('),
            re.compile(r'os\.Open\('),
            re.compile(r'os\.Create\('),
            re.compile(r'http\.(?:ListenAndServe|NewRequest)'),
            re.compile(r'database\.Open\('),
            re.compile(r'grpc\.Dial'),
            re.compile(r'conn\.Open\('),
        ]
        
        # Error Handling Patterns
        self._error_check = [
            re.compile(r'if\s+err\s*!=\s*nil'),
            re.compile(r'if\s+err\s*==\s*nil'),
        ]
        
        self._error_ignore = [
            re.compile(r'_\s*=\s*\w+'),  # _ = function()
            re.compile(r'_\s*:='),       # _ := function()
        ]
        
        # Goroutine/Thread Creation Patterns
        self._thread_creation = [
            re.compile(r'\bgo\s+(?:func|\w+)'),
            re.compile(r'go\s+\w+\('),
            re.compile(r'go\s+func\('),
        ]
        
        # Security Patterns
        self._security = {
            'command_injection': [
                re.compile(r'exec\.Command'),
                re.compile(r'syscall\.Exec'),
                re.compile(r'syscall\.Spawn'),
                re.compile(r'os\.Exec'),
            ],
            'hardcoded_secret': [
                re.compile(r'password\s*:=\s*"[^"]+"'),
                re.compile(r'api[_-]?key\s*:=\s*"[^"]+"'),
                re.compile(r'secret\s*:=\s*"[^"]+"'),
                re.compile(r'token\s*:=\s*"[^"]+"'),
                re.compile(r'aws[_-]?secret'),
            ],
            'sql_injection': [
                re.compile(r'Query\([^)]*\+[^)]*\)'),
                re.compile(r'Exec\([^)]*\+[^)]*\)'),
                re.compile(r'\.QueryRow\([^)]*\+'),
            ],
            'deserialization': [
                re.compile(r'gob\.Decode'),
                re.compile(r'gob\.NewDecoder'),
                re.compile(r'json\.Unmarshal'),
                re.compile(r'xml\.Unmarshal'),
            ],
            'unsafe_usage': [
                re.compile(r'unsafe\.Pointer'),
                re.compile(r'unsafe\.Sizeof'),
                re.compile(r'unsafe\.Alignof'),
                re.compile(r'unsafe\.Offsetof'),
            ],
            'path_traversal': [
                re.compile(r'http\.(?:Get|Post)\s*\([^)]*\+[^)]*\)'),
                re.compile(r'ioutil\.ReadFile\([^)]*\+[^)]*\)'),
            ],
        }
    
    # ==================== Thread Safety ====================
    
    def get_thread_safe_types(self) -> Set[str]:
        return {
            'sync.Mutex', 'sync.RWMutex', 'sync.WaitGroup', 'sync.Once',
            'sync.Cond', 'sync.Pool', 'sync.Map', 'sync.Locker',
            'chan', 'sync.AtomicInt32', 'sync.AtomicInt64',
            'atomic.Int32', 'atomic.Int64', 'atomic.Uint32', 'atomic.Uint64',
            'atomic.Pointer', 'context.Context', 'errgroup.Group'
        }
    
    def get_unsafe_types(self) -> Set[str]:
        return {
            'map', 'slice', '[]',
            'interface{}',  # empty interface
            'string',  # but safe for read
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
            'defer', 'close()', 'defer close()',
            'defer func()', 'defer wg.Done()',
            'defer cancel()'  # context cancellation
        }
    
    def get_resource_creation_patterns(self) -> List[Pattern]:
        return self._resource_creation
    
    # ==================== Error Handling ====================
    
    def get_error_types(self) -> Set[str]:
        return {
            'error', 'error interface',
            'io.EOF', 'io.ErrUnexpectedEOF',
            'syscall.Errno'
        }
    
    def get_error_check_patterns(self) -> List[Pattern]:
        return self._error_check
    
    def get_error_ignore_patterns(self) -> List[Pattern]:
        return self._error_ignore
    
    # ==================== Null Safety ====================
    
    def get_null_checks(self) -> Set[str]:
        return {
            '== nil', '!= nil', 'if err != nil', 'if err == nil',
            'if ctx == nil', 'if ch == nil', 'if m == nil',
        }
    
    def get_null_pointer_types(self) -> Set[str]:
        return {
            'pointer', 'interface', 'slice', 'map', 'chan', 'func',
            'error'  # error is nil-checkable
        }
    
    # ==================== Concurrency Primitives ====================
    
    def get_concurrency_primitives(self) -> Set[str]:
        return {
            'go', 'chan', 'select', 'defer',
            'sync.Mutex', 'sync.RWMutex', 'sync.WaitGroup',
            'sync.Once', 'sync.Cond', 'sync.Pool', 'sync.Map',
            'context.Context', 'context.WithCancel',
            'context.WithTimeout', 'context.WithDeadline',
            'errgroup.Group', 'golang.org/x/sync/errgroup',
            'atomic', 'runtime.GOMAXPROCS'
        }
    
    def get_thread_creation_patterns(self) -> List[Pattern]:
        return self._thread_creation
    
    # ==================== Security ====================
    
    def get_dangerous_patterns(self) -> Dict[str, List[Pattern]]:
        return self._security