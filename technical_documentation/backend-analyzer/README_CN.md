# 后端分析器文档

后端分析器是基于Java的分析引擎，为后端应用程序提供全面的代码变更影响分析，专门支持Spring Boot和微服务架构。

## 📋 文档索引

### 核心实现
- [`ARCHITECTURE_CN.md`](./ARCHITECTURE_CN.md) - 系统架构和设计模式
- [`CLASSIFICATION_SYSTEM_CN.md`](./CLASSIFICATION_SYSTEM_CN.md) - 变更分类系统实现
- [`API_REFERENCE_CN.md`](./API_REFERENCE_CN.md) - Java API文档和用法

### 架构设计
- [`MICROSERVICES_IMPROVEMENTS_CN.md`](./MICROSERVICES_IMPROVEMENTS_CN.md) - 微服务架构增强
- [`SPRING_BOOT_INTEGRATION_CN.md`](./SPRING_BOOT_INTEGRATION_CN.md) - Spring Boot特定分析功能
- [`PERFORMANCE_OPTIMIZATION_CN.md`](./PERFORMANCE_OPTIMIZATION_CN.md) - 性能调优和优化

### 实现指南
- [`SETUP_GUIDE_CN.md`](./SETUP_GUIDE_CN.md) - 开发环境设置
- [`CONFIGURATION_CN.md`](./CONFIGURATION_CN.md) - 配置选项和自定义
- [`TESTING_GUIDE_CN.md`](./TESTING_GUIDE_CN.md) - 测试策略和最佳实践

### 故障排除
- [`COMMON_ISSUES_CN.md`](./COMMON_ISSUES_CN.md) - 常见问题和解决方案
- [`DEBUG_GUIDE_CN.md`](./DEBUG_GUIDE_CN.md) - 调试技术和工具

## 🔧 主要功能

### 变更分类系统
- **A1: 业务逻辑变更** - Controller/Service处理逻辑修改
- **A2: 接口变更** - API方法签名、参数、返回结构
- **A3: 数据结构变更** - Entity/DTO/数据库模式修改
- **A4: 中间件调整** - 框架升级、配置变更
- **A5: 非功能性修改** - 注释、日志、格式化、性能

### 技术栈
- **Java 8+** - 核心分析引擎
- **Spring Boot** - 框架特定分析
- **Maven/Gradle** - 构建系统集成
- **Spoon** - Java源代码分析
- **AST处理** - 抽象语法树操作

### 支持的框架
- Spring Boot 2.x/3.x
- Spring MVC
- Spring Data JPA
- Spring Security
- 微服务 (Spring Cloud)

## 🚀 快速开始

### 前置条件
```bash
# Java开发工具包
java -version  # 需要JDK 8+

# Maven或Gradle
mvn --version
gradle --version
```

### 构建和运行
```bash
# 构建分析器
mvn clean package -DskipTests

# 运行分析
java -jar target/gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar \
  --analyze /path/to/project \
  --output analysis-result.json
```

### 集成示例
```java
// Java API用法
AnalysisConfig config = new AnalysisConfig();
config.setTargetDirectory("/path/to/project");
config.setOutputFormat(OutputFormat.JSON);

ImpactAnalyzer analyzer = new ImpactAnalyzer(config);
AnalysisResult result = analyzer.analyze();
```

## 📊 分析输出

### 分类结果
```json
{
  "changeClassifications": [
    {
      "filePath": "src/main/java/com/example/UserController.java",
      "category": "A1_BUSINESS_LOGIC",
      "confidence": 85.5,
      "indicators": ["业务处理方法", "服务层修改"]
    }
  ],
  "classificationSummary": {
    "A1_BUSINESS_LOGIC": 12,
    "A2_INTERFACE_CHANGES": 5,
    "A3_DATA_STRUCTURE": 3,
    "A4_MIDDLEWARE": 2,
    "A5_NON_FUNCTIONAL": 8
  }
}
```

## 🔗 相关文档

- [前端分析器](../frontend-analyzer/) - 前端代码分析
- [Golang分析器](../golang-analyzer/) - Go代码分析
- [构建工具](../build-tools/) - 构建和打包工具
- [VSCode插件](../vscode-plugin/) - IDE集成

---

[**English**](./README.md) | **中文版** 