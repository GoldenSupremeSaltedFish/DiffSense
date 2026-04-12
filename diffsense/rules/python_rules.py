"""
Python Rules for DiffSense

Python-specific security, concurrency, and quality rules.
Complements Java rules to provide consistent coverage across languages.
"""

import re
from typing import Dict, Any, List, Optional
from sdk.rule import BaseRule
from sdk.signal import Signal


# ==================== Security Rules ====================

class PythonHardcodedSecretRule(BaseRule):
    """检测硬编码的密码、密钥、Token"""

    def __init__(self):
        self._patterns = [
            re.compile(r'password\s*=\s*["\'][^"\']{3,}["\']', re.IGNORECASE),
            re.compile(r'api[_-]?key\s*=\s*["\'][^"\']{8,}["\']', re.IGNORECASE),
            re.compile(r'secret\s*=\s*["\'][^"\']{8,}["\']', re.IGNORECASE),
            re.compile(r'token\s*=\s*["\'][^"\']{8,}["\']', re.IGNORECASE),
            re.compile(r'aws[_-]?access[_-]?key', re.IGNORECASE),
            re.compile(r'private[_-]?key\s*=\s*["\']', re.IGNORECASE),
            re.compile(r'connection[_-]?string\s*=\s*["\']', re.IGNORECASE),
        ]

    @property
    def id(self) -> str:
        return "security.hardcoded_secret"

    @property
    def severity(self) -> str:
        return "critical"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Hardcoded credentials detected - could be exposed in version control"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


class PythonCommandInjectionRule(BaseRule):
    """检测命令注入风险"""

    def __init__(self):
        self._dangerous_calls = [
            re.compile(r'os\.system\s*\('),
            re.compile(r'os\.popen\s*\('),
            re.compile(r'subprocess\.(?:call|run|Popen)\s*\([^)]*shell\s*=\s*True'),
            re.compile(r'subprocess\.(?:call|run|Popen)\s*\([^)]*\+'),
            re.compile(r'os\.spawn'),
            re.compile(r'platform\.system\s*\(\s*\)'),  # 检测系统调用
        ]

    @property
    def id(self) -> str:
        return "security.command_injection"

    @property
    def severity(self) -> str:
        return "critical"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Potential command injection - user input could be executed"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        added_lines = [l for l in raw_diff.split('\n') if l.startswith('+')]

        for line in added_lines:
            for pattern in self._dangerous_calls:
                if pattern.search(line):
                    return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


class PythonEvalUsageRule(BaseRule):
    """检测 eval/exec 使用"""

    def __init__(self):
        self._eval_patterns = [
            re.compile(r'\beval\s*\('),
            re.compile(r'\bexec\s*\('),
            re.compile(r'\bcompile\s*\([^)]*mode\s*=\s*["\']exec'),
            re.compile(r'__import__\s*\(\s*["\']os["\']'),
        ]

    @property
    def id(self) -> str:
        return "security.code_injection"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "eval/exec allows arbitrary code execution"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._eval_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


class PythonSQLInjectionRule(BaseRule):
    """检测 SQL 注入风险"""

    def __init__(self):
        self._sql_patterns = [
            re.compile(r'cursor\.execute\([^)]*\%[^)]*\)'),
            re.compile(r'cursor\.execute\([^)]*\+[^)]*\)'),
            re.compile(r'f["\']SELECT.*\{'),
            re.compile(r'["\']SELECT.+\s+\+'),
            re.compile(r'format\(["\'].*SELECT'),
        ]

    @property
    def id(self) -> str:
        return "security.sql_injection"

    @property
    def severity(self) -> str:
        return "critical"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Potential SQL injection - use parameterized queries"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._sql_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Resource Management Rules ====================

class PythonResourceLeakRule(BaseRule):
    """检测资源泄漏（文件、网络连接）"""

    def __init__(self):
        self._resource_patterns = [
            re.compile(r'open\s*\([^)]+\)\s*(?!.*with)'),  # open without context manager
            re.compile(r'requests\.(?:get|post)\s*\(.*\)\s*(?!.*with)'),
            re.compile(r'urllib\.request\.urlopen'),
        ]
        self._close_pattern = re.compile(r'\.close\s*\(')
        self._with_pattern = re.compile(r'\bwith\s+')

    @property
    def id(self) -> str:
        return "resource.file_leak"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Resource opened without proper cleanup (use 'with' statement)"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        added_lines = [l for l in raw_diff.split('\n') if l.startswith('+') and 'open(' in l]

        for line in added_lines:
            if not self._with_pattern.search(line) and not self._close_pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


# ==================== Concurrency Rules ====================

class PythonThreadSafetyRule(BaseRule):
    """检测线程安全问题"""

    def __init__(self):
        self._unsafe_patterns = [
            re.compile(r'global\s+\w+'),  # global variable
            re.compile(r'self\.\w+\s*=.*\+'),  # modifying shared state
            re.compile(r'list\s*\('),  # shared list
            re.compile(r'dict\s*\('),  # shared dict
        ]
        self._safe_patterns = [
            re.compile(r'threading\.Lock'),
            re.compile(r'threading\.RLock'),
            re.compile(r'queue\.Queue'),
            re.compile(r'with\s+self\._lock'),
        ]

    @property
    def id(self) -> str:
        return "runtime.thread_safety"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Potential race condition - shared state without lock"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")

        has_unsafe = any(p.search(raw_diff) for p in self._unsafe_patterns)
        has_safe = any(p.search(raw_diff) for p in self._safe_patterns)

        if has_unsafe and not has_safe:
            return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


# ==================== Exception Handling Rules ====================

class PythonSwallowedExceptionRule(BaseRule):
    """检测异常被吞掉"""

    def __init__(self):
        self._swallow_patterns = [
            re.compile(r'except\s*:\s*$', re.MULTILINE),
            re.compile(r'except\s+Exception\s*:\s*$', re.MULTILINE),
            re.compile(r'except\s*\)\s*:\s*$', re.MULTILINE),
            re.compile(r'except.*:\s*pass\s*$', re.MULTILINE),
        ]

    @property
    def id(self) -> str:
        return "exception.swallowed"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Empty except block swallows exceptions"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._swallow_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


class PythonBroadExceptionRule(BaseRule):
    """检测捕获过于宽泛的异常"""

    def __init__(self):
        self._broad_patterns = [
            re.compile(r'except\s*:\s*'),
            re.compile(r'except\s+BaseException\s*:\s*'),
            re.compile(r'except\s+Exception\s*:\s*(?!.*logging|.*log)'),
        ]

    @property
    def id(self) -> str:
        return "exception.too_generic"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Catching too broad exception - specify exact exception type"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._broad_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Null Safety Rules ====================

class PythonNoneCheckRule(BaseRule):
    """检测 None 检查缺失"""

    def __init__(self):
        self._method_call = re.compile(r'\w+\.\w+\s*\(')
        self._none_check = re.compile(r'if\s+\w+\s+is\s+(?:not\s+)?None')

    @property
    def id(self) -> str:
        return "null.none_check"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Method called on potentially None value without check"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        lines = raw_diff.split('\n')

        for i, line in enumerate(lines):
            if line.startswith('+') and self._method_call.search(line):
                # Check surrounding lines for None check
                context = '\n'.join(lines[max(0, i-3):i+3])
                if not self._none_check.search(context):
                    return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


class PythonTypeSafetyRule(BaseRule):
    """检测类型安全相关问题"""

    def __init__(self):
        self._unsafe_patterns = [
            re.compile(r'cast\s*\('),
            re.compile(r'type\s*\('),
            re.compile(r'isinstance\s*\([^,]+,\s*type\)'),
        ]

    @property
    def id(self) -> str:
        return "null.type_confusion"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Potential type confusion - avoid using type() for type checking"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._unsafe_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Performance Rules ====================

class PythonLoopInEfficientRule(BaseRule):
    """检测低效循环模式"""

    def __init__(self):
        self._inefficient_patterns = [
            re.compile(r'for\s+\w+\s+in\s+range\s*\(\s*len\s*\('),
            re.compile(r'while\s+True\s*:.*\s+break'),
        ]

    @property
    def id(self) -> str:
        return "performance.inefficient_loop"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "performance"

    @property
    def rationale(self) -> str:
        return "Inefficient loop pattern - use enumerate() or direct iteration"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._inefficient_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


class PythonInMemoryLargeDataRule(BaseRule):
    """检测内存中的大数据处理"""

    def __init__(self):
        self._dangerous_patterns = [
            re.compile(r'read\s*\(\s*\)'),  # read entire file
            re.compile(r'readlines\s*\(\s*\)'),
            re.compile(r'\.read\(\s*\)'),
        ]

    @property
    def id(self) -> str:
        return "performance.memory"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "performance"

    @property
    def rationale(self) -> str:
        return "Loading entire file into memory - use chunked reading for large files"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._dangerous_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Import/Dependency Rules ====================

class PythonSensitiveImportRule(BaseRule):
    """检测敏感模块导入"""

    def __init__(self):
        self._sensitive_imports = [
            re.compile(r'import\s+os\s*$', re.MULTILINE),
            re.compile(r'import\s+sys\s*$', re.MULTILINE),
            re.compile(r'from\s+os\s+import'),
            re.compile(r'from\s+subprocess\s+import'),
            re.compile(r'import\s+pickle\s*$', re.MULTILINE),
            re.compile(r'marshal\.load'),
            re.compile(r'yaml\.unsafe_load'),
        ]

    @property
    def id(self) -> str:
        return "security.sensitive_import"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Sensitive module imported - review for security implications"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        added_lines = [l for l in raw_diff.split('\n') if l.startswith('+')]

        for line in added_lines:
            for pattern in self._sensitive_imports:
                if pattern.search(line):
                    return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


class PythonWeakCryptographyRule(BaseRule):
    """检测弱加密算法使用"""

    def __init__(self):
        self._weak_patterns = [
            re.compile(r'md5\s*\('),
            re.compile(r'hashlib\.md5'),
            re.compile(r'sha1\s*\('),
            re.compile(r'hashlib\.sha1'),
            re.compile(r'DES\s*\('),
            re.compile(r'Crypto\.Cipher\.DES'),
            re.compile(r'Random\.randint'),  # Not cryptographically secure
        ]

    @property
    def id(self) -> str:
        return "security.weak_crypto"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Weak cryptographic algorithm detected - use SHA-256 or stronger"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._weak_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Best Practices ====================

class PythonDebugCodeRule(BaseRule):
    """检测调试代码遗留"""

    def __init__(self):
        self._debug_patterns = [
            re.compile(r'print\s*\(\s*(?!logging|logger)'),
            re.compile(r'import\s+pdb\s*$', re.MULTILINE),
            re.compile(r'from\s+pdb\s+import'),
            re.compile(r'breakpoint\s*\('),
            re.compile(r'import\s+ipdb\s*$', re.MULTILINE),
            re.compile(r'import\s+pytest\s*$', re.MULTILINE),
        ]

    @property
    def id(self) -> str:
        return "maintenance.debug_code"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Debug code detected - should be removed before production"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        added_lines = [l for l in raw_diff.split('\n') if l.startswith('+') and 'print(' in l]

        if added_lines:
            return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


class PythonMutableDefaultArgRule(BaseRule):
    """检测可变默认参数"""

    def __init__(self):
        self._mutable_pattern = re.compile(r'def\s+\w+\s*\([^)]*=\s*\[\s*\]')

    @property
    def id(self) -> str:
        return "runtime.mutable_default"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Mutable default argument - shared across calls"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        if self._mutable_pattern.search(raw_diff):
            return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Path Traversal ====================

class PythonPathTraversalRule(BaseRule):
    """检测路径遍历漏洞"""

    def __init__(self):
        self._path_patterns = [
            re.compile(r'open\s*\([^)]*\+[^)]*\)'),
            re.compile(r'os\.path\.join\s*\([^)]*\+'),
            re.compile(r'Path\s*\([^)]*\+[^)]*\)\.read\(\)'),
        ]

    @property
    def id(self) -> str:
        return "security.path_traversal"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Potential path traversal - validate and sanitize user input"

    @property
    def language(self) -> str:
        return "python"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._path_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None