import re
from typing import Dict, Any, List, Optional
from sdk.rule import BaseRule
from sdk.signal import Signal


class NullReturnIgnoredRule(BaseRule):
    """检测可能返回 null 的方法调用未进行空值检查 - 降低误报，只在高风险场景触发"""

    def __init__(self):
        # 只检查真正危险的方法调用（来自 Map/Collection 的 get）
        self._null_return_methods = [
            r'\.get\s*\([^)]+\)',     # Map.get(key) - 有参数的
        ]
        self._added_call = re.compile(r'^\+.*(' + '|'.join(self._null_return_methods) + r')')
        # 扩展 null 检查模式
        self._null_check = re.compile(
            r'(?:if\s*\([^)]*(?:==|!=|isNull|nonNull|Objects\.|Optional)|Optional\.|orElse|orElseGet)',
            re.IGNORECASE
        )

    @property
    def id(self) -> str:
        return "null.return_ignored"

    @property
    def severity(self) -> str:
        # 降级为 LOW，因为 .get() 调用后不检查 null 是非常常见的模式
        return "low"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Map.get() without null check may cause NPE"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")

        added_lines = raw_diff.split('\n')
        for i, line in enumerate(added_lines):
            if line.startswith('+') and self._added_call.search(line):
                # 只在没有 orElse/orElseGet 等安全写法时触发
                if not self._null_check.search(line):
                    # 额外检查：只对关键路径触发
                    files = diff_data.get('files', [])
                    return {"file": files[0] if files else "unknown", "method": line.strip()}

        return None


class OptionalUnwrapRule(BaseRule):
    """检测 Optional 未正确解包 - 排除安全的 orElse 用法"""

    def __init__(self):
        self._dangerous_get = re.compile(
            r'^\+.*(?<!\.)\.get\s*\(\s*\)',  # Optional.get() without check
            re.MULTILINE
        )
        # 扩展安全模式：包含 orElseGet
        self._optional_safe = re.compile(
            r'\.orElse(?:\w+)?\s*\(|',
            re.MULTILINE
        )

    @property
    def id(self) -> str:
        return "null.optional_unsafe_get"

    @property
    def severity(self) -> str:
        # 降级为 LOW，因为 Optional.get() 在很多场景是合理的
        return "low"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Optional.get() without isPresent() check - ensure null is handled"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")

        # 查找所有 .get() 调用
        import re as re_module
        get_matches = re.findall(r'[^\n]*\.get\s*\(\s*\)[^\n]*', raw_diff)

        for match in get_matches:
            # 跳过已经使用 orElse/orElseGet 的代码
            if self._optional_safe.search(match):
                continue

            # 跳过注释
            if '//' in match or '/*' in match:
                continue

            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}

        return None
        
        dangerous = self._dangerous_get.findall(raw_diff)
        if dangerous:
            # 检查是否有 orElse 等安全用法
            if not self._optional_or_else.search(raw_diff):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown"}
        
        return None


class AutoboxingNPERule(BaseRule):
    """检测自动拆箱可能导致的 NPE"""
    
    def __init__(self):
        self._wrapper_types = ['Integer', 'Long', 'Double', 'Float', 'Boolean', 'Character', 'Short', 'Byte']
        self._unbox_pattern = re.compile(
            r'^\+.*(?:' + '|'.join(self._wrapper_types) + r')\s*\w+\s*=\s*(?!new\s+(?:' + '|'.join(self._wrapper_types) + r'))'
        )
        self._method_return_wrapper = re.compile(
            r'^\+.*\.(?:get|getValue|getOrDefault)\s*\([^)]*\)\s*(?:[+\-*/]|compareTo)',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "null.autoboxing_npe"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Wrapper type auto-unboxed to primitive, NPE if null"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._unbox_pattern.search(raw_diff) or self._method_return_wrapper.search(raw_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}
        
        return None


class ChainedMethodCallNPERule(BaseRule):
    """检测链式调用的 NPE 风险 - 仅在高风险场景触发"""

    def __init__(self):
        # 更严格的链式调用模式：必须是方法调用链，不能是简单的属性访问
        self._chained_call = re.compile(
            r'^\+.*\w+\s*\.\s*\w+\s*\([^)]*\)\s*\.\s*\w+\s*\(',
            re.MULTILINE
        )
        self._null_safe = re.compile(
            r'(?:Objects\.(?:requireNonNull|firstNonNull)|Optional\.ofNullable|\.map\s*\(|\?\.)',
            re.IGNORECASE
        )
        # 高风险场景：DTO/Entity/Model 的 getter 链式调用
        self._high_risk_patterns = [
            r'/dto/',
            r'/entity/',
            r'/model/',
            r'/vo/',
            r'/bo/',
            r'/domain/'
        ]

    @property
    def id(self) -> str:
        return "null.chained_call_unsafe"

    @property
    def severity(self) -> str:
        # 降级为 LOW，因为大多数业务代码的链式调用是安全的
        return "low"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Chained method calls in DTO/Entity without null safety"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        files = diff_data.get('files', [])

        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
        for line in added_lines:
            if self._chained_call.search(line):
                if not self._null_safe.search(line):
                    # 只在 DTO/Entity/Model 相关的文件中触发
                    for f in files:
                        if any(re.search(p, f, re.IGNORECASE) for p in self._high_risk_patterns):
                            return {"file": f, "chain": line.strip()}

        return None


class ArrayIndexOutOfBoundsRule(BaseRule):
    """检测数组/集合索引越界风险"""
    
    def __init__(self):
        self._direct_access = re.compile(
            r'^\+.*\w+\s*\[\s*(?:0|[1-9]\d*)\s*\]',
            re.MULTILINE
        )
        self._size_dependent = re.compile(
            r'^\+.*\w+\s*\[\s*\w+\.(?:size|length)\s*[-+]\s*[1-9]',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "null.array_index_unsafe"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Direct array access with hardcoded index or size-based calculation, bounds not checked"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._size_dependent.search(raw_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}
        
        return None


class StringConcatNPERule(BaseRule):
    """检测字符串拼接的 NPE 风险 - 关闭，因为太容易误报"""

    def __init__(self):
        # 禁用此规则：字符串拼接 "str" + var 是非常常见的模式
        # 即使 var 可能为 null，Java 也不会抛 NPE，而是输出 "null" 字符串
        pass

    @property
    def id(self) -> str:
        return "null.string_concat_unsafe"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        # 修改为更准确的描述
        return "Disabled: Java string concatenation handles null gracefully"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        # 禁用规则：总是返回 None
        return None
