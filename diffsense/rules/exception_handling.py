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
    """检测捕获过于宽泛的异常（Exception/Throwable）"""
    
    def __init__(self):
        self._generic_catch = re.compile(
            r'catch\s*\(\s*(?:Exception|Throwable|RuntimeException)\s+\w+\s*\)',
            re.IGNORECASE
        )
        
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
        return "Catching generic Exception/Throwable, should catch specific exceptions"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
        for line in added_lines:
            if self._generic_catch.search(line):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown", "exception_type": line.strip()}
        
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
    """检测异常未记录日志"""
    
    def __init__(self):
        self._catch_with_log = re.compile(
            r'catch\s*\([^)]+\)\s*{\s*(?:logger|log|LOG)\.(?:error|warn|debug|info)\s*\([^)]*e(?:x)?[^)]*\)',
            re.IGNORECASE
        )
        self._catch_block = re.compile(
            r'catch\s*\([^)]+\)\s*{[^}]*}',
            re.DOTALL
        )
        
    @property
    def id(self) -> str:
        return "exception.not_logged"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Exception caught but not logged, makes debugging difficult"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
        added_diff = '\n'.join(added_lines)
        
        # 查找有 catch 块但没有日志记录
        catch_blocks = self._catch_block.findall(added_diff)
        for block in catch_blocks:
            if not self._catch_with_log.search(block):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown"}
        
        return None
