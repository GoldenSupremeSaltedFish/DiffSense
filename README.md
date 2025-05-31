# GitImpact

GitImpact 是一个用于分析 Git 代码变更影响范围的工具。它可以帮助你：

- 分析两个 commit/tag 之间的代码变更
- 识别受影响的方法和类
- 分析方法调用关系，找出潜在的影响范围
- 推荐需要运行的测试用例

## 功能特点

- 基于 JGit 的 Git 差异分析
- 使用 JavaParser 进行源码解析
- 支持方法级别的影响分析
- 自动推荐相关的单元测试
- 支持 JSON 和 Markdown 格式的报告输出

## 使用方法

编译项目：

```bash
mvn clean package
```

运行工具：

```bash
java -jar target/gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar \
  --repo /path/to/git/repo \
  --base HEAD~1 \
  --target HEAD \
  --format markdown \
  --output report.md
```

### 命令行参数

- `-r, --repo`: Git 仓库路径（必需）
- `-b, --base`: 基准 commit/tag（必需）
- `-t, --target`: 目标 commit/tag（必需）
- `-f, --format`: 输出格式，支持 json 或 markdown（默认：markdown）
- `-o, --output`: 输出文件路径（必需）
- `-h, --help`: 显示帮助信息
- `-V, --version`: 显示版本信息

## 报告示例

Markdown 格式的报告包含以下部分：

```markdown
# 代码变更影响分析报告

## 直接修改的方法
- `UserService.createUser` (src/main/java/com/example/service/UserService.java)

## 间接影响的方法
- `AuthService.authenticate`
- `UserController.registerUser`

## 建议运行的测试
### UserServiceTest
- `testCreateUser`
- `testUpdateUser`

### AuthServiceTest
- `testAuthenticate`
```

## 依赖项

- Java 11 或更高版本
- Maven 3.6 或更高版本
- JGit
- JavaParser
- picocli
- Jackson（JSON 处理）

## 许可证

MIT License