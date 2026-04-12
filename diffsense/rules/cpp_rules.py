"""
C++ Rules for DiffSense

C++ specific security, memory safety, and concurrency rules.
Complements Java rules to provide consistent coverage across languages.
"""

import re
from typing import Dict, Any, List, Optional
from sdk.rule import BaseRule
from sdk.signal import Signal


# ==================== Memory Safety Rules ====================

class CppMemoryLeakRule(BaseRule):
    """检测内存泄漏（new/delete 不匹配）"""

    def __init__(self):
        self._new_pattern = re.compile(r'\bnew\s+')
        self._delete_pattern = re.compile(r'\bdelete\s+')
        self._smart_ptr_pattern = re.compile(r'std::(unique_ptr|shared_ptr|weak_ptr)')

    @property
    def id(self) -> str:
        return "cpp.resource.memory_leak"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Potential memory leak - use smart pointers instead of raw new/delete"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        has_new = self._new_pattern.search(raw_diff)
        has_delete = self._delete_pattern.search(raw_diff)
        has_smart_ptr = self._smart_ptr_pattern.search(raw_diff)

        if has_new and not (has_delete or has_smart_ptr):
            return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


class CppRawPointerRule(BaseRule):
    """检测原始指针使用"""

    def __init__(self):
        self._raw_pointer = re.compile(r'\b(int|char|float|double|void|bool)\s*\*\s*\w+')

    @property
    def id(self) -> str:
        return "cpp.resource.raw_pointer"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Raw pointer detected - consider using smart pointers"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        if self._raw_pointer.search(raw_diff):
            return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


class CppBufferOverflowRule(BaseRule):
    """检测缓冲区溢出风险"""

    def __init__(self):
        self._dangerous_funcs = [
            re.compile(r'\bstrcpy\s*\('),
            re.compile(r'\bstrcat\s*\('),
            re.compile(r'\bsprintf\s*\('),
            re.compile(r'\bsscanf\s*\('),
            re.compile(r'\bmemcpy\s*\([^,]+\+[^,]+\)'),
            re.compile(r'\bmemmove\s*\([^,]+\+[^,]+\)'),
            re.compile(r'\bgets\s*\('),
            re.compile(r'\bscanf\s*\([^)]*%s'),
        ]

    @property
    def id(self) -> str:
        return "cpp.security.buffer_overflow"

    @property
    def severity(self) -> str:
        return "critical"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Unsafe function call - use bounds-checked alternatives"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        added_lines = [l for l in raw_diff.split('\n') if l.startswith('+')]

        for line in added_lines:
            for pattern in self._dangerous_funcs:
                if pattern.search(line):
                    return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


# ==================== Security Rules ====================

class CppHardcodedSecretRule(BaseRule):
    """检测硬编码密钥"""

    def __init__(self):
        self._patterns = [
            re.compile(r'password\s*=\s*["\'][^"\']{3,}["\']', re.IGNORECASE),
            re.compile(r'api[_-]?key\s*=\s*["\'][^"\']{8,}["\']', re.IGNORECASE),
            re.compile(r'secret\s*=\s*["\'][^"\']{8,}["\']', re.IGNORECASE),
            re.compile(r'token\s*=\s*["\'][^"\']{8,}["\']', re.IGNORECASE),
            re.compile(r'private[_-]?key\s*=\s*["\']', re.IGNORECASE),
            re.compile(r'connection[_-]?string.*=.*"', re.IGNORECASE),
        ]

    @property
    def id(self) -> str:
        return "cpp.security.hardcoded_secret"

    @property
    def severity(self) -> str:
        return "critical"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Hardcoded credentials detected"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


class CppCommandInjectionRule(BaseRule):
    """检测命令注入"""

    def __init__(self):
        self._dangerous_calls = [
            re.compile(r'system\s*\('),
            re.compile(r'exec\s*\('),
            re.compile(r'spawn\s*\('),
            re.compile(r'popen\s*\('),
            re.compile(r'\bdlopen\s*\('),
        ]

    @property
    def id(self) -> str:
        return "cpp.security.command_injection"

    @property
    def severity(self) -> str:
        return "critical"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Potential command injection vulnerability"

    @property
    def language(self) -> str:
        return "cpp"

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


class CppSQLInjectionRule(BaseRule):
    """检测 SQL 注入"""

    def __init__(self):
        self._sql_patterns = [
            re.compile(r'execute\s*\([^)]*\+[^)]*\)'),
            re.compile(r'query\s*\([^)]*\+[^)]*\)'),
            re.compile(r'prepare\s*\([^)]*\+'),
            re.compile(r'"SELECT.*\+'),
            re.compile(r'"INSERT.*\+'),
            re.compile(r'"UPDATE.*\+'),
        ]

    @property
    def id(self) -> str:
        return "cpp.security.sql_injection"

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
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._sql_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


class CppUnsafeCastRule(BaseRule):
    """检测不安全的类型转换"""

    def __init__(self):
        self._unsafe_casts = [
            re.compile(r'reinterpret_cast\s*\('),
            re.compile(r'C-style\s+cast'),
            re.compile(r'\(\s*\w+\s*\*\s*\)'),  # C-style pointer cast
        ]

    @property
    def id(self) -> str:
        return "cpp.security.unsafe_cast"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Unsafe type casting - could cause undefined behavior"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._unsafe_casts:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Concurrency Rules ====================

class CppThreadSafetyRule(BaseRule):
    """检测线程安全问题"""

    def __init__(self):
        self._shared_var = re.compile(r'(?:int|char|float|double|void|bool|string)\s+\w+\s*;')
        self._thread_keyword = re.compile(r'std::thread')
        self._lock_keyword = re.compile(r'std::(mutex|lock_guard|unique_lock)')

    @property
    def id(self) -> str:
        return "cpp.runtime.thread_safety"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Potential race condition - shared variable without synchronization"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")

        has_thread = self._thread_keyword.search(raw_diff)
        has_shared = self._shared_var.search(raw_diff)
        has_lock = self._lock_keyword.search(raw_diff)

        if has_thread and has_shared and not has_lock:
            return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


class CppDataRaceRule(BaseRule):
    """检测数据竞争"""

    def __init__(self):
        self._atomic_ops = ['atomic', 'mutex', 'lock', 'barrier']
        self._non_atomic = re.compile(r'std::\w+(?<!atomic)<')

    @property
    def id(self) -> str:
        return "cpp.runtime.data_race"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Potential data race - use std::atomic for shared data"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        if self._non_atomic.search(raw_diff):
            return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Resource Management Rules ====================

class CppResourceLeakRule(BaseRule):
    """检测资源泄漏（文件、连接）"""

    def __init__(self):
        self._resource_open = [
            re.compile(r'fopen\s*\('),
            re.compile(r'ifstream\s*\('),
            re.compile(r'ofstream\s*\('),
            re.compile(r'socket\s*\('),
            re.compile(r'connect\s*\('),
        ]
        self._resource_close = [
            re.compile(r'fclose\s*\('),
            re.compile(r'\.close\s*\('),
            re.compile(r'shutdown\s*\('),
        ]

    @property
    def id(self) -> str:
        return "cpp.resource.leak"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Resource opened without proper cleanup"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")

        has_open = any(p.search(raw_diff) for p in self._resource_open)
        has_close = any(p.search(raw_diff) for p in self._resource_close)

        if has_open and not has_close:
            return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


# ==================== Exception Handling Rules ====================

class CppSwallowedExceptionRule(BaseRule):
    """检测空 catch 块"""

    def __init__(self):
        self._empty_catch = re.compile(r'catch\s*\([^)]*\)\s*{\s*}')

    @property
    def id(self) -> str:
        return "cpp.exception.swallowed"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Empty catch block swallows exceptions"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        if self._empty_catch.search(raw_diff):
            return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


class CppNoexceptRule(BaseRule):
    """检测异常规范问题"""

    def __init__(self):
        self._noexcept_violation = re.compile(r'throw\s*\(')

    @property
    def id(self) -> str:
        return "cpp.exception.noexcept"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Empty throw in noexcept function"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        if self._noexcept_violation.search(raw_diff):
            return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Null Safety Rules ====================

class CppNullPointerRule(BaseRule):
    """检测空指针解引用"""

    def __init__(self):
        self._null_check = [
            re.compile(r'if\s*\(\s*!\s*\w+\s*\)'),
            re.compile(r'if\s*\(\s*\w+\s*==\s*nullptr\s*\)'),
            re.compile(r'if\s*\(\s*\w+\s*!=\s*nullptr\s*\)'),
        ]
        self._dereference = re.compile(r'->\w+|\*\w+')

    @property
    def id(self) -> str:
        return "cpp.null.dereference"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Potential null pointer dereference"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        lines = raw_diff.split('\n')

        for i, line in enumerate(lines):
            if line.startswith('+') and self._dereference.search(line):
                context = '\n'.join(lines[max(0, i-3):i+3])
                has_check = any(p.search(context) for p in self._null_check)
                if not has_check:
                    return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


# ==================== Performance Rules ====================

class CppInefficientCopyRule(BaseRule):
    """检测低效拷贝"""

    def __init__(self):
        self._copy_patterns = [
            re.compile(r'for\s*\(\s*.*\s*:\s*.*\s*\)\s*{\s*.*\.push_back'),
            re.compile(r'\.assign\s*\('),
        ]

    @property
    def id(self) -> str:
        return "cpp.performance.inefficient_copy"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "performance"

    @property
    def rationale(self) -> str:
        return "Inefficient copy operation - consider using algorithms"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._copy_patterns:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


class CppUnboundedVectorRule(BaseRule):
    """检测无界限的 vector 使用"""

    def __init__(self):
        self._unbounded = re.compile(r'push_back|emplace_back')

    @property
    def id(self) -> str:
        return "cpp.performance.unbounded_vector"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "performance"

    @property
    def rationale(self) -> str:
        return "Unbounded vector growth - consider reserve() for known size"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        if self._unbounded.search(raw_diff):
            return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Best Practices ====================

class CppMagicNumberRule(BaseRule):
    """检测魔数"""

    def __init__(self):
        self._magic_number = re.compile(r'(?<!\w)\d{3,}(?!\w)')

    @property
    def id(self) -> str:
        return "cpp.maintenance.magic_number"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Magic number detected - use named constant"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        added_lines = [l for l in raw_diff.split('\n') if l.startswith('+')]

        for line in added_lines:
            if self._magic_number.search(line):
                return {"file": diff_data.get('files', ['unknown'])[0]}

        return None


class CppUnusedVariableRule(BaseRule):
    """检测未使用变量"""

    def __init__(self):
        self._unused = re.compile(r'\[\[maybe_unused\]\]|__attribute__\s*\(\s*\(\s*unused\s*\)\)')

    @property
    def id(self) -> str:
        return "cpp.maintenance.unused_variable"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Unused variable should be removed or marked"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        # This is typically a compiler warning, not a runtime issue
        return None


# ==================== Integer Safety ====================

class CppIntegerOverflowRule(BaseRule):
    """检测整数溢出"""

    def __init__(self):
        self._overflow_risks = [
            re.compile(r'\+\+\s*\w+.*\+\+'),
            re.compile(r'\+\s*\d+\s*\*\s*\d+'),
            re.compile(r'INT_MAX|INT_MIN'),
        ]

    @property
    def id(self) -> str:
        return "cpp.security.integer_overflow"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Potential integer overflow - validate bounds"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        for pattern in self._overflow_risks:
            if pattern.search(raw_diff):
                return {"file": diff_data.get('files', ['unknown'])[0]}
        return None


# ==================== Template Safety ====================

class CppTemplateTypeDeductionRule(BaseRule):
    """检测模板类型推导问题"""

    def __init__(self):
        self._auto_usage = re.compile(r'\bauto\s+\w+\s*=')

    @property
    def id(self) -> str:
        return "cpp.maintenance.template_type"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Auto type deduction - ensure intended type"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        # Auto is generally fine, this is informational
        return None


# ==================== Uninitialized Variables ====================

class CppUninitializedRule(BaseRule):
    """检测未初始化变量"""

    def __init__(self):
        self._uninit = re.compile(r'int\s+\w+\s*;|float\s+\w+\s*;|double\s+\w+\s*;')

    @property
    def id(self) -> str:
        return "cpp.runtime.uninitialized"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Uninitialized variable - initialize before use"

    @property
    def language(self) -> str:
        return "cpp"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        added_lines = [l for l in raw_diff.split('\n') if l.startswith('+')]

        for line in added_lines:
            if self._uninit.search(line) and '=' not in line:
                return {"file": diff_data.get('files', ['unknown'])[0]}

        return None