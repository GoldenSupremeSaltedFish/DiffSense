# 微服务项目递归深度优化

## 问题描述

在分析微服务项目时，原有的文件类型检测和代码分析器的递归深度配置不足，导致无法正确识别深层目录结构中的项目文件类型。微服务项目通常具有更深的目录层次结构，例如：

```
project-root/
├── services/
│   ├── user-service/
│   │   ├── internal/
│   │   │   ├── domain/
│   │   │   │   ├── service/
│   │   │   │   │   └── user_service.go
│   │   │   │   └── model/
│   │   │   │       └── user.go
│   │   │   └── infrastructure/
│   │   │       └── persistence/
│   │   │           └── user_repository.go
│   │   └── go.mod
│   └── order-service/
│       └── src/
│           └── main/
│               └── java/
│                   └── com/
│                       └── company/
│                           └── order/
│                               └── OrderService.java
└── frontend/
    └── packages/
        └── shared/
            └── components/
                └── common/
                    └── Button.tsx
```

## 解决方案

### 1. 前端文件类型检测增强

**文件**: `plugin/src/extension.ts`

增强了所有文件类型检测函数的glob配置：

- **Java项目检测**: 增加`maxDepth: 15`配置
  - Maven文件搜索 (`**/pom.xml`)
  - Gradle文件搜索 (`**/build.gradle*`)
  - Java源文件搜索 (`**/*.java`)

- **Go项目检测**: 增加`maxDepth: 15`配置
  - Go module文件搜索 (`**/go.mod`)
  - Go源文件搜索 (`**/*.go`)

- **前端项目检测**: 增加`maxDepth: 15`配置
  - package.json文件搜索
  - TypeScript配置文件搜索
  - 前端源文件搜索

### 2. 前端分析器深度配置

**文件**: `ui/node-analyzer/analyze.js`

```javascript
class FrontendAnalyzer {
  constructor(targetDir, options = {}) {
    this.options = {
      // ... 其他配置
      maxDepth: 15, // 增加递归深度以支持微服务项目
      ...options
    };
  }
  
  async analyzeCode() {
    const files = glob.sync(this.options.filePattern, {
      cwd: this.targetDir,
      ignore: this.options.exclude,
      absolute: true,
      maxDepth: this.options.maxDepth // 使用配置的深度
    });
  }
}
```

### 3. Golang分析器深度配置

**文件**: `ui/golang-analyzer/analyze.js`

```javascript
class GolangAnalyzer {
  constructor(targetDir, options = {}) {
    this.options = {
      // ... 其他配置
      maxDepth: 15, // 增加递归深度以支持微服务项目
      ...options
    };
  }
  
  async analyzeGoCodeEnhanced() {
    const businessFiles = glob.sync(this.options.filePattern, {
      cwd: this.targetDir,
      ignore: [...this.options.exclude, '**/*_test.go'],
      absolute: true,
      maxDepth: this.options.maxDepth // 使用配置的深度
    });
  }
}
```

### 4. Java后端分析器配置增强

**文件**: `src/main/java/com/yourorg/gitimpact/config/AnalysisConfig.java`

```java
public class AnalysisConfig {
    private static final int DEFAULT_MAX_DEPTH = 10; // 从5增加到10
    private static final int DEFAULT_MAX_FILES = 500; // 从200增加到500
}
```

**文件**: `src/main/java/com/yourorg/gitimpact/inspect/InspectConfig.java`

```java
public class InspectConfig {
    private static final int DEFAULT_DEPTH = 10; // 从5增加到10
}
```

**文件**: `src/main/java/com/yourorg/gitimpact/cli/InspectCommand.java`

```java
@Option(
    names = {"--depth"},
    description = "分析调用链的最大深度（默认: 10）", // 从5更新到10
    required = false
)
private Integer depth;

// 构建配置时使用新的默认值
.depth(depth != null ? depth : 10) // 从5增加到10
```

## 改进效果

### 1. 文件类型检测准确性提升

- **支持更深的目录结构**: 从默认的glob深度提升到15层
- **微服务架构友好**: 能够正确识别深层嵌套的服务目录
- **多项目workspace支持**: 支持monorepo结构的项目

### 2. 代码分析深度提升

- **调用链分析**: 调用链分析深度从5层增加到10层
- **影响分析准确性**: 能够发现更深层次的方法调用关系
- **测试覆盖分析**: 更准确地分析测试覆盖范围

### 3. 性能优化

- **文件数量限制**: 从200个文件增加到500个文件
- **智能过滤**: 保持原有的ignore模式，避免分析不必要的文件
- **缓存机制**: 利用现有的缓存机制提升分析性能

## 配置说明

### 前端/插件配置

文件类型检测的深度现在默认设置为15层，可以通过修改对应的`maxDepth`参数进行调整。

### Java后端配置

可以通过以下方式自定义分析深度：

```bash
# 使用CLI命令指定深度
java -jar gitimpact.jar inspect --branch feature/new-feature --depth 15

# 或使用默认配置（现在是10层）
java -jar gitimpact.jar inspect --branch feature/new-feature
```

### 分析器配置

前端和Golang分析器支持在构造时传入自定义配置：

```javascript
// 自定义深度配置
const analyzer = new FrontendAnalyzer(targetDir, {
  maxDepth: 20 // 自定义更深的递归深度
});
```

## 兼容性

- **向后兼容**: 所有更改都是向后兼容的
- **性能影响**: 虽然增加了搜索深度，但通过合理的ignore模式避免了性能问题
- **配置灵活**: 支持通过参数自定义深度，满足不同项目需求

## 建议使用场景

1. **微服务架构项目**: 特别适用于具有深层目录结构的微服务项目
2. **Monorepo项目**: 支持多个子项目在同一仓库中的场景
3. **复杂企业级应用**: 适用于具有多层架构的大型应用程序
4. **多技术栈项目**: 支持前后端混合、多语言的复杂项目结构 