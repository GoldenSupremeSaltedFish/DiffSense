import re
from typing import Dict, Any, List, Optional
from sdk.rule import BaseRule
from sdk.signal import Signal


class CloseableResourceLeakRule(BaseRule):
    """检测未正确关闭的资源（Stream, Connection 等）"""
    
    def __init__(self):
        self._closeable_types = [
            'InputStream', 'OutputStream', 'Reader', 'Writer',
            'Socket', 'ServerSocket', 'Connection', 'Statement', 
            'ResultSet', 'BufferedReader', 'BufferedWriter'
        ]
        self._added_pattern = re.compile(r'^\+.*\b(new\s+\w+(?:' + '|'.join(self._closeable_types) + r')\s*\()')
        self._try_with_resources = re.compile(r'^\+.*try\s*\([^)]*(?:' + '|'.join(self._closeable_types) + r')')
        self._finally_close = re.compile(r'^\+.*\.close\(\)')
        
    @property
    def id(self) -> str:
        return "resource.closeable_leak"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Closeable resources opened but not closed in try-with-resources or finally block"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        # 检查是否添加了可关闭资源
        added_resources = self._added_pattern.findall(raw_diff)
        if not added_resources:
            return None
        
        # 检查是否有 try-with-resources 或 finally 中关闭
        has_try_resources = bool(self._try_with_resources.search(raw_diff))
        has_finally_close = bool(self._finally_close.search(raw_diff))
        
        # 如果既没有 try-with-resources 也没有 finally close，则报告
        if not has_try_resources and not has_finally_close:
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown", "resources": added_resources}
        
        return None


class DatabaseConnectionLeakRule(BaseRule):
    """检测数据库连接泄漏风险"""
    
    def __init__(self):
        self._conn_patterns = [
            r'DriverManager\.getConnection',
            r'DataSource\.getConnection',
            r'new\s+HikariDataSource',
            r'new\s+BasicDataSource'
        ]
        self._added_conn = re.compile(r'^\+.*(' + '|'.join(self._conn_patterns) + r')')
        self._conn_close = re.compile(r'^\+.*(?:connection|conn)\.close\(\)', re.IGNORECASE)
        
    @property
    def id(self) -> str:
        return "resource.database_connection_leak"

    @property
    def severity(self) -> str:
        return "critical"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "Database connection opened without proper close, may cause connection pool exhaustion"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._added_conn.search(raw_diff):
            if not self._conn_close.search(raw_diff):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown"}
        
        return None


class StreamWrapperRule(BaseRule):
    """检测流包装时未指定编码"""
    
    def __init__(self):
        self._unencoded_patterns = [
            r'new\s+InputStreamReader\s*\(\s*(?!.*Charset|charset|StandardCharsets)',
            r'new\s+OutputStreamWriter\s*\(\s*(?!.*Charset|charset|StandardCharsets)',
            r'new\s+FileReader\s*\(',
            r'new\s+FileWriter\s*\('
        ]
        self._added_stream = re.compile(r'^\+.*(' + '|'.join(self._unencoded_patterns) + r')')
        
    @property
    def id(self) -> str:
        return "resource.stream_encoding_missing"

    @property
    def severity(self) -> str:
        return "medium"

    @property
    def impact(self) -> str:
        return "maintenance"

    @property
    def rationale(self) -> str:
        return "Stream reader/writer created without explicit charset, uses platform default encoding"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        matches = self._added_stream.findall(raw_diff)
        if matches:
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown", "patterns": matches}
        
        return None


class IOStreamChainingRule(BaseRule):
    """检测 IO 流链接调用中的资源泄漏"""
    
    def __init__(self):
        self._chaining_pattern = re.compile(
            r'^\+.*new\s+\w+(?:InputStream|OutputStream|Reader|Writer)\s*\([^)]*\.get\s*\w*\s*\(\s*\)'
        )
        
    @property
    def id(self) -> str:
        return "resource.stream_chaining_leak"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "IO stream created from method call result, intermediate stream may leak"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._chaining_pattern.search(raw_diff):
            files = diff_data.get('files', [])
            return {"file": files[0] if files else "unknown"}
        
        return None


class ExecutorServiceShutdownRule(BaseRule):
    """检测线程池未正确关闭"""
    
    def __init__(self):
        self._executor_creation = re.compile(
            r'^\+.*(?:Executors\.(newFixedThreadPool|newCachedThreadPool|newSingleThreadExecutor)|new\s+ThreadPoolExecutor)\s*\('
        )
        self._executor_shutdown = re.compile(r'^\+.*\.shutdown\s*\(\s*\)')
        
    @property
    def id(self) -> str:
        return "resource.executor_shutdown_missing"

    @property
    def severity(self) -> str:
        return "high"

    @property
    def impact(self) -> str:
        return "runtime"

    @property
    def rationale(self) -> str:
        return "ExecutorService created without shutdown, threads may not terminate"

    @property
    def rule_type(self) -> str:
        return "absolute"

    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        if self._executor_creation.search(raw_diff):
            if not self._executor_shutdown.search(raw_diff):
                files = diff_data.get('files', [])
                return {"file": files[0] if files else "unknown"}
        
        return None
