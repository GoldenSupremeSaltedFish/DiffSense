"""
Go Language Rules for DiffSense

These rules are Go-specific implementations following the same patterns
as the Java rules but adapted for Go language constructs.
"""

import re
from typing import Dict, Any, List, Optional
from sdk.rule import BaseRule
from sdk.signal import Signal


class GoGoroutineLeakRule(BaseRule):
    """检测 goroutine 泄漏风险（未正确退出的 goroutine）"""
    
    def __init__(self):
        self._goroutine_pattern = re.compile(r'^\+.*\bgo\s+\w+\.?\w*\s*\(')
        self._context_pattern = re.compile(r'(?:context\.Context|ctx|done\s*chan)')
        self._select_pattern = re.compile(r'\bselect\s*{')
        self._defer_pattern = re.compile(r'\bdefer\s+')
        
    @property
    def id(self) -> str:
        return "resource.goroutine_leak"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Goroutine started without proper exit mechanism (context, channel, or defer)"

    @property
    def language(self) -> str:
        return "go"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        # 检查是否创建了 goroutine
        if self._goroutine_pattern.search(raw_diff):
            added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
            
            for line in added_lines:
                if self._goroutine_pattern.search(line):
                    # 检查是否有 context 或 channel 用于退出
                    has_context = bool(self._context_pattern.search(line))
                    has_select = any(self._select_pattern.search(l) for l in added_lines)
                    has_defer = any(self._defer_pattern.search(l) for l in added_lines)
                    
                    if not (has_context or has_select or has_defer):
                        files = diff_data.get('files', [])
                        return {"file": files[0] if files else "unknown", "goroutine": line.strip()}
        
        return None


class GoChannelLeakRule(BaseRule):
    """检测 channel 使用问题（未关闭、缓冲通道泄漏等）"""
    
    def __init__(self):
        self._chan_pattern = re.compile(r'^\+.*(?:make\s*\(\s*chan|chan\s+\w+\s*=)')
        self._close_pattern = re.compile(r'\bclose\s*\(')
        self._buffered_chan = re.compile(r'make\s*\(\s*chan\s+\w+\s*,\s*[1-9]\d*\s*\)')
        
    @property
    def id(self) -> str:
        return "resource.channel_leak"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Channel created without close or with large buffer, may cause goroutine hang"

    @property
    def language(self) -> str:
        return "go"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._chan_pattern.search(raw_diff):
            # 检查是否有 close 调用
            if not self._close_pattern.search(raw_diff):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown"}
        
        # 检查大的缓冲通道
        buffered_matches = self._buffered_chan.findall(raw_diff)
        if buffered_matches:
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown", "buffered_channels": buffered_matches}
        
        return None


class GoDeferMisuseRule(BaseRule):
    """检测 defer 误用（循环中 defer、defer 参数问题）"""
    
    def __init__(self):
        self._defer_in_loop = re.compile(r'(?:for\s+|range\s+)\s*{[^}]*defer\s+', re.DOTALL)
        self._defer_pattern = re.compile(r'^\+.*\bdefer\s+')
        self._defer_with_args = re.compile(r'defer\s+\w+\s*\(\s*\w+\s*[+\-*/]')
        
    @property
    def id(self) -> str:
        return "resource.defer_misuse"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Defer used in loop or with evaluated arguments, may cause resource leak"

    @property
    def language(self) -> str:
        return "go"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        # 检查循环中的 defer
        if self._defer_in_loop.search(raw_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown", "issue": "defer_in_loop"}
        
        # 检查 defer 参数立即求值
        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
        for line in added_lines:
            if self._defer_with_args.search(line):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown", "issue": "defer_args_evaluated"}
        
        return None


class GoUnsafeUsageRule(BaseRule):
    """检测 unsafe 包的使用（类型转换、指针运算）"""
    
    def __init__(self):
        self._unsafe_pattern = re.compile(r'^\+.*\bunsafe\.(?:Pointer|Sizeof|Alignof|Offsetof)\s*\(')
        self._type_assertion = re.compile(r'\(\*\w+\)\(unsafe\.Pointer')
        
    @property
    def id(self) -> str:
        return "security.unsafe_usage"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "Unsafe package usage may cause memory safety issues"

    @property
    def language(self) -> str:
        return "go"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._unsafe_pattern.search(raw_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}
        
        return None


class GoErrorHandlingRule(BaseRule):
    """检测错误处理不当（忽略 error 返回值）"""
    
    def __init__(self):
        self._ignore_error = re.compile(r'_\s*=\s*\w+\s*\([^)]*\)')
        self._error_return = re.compile(r'\w+\s*,\s*err\s*:=')
        self._no_error_check = re.compile(r'if\s+err\s*(?:!=|==)\s*nil')
        
    @property
    def id(self) -> str:
        return "exception.error_ignored"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Error return value ignored, may hide failures"

    @property
    def language(self) -> str:
        return "go"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
        for line in added_lines:
            # 检查忽略错误
            if self._ignore_error.search(line):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown", "issue": "error_ignored"}
            
            # 检查有 error 返回但未检查
            if self._error_return.search(line):
                # 在后续几行查找错误检查
                context = '\n'.join(added_lines[added_lines.index(line):added_lines.index(line)+5])
                if not self._no_error_check.search(context):
                    files = diff_data.get('files', [])
                    return {"file": files[0] if files else "unknown", "issue": "error_not_checked"}
        
        return None


class GoNilPointerRule(BaseRule):
    """检测 nil 指针解引用风险"""
    
    def __init__(self):
        self._method_call = re.compile(r'^\+.*\w+\s*\.\s*\w+\s*\(')
        self._nil_check = re.compile(r'(?:if\s+\w+\s*==\s*nil|if\s+\w+\s*!=\s*nil|\w+\s*==\s*nil\s*\?|nil\s*check)')
        
    @property
    def id(self) -> str:
        return "null.nil_dereference"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Method call on potentially nil pointer without nil check"

    @property
    def language(self) -> str:
        return "go"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        added_lines = raw_diff.split('\n')
        for i, line in enumerate(added_lines):
            if line.startswith('+') and self._method_call.search(line):
                # 检查前后是否有 nil 检查
                context = '\n'.join(added_lines[max(0,i-3):i+4])
                if not self._nil_check.search(context):
                    files = diff_data.get('files', [])
                    return {"file": files[0] if files else "unknown", "call": line.strip()}
        
        return None


class GoRaceConditionRule(BaseRule):
    """检测竞态条件风险（共享变量无锁保护）"""
    
    def __init__(self):
        self._shared_var = re.compile(r'^\+.*(?:var\s+\w+\s+|:=\s*\w+\s*=).*(?:map|slice|chan)')
        self._mutex_pattern = re.compile(r'(?:sync\.(?:Mutex|RWMutex)|\.Lock\(\)|\.Unlock\(\))')
        self._atomic_pattern = re.compile(r'atomic\.(?:Load|Store|Add|Swap|CompareAndSwap)')
        
    @property
    def id(self) -> str:
        return "runtime.race_condition"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Shared variable access without synchronization, potential race condition"

    @property
    def language(self) -> str:
        return "go"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._shared_var.search(raw_diff):
            # 检查是否有同步机制
            has_mutex = bool(self._mutex_pattern.search(raw_diff))
            has_atomic = bool(self._atomic_pattern.search(raw_diff))
            
            if not (has_mutex or has_atomic):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown"}
        
        return None


class GoHTTPSecurityRule(BaseRule):
    """检测 HTTP 安全问题（路径遍历、未验证输入等）"""
    
    def __init__(self):
        self._http_pattern = re.compile(r'^\+.*http\.(?:Get|Post|HandleFunc|Handle)\s*\(')
        self._path_traversal = re.compile(r'http\.(?:Get|Post)\s*\([^)]*\+[^)]*\)')
        self._no_auth = re.compile(r'http\.ListenAndServe\s*\(\s*"[^"]*"', re.IGNORECASE)
        
    @property
    def id(self) -> str:
        return "security.http_vulnerability"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "security"

    @property
    def rationale(self) -> str:
        return "HTTP handler with potential security issues (path traversal, no auth)"

    @property
    def language(self) -> str:
        return "go"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._http_pattern.search(raw_diff):
            # 检查路径遍历风险
            if self._path_traversal.search(raw_diff):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown", "issue": "path_traversal"}
            
            # 检查无认证的 HTTP 服务
            if self._no_auth.search(raw_diff):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown", "issue": "no_authentication"}
        
        return None
