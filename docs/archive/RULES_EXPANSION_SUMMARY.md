# DiffSense 规则扩充总结

## 📋 本次扩充概览

本次为 DiffSense 基础规则库进行了全面扩充，从原来的 **4 条并发规则** 扩展到 **36 条规则**，涵盖 6 个主要类别。

---

## ✨ 新增规则文件

### 1. **resource_management.py** - 资源管理规则 (5 条)
检测资源泄漏风险，包括：
- ✅ 可关闭资源泄漏检测
- ✅ 数据库连接泄漏检测（Critical 级别）
- ✅ 流编码缺失检测
- ✅ IO 流链接泄漏检测
- ✅ 线程池未关闭检测

**典型场景**：
```java
// ❌ 会被检测出
InputStream is = new FileInputStream("test.txt");
String content = read(is);

// ✅ 正确做法
try (InputStream is = new FileInputStream("test.txt")) {
    String content = read(is);
}
```

### 2. **exception_handling.py** - 异常处理规则 (6 条)
检测异常处理不当，包括：
- ✅ 空 catch 块检测
- ✅ 泛化异常捕获检测
- ✅ 运行时异常抛出检测
- ✅ throws 声明移除检测
- ✅ finally 块缺失检测
- ✅ 异常未日志记录检测

**典型场景**：
```java
// ❌ 会被检测出 - 空 catch 块
try {
    riskyOperation();
} catch (Exception e) {
}

// ❌ 会被检测出 - 泛化异常
try {
    doSomething();
} catch (Exception e) {
    e.printStackTrace();
}

// ✅ 正确做法
try {
    doSomething();
} catch (SpecificException e) {
    logger.error("Operation failed", e);
}
```

### 3. **null_safety.py** - 空安全规则 (6 条)
检测 NPE 风险，包括：
- ✅ null 返回值忽略检测
- ✅ Optional 不安全解包检测
- ✅ 自动拆箱 NPE 检测
- ✅ 链式调用 NPE 检测
- ✅ 数组索引越界检测
- ✅ 字符串拼接 NPE 检测

**典型场景**：
```java
// ❌ 会被检测出 - 未检查 null
String value = map.get("key");
System.out.println(value.length());

// ❌ 会被检测出 - Optional 不安全
optional.get();

// ✅ 正确做法
String value = map.get("key");
if (value != null) {
    System.out.println(value.length());
}

// ✅ 或使用 Optional
optional.ifPresent(v -> System.out.println(v.length()));
```

### 4. **collection_handling.py** - 集合处理规则 (7 条)
检测集合使用问题，包括：
- ✅ 原始类型使用检测
- ✅ 可变集合返回检测
- ✅ 并发修改检测
- ✅ Map compute 优化建议
- ✅ Stream collector 不安全检测
- ✅ 过时工厂方法检测
- ✅ Arrays.asList 修改检测

**典型场景**：
```java
// ❌ 会被检测出 - 原始类型
List list = new ArrayList();

// ❌ 会被检测出 - 返回可变集合
public List<String> getItems() {
    return this.items;
}

// ❌ 会被检测出 - 遍历时修改
for (String item : list) {
    list.remove(item);  // ConcurrentModificationException!
}

// ✅ 正确做法
List<String> list = new ArrayList<>();

public List<String> getItems() {
    return Collections.unmodifiableList(this.items);
}

// 或使用 Iterator
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (shouldRemove(it.next())) {
        it.remove();
    }
}
```

### 5. **api_compatibility.py** - API 兼容性规则 (8 条)
检测破坏性变更，包括：
- ✅ 公共方法删除检测（Critical 级别）
- ✅ 方法签名变更检测
- ✅ 公共字段删除检测
- ✅ 构造函数删除检测
- ✅ 接口变更检测
- ✅ 重要注解删除检测
- ✅ Deprecated 注解添加检测
- ✅ SerialVersionUID 变更检测

**典型场景**：
```java
// ❌ 会被检测出 - 删除公共方法
- public void doSomething() {
-     // implementation
- }

// ❌ 会被检测出 - 修改方法签名
- public void process(String data) {
+ public void process(Integer data) {

// ✅ 正确做法 - 先标记@Deprecated
@Deprecated
public void oldMethod() {
    // ...
}

public void newMethod() {
    // ...
}
```

---

## 📦 新增辅助文件

### 6. **__init__.py** - 规则注册模块
提供规则加载和注册功能：
- `get_all_builtin_rules()` - 获取所有内置规则
- `get_rules_by_category(category)` - 按类别获取规则
- `get_rule_by_id(rule_id)` - 按 ID 获取特定规则

### 7. **RULES_README.md** - 完整规则文档
包含：
- 所有规则的详细说明
- 规则 ID、严重程度、类型
- 使用示例和自定义规则指南
- 规则模板

### 8. **QUICK_REFERENCE.md** - 快速参考卡片
包含：
- 规则统计表格
- 按严重程度分类
- 按场景推荐组合
- 命令行使用示例

---

## 📊 规则统计

### 按类别分布
```
并发 (Concurrency)         ████░░░░░░  4 条 (11%)
资源管理 (Resource)        █████░░░░░  5 条 (14%)
异常处理 (Exception)       ██████░░░░  6 条 (17%)
空安全 (Null Safety)       ██████░░░░  6 条 (17%)
集合处理 (Collection)      ███████░░░  7 条 (19%)
API 兼容性 (API)           ████████░░  8 条 (22%)
```

### 按严重程度分布
```
Critical  🔴  2 条   (6%)   - 必须修复，阻止 PR
High      🟠  18 条  (50%)  - 强烈建议修复
Medium    🟡  11 条  (31%)  - 应该修复
Low       🟢  5 条   (14%)  - 建议改进
```

### 按规则类型分布
```
Absolute   24 条 (67%)  - 基于当前代码质量
Regression 12 条 (33%)  - 基于变更对比
```

---

## 🎯 使用场景

### 场景 1: PR 快速检查
```python
from rules import get_all_builtin_rules

# 只运行 Critical + High 级别规则（20 条）
rules = [r for r in get_all_builtin_rules() 
         if r.severity in ['critical', 'high']]
```

### 场景 2: 专项代码审查
```python
from rules import get_rules_by_category

# 只检查 API 兼容性（8 条规则）
api_rules = get_rules_by_category('api')

# 只检查空安全问题（6 条规则）
null_safety_rules = get_rules_by_category('null_safety')
```

### 场景 3: 全面代码质量审计
```python
from rules import get_all_builtin_rules

# 运行全部 36 条规则
all_rules = get_all_builtin_rules()
```

---

## 🧪 测试覆盖

已创建测试文件 `tests/test_builtin_rules.py`，包含：
- ✅ 规则加载测试
- ✅ 按类别加载测试
- ✅ 按 ID 查询测试
- ✅ 规则元数据一致性测试
- ✅ 各类别规则功能测试

运行测试：
```bash
python -m pytest tests/test_builtin_rules.py -v
```

---

## 📈 与原规则集成

原有 4 条并发规则保持不变，新增规则与其完美集成：

```python
# 所有规则统一接口
from sdk.rule import BaseRule

# 所有规则都可以通过统一方式调用
for rule in get_all_builtin_rules():
    result = rule.evaluate(diff_data, signals)
    if result:
        print(f"Rule {rule.id} matched: {result}")
```

---

## 🚀 下一步建议

### 短期（1-2 周）
1. ✅ 运行测试验证所有规则正常工作
2. ✅ 在实际项目中试运行规则
3. ✅ 收集误报/漏报反馈

### 中期（1 个月）
1. 📝 根据实际使用情况调整规则敏感度
2. 🔧 优化正则表达式减少误报
3. 📊 添加规则执行统计和报告

### 长期（2-3 个月）
1. 🆕 添加更多类别规则：
   - 安全规则（Security）- SQL 注入、XSS 等
   - 性能规则（Performance）- 低效操作检测
   - 代码风格规则（Style）- 命名规范等
2. 🤖 引入机器学习改进规则准确性
3. 🌐 支持其他语言（Python, JavaScript 等）

---

## 📝 文件清单

本次扩充创建/修改的文件：

```
diffsense/
├── rules/
│   ├── __init__.py                    ✨ 新建 - 规则注册
│   ├── concurrency.py                 📝 原有 - 保持不变
│   ├── yaml_adapter.py                📝 原有 - 保持不变
│   ├── resource_management.py         ✨ 新建 - 5 条规则
│   ├── exception_handling.py          ✨ 新建 - 6 条规则
│   ├── null_safety.py                 ✨ 新建 - 6 条规则
│   ├── collection_handling.py         ✨ 新建 - 7 条规则
│   ├── api_compatibility.py           ✨ 新建 - 8 条规则
│   ├── RULES_README.md                ✨ 新建 - 完整文档
│   └── QUICK_REFERENCE.md             ✨ 新建 - 快速参考
└── sdk/
    ├── rule.py                        📝 原有 - 保持不变
    └── signal.py                      📝 原有 - 保持不变

tests/
└── test_builtin_rules.py              ✨ 新建 - 单元测试
```

---

## 💡 最佳实践建议

### 1. 规则配置
- **开发阶段**: 运行全部规则，尽早发现问题
- **CI/CD**: 运行 High+Critical 规则，确保代码质量
- **发布前**: 运行 Critical 规则，确保无严重问题

### 2. 规则定制
```python
# 根据项目特点禁用某些规则
from rules import get_all_builtin_rules

all_rules = get_all_builtin_rules()
enabled_rules = [r for r in all_rules 
                 if r.id not in ['collection.legacy_factory']]
```

### 3. 渐进式采用
1. 第一阶段：只运行 Critical 规则
2. 第二阶段：加入 High 规则
3. 第三阶段：加入 Medium 规则
4. 第四阶段：运行全部规则

---

## 🎉 总结

本次扩充使 DiffSense 规则库从 **4 条** 增长到 **36 条**，覆盖了 Java 开发中最常见的 6 大类问题：

✅ **并发安全** - 4 条规则  
✅ **资源管理** - 5 条规则  
✅ **异常处理** - 6 条规则  
✅ **空安全** - 6 条规则  
✅ **集合处理** - 7 条规则  
✅ **API 兼容性** - 8 条规则  

所有规则都遵循统一的 `BaseRule` 接口，易于扩展和维护。

**总计**: 
- 📦 6 个规则文件
- 📚 3 个文档文件
- 🧪 1 个测试文件
- 🎯 36 条规则

---

**创建时间**: 2026-03-22  
**版本**: v2.2.0  
**作者**: DiffSense Team
