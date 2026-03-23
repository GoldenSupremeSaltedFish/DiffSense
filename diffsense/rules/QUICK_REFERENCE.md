# DiffSense 规则快速参考

## 📊 规则统计

| 类别 | 规则数 | Critical | High | Medium | Low |
|------|--------|----------|------|--------|-----|
| **并发 (Concurrency)** | 4 | 0 | 4 | 0 | 0 |
| **资源管理 (Resource)** | 5 | 1 | 3 | 1 | 0 |
| **异常处理 (Exception)** | 6 | 0 | 1 | 4 | 1 |
| **空安全 (Null Safety)** | 6 | 0 | 3 | 2 | 1 |
| **集合处理 (Collection)** | 7 | 0 | 2 | 3 | 2 |
| **API 兼容性** | 8 | 1 | 5 | 1 | 1 |
| **总计** | **36** | **2** | **18** | **11** | **5** |

---

## 🔴 Critical 规则 (2 条)

必须修复，否则阻止 PR 合并：

1. **`resource.database_connection_leak`** - 数据库连接泄漏
2. **`api.public_method_removed`** - 删除公共方法

---

## 🟠 High 规则 (18 条)

强烈建议修复：

### 并发 (4)
- `runtime.threadpool_semantic_change` - 线程池配置风险
- `runtime.concurrency_regression` - 并发类型降级
- `runtime.thread_safety_removal` - 移除同步机制
- `runtime.latch_misuse` - Latch 误用

### 资源管理 (3)
- `resource.closeable_leak` - 可关闭资源泄漏
- `resource.stream_chaining_leak` - 流链接泄漏
- `resource.executor_shutdown_missing` - 线程池未关闭

### 异常处理 (1)
- `exception.swallowed` - 空 catch 块

### 空安全 (3)
- `null.return_ignored` - 未检查 null 返回值
- `null.optional_unsafe_get` - Optional.get() 不安全
- `null.autoboxing_npe` - 自动拆箱 NPE

### 集合处理 (2)
- `collection.concurrent_modification` - 遍历时修改
- `collection.aslist_modify` - 修改不可变列表

### API 兼容性 (5)
- `api.method_signature_changed` - 方法签名变更
- `api.public_field_removed` - 删除公共字段
- `api.constructor_removed` - 删除构造函数
- `api.interface_changed` - 接口变更
- `api.serialversionuid_changed` - serialVersionUID 变更

---

## 🟡 Medium 规则 (11 条)

应该修复：

### 资源管理 (1)
- `resource.stream_encoding_missing` - 流编码缺失

### 异常处理 (4)
- `exception.too_generic` - 捕获泛化异常
- `exception.throws_removed` - 移除 throws
- `exception.finally_missing` - 缺少 finally
- `exception.not_logged` - 异常未记录日志

### 空安全 (2)
- `null.chained_call_unsafe` - 链式调用风险
- `null.array_index_unsafe` - 数组索引越界

### 集合处理 (3)
- `collection.raw_type` - 原始类型
- `collection.mutable_return` - 返回可变集合
- `collection.stream_collector_unsafe` - Stream collector 不安全

### API 兼容性 (1)
- `api.important_annotation_removed` - 删除重要注解

---

## 🟢 Low 规则 (5 条)

建议改进：

### 异常处理 (1)
- `exception.runtime_throw` - 抛出运行时异常

### 空安全 (1)
- `null.string_concat_unsafe` - 字符串拼接 NPE

### 集合处理 (2)
- `collection.map_compute_opportunity` - 可用 compute 简化
- `collection.legacy_factory` - 过时工厂方法

### API 兼容性 (1)
- `api.deprecated_added` - 添加@Deprecated

---

## 🎯 按场景推荐规则组合

### PR 快速检查（只跑 High+Critical）
```python
from rules import get_all_builtin_rules

rules = [r for r in get_all_builtin_rules() 
         if r.severity in ['critical', 'high']]
# 20 条规则
```

### 全面代码质量检查（全部规则）
```python
from rules import get_all_builtin_rules

rules = get_all_builtin_rules()
# 36 条规则
```

### 仅 API 兼容性检查
```python
from rules import get_rules_by_category

rules = get_rules_by_category('api')
# 8 条规则
```

### 仅运行时安全问题
```python
from rules import get_all_builtin_rules

rules = [r for r in get_all_builtin_rules() 
         if r.impact == 'runtime' and r.severity in ['critical', 'high']]
# 15 条规则
```

---

## 📝 规则 ID 速查

按字母顺序排列：

```
api.constructor_removed              api.public_method_removed
api.deprecated_added                 api.serialversionuid_changed
api.interface_changed                collection.aslist_modify
api.important_annotation_removed     collection.concurrent_modification
api.method_signature_changed         collection.legacy_factory
api.public_field_removed             collection.map_compute_opportunity
collection.mutable_return            null.chained_call_unsafe
collection.raw_type                  null.optional_unsafe_get
collection.stream_collector_unsafe   null.return_ignored
exception.finally_missing            null.string_concat_unsafe
exception.not_logged                 resource.closeable_leak
exception.runtime_throw              resource.database_connection_leak
exception.swallowed                  resource.executor_shutdown_missing
exception.too_generic                resource.stream_chaining_leak
exception.throws_removed             resource.stream_encoding_missing
null.array_index_unsafe              runtime.concurrency_regression
null.autoboxing_npe                  runtime.latch_misuse
                                     runtime.thread_safety_removal
                                     runtime.threadpool_semantic_change
```

---

## 🔧 命令行使用

### 运行特定类别规则
```bash
diffsense --rules resource --diff commit1..commit2
diffsense --rules null_safety --diff HEAD~1
diffsense --rules api,collection --diff feature-branch
```

### 运行特定严重程度规则
```bash
diffsense --severity critical,high --diff HEAD~1
diffsense --severity high --diff main..feature
```

### 运行特定规则
```bash
diffsense --rule resource.database_connection_leak --diff HEAD~1
diffsense --rule api.public_method_removed --diff main..develop
```

---

## 📈 规则效果指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 误报率 | < 5% | 规则报告的问题中实际不是问题的比例 |
| 漏报率 | < 10% | 实际问题中未被规则发现的比例 |
| 平均修复时间 | < 30 分钟 | 修复一个规则问题的平均时间 |
| 规则覆盖率 | > 80% | 项目代码被规则覆盖的比例 |

---

## 🚀 性能建议

- **小型项目** (< 10K LOC): 运行全部 36 条规则
- **中型项目** (10K-100K LOC): 优先运行 High+Critical (20 条)
- **大型项目** (> 100K LOC): 只运行 Critical (2 条) + 自定义规则

---

## 📞 反馈与支持

发现误报或漏报？请提交 Issue 并附上：
- 规则 ID
- 代码示例
- 预期行为
- 实际行为
