# DiffSense 内置规则清单

本文档列出了 DiffSense 的所有内置规则，按类别组织。

## 规则总数：44 条（36 Java + 8 Go）

---

## 1. 并发规则 (Concurrency) - 4 条

检测多线程和并发相关问题。

| 规则 ID | 严重程度 | 类型 | 说明 |
|---------|---------|------|------|
| `runtime.threadpool_semantic_change` | High | Absolute | 检测高风险线程池配置（无界或零核心线程数） |
| `runtime.concurrency_regression` | High | Regression | 检测从并发/原子类型降级到非线程安全实现 |
| `runtime.thread_safety_removal` | High | Regression | 检测移除同步机制（synchronized, volatile, locks） |
| `runtime.latch_misuse` | High | Regression | 检测移除 CountDownLatch.countDown()，可能导致死锁 |

---

## 2. 资源管理规则 (Resource Management) - 5 条

检测资源泄漏风险。

| 规则 ID | 严重程度 | 类型 | 说明 |
|---------|---------|------|------|
| `resource.closeable_leak` | High | Absolute | 检测可关闭资源未使用 try-with-resources 或 finally 关闭 |
| `resource.database_connection_leak` | **Critical** | Absolute | 检测数据库连接未正确关闭，可能导致连接池耗尽 |
| `resource.stream_encoding_missing` | Medium | Absolute | 检测流包装时未指定编码，使用平台默认编码 |
| `resource.stream_chaining_leak` | High | Absolute | 检测 IO 流链接调用中的中间流泄漏 |
| `resource.executor_shutdown_missing` | High | Absolute | 检测 ExecutorService 未正确关闭，线程可能不终止 |

---

## 3. 异常处理规则 (Exception Handling) - 6 条

检测异常处理不当的问题。

| 规则 ID | 严重程度 | 类型 | 说明 |
|---------|---------|------|------|
| `exception.swallowed` | High | Absolute | 检测捕获异常但未处理（空 catch 块） |
| `exception.too_generic` | Medium | Absolute | 检测捕获过于宽泛的异常（Exception/Throwable） |
| `exception.runtime_throw` | Low | Absolute | 检测抛出 RuntimeException 而非业务异常 |
| `exception.throws_removed` | Medium | Regression | 检测移除 throws 声明，可能破坏调用者的异常处理 |
| `exception.finally_missing` | Medium | Absolute | 检测资源操作后缺少 finally 块 |
| `exception.not_logged` | Medium | Absolute | 检测异常未记录日志，增加调试难度 |

---

## 4. 空安全规则 (Null Safety) - 6 条

检测空指针异常（NPE）风险。

| 规则 ID | 严重程度 | 类型 | 说明 |
|---------|---------|------|------|
| `null.return_ignored` | High | Absolute | 检测可能返回 null 的方法调用未进行空值检查 |
| `null.optional_unsafe_get` | High | Absolute | 检测 Optional.get() 未检查 isPresent() |
| `null.autoboxing_npe` | High | Absolute | 检测自动拆箱导致的 NPE |
| `null.chained_call_unsafe` | Medium | Absolute | 检测链式调用的 NPE 风险 |
| `null.array_index_unsafe` | Medium | Absolute | 检测数组/集合索引越界风险 |
| `null.string_concat_unsafe` | Low | Absolute | 检测字符串拼接的 NPE 风险 |

---

## 5. 集合处理规则 (Collection Handling) - 7 条

检测集合使用问题。

| 规则 ID | 严重程度 | 类型 | 说明 |
|---------|---------|------|------|
| `collection.raw_type` | Medium | Absolute | 检测使用集合原始类型（未指定泛型） |
| `collection.mutable_return` | Medium | Absolute | 检测返回可变集合，调用者可修改内部状态 |
| `collection.concurrent_modification` | High | Absolute | 检测遍历时修改集合，可能抛出 ConcurrentModificationException |
| `collection.map_compute_opportunity` | Low | Absolute | 检测 Map containsKey+put 模式可用 compute 简化 |
| `collection.stream_collector_unsafe` | Medium | Absolute | 检测 Stream toMap 缺少 merge 函数 |
| `collection.legacy_factory` | Low | Absolute | 检测使用过时的 Collections.factory() 方法 |
| `collection.aslist_modify` | High | Absolute | 检测对 Arrays.asList() 结果调用 add/remove |

---

## 6. API 兼容性规则 (API Compatibility) - 8 条

检测破坏性变更。

| 规则 ID | 严重程度 | 类型 | 说明 |
|---------|---------|------|------|
| `api.public_method_removed` | **Critical** | Regression | 检测删除公共方法，破坏 API 兼容性 |
| `api.method_signature_changed` | High | Regression | 检测方法签名变更（参数/返回类型） |
| `api.public_field_removed` | High | Regression | 检测删除公共字段 |
| `api.constructor_removed` | High | Regression | 检测删除构造函数 |
| `api.interface_changed` | High | Regression | 检测接口变更（添加/删除方法） |
| `api.important_annotation_removed` | Medium | Regression | 检测删除重要注解 |
| `api.deprecated_added` | Low | Absolute | 检测添加@Deprecated 注解 |
| `api.serialversionuid_changed` | High | Regression | 检测 SerialVersionUID 变更，破坏序列化兼容性 |

---

## 7. Go 语言规则 (Go Language) - 8 条

检测 Go 语言特有的风险模式。

| 规则 ID | 严重程度 | 类型 | 说明 |
|---------|---------|------|------|
| `resource.goroutine_leak` | High | Absolute | 检测 goroutine 泄漏风险（未正确退出的 goroutine） |
| `resource.channel_leak` | High | Absolute | 检测 channel 使用问题（未关闭、缓冲通道泄漏等） |
| `resource.defer_misuse` | Medium | Absolute | 检测 defer 误用（循环中 defer、defer 参数问题） |
| `security.unsafe_usage` | High | Absolute | 检测 unsafe 包的使用（类型转换、指针运算） |
| `exception.error_ignored` | Medium | Absolute | 检测错误处理不当（忽略 error 返回值） |
| `null.nil_dereference` | High | Absolute | 检测 nil 指针解引用风险 |
| `runtime.race_condition` | High | Regression | 检测竞态条件风险（共享变量无锁保护） |
| `security.http_vulnerability` | High | Absolute | 检测 HTTP 安全问题（路径遍历、未验证输入等） |

> 注意：Go 规则现已 YAML 化，规则文件位于 `config/rules/go/`；`go_rules.py` 仅保留兼容代码，不再作为默认加载来源。

---

## 规则类型说明

### Absolute（绝对规则）
- 不依赖 diff 历史，仅根据当前变更内容判断
- 适用于检测代码质量问题
- 例如：空 catch 块、未关闭资源

### Regression（回归规则）
- 依赖 diff 历史，检测"变差"的变更
- 适用于检测破坏性变更
- 例如：删除公共方法、移除同步机制

---

## 严重程度说明

| 级别 | 说明 | 建议操作 |
|------|------|----------|
| **Critical** | 严重问题，必须修复 | 阻止 PR 合并 |
| **High** | 高风险问题 | 强烈建议修复 |
| **Medium** | 中等问题 | 应该修复 |
| **Low** | 轻微问题，最佳实践 | 建议改进 |

---

## 使用示例

### 加载所有内置规则

```python
from rules import get_all_builtin_rules

rules = get_all_builtin_rules()
for rule in rules:
    print(f"{rule.id}: {rule.severity} - {rule.rationale}")
```

### 按类别加载规则

```python
from rules import get_rules_by_category

# 只加载空安全相关规则
null_safety_rules = get_rules_by_category('null_safety')
```

### 自定义规则

```python
from sdk.rule import BaseRule

class MyCustomRule(BaseRule):
    @property
    def id(self) -> str:
        return "myapp.custom_rule"
    
    @property
    def severity(self) -> str:
        return "high"
    
    @property
    def impact(self) -> str:
        return "runtime"
    
    @property
    def rationale(self) -> str:
        return "Custom rule rationale"
    
    def evaluate(self, diff_data, signals):
        # 实现你的规则逻辑
        return {"file": "matched_file.java"} if matched else None
```

---

## 规则文件位置

```
diffsense/rules/
├── __init__.py                    # 规则注册和导出
├── concurrency.py                 # 并发规则 (4 条)
├── concurrency_adapter.py         # 基于 Adapter 的并发规则（跨语言）
├── resource_management.py         # 资源管理规则 (5 条)
├── exception_handling.py          # 异常处理规则 (6 条)
├── null_safety.py                 # 空安全规则 (6 条)
├── collection_handling.py         # 集合处理规则 (7 条)
├── api_compatibility.py           # API 兼容性规则 (8 条)
├── go_rules.py                    # Go 旧版实现（兼容保留，默认不加载）
└── yaml_adapter.py                # YAML 规则适配器

diffsense/config/rules/
├── go/*.yaml                      # Go 规则（默认加载）
├── python/*.yaml                  # Python 规则
├── javascript/*.yaml              # JavaScript 规则
├── typescript/*.yaml              # TypeScript 规则
└── cpp/*.yaml                     # C/C++ 规则

diffsense/sdk/
├── rule.py                        # BaseRule 抽象类
├── language_adapter.py            # LanguageAdapter 抽象 + AdapterFactory
├── java_adapter.py                # Java 语言适配器
├── go_adapter.py                  # Go 语言适配器
├── python_adapter.py              # Python 语言适配器
└── signal.py                      # 信号系统
```

---

## 使用 LanguageAdapter 编写跨语言规则

DiffSense 提供 `LanguageAdapter` 系统，支持编写一次即可跨 Java、Go、Python 运行的规则。

### 示例：使用 Adapter 创建规则

```python
from sdk.rule import BaseRule
from sdk.language_adapter import AdapterFactory, LanguageAdapter
from sdk.signal import Signal
from typing import Dict, Any, List, Optional

class ThreadSafetyRemovalRule(BaseRule):
    """线程安全移除规则 - 使用 Adapter 实现跨语言支持"""
    
    def __init__(self, language: str = "java"):
        self._adapter = AdapterFactory.get_adapter(language)
        self._language = language
    
    @property
    def id(self) -> str:
        return "runtime.thread_safety_removal"
    
    @property
    def severity(self) -> str:
        return "high"
    
    @property
    def language(self) -> str:
        return self._language
    
    @property
    def rule_type(self) -> str:
        return "regression"
    
    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        raw_diff = diff_data.get('raw_diff', "")
        
        # 使用 adapter 获取语言特定的模式
        lock_patterns = self._adapter.get_lock_patterns()
        
        # 检查是否移除了锁
        for pattern in lock_patterns:
            if pattern.search(raw_diff):
                return {"file": "lock_removed"}
        
        return None

# 使用不同语言创建规则实例
java_rule = ThreadSafetyRemovalRule(language="java")
go_rule = ThreadSafetyRemovalRule(language="go")
python_rule = ThreadSafetyRemovalRule(language="python")
```

### Adapter 提供的能力

| 方法 | 说明 |
|------|------|
| `get_thread_safe_types()` | 获取线程安全类型集合 |
| `get_unsafe_types()` | 获取非线程安全类型集合 |
| `get_lock_patterns()` | 获取锁模式正则列表 |
| `get_unlock_patterns()` | 获取解锁模式正则列表 |
| `get_cleanup_keywords()` | 获取资源清理关键词 |
| `get_error_check_patterns()` | 获取错误检查模式 |
| `get_concurrency_primitives()` | 获取并发原语集合 |
| `get_dangerous_patterns()` | 获取安全相关模式字典 |

---

## 贡献新规则

欢迎贡献新规则！请遵循以下指南：

1. 继承 `BaseRule` 类
2. 实现所有必需的属性和方法
3. 将规则添加到合适的类别文件中
4. 在 `__init__.py` 中注册规则
5. 更新此文档

### 规则模板

```python
from sdk.rule import BaseRule
from sdk.signal import Signal
from typing import Dict, Any, List, Optional

class MyRule(BaseRule):
    def __init__(self):
        # 初始化正则表达式等
        pass
    
    @property
    def id(self) -> str:
        return "category.rule_name"
    
    @property
    def severity(self) -> str:
        return "high"
    
    @property
    def impact(self) -> str:
        return "runtime"
    
    @property
    def rationale(self) -> str:
        return "Rule description and risk explanation"
    
    @property
    def rule_type(self) -> str:
        return "absolute"  # or "regression"
    
    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        # 实现规则逻辑
        # 返回 dict（包含'file'键）表示匹配
        # 返回 None 表示不匹配
        pass
```
