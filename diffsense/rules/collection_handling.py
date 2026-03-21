import re
from typing import Dict, Any, List, Optional
from sdk.rule import BaseRule
from sdk.signal import Signal


class RawTypeUsageRule(BaseRule):
    """检测使用集合原始类型（未指定泛型）"""
    
    def __init__(self):
        self._collection_types = [
            'List', 'Set', 'Map', 'Collection', 'ArrayList', 'HashSet', 
            'HashMap', 'TreeSet', 'TreeMap', 'LinkedList', 'LinkedHashMap'
        ]
        self._raw_type = re.compile(
            r'^\+.*(?:' + '|'.join(self._collection_types) + r')\s+\w+\s*=\s*new\s+(?:' + '|'.join(self._collection_types) + r')\s*<\s*>'
        )
        self._with_generic = re.compile(
            r'<\s*\w+',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "collection.raw_type"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Collection declared with raw type, loses type safety"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
        for line in added_lines:
            if self._raw_type.search(line):
                # 检查右边是否有泛型
                if not self._with_generic.search(line.split('=')[1] if '=' in line else line):
                    files = diff_data.get('files', [])
                    return {"file": files[0] if files else "unknown", "declaration": line.strip()}
        
        return None


class UnmodifiableCollectionRule(BaseRule):
    """检测返回可变集合（应返回不可变视图）"""
    
    def __init__(self):
        self._return_mutable = re.compile(
            r'^\+.*return\s+(?:this\.|m_)?(?:list|map|set|collection)\w*\s*;',
            re.IGNORECASE | re.MULTILINE
        )
        self._unmodifiable = re.compile(
            r'Collections\.(?:unmodifiable|singleton)|List\.of|Map\.of|Set\.of|Collections\.empty',
            re.IGNORECASE
        )
        
    @property
    def id(self) -> str:
        return "collection.mutable_return"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Returning mutable collection, caller can modify internal state"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
        for line in added_lines:
            if self._return_mutable.search(line):
                if not self._unmodifiable.search(line):
                    files = diff_data.get('files', [])
                    return {"file": files[0] if files else "unknown", "return": line.strip()}
        
        return None


class ConcurrentModificationRule(BaseRule):
    """检测在遍历时修改集合的风险"""
    
    def __init__(self):
        self._foreach_loop = re.compile(
            r'for\s*\(\s*\w+\s+\w+\s*:\s*\w+\s*\)',
            re.MULTILINE
        )
        self._remove_call = re.compile(
            r'\.remove\s*\(',
            re.MULTILINE
        )
        self._iterator_remove = re.compile(
            r'\w+Iterator\.remove\s*\(\)',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "collection.concurrent_modification"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Collection modified during foreach iteration, may throw ConcurrentModificationException"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        added_lines = raw_diff.split('\n')
        in_foreach = False
        foreach_start = -1
        
        for i, line in enumerate(added_lines):
            if line.startswith('+') and self._foreach_loop.search(line):
                in_foreach = True
                foreach_start = i
            elif in_foreach and line.startswith('+'):
                if self._remove_call.search(line) and not self._iterator_remove.search(line):
                    files = diff_data.get('files', [])
                    return {"file": files[0] if files else "unknown", "loop_line": foreach_start}
                # 检查是否还在 foreach 块内（简化处理）
                if line.strip().startswith('}'):
                    in_foreach = False
        
        return None


class MapComputeRule(BaseRule):
    """检测 Map 操作可以简化为 compute 方法"""
    
    def __init__(self):
        self._contains_put = re.compile(
            r'if\s*\(\s*!?map\.containsKey\s*\([^)]+\)\s*\)',
            re.MULTILINE
        )
        self._put_inside = re.compile(
            r'\.put\s*\([^)]+\)',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "collection.map_compute_opportunity"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Map containsKey + put pattern can be replaced with compute/merge"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._contains_put.search(raw_diff) and self._put_inside.search(raw_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}
        
        return None


class StreamCollectorRule(BaseRule):
    """检测 Stream 收集器的不当使用"""
    
    def __init__(self):
        self._to_list = re.compile(
            r'\.collect\s*\(\s*Collectors\.toList\s*\(\s*\)\s*\)',
            re.MULTILINE
        )
        self._to_set = re.compile(
            r'\.collect\s*\(\s*Collectors\.toSet\s*\(\s*\)\s*\)',
            re.MULTILINE
        )
        self._to_map_no_merge = re.compile(
            r'\.collect\s*\(\s*Collectors\.toMap\s*\([^,]+,[^)]+\)\s*\)',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "collection.stream_collector_unsafe"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Stream collector without merge function may throw IllegalStateException on duplicate keys"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
        for line in added_lines:
            if self._to_map_no_merge.search(line):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown", "collector": line.strip()}
        
        return None


class ImmutableCollectionRule(BaseRule):
    """检测使用过时的集合工厂方法"""
    
    def __init__(self):
        self._legacy_factory = re.compile(
            r'^\+.*Collections\.(?:singletonList|singletonSet|singletonMap|emptyList|emptySet|emptyMap)\s*\(',
            re.MULTILINE
        )
        self._modern_factory = re.compile(
            r'(?:List|Set|Map|Collection)\.of\s*\(',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "collection.legacy_factory"

    @property
    def severity(self) -> str:
        return "low"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Using legacy Collections.factory(), prefer List.of()/Set.of()/Map.of() (Java 9+)"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._legacy_factory.search(raw_diff):
            if not self._modern_factory.search(raw_diff):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown"}
        
        return None


class ListResizeRule(BaseRule):
    """检测对不可变列表的修改操作"""
    
    def __init__(self):
        self._as_list = re.compile(
            r'Arrays\.asList\s*\([^)]+\)',
            re.MULTILINE
        )
        self._modifying_op = re.compile(
            r'\.(?:add|remove|clear)\s*\(',
            re.MULTILINE
        )
        
    @property
    def id(self) -> str:
        return "collection.aslist_modify"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Calling add/remove on Arrays.asList() result throws UnsupportedOperationException"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        added_lines = raw_diff.split('\n')
        has_aslist = False
        aslist_var = None
        
        for i, line in enumerate(added_lines):
            if line.startswith('+'):
                match = re.search(r'(\w+)\s*=\s*Arrays\.asList', line)
                if match:
                    has_aslist = True
                    aslist_var = match.group(1)
                elif has_aslist and aslist_var and self._modifying_op.search(line):
                    if aslist_var in line:
                        files = diff_data.get('files', [])
                        return {"file": files[0] if files else "unknown", "operation": line.strip()}
        
        return None
