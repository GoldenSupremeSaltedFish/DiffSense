"""
C++ Language Adapter for DiffSense

Provides C++-specific patterns and constructs for rule development.
"""

import re
from typing import List, Set, Pattern, Dict
from .language_adapter import LanguageAdapter


class CppAdapter(LanguageAdapter):
    """
    Language adapter for C++.

    Provides C++-specific patterns for resource management, memory safety,
    concurrency, and other language constructs.
    """

    def __init__(self):
        super().__init__("cpp")
        self._compile_patterns()

    def _compile_patterns(self):
        """Pre-compile commonly used patterns."""
        # Thread Safety / Concurrency Patterns
        self._lock_patterns = [
            re.compile(r'std::lock_guard\s*<'),
            re.compile(r'std::unique_lock\s*<'),
            re.compile(r'std::shared_lock\s*<'),
            re.compile(r'pthread_mutex_lock\s*\('),
            re.compile(r'boost::mutex'),
            re.compile(r'std::mutex'),
        ]

        self._unlock_patterns = [
            re.compile(r'std::lock_guard.*release\('),
            re.compile(r'std::unique_lock.*release\('),
            re.compile(r'pthread_mutex_unlock\s*\('),
            re.compile(r'\.unlock\(\)'),
        ]

        self._volatile_patterns = [
            re.compile(r'std::atomic<'),
            re.compile(r'volatile\s+\w+'),
            re.compile(r'atomic_\w+\s*\('),
        ]

        # Resource Management Patterns (RAII)
        self._resource_creation = [
            re.compile(r'new\s+\w+'),
            re.compile(r'fopen\s*\('),
            re.compile(r'ifstream\s*\('),
            re.compile(r'ofstream\s*\('),
            re.compile(r'socket\s*\('),
            re.compile(r'connect\s*\('),
            re.compile(r'std::make_unique'),
            re.compile(r'std::make_shared'),
            re.compile(r'std::move'),
        ]

        # Error Handling Patterns
        self._error_check = [
            re.compile(r'catch\s*\(\s*\w+.*\)\s*\{'),
            re.compile(r'if\s*\(\s*errno'),
            re.compile(r'if\s*\(\s*!'),
            re.compile(r'if\s*\(\s*nullptr'),
            re.compile(r'if\s*\(\s*\w+\s*==\s*NULL'),
        ]

        self._error_ignore = [
            re.compile(r'catch\s*\([^)]*\)\s*\{\s*\}'),
            re.compile(r'catch\s*\(\s*\w+\s*&\s*\w+\s*\)\s*\{\s*\}'),
        ]

        # Memory Management Patterns
        self._memory_patterns = [
            re.compile(r'delete\s+\w+'),
            re.compile(r'delete\[\]\s+\w+'),
            re.compile(r'free\s*\('),
            re.compile(r'malloc\s*\('),
            re.compile(r'realloc\s*\('),
            re.compile(r'std::unique_ptr'),
            re.compile(r'std::shared_ptr'),
            re.compile(r'std::weak_ptr'),
        ]

        # Security Patterns
        self._security = {
            'buffer_overflow': [
                re.compile(r'strcpy\s*\('),
                re.compile(r'strcat\s*\('),
                re.compile(r'sprintf\s*\('),
                re.compile(r'gets\s*\('),
                re.compile(r'scanf\s*\([^)]*%s'),
            ],
            'hardcoded_secret': [
                re.compile(r'password\s*=\s*["\'][^"\']+["\']'),
                re.compile(r'api[_-]?key\s*=\s*["\'][^"\']+["\']'),
                re.compile(r'secret\s*=\s*["\'][^"\']+["\']'),
                re.compile(r'token\s*=\s*["\'][^"\']+["\']'),
            ],
            'command_injection': [
                re.compile(r'system\s*\('),
                re.compile(r'exec\s*\('),
                re.compile(r'popen\s*\('),
                re.compile(r'shell_exec\s*\('),
            ],
            'format_string': [
                re.compile(r'printf\s*\([^,]+%s'),
                re.compile(r'sprintf\s*\([^,]+%s'),
            ],
            'unsafe_pointer': [
                re.compile(r'new\s+\w+\s*\(\s*\)'),
                re.compile(r'\*\s*\w+\s*='),
                re.compile(r'&(?!\w)'),
            ],
        }

    # ==================== Thread Safety ====================

    def get_thread_safe_types(self) -> Set[str]:
        return {
            'std::mutex', 'std::recursive_mutex', 'std::shared_mutex',
            'std::lock_guard', 'std::unique_lock', 'std::shared_lock',
            'std::atomic', 'std::atomic_flag',
            'pthread_mutex_t', 'pthread_rwlock_t',
            'concurrent_queue', 'thread',
        }

    def get_unsafe_types(self) -> Set[str]:
        return {
            'raw pointer', 'char*', 'void*', 'int*',
            'std::vector', 'std::list', 'std::map', 'std::set',
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
            'delete', 'delete[]', 'free', 'close',
            'fclose', 'shutdown', 'disconnect',
            'std::unique_ptr', 'std::shared_ptr',
            'RAII', 'destructor', '~'
        }

    def get_resource_creation_patterns(self) -> List[Pattern]:
        return self._resource_creation

    # ==================== Error Handling ====================

    def get_error_types(self) -> Set[str]:
        return {
            'std::exception', 'std::runtime_error', 'std::logic_error',
            'std::bad_alloc', 'std::bad_cast', 'std::out_of_range',
            'std::invalid_argument', 'errno', 'NULL', 'nullptr'
        }

    def get_error_check_patterns(self) -> List[Pattern]:
        return self._error_check

    def get_error_ignore_patterns(self) -> List[Pattern]:
        return self._error_ignore

    # ==================== Null Safety ====================

    def get_null_checks(self) -> Set[str]:
        return {
            '== nullptr', '!= nullptr', '!ptr',
            'if (ptr)', 'if (!ptr)', 'if (ptr == nullptr)',
            'NULL', 'nullptr', 'assert()'
        }

    def get_null_pointer_types(self) -> Set[str]:
        return {
            'nullptr', 'NULL', 'void*', 'char*', 'T*'
        }

    # ==================== Concurrency Primitives ====================

    def get_concurrency_primitives(self) -> Set[str]:
        return {
            'std::thread', 'std::mutex', 'std::lock_guard',
            'std::atomic', 'std::future', 'std::promise',
            'pthread', 'pthread_mutex', 'pthread_cond',
            'boost::thread', 'boost::mutex'
        }

    def get_thread_creation_patterns(self) -> List[Pattern]:
        return [
            re.compile(r'std::thread\s*\('),
            re.compile(r'pthread_create\s*\('),
            re.compile(r'boost::thread\s*\('),
        ]

    # ==================== Security ====================

    def get_dangerous_patterns(self) -> Dict[str, List[Pattern]]:
        return self._security

    # ==================== Additional C++ specific ====================

    def get_memory_management_patterns(self) -> List[Pattern]:
        """Get patterns for memory management (smart vs raw pointers)."""
        return self._memory_patterns

    def get_raii_patterns(self) -> List[Pattern]:
        """Get patterns for RAII (Resource Acquisition Is Initialization)."""
        return [
            re.compile(r'class\s+\w+.*\{'),
            re.compile(r'~?\w+\s*\(\s*\).*\{'),
            re.compile(r'std::unique_ptr'),
            re.compile(r'std::shared_ptr'),
        ]

    def get_smart_pointer_patterns(self) -> List[Pattern]:
        """Get patterns for smart pointers (preferred over raw)."""
        return [
            re.compile(r'std::unique_ptr'),
            re.compile(r'std::shared_ptr'),
            re.compile(r'std::weak_ptr'),
            re.compile(r'std::make_unique'),
            re.compile(r'std::make_shared'),
        ]


def get_adapter():
    """Get C++ adapter instance."""
    return CppAdapter()