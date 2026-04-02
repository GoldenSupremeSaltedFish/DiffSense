"""
Java Language Adapter for DiffSense

Provides Java-specific patterns and constructs for rule development.
"""

import re
from typing import List, Set, Pattern, Dict
from .language_adapter import LanguageAdapter


class JavaAdapter(LanguageAdapter):
    """
    Language adapter for Java.
    
    Provides Java-specific patterns for thread safety, resource management,
    error handling, and other language constructs.
    """
    
    def __init__(self):
        super().__init__("java")
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Pre-compile commonly used patterns."""
        # Thread Safety Patterns
        self._lock_patterns = [
            re.compile(r'synchronized'),
            re.compile(r'\.lock\(\)'),
            re.compile(r'\.tryLock\(\)'),
            re.compile(r'\.wait\(\)'),
        ]
        
        self._unlock_patterns = [
            re.compile(r'\.unlock\(\)'),
            re.compile(r'\.notify\(\)'),
            re.compile(r'\.notifyAll\(\)'),
        ]
        
        self._volatile_patterns = [
            re.compile(r'\bvolatile\b'),
            re.compile(r'AtomicInteger'),
            re.compile(r'AtomicLong'),
            re.compile(r'AtomicBoolean'),
            re.compile(r'AtomicReference'),
        ]
        
        # Resource Management Patterns
        self._resource_creation = [
            re.compile(r'new\s+(?:File|Input|Output)?Stream\('),
            re.compile(r'new\s+Connection\('),
            re.compile(r'DriverManager\.getConnection'),
            re.compile(r'new\s+(?:Socket|ServerSocket)\('),
            re.compile(r'new\s+Thread\('),
            re.compile(r'Executors\.new'),
        ]
        
        # Error Handling Patterns
        self._error_check = [
            re.compile(r'catch\s*\(\s*(\w+\s+)?\w+Exception'),
            re.compile(r'if\s+\w+\s*==\s*null'),
            re.compile(r'if\s+\w+\s*!=\s*null'),
            re.compile(r'Objects\.isNull'),
            re.compile(r'Objects\.nonNull'),
        ]
        
        self._error_ignore = [
            re.compile(r'catch\s*\(\s*Exception\s*\)'),
            re.compile(r'catch\s*\(\s*\s*\)'),
            re.compile(r'catch\s*\(\s*Throwable\s*\)'),
        ]
        
        # Thread Creation Patterns
        self._thread_creation = [
            re.compile(r'new\s+Thread\('),
            re.compile(r'executor\.submit'),
            re.compile(r'CompletableFuture\.runAsync'),
            re.compile(r'CompletableFuture\.supplyAsync'),
            re.compile(r'new\s+(?:Fixed|Cached|Single)ThreadPool'),
        ]
        
        # Security Patterns
        self._security = {
            'sql_injection': [
                re.compile(r'Statement.*\+'),
                re.compile(r'executeQuery.*\+'),
                re.compile(r'createStatement\(\).*\+'),
            ],
            'hardcoded_secret': [
                re.compile(r'password\s*=\s*"[^"]+"'),
                re.compile(r'api[_-]?key\s*=\s*"[^"]+"'),
                re.compile(r'secret\s*=\s*"[^"]+"'),
                re.compile(r'token\s*=\s*"[^"]+"'),
            ],
            'command_injection': [
                re.compile(r'Runtime\.getRuntime\(\)\.exec'),
                re.compile(r'ProcessBuilder'),
            ],
            'deserialization': [
                re.compile(r'ObjectInputStream'),
                re.compile(r'XMLDecoder'),
                re.compile(r'YAML\.load'),
            ],
        }
    
    # ==================== Thread Safety ====================
    
    def get_thread_safe_types(self) -> Set[str]:
        return {
            'ConcurrentHashMap', 'ConcurrentMap', 'ConcurrentLinkedQueue',
            'ConcurrentLinkedDeque', 'ConcurrentSkipListMap', 'ConcurrentSkipListSet',
            'CopyOnWriteArrayList', 'CopyOnWriteArraySet',
            'AtomicInteger', 'AtomicLong', 'AtomicBoolean', 'AtomicReference',
            'AtomicIntegerArray', 'AtomicLongArray',
            'Collections.synchronizedMap', 'Collections.synchronizedList',
            'Collections.synchronizedSet', 'Vector', 'Stack', 'Hashtable',
            'BlockingQueue', 'BlockingDeque', 'LinkedBlockingQueue',
            'Semaphore', 'CountDownLatch', 'CyclicBarrier', 'Exchanger'
        }
    
    def get_unsafe_types(self) -> Set[str]:
        return {
            'HashMap', 'ArrayList', 'HashSet', 'LinkedList',
            'LinkedHashMap', 'LinkedHashSet', 'TreeMap', 'TreeSet',
            'Map', 'List', 'Set', 'Collection',
            'StringBuilder', 'StringBuffer',  # when shared across threads
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
            'close()', 'finally', 'try-with-resources',
            'closeQuietly', 'IOUtils.closeQuietly'
        }
    
    def get_resource_creation_patterns(self) -> List[Pattern]:
        return self._resource_creation
    
    # ==================== Error Handling ====================
    
    def get_error_types(self) -> Set[str]:
        return {
            'Exception', 'RuntimeException', 'Throwable',
            'Error', 'IOException', 'SQLException',
            'NullPointerException', 'IllegalArgumentException',
            'IllegalStateException', 'ConcurrentModificationException'
        }
    
    def get_error_check_patterns(self) -> List[Pattern]:
        return self._error_check
    
    def get_error_ignore_patterns(self) -> List[Pattern]:
        return self._error_ignore
    
    # ==================== Null Safety ====================
    
    def get_null_checks(self) -> Set[str]:
        return {
            '== null', '!= null', 'Objects.isNull', 'Objects.nonNull',
            'Optional.ofNullable', 'Optional.empty', 'isPresent',
            'if (obj == null)', 'if (obj != null)'
        }
    
    def get_null_pointer_types(self) -> Set[str]:
        return {
            'Object', 'String', 'List', 'Map', 'Set', 'Collection',
            'Array', 'Integer', 'Long', 'Double', 'Float', 'Boolean',
            'Date', 'BigDecimal', 'Optional'
        }
    
    # ==================== Concurrency Primitives ====================
    
    def get_concurrency_primitives(self) -> Set[str]:
        return {
            'synchronized', 'volatile', 'Thread', 'Runnable', 'Callable',
            'ExecutorService', 'Executor', 'ThreadPoolExecutor',
            'Future', 'CompletableFuture', 'CountDownLatch',
            'CyclicBarrier', 'Semaphore', 'ReentrantLock', 'ReentrantReadWriteLock',
            'AtomicInteger', 'AtomicLong', 'AtomicBoolean', 'AtomicReference',
            'ConcurrentHashMap', 'ConcurrentMap', 'Collections.synchronizedMap'
        }
    
    def get_thread_creation_patterns(self) -> List[Pattern]:
        return self._thread_creation
    
    # ==================== Security ====================
    
    def get_dangerous_patterns(self) -> Dict[str, List[Pattern]]:
        return self._security