"""
JavaScript/TypeScript Language Adapter for DiffSense

Provides JavaScript-specific patterns and constructs for rule development.
"""

import re
from typing import List, Set, Pattern, Dict
from .language_adapter import LanguageAdapter


class JavaScriptAdapter(LanguageAdapter):
    """
    Language adapter for JavaScript/TypeScript.

    Provides JavaScript-specific patterns for concurrency, resource management,
    error handling, and other language constructs.
    """

    def __init__(self):
        super().__init__("javascript")
        self._compile_patterns()

    def _compile_patterns(self):
        """Pre-compile commonly used patterns."""
        # Thread Safety / Concurrency Patterns
        self._lock_patterns = [
            re.compile(r'new\s+Mutex\(\)'),
            re.compile(r'await\s+mutex\.acquire\(\)'),
            re.compile(r'\.lock\(\)'),
            re.compile(r'with\s*\(\s*lock\s*\)'),
            re.compile(r'synchronized\s*\('),
        ]

        self._unlock_patterns = [
            re.compile(r'mutex\.release\(\)'),
            re.compile(r'\.unlock\(\)'),
        ]

        self._volatile_patterns = [
            re.compile(r'Atomic\w+\('),
            re.compile(r'new\s+AtomicReference'),
        ]

        # Resource Management Patterns
        self._resource_creation = [
            re.compile(r'fs\.open\('),
            re.compile(r'fs\.createReadStream\('),
            re.compile(r'fs\.createWriteStream\('),
            re.compile(r'database\.connect\('),
            re.compile(r'new\s+Client\(.*\)\.connect\(\)'),
        ]

        # Error Handling Patterns
        self._error_check = [
            re.compile(r'catch\s*\([^)]*\)\s*\{'),
            re.compile(r'if\s*\(\s*err\s*\)'),
            re.compile(r'if\s*\(\s*error\s*\)'),
            re.compile(r'if\s*\(\s*!\w+\s*\)\s*\{'),
            re.compile(r'\.catch\(\s*\w*\s*=>'),
        ]

        self._error_ignore = [
            re.compile(r'catch\s*\([^)]*\)\s*\{\s*\}'),
            re.compile(r'catch\s*\(\s*\w+\s*\)\s*\{\s*\}'),
            re.compile(r'\.catch\(\s*\(\s*\w*\s*\)\s*\{\s*\}\s*\)'),
        ]

        # Async/Promise Patterns
        self._promise_handling = [
            re.compile(r'\.then\('),
            re.compile(r'\.catch\('),
            re.compile(r'\.finally\('),
            re.compile(r'await\s+'),
            re.compile(r'async\s+function'),
        ]

        # Security Patterns
        self._security = {
            'command_injection': [
                re.compile(r'child_process\.exec\('),
                re.compile(r'child_process\.execSync\('),
                re.compile(r'eval\s*\('),
                re.compile(r'new\s+Function\('),
                re.compile(r'document\.write\('),
            ],
            'hardcoded_secret': [
                re.compile(r'password\s*[:=]\s*["\'][^"\']+["\']'),
                re.compile(r'api[_-]?key\s*[:=]\s*["\'][^"\']+["\']'),
                re.compile(r'secret[_-]?key\s*[:=]\s*["\'][^"\']+["\']'),
                re.compile(r'access[_-]?token\s*[:=]\s*["\'][^"\']+["\']'),
                re.compile(r'AKIA[0-9A-Z]{16}'),
            ],
            'sql_injection': [
                re.compile(r'query\s*\(\s*["\'].*\%.*["\']'),
                re.compile(r'query\s*\(\s*[`].*\$\{'),
            ],
            'deserialization': [
                re.compile(r'JSON\.parse\('),
                re.compile(r'yaml\.load\('),
                re.compile(r'yaml\.unsafe_load\('),
            ],
            'xss': [
                re.compile(r'innerHTML\s*='),
                re.compile(r'outerHTML\s*='),
                re.compile(r'document\.write\('),
            ],
        }

        # Console usage (should not be in production)
        self._console_usage = [
            re.compile(r'console\.log\('),
            re.compile(r'console\.debug\('),
            re.compile(r'console\.info\('),
            re.compile(r'console\.warn\('),
            re.compile(r'console\.error\('),
        ]

    # ==================== Thread Safety ====================

    def get_thread_safe_types(self) -> Set[str]:
        return {
            'Mutex', 'Lock', 'RLock', 'Semaphore',
            'AtomicReference', 'AtomicInteger', 'AtomicBoolean',
            'ConcurrentMap', 'ConcurrentHashMap',
            'Promise', 'AsyncIterable',
        }

    def get_unsafe_types(self) -> Set[str]:
        return {
            'Object', 'Array', 'Map', 'Set',
            'string', 'number', 'boolean',
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
            'close()', '.close()', 'finally', 'dispose()',
            '.end()', '.destroy()', 'cleanup()', 'teardown()'
        }

    def get_resource_creation_patterns(self) -> List[Pattern]:
        return self._resource_creation

    # ==================== Error Handling ====================

    def get_error_types(self) -> Set[str]:
        return {
            'Error', 'TypeError', 'ReferenceError', 'SyntaxError',
            'RangeError', 'URIError', 'EvalError',
            'PromiseRejection', 'UnhandledPromiseRejection'
        }

    def get_error_check_patterns(self) -> List[Pattern]:
        return self._error_check

    def get_error_ignore_patterns(self) -> List[Pattern]:
        return self._error_ignore

    # ==================== Null Safety ====================

    def get_null_checks(self) -> Set[str]:
        return {
            '=== null', '!== null', '== null', '!= null',
            'if (x)', 'if (!x)', 'if (x !== null)',
            'x &&', 'x?.', 'x ??', 'Optional.ofNullable'
        }

    def get_null_pointer_types(self) -> Set[str]:
        return {
            'null', 'undefined', 'any', 'object'
        }

    # ==================== Concurrency Primitives ====================

    def get_concurrency_primitives(self) -> Set[str]:
        return {
            'Promise', 'async', 'await', 'setTimeout', 'setInterval',
            'Worker', 'WorkerThread', 'child_process',
            'Mutex', 'Semaphore', 'Atomics',
            'EventEmitter', 'EventTarget'
        }

    def get_thread_creation_patterns(self) -> List[Pattern]:
        return self._promise_handling + [
            re.compile(r'new\s+Worker\('),
            re.compile(r'child_process\.spawn\('),
        ]

    # ==================== Security ====================

    def get_dangerous_patterns(self) -> Dict[str, List[Pattern]]:
        return self._security

    # ==================== Additional JavaScript-specific ====================

    def get_console_patterns(self) -> List[Pattern]:
        """Get patterns for console usage (production issue)."""
        return self._console_usage

    def get_var_declaration_patterns(self) -> List[Pattern]:
        """Get patterns for deprecated var declaration."""
        return [
            re.compile(r'\bvar\s+\w+'),
        ]

    def get_strict_comparison_patterns(self) -> List[Pattern]:
        """Get patterns for loose equality (should use ===)."""
        return [
            re.compile(r'==\s*null'),
            re.compile(r'!=\s*null'),
            re.compile(r'==\s*undefined'),
            re.compile(r'!=\s*undefined'),
        ]


def get_adapter():
    """Get JavaScript adapter instance."""
    return JavaScriptAdapter()