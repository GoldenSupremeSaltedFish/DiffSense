# DiffSense Plugin 独立调试指南

本目录包含了 DiffSense 插件的完整代码，可以独立进行调试和测试。

## 🔧 环境要求

- Node.js (v16+)
- npm 或 yarn

## 📁 目录结构

```
plugin/
├── analyzers/
│   ├── node-analyzer/          # 前端代码分析器
│   │   ├── analyze.js          # 主分析器
│   │   ├── granularAnalyzer.js # 细粒度分析器
│   │   ├── modificationType.js # 修改类型定义
│   │   └── ...
│   └── golang-analyzer/        # Go代码分析器
├── cli-adapter.js              # CLI适配器
├── package.json               # 依赖配置
└── ...
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd plugin
npm install
```

### 2. 基本代码分析

```bash
# 分析TypeScript/JavaScript项目
node analyzers/node-analyzer/analyze.js /path/to/your/project

# 分析Go项目  
node analyzers/golang-analyzer/analyze.js /path/to/your/go/project
```

### 3. 使用CLI适配器

```bash
# 基本分析
node cli-adapter.js analyze --lang ts --repo /path/to/project

# 包含细粒度分析
node cli-adapter.js analyze --lang ts --repo /path/to/project --include-type-tags

# 生成调用图
node cli-adapter.js callgraph --lang ts --repo /path/to/project

# 影响分析
node cli-adapter.js impacted --lang ts --repo /path/to/project --from HEAD~1 --to HEAD
```

## 🎯 细粒度分析功能

细粒度分析功能可以识别24种不同类型的前端代码修改：

### 组件行为类
- `component-logic-change`: 组件逻辑变更
- `hook-change`: React Hook变更
- `lifecycle-change`: 生命周期变更
- `state-management-change`: 状态管理变更

### UI结构类
- `jsx-structure-change`: JSX结构变更
- `template-change`: Vue模板变更
- `component-props-change`: 组件属性变更

### 样式相关
- `css-change`: CSS样式变更
- `style-in-js-change`: CSS-in-JS变更
- `theme-change`: 主题变更

### 交互事件类
- `event-handler-change`: 事件处理变更
- `form-handling-change`: 表单处理变更

### 更多类型...

### 启用细粒度分析

```bash
# 在命令行中添加 --include-type-tags 参数
node cli-adapter.js analyze --lang ts --repo /path/to/project --include-type-tags

# 或直接使用分析器
node analyzers/node-analyzer/analyze.js /path/to/project --include-type-tags
```

## 🔍 调试技巧

### 1. 查看详细日志

分析器会输出详细的执行日志，包括：
- 🔍 开始分析目录
- 🏗️ 微服务项目检测
- 📦 模块依赖分析  
- 🔬 代码结构分析
- 🔍 细粒度修改分析

### 2. 输出格式选择

```bash
# JSON格式（默认）
node cli-adapter.js analyze --lang ts --repo /path/to/project --format json

# 摘要格式
node cli-adapter.js analyze --lang ts --repo /path/to/project --format summary

# 文本格式
node cli-adapter.js analyze --lang ts --repo /path/to/project --format text
```

### 3. 调整分析参数

```bash
# 调整分析深度
node cli-adapter.js analyze --lang ts --repo /path/to/project --max-depth 20

# 限制文件数量
node cli-adapter.js analyze --lang ts --repo /path/to/project --max-files 500
```

## 🧪 测试验证

### 验证模块导入

```javascript
// 创建测试文件 test-imports.js
try {
    const FrontendAnalyzer = require('./analyzers/node-analyzer/analyze.js');
    const { ModificationType } = require('./analyzers/node-analyzer/modificationType.js');
    const FrontendGranularAnalyzer = require('./analyzers/node-analyzer/granularAnalyzer.js');
    const CliAdapter = require('./cli-adapter.js');
    
    console.log('✅ 所有模块导入成功');
    console.log('细粒度类型数量:', Object.keys(ModificationType).length);
} catch (error) {
    console.error('❌ 模块导入失败:', error.message);
}
```

### 测试分析功能

```javascript
// 创建简单的分析测试
const FrontendAnalyzer = require('./analyzers/node-analyzer/analyze.js');

async function test() {
    const analyzer = new FrontendAnalyzer('./test-project', { 
        includeTypeTags: true 
    });
    const result = await analyzer.analyze();
    console.log('分析结果:', result.summary);
}

test().catch(console.error);
```

## ⚙️ 配置选项

### FrontendAnalyzer 选项

```javascript
const options = {
    includeNodeModules: false,          // 是否包含 node_modules
    filePattern: '**/*.{js,jsx,ts,tsx,vue}', // 文件匹配模式
    exclude: ['node_modules/**', 'dist/**'], // 排除模式
    maxDepth: 15,                       // 最大递归深度
    includeTypeTags: true,              // 启用细粒度分析
    enableMicroserviceDetection: true,  // 启用微服务检测
    enableBuildToolDetection: true,     // 启用构建工具检测
    enableFrameworkDetection: true      // 启用框架检测
};
```

## 🔧 故障排除

### 常见问题

1. **模块导入失败**
   - 确保在 plugin 目录下运行
   - 检查 package.json 依赖是否安装

2. **分析结果为空**
   - 检查目标目录是否存在
   - 确认文件匹配模式是否正确

3. **细粒度分析未生效**
   - 确保使用了 `--include-type-tags` 参数
   - 检查是否有可分析的文件

### 调试日志

如果需要更详细的调试信息，可以修改代码中的 `console.error` 输出级别。

## 📝 开发说明

本 plugin 目录是从主项目同步而来，包含了以下主要组件：

1. **前端分析器** (`analyzers/node-analyzer/`)
   - 支持 TypeScript/JavaScript/React/Vue 分析
   - 集成细粒度修改类型检测
   - 支持微服务项目检测

2. **CLI适配器** (`cli-adapter.js`)
   - 统一的命令行接口
   - 支持多种输出格式
   - 集成各种分析功能

3. **细粒度分析器** (`analyzers/node-analyzer/granularAnalyzer.js`)
   - 24种前端修改类型检测
   - 基于文件内容和方法签名的智能分析
   - 可配置的置信度评分

可以独立调试和扩展这些功能。 