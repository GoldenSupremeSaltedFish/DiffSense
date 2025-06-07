# DiffSense 统一跨语言 CLI 接口实现方案

## 📋 概述
基于当前项目结构，实现统一的跨语言CLI接口，支持Java/Go/TypeScript/C++代码分析。

## 🎯 当前状态分析

### 现有CLI工具
1. **Java分析器**: `gitimpact.jar` (PicoCLI)
2. **回归分析器**: `regression-analyzer` (Commander.js)  
3. **前端分析器**: `diffsense-analyzer` (简单参数)
4. **Go分析器**: `diffsense-go-analyzer` (简单参数)

### 问题
- 接口不统一，参数命名不一致
- 输出格式各异
- 用户体验分散

## 🛠️ 统一CLI接口设计

### 核心命令结构
```bash
diffsense-cli <command> [subcommand] [options]
```

### 主要命令

#### 1. analyze - 代码分析
```bash
diffsense-cli analyze \
  --lang <java|go|ts|cpp> \
  --mode <diff|full|hybrid> \
  --from <git_commit_ref> \
  --to <git_commit_ref> \
  --repo <repo_path> \
  --scope <package_or_dir> \
  --max-depth <n> \
  --max-files <n> \
  --format <json|html|markdown> \
  --output <output_file>
```

#### 2. impacted - 影响分析
```bash
diffsense-cli impacted \
  --lang <language> \
  --from <commit> \
  --to <commit> \
  --repo <path> \
  --format <json|text>
```

#### 3. callgraph - 调用图分析
```bash
diffsense-cli callgraph \
  --lang <language> \
  --target <method_or_function> \
  --repo <path> \
  --max-depth <n> \
  --format <json|dot|svg>
```

#### 4. recommend-tests - 测试推荐
```bash
diffsense-cli recommend-tests \
  --lang <language> \
  --from <commit> \
  --to <commit> \
  --repo <path> \
  --format <json|text>
```

#### 5. regression - 回归分析
```bash
diffsense-cli regression \
  --mode <analyze|quick|trend|detect-rollback> \
  --repo <path> \
  --commits <n> \
  --format <html|json|markdown>
```

## 🏗️ 实现架构

### 1. 统一入口点 (Shell Wrapper)
```bash
#!/bin/bash
# diffsense-cli - 统一CLI入口

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JAVA_ANALYZER="$SCRIPT_DIR/java-analyzer.jar"
NODE_ANALYZERS="$SCRIPT_DIR/node_modules/.bin"

# 解析命令和语言
COMMAND="$1"
shift

case "$COMMAND" in
  "analyze")
    # 解析--lang参数决定调用哪个分析器
    ;;
  "impacted")
    # 统一影响分析接口
    ;;
  *)
    echo "Unknown command: $COMMAND"
    exit 1
    ;;
esac
```

### 2. Java分析器重构

#### 修改主入口类
```java
@Command(
    name = "diffsense-cli",
    description = "DiffSense 统一代码分析工具",
    subcommands = {
        AnalyzeCommand.class,
        ImpactedCommand.class,
        CallGraphCommand.class,
        RecommendTestsCommand.class
    }
)
public class UnifiedCliMain {
    public static void main(String[] args) {
        int exitCode = new CommandLine(new UnifiedCliMain()).execute(args);
        System.exit(exitCode);
    }
}
```

#### 新增AnalyzeCommand
```java
@Command(
    name = "analyze",
    description = "代码分析"
)
public class AnalyzeCommand implements Callable<Integer> {
    @Option(names = {"--lang"}, description = "语言: java|go|ts|cpp", required = true)
    private String language;
    
    @Option(names = {"--mode"}, description = "模式: diff|full|hybrid", defaultValue = "diff")
    private String mode;
    
    @Option(names = {"--from"}, description = "起始提交", defaultValue = "HEAD~1")
    private String fromCommit;
    
    @Option(names = {"--to"}, description = "结束提交", defaultValue = "HEAD")
    private String toCommit;
    
    @Option(names = {"--repo"}, description = "仓库路径", defaultValue = ".")
    private String repoPath;
    
    @Option(names = {"--max-depth"}, description = "最大深度", defaultValue = "10")
    private int maxDepth;
    
    @Option(names = {"--format"}, description = "输出格式: json|html|markdown", defaultValue = "json")
    private String format;
    
    @Override
    public Integer call() throws Exception {
        // 根据语言调用相应的分析器
        switch (language.toLowerCase()) {
            case "java":
                return analyzeJava();
            case "go":
                return delegateToGoAnalyzer();
            case "ts":
                return delegateToTsAnalyzer();
            case "cpp":
                return delegateToCppAnalyzer();
            default:
                System.err.println("不支持的语言: " + language);
                return 1;
        }
    }
}
```

### 3. Node.js分析器适配

#### 创建统一适配器
```javascript
// cli-adapter.js - Node.js分析器统一适配器
class CliAdapter {
    constructor() {
        this.analyzers = {
            ts: require('./node-analyzer/analyze.js'),
            go: require('./golang-analyzer/analyze.js'),
            regression: require('./regression-analyzer/index.js')
        };
    }

    async execute(command, options) {
        const { lang, mode, from, to, repo, format, maxDepth } = options;
        
        switch (command) {
            case 'analyze':
                return this.analyze(lang, options);
            case 'impacted':
                return this.getImpacted(lang, options);
            default:
                throw new Error(`Unknown command: ${command}`);
        }
    }

    async analyze(lang, options) {
        const analyzer = this.analyzers[lang];
        if (!analyzer) {
            throw new Error(`Unsupported language: ${lang}`);
        }

        // 统一参数格式
        const standardOptions = this.normalizeOptions(options);
        
        // 调用具体分析器
        const result = await analyzer.analyze(standardOptions);
        
        // 统一输出格式
        return this.formatOutput(result, options.format);
    }

    normalizeOptions(options) {
        return {
            targetDir: options.repo || process.cwd(),
            maxDepth: options.maxDepth || 10,
            includeTests: true,
            format: options.format || 'json'
        };
    }

    formatOutput(result, format) {
        switch (format) {
            case 'json':
                return JSON.stringify(result, null, 2);
            case 'summary':
                return this.generateSummary(result);
            default:
                return JSON.stringify(result, null, 2);
        }
    }
}
```

## 📊 统一输出格式

### 标准JSON输出结构
```json
{
  "version": "1.0.0",
  "timestamp": "2024-01-01T12:00:00Z",
  "language": "java",
  "mode": "diff",
  "repository": "./my-project",
  "commits": {
    "from": "abc123",
    "to": "def456"
  },
  "summary": {
    "totalFiles": 15,
    "impactedFiles": 5,
    "impactedMethods": 12,
    "testCoverage": 85.5
  },
  "impactedMethods": [
    {
      "signature": "org.example.Foo::bar()",
      "file": "src/main/java/org/example/Foo.java",
      "line": 42,
      "changeType": "modified",
      "riskLevel": "medium"
    }
  ],
  "callGraph": {
    "nodes": [
      {
        "id": "org.example.Foo::bar()",
        "type": "method",
        "file": "src/main/java/org/example/Foo.java"
      }
    ],
    "edges": [
      {
        "source": "org.example.Foo::bar()",
        "target": "org.example.Util::helper()",
        "type": "calls"
      }
    ]
  },
  "recommendedTests": [
    {
      "testClass": "org.example.FooTest",
      "testMethod": "testBar",
      "reason": "直接测试受影响方法",
      "priority": "high"
    }
  ]
}
```

## 🚀 实施步骤

### 阶段1: 核心重构 (1-2周)
1. ✅ 重构Java主分析器
   - 创建UnifiedCliMain
   - 实现AnalyzeCommand、ImpactedCommand等
   - 统一参数命名和输出格式

2. ✅ 创建Shell Wrapper
   - 实现diffsense-cli入口脚本
   - 支持Windows和Unix平台

### 阶段2: 分析器集成 (2-3周)
1. ✅ Node.js分析器适配
   - 创建CliAdapter统一接口
   - 重构现有分析器以符合新接口

2. ✅ 输出格式统一
   - 实现标准JSON输出
   - 支持多种输出格式转换

### 阶段3: 功能增强 (2-3周)
1. ✅ C++分析器开发
   - 基于ctags/clangd实现
   - 集成到统一CLI

2. ✅ 高级功能
   - 配置文件支持
   - 缓存机制
   - 性能优化

### 阶段4: 测试和文档 (1-2周)
1. ✅ 集成测试
2. ✅ 文档更新
3. ✅ VSCode插件适配

## 🔧 配置文件支持

### diffsense.config.json
```json
{
  "version": "1.0",
  "languages": {
    "java": {
      "sourcePatterns": ["src/main/java/**/*.java"],
      "testPatterns": ["src/test/java/**/*.java"],
      "excludePatterns": ["**/generated/**"]
    },
    "go": {
      "sourcePatterns": ["**/*.go"],
      "testPatterns": ["**/*_test.go"],
      "excludePatterns": ["vendor/**"]
    }
  },
  "analysis": {
    "maxDepth": 15,
    "maxFiles": 1000,
    "enableCaching": true,
    "cacheDir": ".diffsense-cache"
  },
  "output": {
    "defaultFormat": "json",
    "includeCallGraph": true,
    "includeTestRecommendations": true
  }
}
```

## 📈 兼容性矩阵

| 功能 | Java | Go | TypeScript | C++ |
|------|------|----|-----------|----|
| 基础分析 | ✅ | ✅ | ✅ | ⚠️ |
| 调用图 | ✅ | ✅ | ✅ | ⚠️ |
| 测试推荐 | ✅ | ✅ | ✅ | ❌ |
| 回归分析 | ✅ | ⚠️ | ⚠️ | ❌ |

注: ✅ 完整支持, ⚠️ 部分支持, ❌ 不支持

## 🎉 预期效果

1. **用户体验统一**: 所有语言使用相同的CLI接口
2. **维护性提升**: 统一的参数处理和错误处理
3. **扩展性增强**: 轻松添加新语言支持
4. **集成友好**: VSCode插件可以使用统一接口调用后端 