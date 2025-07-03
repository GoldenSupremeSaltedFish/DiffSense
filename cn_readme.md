# DiffSense

DiffSense 是一款强大的代码变更影响分析工具，以 VSCode 插件形式提供。它通过静态代码分析和版本差异比对，帮助开发者快速理解代码变更的影响范围和风险。

[![Version](https://img.shields.io/badge/version-0.1.12-blue.svg)](https://github.com/GoldenSupremeSaltedFish/DiffSense)
[![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)](./LICENSE.txt)
[![VSCode](https://img.shields.io/badge/VSCode-1.74.0+-blueviolet.svg)](https://code.visualstudio.com/)
[![Marketplace](https://img.shields.io/badge/Marketplace-DiffSense-orange.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

## ✨ 主要特性

- 🔍 **多语言支持**
  - Java 后端代码分析（Spring Boot、Maven/Gradle项目）
  - Golang 后端代码分析
  - TypeScript/JavaScript 前端代码分析（React、Vue）
  - 支持全栈项目综合分析

- 🎯 **精准分析**
  - 方法级别的影响分析
  - 类级别的变更追踪
  - 调用链路可视化
  - 前端组件依赖分析
  - API接口变更影响评估

- 🌈 **智能界面**
  - 自动适配 VSCode 主题
  - 直观的分析结果展示
  - 交互式调用关系图
  - 多语言界面（中文/英文）
  - 风险等级颜色编码

- 📊 **丰富报告**
  - JSON/HTML 格式导出
  - 详细的变更分类报告
  - 支持持续集成流水线
  - 历史变更趋势分析

## 🚀 快速开始

### 安装插件

#### 方式一：从 VSCode 插件市场安装（推荐）
1. 打开 VSCode
2. 按 `Ctrl+P`（Mac 上按 `Cmd+P`）打开快速打开
3. 输入：`ext install humphreyLi.diffsense`
4. 按回车安装

#### 方式二：从扩展面板安装
1. 打开 VSCode
2. 进入扩展面板（`Ctrl+Shift+X`）
3. 搜索 "DiffSense"
4. 点击安装

#### 方式三：从 VSIX 文件安装
1. 从 [Releases](https://github.com/GoldenSupremeSaltedFish/DiffSense/releases) 下载最新的 VSIX 文件
2. 在 VSCode 中，进入扩展面板
3. 点击 "..." 菜单，选择 "从 VSIX 安装..."
4. 选择下载的 VSIX 文件

### 使用步骤
1. 打开任意 Git 仓库项目
2. 在 VSCode 侧边栏找到 DiffSense 图标
3. 选择要分析的提交范围或分支
4. 选择分析类型（方法级/类级/全栈）
5. 点击"开始分析"按钮
6. 查看分析结果和可视化图表

## 💡 分析模式详解

### 后端代码分析
- **A1-业务逻辑变更**: Controller/Service 处理逻辑修改
- **A2-接口变更**: API 方法签名、参数、返回值结构变更
- **A3-数据结构变更**: Entity/DTO/数据库模式变更
- **A4-中间件调整**: 框架升级、配置文件、连接池参数调整
- **A5-非功能性修改**: 注释、日志、代码格式、性能优化

### 前端代码分析
- **组件依赖分析**: 识别 React/Vue 组件间的依赖关系
- **Props/State 变更**: 跟踪组件接口变更
- **Hook 使用分析**: useEffect、useState 等 Hook 依赖变更
- **路由影响**: 页面路由变更的影响范围

### 全栈分析
- **API 契约变更**: 前后端接口契约一致性检查
- **数据流追踪**: 从前端到后端的完整数据流分析
- **微服务依赖**: 跨服务调用影响分析

## 📝 支持的项目类型

### Java 项目
- Spring Boot 应用
- Maven/Gradle 构建系统
- JDK 8+ 支持
- 微服务架构支持

### Golang 项目
- Go Module 项目
- Gin/Echo 等 Web 框架
- Go 1.16+ 支持

### 前端项目
- React 16+ 项目
- Vue 2/3 项目
- TypeScript/JavaScript
- Webpack/Vite 构建工具

## 🛠️ 系统要求

- **VSCode**: 1.74.0 或更高版本
- **Git**: 2.20.0 或更高版本
- **Java 项目**: JDK 8+，Maven 3.6+ 或 Gradle 6+
- **Golang 项目**: Go 1.16+
- **前端项目**: Node.js 14+

## 📁 项目结构

```
DiffSense/
├── plugin/                    # VSCode插件核心
├── ui/                       # 前端UI组件
├── src/main/java/           # Java后端分析器
├── technical_documentation/ # 技术文档
└── build-tools/            # 构建工具
```

## 🔧 开发和构建

### 本地开发
```bash
# 克隆项目
git clone https://github.com/GoldenSupremeSaltedFish/DiffSense.git
cd DiffSense

# 构建所有组件
./build-all.bat

# 检查构建结果
./check-build.bat
```

### 打包发布
```bash
# 打包VSCode插件
cd plugin
npm run package
```

## 🤝 贡献指南

1. Fork 项目到你的 GitHub
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的修改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 Apache-2.0 许可证 - 查看 [LICENSE](LICENSE.txt) 文件了解详情

## 🌟 致谢

感谢所有为 DiffSense 做出贡献的开发者和用户！

## 📞 支持与反馈

- 🐛 [报告问题](https://github.com/GoldenSupremeSaltedFish/DiffSense/issues)
- 💡 [功能建议](https://github.com/GoldenSupremeSaltedFish/DiffSense/discussions)
- 📚 [技术文档](./technical_documentation/)
- 🛒 [VSCode 插件市场](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

---

[English](./README.md) | **中文版** 