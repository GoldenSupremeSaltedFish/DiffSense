# 细粒度变更分析功能

## 概述

细粒度变更分析功能允许分析器识别一个提交中的多种具体修改类型，提供更精确的变更描述和风险评估。

## 功能特性

### 支持的修改类型

| 类型代码 | 类型名称 | 描述 |
|---------|---------|------|
| `behavior-change` | 行为变更 | 修改了方法的核心逻辑或业务行为 |
| `interface-change` | 接口变更 | 修改了方法签名、参数或返回类型 |
| `api-endpoint-change` | API端点变更 | 修改了REST API的路径、方法或参数 |
| `data-structure-change` | 数据结构变更 | 修改了实体类、DTO或数据库结构 |
| `config-change` | 配置变更 | 修改了配置文件、环境变量或系统参数 |
| `refactor` | 代码重构 | 重构代码结构，不改变外部行为 |
| `logging-added` | 日志增强 | 添加或修改了日志记录 |
| `logging-removed` | 日志移除 | 删除了日志记录 |
| `comment-change` | 注释变更 | 仅修改了注释或文档 |
| `test-added` | 测试新增 | 添加了新的测试用例 |
| `test-modified` | 测试修改 | 修改了现有测试用例 |
| `test-removed` | 测试移除 | 删除了测试用例 |
| `dependency-added` | 依赖新增 | 添加了新的依赖项 |
| `dependency-removed` | 依赖移除 | 移除了依赖项 |
| `dependency-updated` | 依赖更新 | 更新了依赖版本 |
| `performance-optimization` | 性能优化 | 优化了性能相关的代码 |
| `security-enhancement` | 安全增强 | 增强了安全相关的功能 |
| `formatting-change` | 格式调整 | 仅调整了代码格式，无逻辑变更 |

## 使用方法

### 命令行参数

使用 `--include-type-tags` 参数启用细粒度分析：

```bash
# 分析Java代码并包含细粒度修改类型
java -jar diffsense.jar analyze --lang java --include-type-tags

# 分析Go代码并包含细粒度修改类型
java -jar diffsense.jar analyze --lang go --include-type-tags

# 指定输出格式
java -jar diffsense.jar analyze --lang java --include-type-tags --format json
```

### 输出格式

启用细粒度分析后，输出JSON将包含 `modifications` 字段：

```json
{
  "commit": "abc123",
  "message": "Add user authentication and logging",
  "modifications": [
    {
      "type": "behavior-change",
      "typeName": "行为变更",
      "description": "方法逻辑变更: authenticateUser",
      "file": "src/main/java/com/example/AuthService.java",
      "method": "authenticateUser",
      "confidence": 0.85,
      "indicators": []
    },
    {
      "type": "logging-added",
      "typeName": "日志增强",
      "description": "日志记录变更: authenticateUser",
      "file": "src/main/java/com/example/AuthService.java",
      "method": "authenticateUser",
      "confidence": 0.8,
      "indicators": []
    },
    {
      "type": "config-change",
      "typeName": "配置变更",
      "description": "配置文件变更: application.yml",
      "file": "src/main/resources/application.yml",
      "confidence": 1.0,
      "indicators": []
    }
  ]
}
```

## 检测规则

### 文件类型检测

- **配置文件**: 检测 `.yml`, `.yaml`, `.properties`, `.xml`, `.json` 等扩展名
- **依赖文件**: 检测 `pom.xml`, `build.gradle`, `package.json`, `go.mod` 等
- **测试文件**: 检测包含 `Test`, `Tests`, `Spec`, `IT` 的文件名模式

### 方法级别检测

- **API端点**: 检测位于 `/controller/` 或 `/api/` 目录的方法
- **数据结构**: 检测位于 `/entity/`, `/dto/`, `/model/` 目录的方法
- **日志变更**: 使用正则表达式检测日志语句的添加/删除

### 变更内容检测

- **签名变更**: 检测方法签名的修改
- **行为变更**: 检测方法体逻辑的修改
- **注释变更**: 检测仅包含注释的变更
- **格式变更**: 检测仅包含格式调整的变更

## 应用场景

### 1. 回归测试推荐

根据修改类型推荐相应的测试策略：

- **行为变更** → 功能测试
- **接口变更** → 集成测试
- **配置变更** → 配置验证测试
- **日志变更** → 日志输出一致性测试

### 2. 风险评估

- **多类型变更**: 同时包含行为+配置+日志变更的提交风险较高
- **接口变更**: 可能影响其他模块的集成
- **依赖变更**: 可能引入兼容性问题

### 3. 代码审查

- 帮助审查者快速理解变更的意图和影响范围
- 识别可能遗漏的测试场景
- 发现不合理的变更组合

## 扩展开发

### 添加新的修改类型

1. 在 `ModificationType` 枚举中添加新类型
2. 在 `GranularChangeAnalyzer` 中实现检测逻辑
3. 添加相应的测试用例

### 自定义检测规则

可以通过修改 `GranularChangeAnalyzer` 中的检测方法来自定义规则：

```java
// 自定义配置文件检测
private boolean isCustomConfigFile(String filePath) {
    // 实现自定义逻辑
    return filePath.contains("/custom-config/");
}
```

## 性能考虑

- 细粒度分析会增加分析时间，建议仅在需要时启用
- 可以通过缓存机制优化重复分析
- 支持并行分析以提高性能

## 注意事项

1. 检测结果的置信度基于启发式规则，可能存在误判
2. 建议结合人工审查使用
3. 检测规则可以根据项目特点进行调整
4. 输出结果包含置信度字段，用于评估检测的可靠性 