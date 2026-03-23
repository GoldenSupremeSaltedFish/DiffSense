# DiffSense 跨语言规则指南

## 📋 概述

DiffSense 的规则系统设计为**语言无关**的架构，但当前实现的规则主要针对 Java 语言。本指南说明如何让规则支持多种语言（Go、Python 等）。

---

## 🏗️ 规则架构

### 当前状态

```
✅ 规则引擎 (Rule Engine) - 语言无关 ✅
✅ 规则接口 (BaseRule) - 语言无关 ✅
✅ 信号系统 (Signal) - 语言无关 ✅
✅ Go 语言分析器 - 已实现 ⚠️
✅ Python 分析器 - 已实现 ⚠️
⚠️ 内置规则 - 主要针对 Java ❌ 需要扩展
```

---

## 🎯 规则普适性分析

### 已扩充的规则（36 条）- Java 特定

当前扩充的 36 条规则主要针对 **Java 语言特性**：

| 规则类别 | Java 特定模式 | Go 对应概念 |
|---------|-------------|-----------|
| **资源管理** | `InputStream`, `try-with-resources` | `defer`, `io.Closer` |
| **异常处理** | `try-catch`, `Exception` | `error` 返回值 |
| **空安全** | `null`, `Optional` | `nil`, 多返回值 |
| **集合处理** | `List`, `Map`, `Stream` | `slice`, `map`, `range` |
| **并发控制** | `ThreadPool`, `synchronized` | `goroutine`, `mutex` |
| **API 兼容性** | `public method`, `@Deprecated` | 导出的函数，注释 |

### 结论

❌ **当前规则不直接适用于 Go** - 需要为 Go 语言实现特定版本

---

## 🔄 实现跨语言规则的两种方式

### 方式 1: 语言特定规则（推荐）

为每种语言实现特定版本的规则，遵循相同的规则模式。

**优点**：
- ✅ 精确匹配语言特性
- ✅ 更高的准确性
- ✅ 更好的性能

**示例**：

```python
# Java 版本 - diffsense/rules/resource_management.py
class CloseableResourceLeakRule(BaseRule):
    def __init__(self):
        self._closeable_types = ['InputStream', 'OutputStream']
        self._try_with_resources = re.compile(r'try\s*\([^)]*InputStream')
    
    @property
    def language(self) -> str:
        return "java"
    
    def evaluate(self, diff_data, signals):
        # Java 特定的 try-with-resources 检测
        pass

# Go 版本 - diffsense/rules/go_rules.py
class GoDeferMisuseRule(BaseRule):
    def __init__(self):
        self._defer_pattern = re.compile(r'\bdefer\s+')
        self._loop_pattern = re.compile(r'\bfor\s+.*{')
    
    @property
    def language(self) -> str:
        return "go"
    
    def evaluate(self, diff_data, signals):
        # Go 特定的 defer 在循环中检测
        pass
```

### 方式 2: 通用语义规则

检测跨语言的通用模式（通过 AST 信号）。

**优点**：
- ✅ 一套规则支持多语言
- ✅ 维护成本低

**缺点**：
- ❌ 准确性较低
- ❌ 无法检测语言特定问题

---

## 📦 Go 语言规则示例

已创建 `diffsense/rules/go_rules.py`，包含 8 条 Go 特定规则：

### 1. 资源管理类 (2 条)
- `resource.goroutine_leak` - goroutine 泄漏检测
- `resource.channel_leak` - channel 泄漏检测
- `resource.defer_misuse` - defer 误用检测

### 2. 并发安全类 (1 条)
- `runtime.race_condition` - 竞态条件检测

### 3. 空安全类 (1 条)
- `null.nil_dereference` - nil 指针解引用

### 4. 异常处理类 (1 条)
- `exception.error_ignored` - 错误忽略检测

### 5. 安全类 (2 条)
- `security.unsafe_usage` - unsafe 包使用
- `security.http_vulnerability` - HTTP 安全问题

---

## 🔧 注册和使用 Go 规则

### 步骤 1: 更新规则注册

修改 `diffsense/rules/__init__.py`：

```python
from rules.go_rules import (
    GoGoroutineLeakRule,
    GoChannelLeakRule,
    GoDeferMisuseRule,
    GoUnsafeUsageRule,
    GoErrorHandlingRule,
    GoNilPointerRule,
    GoRaceConditionRule,
    GoHTTPSecurityRule,
)

# 添加到 BUILTIN_RULES
BUILTIN_RULES = [
    # ... Java 规则 ...
    
    # Go 规则
    GoGoroutineLeakRule,
    GoChannelLeakRule,
    GoDeferMisuseRule,
    GoUnsafeUsageRule,
    GoErrorHandlingRule,
    GoNilPointerRule,
    GoRaceConditionRule,
    GoHTTPSecurityRule,
]
```

### 步骤 2: 规则引擎自动识别

规则引擎会根据 `rule.language` 属性自动匹配：

```python
# 在 RuleEngine.evaluate() 中
rule_lang = getattr(rule, 'language', '*')

for file_path in changed_files:
    if rule_lang != '*' and not file_path.endswith(f".{rule_lang}"):
        continue  # 跳过不匹配的文件
    # 执行规则
```

### 步骤 3: 运行规则

```bash
# 自动检测 Go 文件
diffsense --diff HEAD~1

# 或指定只运行 Go 规则
diffsense --rules go --diff HEAD~1
```

---

## 📊 规则语言映射

| 概念 | Java | Go | Python |
|------|------|----|-------|
| **资源关闭** | try-with-resources | defer | with statement |
| **异常处理** | try-catch | error return | try-except |
| **空值** | null | nil | None |
| **集合** | List/Map | slice/map | list/dict |
| **并发** | Thread/Synchronized | goroutine/mutex | threading/lock |
| **泛型** | `<T>` | 无（interface{}） | 泛型（3.10+） |

---

## 🎯 规则普适性评估

### 高普适性规则（可跨语言）

这些规则的**概念**适用于所有语言，但需要语言特定实现：

| 规则概念 | 普适性 | Java 实现 | Go 实现 | Python 实现 |
|---------|-------|---------|-------|-----------|
| 资源泄漏 | ⭐⭐⭐⭐⭐ | ✅ | ✅ | ✅ |
| 空指针 | ⭐⭐⭐⭐⭐ | ✅ | ✅ | ✅ |
| 并发问题 | ⭐⭐⭐⭐ | ✅ | ✅ | ✅ |
| 错误处理 | ⭐⭐⭐⭐ | ✅ | ✅ | ✅ |
| 集合误用 | ⭐⭐⭐ | ✅ | ✅ | ✅ |
| API 兼容性 | ⭐⭐⭐ | ✅ | ⚠️ | ⚠️ |

### 低普适性规则（语言特定）

这些规则**仅适用于特定语言**：

| 规则 | 语言 | 原因 |
|------|------|------|
| `serialVersionUID_changed` | Java | Java 序列化特有 |
| `Optional_unsafe_get` | Java | Java Optional 特有 |
| `goroutine_leak` | Go | Go 特有 |
| `defer_misuse` | Go | Go 特有 |
| `with_statement_missing` | Python | Python 特有 |

---

## 🚀 推荐方案

### 短期（当前）

1. ✅ **保持 Java 规则** - 继续完善 36 条 Java 规则
2. ✅ **添加 Go 规则** - 使用已创建的 `go_rules.py`
3. ✅ **添加 Python 规则** - 类似模式创建 `python_rules.py`

### 中期（1-2 个月）

1. 📝 **提取通用模式** - 识别跨语言的共同概念
2. 🔧 **创建规则模板** - 定义语言的"适配层"
3. 🧪 **统一测试框架** - 跨语言规则测试

### 长期（3-6 个月）

1. 🤖 **基于 AST 的语义规则** - 利用 AST 信号实现语言无关规则
2. 🌐 **规则市场** - 社区贡献不同语言的规则
3. 📚 **规则转换工具** - 自动将规则迁移到新语言

---

## 💡 规则开发最佳实践

### 1. 明确标注语言

```python
class MyRule(BaseRule):
    @property
    def language(self) -> str:
        return "go"  # 或 "java", "python", "*"（通用）
```

### 2. 使用语言特定的正则

```python
# ❌ 不好 - 混合语言
pattern = r'(InputStream|io.Reader)'

# ✅ 好 - 明确语言
class JavaRule(BaseRule):
    pattern = r'InputStream'
    language = "java"

class GoRule(BaseRule):
    pattern = r'io\.Reader'
    language = "go"
```

### 3. 遵循命名约定

```
{语言}{问题类型}Rule

# Java
JavaThreadPoolRule
JavaNullSafetyRule

# Go
GoGoroutineRule
GoNilPointerRule

# 通用（如果真的是跨语言）
ResourceLeakRule  # language = "*"
```

---

## 📈 当前支持状态

| 组件 | Java | Go | Python |
|------|------|----|-------|
| **分析器** | ✅ 完整 | ✅ 增强版 | ✅ 基础 |
| **内置规则** | ✅ 36 条 | ✅ 8 条 | ❌ 待开发 |
| **YAML 规则** | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| **CVE 规则** | ✅ 支持 | ⚠️ 部分 | ⚠️ 部分 |

---

## 🎓 学习资源

- [Go 语言规范](https://golang.org/ref/spec)
- [Java 语言规范](https://docs.oracle.com/javase/specs/)
- [Python 语言参考](https://docs.python.org/3/reference/)
- [DiffSense 规则开发指南](RULES_README.md)

---

## 📞 常见问题

### Q: 能否直接将 Java 规则用于 Go？

**A**: ❌ 不能。Java 规则使用 Java 特定的 API 和模式（如 `InputStream`, `try-with-resources`），这些在 Go 中不存在。需要为 Go 实现特定版本。

### Q: 规则引擎是否支持多语言混合项目？

**A**: ✅ 支持。规则引擎会根据 `rule.language` 和文件扩展名自动匹配正确的规则。

### Q: 如何为 TypeScript 添加规则？

**A**: 遵循相同模式：
1. 创建 `diffsense/rules/typescript_rules.py`
2. 实现 TypeScript 特定的规则类
3. 在 `__init__.py` 中注册
4. 添加 TypeScript 分析器（如需要）

---

**创建时间**: 2026-03-22  
**版本**: v2.2.0  
**状态**: 草案
