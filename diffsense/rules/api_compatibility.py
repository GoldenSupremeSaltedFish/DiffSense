import re
from typing import Dict, Any, List, Optional
from sdk.rule import BaseRule
from sdk.signal import Signal


class PublicMethodRemovedRule(BaseRule):
    """检测删除公共方法 - 排除测试文件"""

    def __init__(self):
        # 只匹配非测试文件中的方法删除
        self._removed_method = re.compile(
            r'^-\s*(?:public|protected)\s+(?!.*test)(?!.*Test)\s*(?:static\s+)?(?:\w+(?:<[^>]+>)?\s+)?\w+\s*\([^)]*\)',
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
        return "Public method removed from production code, breaks API compatibility"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        files = diff_data.get('files', [])

        if self._removed_method.search(raw_diff):
            # 如果没有添加@Deprecated 作为过渡，则报告
            if not self._added_deprecated.search(raw_diff):
                return {"file": files[0] if files else "unknown"}

        return None


class MethodSignatureChangedRule(BaseRule):
    """检测方法签名变更 - 只在真正破坏 API 兼容性时触发"""

    def __init__(self):
        pass

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
        return "Method signature changed in production code"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        files = diff_data.get('files', [])

        # 只检测真正的签名变化：同一方法名，参数数量或类型不同
        # 使用更严格的检测：必须有完整的参数列表变化
        import re as re_module

        # 查找同时有删除和添加的同一方法
        removed_methods = re_module.findall(
            r'^-\s*(?:public|protected)\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?\s+)+(\w+)\s*\(([^)]*)\)',
            raw_diff,
            re_module.MULTILINE
        )

        added_methods = re_module.findall(
            r'^\+\s*(?:public|protected)\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?\s+)+(\w+)\s*\(([^)]*)\)',
            raw_diff,
            re.MULTILINE
        )

        for rem_name, rem_params in removed_methods:
            for add_name, add_params in added_methods:
                if rem_name == add_name and rem_params != add_params:
                    return {"file": files[0] if files else "unknown", "method": rem_name}

        return None


class FieldRemovedRule(BaseRule):
    """检测删除公共字段 - 只在真正删除字段时触发"""

    def __init__(self):
        # 更严格的正则：确保是删除字段，而不是修改修饰符
        self._removed_field = re.compile(
            r'^-\s*(?:public|protected)\s+(?!.*\bfinal\b)(?!.*\bstatic\b).*\s+\w+\s+\w+\s*;',
            re.MULTILINE
        )


class FieldRemovedRule(BaseRule):
    """检测删除公共字段 - 只在真正删除字段时触发"""

    def __init__(self):
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
    """检测接口变更 - 只在真正的接口文件中检测"""

    def __init__(self):
        self._interface_decl = re.compile(
            r'^\s*(?:public\s+)?(?:abstract\s+)?(?:interface|@interface)\s+\w+',
            re.MULTILINE
        )
        # 更严格的正则：只匹配方法声明，不匹配普通类的方法
        self._method_decl = re.compile(
            r'^\s*(?:public\s+)?(?:abstract\s+)?[\w<>,\s]+\s+\w+\s*\([^)]*\)\s*(?:;|default|{)?',
            re.MULTILINE
        )

    @property
    def id(self) -> str:
        return "api.interface_changed"

    @property
    def severity(self) -> str:
        # 降级为 medium，因为接口变更不总是破坏性的
        return "medium"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Interface method added/removed in interface file"

    @property
    def rule_type(self) -> str:
        return "regression"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        files = diff_data.get('files', [])

        # 关键：只检测接口文件
        is_interface_file = False
        for line in raw_diff.split('\n'):
            # 检查 diff 中是否包含 interface 声明
            if 'interface ' in line.lower() or '@interface' in line.lower():
                is_interface_file = True
                break

        if not is_interface_file:
            return None

        # 只在接口文件中检测方法变更
        if self._method_decl.search(raw_diff):
            return {"file": files[0] if files else "unknown", "change": "interface_method"}

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
