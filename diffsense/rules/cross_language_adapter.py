"""
跨语言规则兼容层原型

这个模块展示了如何通过兼容层将 Java 规则的逻辑复用到 Go 语言。
核心思想：提取规则的"语义模式"，而非"语法模式"。
"""

import re
from typing import Dict, Any, List, Optional, Callable, Set
from sdk.rule import BaseRule
from sdk.signal import Signal


# ============================================================================
# 1. 语言适配层：定义语言特定的模式映射
# ============================================================================

class LanguageAdapter:
    """
    语言适配器：将通用语义模式映射到特定语言的语法模式。
    """
    
    def __init__(self, language: str):
        self.language = language
    
    def get_closeable_types(self) -> List[str]:
        """获取该语言中可关闭的资源类型"""
        mapping = {
            'java': ['InputStream', 'OutputStream', 'Reader', 'Writer', 
                    'Socket', 'Connection', 'Statement', 'ResultSet'],
            'go': ['io.Closer', 'io.ReadCloser', 'io.WriteCloser', 
                  'os.File', 'net.Conn', 'sql.DB', 'sql.Rows'],
            'python': ['IOBase', 'TextIOBase', 'BinaryIO', 'Socket', 'Connection'],
        }
        return mapping.get(self.language, [])
    
    def get_resource_open_pattern(self) -> str:
        """获取资源打开的正则模式"""
        patterns = {
            'java': r'(?:new\s+\w+(?:InputStream|OutputStream|Reader|Writer|Connection)\s*\()',
            'go': r'(?:os\.Open|os\.Create|net\.Dial|sql\.Open|os\.Pipe)\s*\(',
            'python': r'(?:open\s*\(|socket\.socket\(|connect\s*\()',
            'javascript': r'(?:fs\.open\(|fs\.createReadStream\(|new\s+Client\(\)\.connect\()',
            'typescript': r'(?:fs\.open\(|fs\.createReadStream\(|new\s+Client\(\)\.connect\()',
            'cpp': r'(?:new\s+\w+|fopen\s*\(|ifstream\s*\()',
            'c': r'(?:malloc\s*\(|fopen\s*\(|calloc\s*\()',
        }
        return patterns.get(self.language, r'')

    def get_resource_close_pattern(self) -> str:
        """获取资源关闭的正则模式"""
        patterns = {
            'java': r'(?:\.close\(\)|try\s*\([^)]*\.close)',
            'go': r'(?:\.Close\(\)|defer\s+.*\.Close)',
            'python': r'(?:\.close\(\)|with\s+)',
            'javascript': r'(?:\.close\(\)|\.end\(\)|\.destroy\(\))',
            'typescript': r'(?:\.close\(\)|\.end\(\)|\.destroy\(\))',
            'cpp': r'(?:delete\s+|fclose\s*\(|close\s*\()',
            'c': r'(?:free\s*\(|fclose\s*\(|close\s*\()',
        }
        return patterns.get(self.language, r'')

    def get_null_check_pattern(self) -> str:
        """获取空值检查的正则模式"""
        patterns = {
            'java': r'(?:if\s*\([^)]*(?:==|!=)\s*null|Objects\.(?:nonNull|isNull)|Optional)',
            'go': r'(?:if\s+\w+\s*(?:==|!=)\s*nil|if\s+err\s*(?:!=|==)\s*nil)',
            'python': r'(?:if\s+\w+\s+(?:is|is\s+not|==|!=)\s+None)',
            'javascript': r'(?:if\s*\(\s*\w+\s*(?:===|!==|==|!=)\s*(?:null|undefined)|if\s*\(\s*!\w+)',
            'typescript': r'(?:if\s*\(\s*\w+\s*(?:===|!==|==|!=)\s*(?:null|undefined)|if\s*\(\s*!\w+)',
            'cpp': r'(?:if\s*\(\s*\w+\s*(?:==|!=)\s*nullptr|if\s*\(\s*!\w+)',
            'c': r'(?:if\s*\(\s*\w+\s*(?:==|!=)\s*NULL|if\s*\(\s*!\w+)',
        }
        return patterns.get(self.language, r'')

    def get_exception_catch_pattern(self) -> str:
        """获取异常捕获的正则模式"""
        patterns = {
            'java': r'(?:catch\s*\([^)]+\)\s*{)',
            'go': r'(?:if\s+err\s*(?:!=|==)\s*nil)',
            'python': r'(?:except\s+.*:)',
            'javascript': r'(?:catch\s*\([^)]*\)\s*\{)',
            'typescript': r'(?:catch\s*\([^)]*\)\s*\{)',
            'cpp': r'(?:catch\s*\([^)]*\)\s*\{)',
            'c': r'(?:if\s*\([^)]*error[^)]*\)|if\s*\([^)]*errno)',
        }
        return patterns.get(self.language, r'')

    def get_empty_catch_pattern(self) -> str:
        """获取空异常处理的正则模式"""
        patterns = {
            'java': r'(?:catch\s*\([^)]+\)\s*{\s*})',
            'go': r'(?:if\s+err\s*(?:!=|==)\s*nil\s*{\s*})',
            'python': r'(?:except\s+.*:\s*\n\s*pass)',
            'javascript': r'(?:catch\s*\([^)]*\)\s*\{\s*\})',
            'typescript': r'(?:catch\s*\([^)]*\)\s*\{\s*\})',
            'cpp': r'(?:catch\s*\([^)]*\)\s*\{\s*\})',
            'c': r'(?:if\s*\([^)]*error[^)]*\)\s*\{\s*\})',
        }
        return patterns.get(self.language, r'')
    
    def get_null_value(self) -> str:
        """获取该语言的空值关键字"""
        mapping = {
            'java': 'null',
            'go': 'nil',
            'python': 'None',
            'javascript': 'null',
            'typescript': 'null',
            'cpp': 'nullptr',
            'c': 'NULL',
        }
        return mapping.get(self.language, 'null')

    def get_file_extensions(self) -> List[str]:
        """获取该语言的文件扩展名"""
        mapping = {
            'java': ['.java'],
            'go': ['.go'],
            'python': ['.py'],
            'javascript': ['.js', '.jsx', '.mjs', '.cjs'],
            'typescript': ['.ts', '.tsx'],
            'cpp': ['.cpp', '.cc', '.cxx', '.h', '.hpp'],
            'c': ['.c', '.h'],
        }
        return mapping.get(self.language, [])


# ============================================================================
# 2. 通用规则模板：使用适配器的语义规则
# ============================================================================

class GenericResourceLeakRule(BaseRule):
    """
    通用资源泄漏检测规则 - 通过适配器支持多语言
    
    语义模式：
    1. 创建了可关闭资源
    2. 没有在使用后正确关闭
    """
    
    def __init__(self, language: str = '*'):
        self.adapter = LanguageAdapter(language)
        self._language = language
        
        # 使用适配器获取语言特定的模式
        closeable_types = self.adapter.get_closeable_types()
        open_pattern = self.adapter.get_resource_open_pattern()
        close_pattern = self.adapter.get_resource_close_pattern()
        
        self._open_re = re.compile(open_pattern) if open_pattern else None
        self._close_re = re.compile(close_pattern) if close_pattern else None
    
    @property
    def id(self) -> str:
        return "resource.leak_generic"
    
    @property
    def severity(self) -> str:
        return "high"
    
    @property
    def impact(self) -> str:
        return "runtime"
    
    @property
    def rationale(self) -> str:
        return "Resource opened but not properly closed"
    
    @property
    def language(self) -> str:
        return self._language
    
    @property
    def rule_type(self) -> str:
        return "absolute"
    
    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        if not self._open_re:
            return None
        
        raw_diff = diff_data.get('raw_diff', "")
        
        # 检查是否打开了资源
        if self._open_re.search(raw_diff):
            # 检查是否有关闭操作
            if not self._close_re or not self._close_re.search(raw_diff):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown", "language": self._language}
        
        return None


class GenericNullSafetyRule(BaseRule):
    """
    通用空值安全检查规则 - 通过适配器支持多语言
    
    语义模式：
    1. 调用了可能返回空值的方法
    2. 没有进行空值检查就直接使用
    """
    
    def __init__(self, language: str = '*'):
        self.adapter = LanguageAdapter(language)
        self._language = language
        
        # 语言特定的可能返回空值的方法
        null_return_methods = self._get_null_return_methods()
        null_check_pattern = self.adapter.get_null_check_pattern()
        
        self._call_re = re.compile(r'^\+.*(' + '|'.join(null_return_methods) + r')') if null_return_methods else None
        self._null_check_re = re.compile(null_check_pattern) if null_check_pattern else None
    
    def _get_null_return_methods(self) -> List[str]:
        """获取该语言中可能返回空值的方法"""
        mapping = {
            'java': [
                r'\.get\s*\(',           # Map.get()
                r'\.findFirst\s*\(',     # Stream.findFirst()
                r'\.readLine\s*\(',      # BufferedReader.readLine()
            ],
            'go': [
                r'\.Read\s*\(',          # io.Reader
                r'\.Next\s*\(',          # sql.Rows.Next()
                r'map\[.*\]',            # map 访问
            ],
            'python': [
                r'\.get\s*\(',           # dict.get()
                r'\.pop\s*\(',           # dict.pop()
                r'\[.*\]',               # 索引访问
            ],
            'javascript': [
                r'\.get\s*\(',           # Map.get()
                r'\.find\s*\(',         # Array.find()
                r'\.findFirst\s*\(',    # Optional.findFirst()
                r'\[.*\]',               # 索引访问
            ],
            'typescript': [
                r'\.get\s*\(',           # Map.get()
                r'\.find\s*\(',         # Array.find()
                r'\[.*\]',               # 索引访问
            ],
            'cpp': [
                r'->\w+',                # 指针访问
                r'\.at\s*\(',            # std::vector::at()
                r'\[\s*\w+\s*\]',        # 数组索引
            ],
            'c': [
                r'->\w+',                # 结构体指针访问
                r'\[\s*\w+\s*\]',        # 数组索引
            ],
        }
        return mapping.get(self._language, [])
    
    @property
    def id(self) -> str:
        return "null.safety_generic"
    
    @property
    def severity(self) -> str:
        return "high"
    
    @property
    def impact(self) -> str:
        return "runtime"
    
    @property
    def rationale(self) -> str:
        return "Potentially null/nil value used without check"
    
    @property
    def language(self) -> str:
        return self._language
    
    @property
    def rule_type(self) -> str:
        return "absolute"
    
    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        if not self._call_re:
            return None
        
        raw_diff = diff_data.get('raw_diff', "")
        
        added_lines = raw_diff.split('\n')
        for i, line in enumerate(added_lines):
            if line.startswith('+') and self._call_re.search(line):
                # 检查是否有空值检查
                context = '\n'.join(added_lines[max(0, i-3):i+4])
                if not self._null_check_re or not self._null_check_re.search(context):
                    files = diff_data.get('files', [])
                    return {"file": files[0] if files else "unknown", "language": self._language}
        
        return None


class GenericExceptionHandlingRule(BaseRule):
    """
    通用异常处理检查规则 - 通过适配器支持多语言
    
    语义模式：
    1. 捕获了异常/错误
    2. 但没有实际处理（空块或仅注释）
    """
    
    def __init__(self, language: str = '*'):
        self.adapter = LanguageAdapter(language)
        self._language = language
        
        empty_catch_pattern = self.adapter.get_empty_catch_pattern()
        
        self._empty_catch_re = re.compile(empty_catch_pattern) if empty_catch_pattern else None
    
    @property
    def id(self) -> str:
        return "exception.swallowed_generic"
    
    @property
    def severity(self) -> str:
        return "high"
    
    @property
    def impact(self) -> str:
        return "maintenance"
    
    @property
    def rationale(self) -> str:
        return "Exception/error caught but not handled"
    
    @property
    def language(self) -> str:
        return self._language
    
    @property
    def rule_type(self) -> str:
        return "absolute"
    
    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        if not self._empty_catch_re:
            return None
        
        raw_diff = diff_data.get('raw_diff', "")
        
        added_lines = [line for line in raw_diff.split('\n') if line.startswith('+')]
        added_diff = '\n'.join(added_lines)
        
        if self._empty_catch_re.search(added_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown", "language": self._language}
        
        return None


# ============================================================================
# 3. 规则工厂：根据语言自动创建规则实例
# ============================================================================

# 支持的语言列表
SUPPORTED_LANGUAGES = ['java', 'go', 'python', 'javascript', 'typescript', 'cpp', 'c']


class CrossLanguageRuleFactory:
    """
    跨语言规则工厂：根据目标语言创建适当的规则实例。
    """

    @staticmethod
    def create_resource_leak_rule(language: str) -> BaseRule:
        """创建资源泄漏检测规则"""
        return GenericResourceLeakRule(language=language)

    @staticmethod
    def create_null_safety_rule(language: str) -> BaseRule:
        """创建空值安全检查规则"""
        return GenericNullSafetyRule(language=language)

    @staticmethod
    def create_exception_handling_rule(language: str) -> BaseRule:
        """创建异常处理检查规则"""
        return GenericExceptionHandlingRule(language=language)

    @staticmethod
    def create_all_rules_for_language(language: str) -> List[BaseRule]:
        """为指定语言创建所有适用的规则"""
        if language not in SUPPORTED_LANGUAGES:
            return []
        return [
            CrossLanguageRuleFactory.create_resource_leak_rule(language),
            CrossLanguageRuleFactory.create_null_safety_rule(language),
            CrossLanguageRuleFactory.create_exception_handling_rule(language),
        ]

    @staticmethod
    def create_all_rules_for_all_languages() -> Dict[str, List[BaseRule]]:
        """为所有支持的语言创建规则"""
        result = {}
        for language in SUPPORTED_LANGUAGES:
            result[language] = CrossLanguageRuleFactory.create_all_rules_for_language(language)
        return result


# ============================================================================
# 4. 使用示例
# ============================================================================

def example_usage():
    """示例：如何使用跨语言规则"""
    
    # 为 Java 创建规则
    java_rules = CrossLanguageRuleFactory.create_all_rules_for_language('java')
    
    # 为 Go 创建规则
    go_rules = CrossLanguageRuleFactory.create_all_rules_for_language('go')
    
    # 为 Python 创建规则
    python_rules = CrossLanguageRuleFactory.create_all_rules_for_language('python')
    
    # 模拟 diff 数据
    java_diff = {
        'files': ['test.java'],
        'raw_diff': '+ InputStream is = new FileInputStream("test.txt");'
    }
    
    go_diff = {
        'files': ['test.go'],
        'raw_diff': '+ file, _ := os.Open("test.txt")'
    }
    
    # 测试 Java 规则
    for rule in java_rules:
        result = rule.evaluate(java_diff, [])
        if result:
            print(f"Java rule matched: {rule.id} in {result['file']}")
    
    # 测试 Go 规则
    for rule in go_rules:
        result = rule.evaluate(go_diff, [])
        if result:
            print(f"Go rule matched: {rule.id} in {result['file']}")


if __name__ == '__main__':
    example_usage()
