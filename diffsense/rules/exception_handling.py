import re
from typing import Dict, Any, List, Optional
from sdk.rule import BaseRule
from sdk.signal import Signal


class SwallowedExceptionRule(BaseRule):
    """检测捕获异常但未处理（空 catch 块）"""
    
    def __init__(self):
        self._empty_catch = re.compile(
            r'}\s*catch\s*\([^)]+\)\s*{',
            re.MULTILINE
        )
        self._empty_catch_body = re.compile(
            r'catch\s*\([^)]+\)\s*{\s*}',
            re.MULTILINE
        )
        self._only_comment = re.compile(
            r'catch\s*\([^)]+\)\s*{\s*//.*\s*}',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "exception.swallowed"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Exception caught but not handled (empty catch block), may hide errors"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        # 查找新增的空 catch 块
        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
        added_diff = '\n'.join(added_lines)
        
        if self._empty_catch_body.search(added_diff) or self._only_comment.search(added_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}
        
        return None


class GenericExceptionRule(BaseRule):
    """检测捕获过于宽泛的异常（Exception/Throwable）- 仅在关键代码路径"""

    def __init__(self):
        self._generic_catch = re.compile(
            r'catch\s*\(\s*(?:Exception|Throwable|RuntimeException)\s+\w+\s*\)',
            re.IGNORECASE
        )
        # 关键代码路径模式：controller、service、business logic
        self._critical_paths = [
            r'/controller/',
            r'/service/',
            r'/biz/',
            r'/business/',
            r'/api/',
            r'/handler/'
        ]

    @property
    def id(self) -> str:
        return "exception.too_generic"

    @property
    def severity(self) -> str:
        # 降级为 LOW，因为捕获泛化异常是常见模式
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Catching generic Exception/Throwable in critical path, consider catching specific exceptions"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        files = diff_data.get('files', [])

        # 只在关键路径的修改中检测
        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]

        for line in added_lines:
            if self._generic_catch.search(line):
                # 检查文件路径是否是关键路径
                for f in files:
                    if any(re.search(p, f, re.IGNORECASE) for p in self._critical_paths):
                        return {"file": f, "exception_type": line.strip()}

        return None


class ThrowRuntimeExceptionRule(BaseRule):
    """检测抛出 RuntimeException 而非业务异常"""
    
    def __init__(self):
        self._runtime_exceptions = [
            'RuntimeException', 'IllegalStateException', 'NullPointerException',
            'IllegalArgumentException', 'IndexOutOfBoundsException'
        ]
        self._throw_pattern = re.compile(
            r'^\+.*throw\s+new\s+(?:' + '|'.join(self._runtime_exceptions) + r')\s*\('
        )
        
    @property
    def id(self) -> str:
        return "exception.runtime_throw"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Throwing RuntimeException, consider using domain-specific exceptions"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        matches = self._throw_pattern.findall(raw_diff)
        if matches:
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown", "exceptions": matches}
        
        return None


class ThrowsClauseRemovedRule(BaseRule):
    """检测移除 throws 声明（可能破坏 API 兼容性）"""
    
    def __init__(self):
        self._removed_throws = re.compile(
            r'^-.*throws\s+\w+',
            re.MULTILINE
        )
        self._added_method = re.compile(
            r'^\+.*(?:public|private|protected)\s+.*\w+\s*\([^)]*\)\s*(?:throws)?\s*[{;]',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "exception.throws_removed"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Throws clause removed, may break caller's exception handling"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._removed_throws.search(raw_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}
        
        return None


class FinallyBlockMissingRule(BaseRule):
    """检测资源操作后缺少 finally 块"""
    
    def __init__(self):
        self._resource_ops = [
            r'\.open\s*\(',
            r'\.create\s*\(',
            r'\.connect\s*\(',
            r'\.acquire\s*\(',
            r'\.lock\s*\('
        ]
        self._added_op = re.compile(r'^\+.*(' + '|'.join(self._resource_ops) + r')')
        self._has_finally = re.compile(r'finally\s*{', re.IGNORECASE)
        
    @property
    def id(self) -> str:
        return "exception.finally_missing"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Resource operation without finally block for cleanup"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        added_lines = raw_diff.split('\n')
        for i, line in enumerate(added_lines):
            if line.startswith('+') and self._added_op.search(line):
                # 检查后续是否有 finally
                remaining = '\n'.join(added_lines[i:])
                if not self._has_finally.search(remaining):
                    files = diff_data.get('files', [])
                    return {"file": files[0] if files else "unknown", "operation": line.strip()}
        
        return None


class ExceptionLoggingRule(BaseRule):
    """检测异常未记录日志 - 仅在异常被吞掉（无日志也无重抛）时触发"""

    def __init__(self):
        self._catch_with_log = re.compile(
            r'catch\s*\([^)]+\)\s*{\s*(?:logger|log|LOG)\.(?:error|warn|debug|info|warn|error)\s*\(',
            re.IGNORECASE
        )
        self._catch_with_throw = re.compile(
            r'catch\s*\([^)]+\)\s*{[^}]*throw',
            re.DOTALL
        )
        self._catch_with_return = re.compile(
            r'catch\s*\([^)]+\)\s*{[^}]*return',
            re.DOTALL
        )
        # 关键代码路径
        self._critical_paths = [
            r'/controller/',
            r'/service/',
            r'/biz/',
            r'/business/',
            r'/api/',
            r'/handler/'
        ]

    @property
    def id(self) -> str:
        return "exception.not_logged"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Exception silently caught without logging in critical path"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        files = diff_data.get('files', [])

        # 提取新增的 catch 块
        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
        added_diff = '\n'.join(added_lines)

        # 查找所有 catch 块（简化版：只检查行内）
        import re as re_module
        catch_lines = [line for line in added_lines if 'catch' in line and '(' in line and ')' in line]

        for line in catch_lines:
            has_log = self._catch_with_log.search(line)
            has_throw = 'throw' in line
            has_return = 'return' in line

            # 如果 catch 块中没有日志，也没有 throw/return，才触发
            # 这意味着异常被完全吞掉了
            if not has_log and not has_throw and not has_return:
                # 只在关键路径触发
                for f in files:
                    if any(re.search(p, f, re.IGNORECASE) for p in self._critical_paths):
                        return {"file": f}

        return None
