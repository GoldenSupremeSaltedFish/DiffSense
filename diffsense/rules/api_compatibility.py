import re
from typing import Dict, Any, List, Optional
from sdk.rule import BaseRule
from sdk.signal import Signal


class PublicMethodRemovedRule(BaseRule):
    """检测删除公共方法（破坏 API 兼容性）"""
    
    def __init__(self):
        self._removed_method = re.compile(
            r'^-\s*(?:public|protected)\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?\s+)?\w+\s*\([^)]*\)',
            re.MULTILINE
        )
        self._added_deprecated = re.compile(
            r'^\+.*@Deprecated',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "api.public_method_removed"

    @property
    def severity(self) -> str:
        return "critical"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Public method removed, breaks API compatibility for callers"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._removed_method.search(raw_diff):
            # 如果没有添加@Deprecated 作为过渡，则报告
            if not self._added_deprecated.search(raw_diff):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown"}
        
        return None


class MethodSignatureChangedRule(BaseRule):
    """检测方法签名变更（参数类型/数量/返回类型）- 只在真正修改时触发"""

    def __init__(self):
        # 更严格的正则：只匹配参数列表或返回类型的实际变化
        # 排除只是添加 final/static/volatile 等修饰符的情况
        self._signature_change = re.compile(
            r'^[-+]\s*(?:public|protected|private)\s+(?!.*\bfinal\b)(?!.*\bstatic\b)(?!.*\bvolatile\b).*\s+\w+\s*\([^)]*\)',
            re.MULTILINE
        )

    @property
    def id(self) -> str:
        return "api.method_signature_changed"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Method signature changed (param/return type), may break callers"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")

        # 查找有实质性签名变化的方法（排除只改修饰符的情况）
        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
        removed_lines = [line for line in raw_diff.split('\n') if line.startswith('-')]

        for rem in removed_lines:
            # 跳过只有修饰符变化的情况
            if 'final' in rem or 'static' in rem or 'volatile' in rem:
                continue

            # 查找方法名
            rem_match = re.search(r'\s+(\w+)\s*\(', rem)
            if not rem_match:
                continue

            method_name = rem_match.group(1)
            # 检查参数列表是否有变化
            rem_params = re.search(r'\(([^)]*)\)', rem)
            if not rem_params:
                continue

            # 查找对应的添加行
            for add in added_lines:
                if method_name in add:
                    add_params = re.search(r'\(([^)]*)\)', add)
                    if add_params and rem_params.group(1) != add_params.group(1):
                        # 参数列表确实变化了
                        files = diff_data.get('files', [])
                        return {"file": files[0] if files else "unknown", "method": method_name}

        return None


class FieldRemovedRule(BaseRule):
    """检测删除公共字段 - 只在真正删除字段时触发"""

    def __init__(self):
        # 更严格的正则：确保是删除字段，而不是修改修饰符
        self._removed_field = re.compile(
            r'^-\s*(?:public|protected)\s+(?!.*\bfinal\b)(?!.*\bstatic\b).*\s+\w+\s+\w+\s*;',
            re.MULTILINE
        )

    @property
    def id(self) -> str:
        return "api.public_field_removed"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Public field removed, breaks direct field access"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")

        if self._removed_field.search(raw_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}

        return None


class ConstructorRemovedRule(BaseRule):
    """检测删除构造函数"""
    
    def __init__(self):
        self._removed_ctor = re.compile(
            r'^-\s*(?:public|protected)\s+\w+\s*\([^)]*\)',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "api.constructor_removed"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Constructor removed, breaks instantiation code"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._removed_ctor.search(raw_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}
        
        return None


class InterfaceChangedRule(BaseRule):
    """检测接口变更（添加/删除方法）"""
    
    def __init__(self):
        self._interface_decl = re.compile(
            r'(?:public\s+)?(?:abstract\s+)?(?:interface|@interface)\s+\w+',
            re.MULTILINE
        )
        self._method_in_interface = re.compile(
            r'^[-+]\s*(?:public\s+)?(?:abstract\s+)?\w+\s+\w+\s*\([^)]*\)',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "api.interface_changed"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Interface method added/removed, all implementations must be updated"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        # 检查是否是接口文件
        files = diff_data.get('files', [])
        if files and any('.java' in f for f in files):
            if self._method_in_interface.search(raw_diff):
                return {"file": files[0], "change": "interface_method"}
        
        return None


class AnnotationRemovedRule(BaseRule):
    """检测删除重要注解"""
    
    def __init__(self):
        self._important_annotations = [
            '@Override', '@Deprecated', '@Nullable', '@Nonnull', '@NotNull',
            '@Transactional', '@Cacheable', '@Async', '@Scheduled'
        ]
        self._removed_annotation = re.compile(
            r'^-\s*@(?:' + '|'.join([ann.replace('@', '') for ann in self._important_annotations]) + r')',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "api.important_annotation_removed"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Important annotation removed, may change behavior"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._removed_annotation.search(raw_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}
        
        return None


class DeprecatedApiAddedRule(BaseRule):
    """检测添加@Deprecated 注解（需要关注迁移）"""
    
    def __init__(self):
        self._added_deprecated = re.compile(
            r'^\+\s*@Deprecated(?:\([^)]*\))?',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "api.deprecated_added"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "API marked as deprecated, users need migration plan"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._added_deprecated.search(raw_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}
        
        return None


class SerialVersionUIDChangedRule(BaseRule):
    """检测 SerialVersionUID 变更（破坏序列化兼容性）"""
    
    def __init__(self):
        self._serial_change = re.compile(
            r'^[-+].*serialVersionUID\s*=',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "api.serialversionuid_changed"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "serialVersionUID changed, breaks deserialization of previously serialized objects"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._serial_change.search(raw_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}
        
        return None
