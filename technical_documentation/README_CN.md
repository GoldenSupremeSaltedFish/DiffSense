# DiffSense 技术文档

本目录包含 DiffSense 所有组件的完整技术文档，按模块组织。

## 📂 文档结构

### 🔧 后端分析器
- [`backend-analyzer/`](./backend-analyzer/) - 基于Java的后端代码分析引擎
  - 变更分类系统实现
  - 微服务架构改进
  - 性能优化指南

### 🎨 前端分析器
- [`frontend-analyzer/`](./frontend-analyzer/) - 基于Node.js的前端代码分析引擎
  - React/Vue组件分析
  - 依赖关系跟踪系统
  - 快照对比算法

### 🐹 Golang分析器
- [`golang-analyzer/`](./golang-analyzer/) - Go代码分析引擎
  - Go模块依赖分析
  - Goroutine影响跟踪
  - 性能分析集成

### 🛠️ 构建工具
- [`build-tools/`](./build-tools/) - 构建系统和打包工具
  - 完整构建流程文档
  - 打包检查清单和验证
  - CI/CD集成指南

### 🔌 VSCode插件
- [`vscode-plugin/`](./vscode-plugin/) - Visual Studio Code扩展
  - 扩展架构和设计
  - UI/UX实现细节
  - 插件API文档

## 🌐 语言支持

所有技术文档都提供中英文双版本：
- **English**: 默认文档文件
- **中文**: 带有 `_CN` 后缀的文件（如：`ARCHITECTURE_CN.md`）

## 📋 文档类型

- **架构设计**: 系统设计和组件关系
- **实现指南**: 详细的技术实现指导
- **API参考**: 函数和类文档
- **部署指南**: 构建、打包和部署流程
- **故障排除**: 常见问题和解决方案

## 🔄 文档规范

### 文件命名约定
- 英文版: `DOCUMENT_NAME.md`
- 中文版: `DOCUMENT_NAME_CN.md`

### 内容结构
1. **概述** - 简要描述和目的
2. **架构** - 系统设计和组件
3. **实现** - 技术细节和代码示例
4. **配置** - 设置和自定义选项
5. **API参考** - 函数签名和用法
6. **示例** - 实际使用场景
7. **故障排除** - 常见问题和解决方案

## 🚀 快速导航

| 模块 | 英文文档 | 中文文档 | 主要功能 |
|------|---------|---------|---------|
| 后端分析器 | [📁](./backend-analyzer/) | [📁](./backend-analyzer/) | Java分析，Spring Boot支持 |
| 前端分析器 | [📁](./frontend-analyzer/) | [📁](./frontend-analyzer/) | React/Vue分析，组件跟踪 |
| Golang分析器 | [📁](./golang-analyzer/) | [📁](./golang-analyzer/) | Go模块分析，并发跟踪 |
| 构建工具 | [📁](./build-tools/) | [📁](./build-tools/) | 自动化构建，打包，CI/CD |
| VSCode插件 | [📁](./vscode-plugin/) | [📁](./vscode-plugin/) | 扩展开发，UI/UX |

## 📞 文档贡献指南

添加或更新文档时：

1. **创建双版本**: 始终提供英文和中文版本
2. **遵循命名约定**: 中文文档使用 `_CN` 后缀
3. **更新索引**: 将新文档添加到相关模块的README文件中
4. **交叉引用**: 在模块间链接相关文档
5. **保持同步**: 确保两种语言版本具有等效内容

---

[**English**](./README.md) | **中文版** 