# DiffSense Plugin Artifacts

[![Version](https://img.shields.io/badge/version-0.1.12-blue.svg)](https://github.com/GoldenSupremeSaltedFish/DiffSense)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE.txt)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/GoldenSupremeSaltedFish/DiffSense/actions)

🚀 **生产就绪的 DiffSense VSCode 插件产物仓库**

这个仓库包含 DiffSense 插件的完整构建产物，保持与源码相同的目录结构，支持独立调试和测试。

[🔗 源代码仓库](https://github.com/GoldenSupremeSaltedFish/DiffSense) | [🐛 问题反馈](https://github.com/GoldenSupremeSaltedFish/DiffSense/issues) | [📚 文档](https://github.com/GoldenSupremeSaltedFish/DiffSense/wiki)

---

## 🚀 快速开始

### 方式一：直接调试（推荐）
```bash
# 克隆产物仓库
git clone https://github.com/GoldenSupremeSaltedFish/Diffsense-artifacts.git
cd Diffsense-artifacts

# 在 VS Code 中打开
code .

# 按 F5 开始调试 - 无需任何编译！
```

### 方式二：安装 VSIX
```bash
# 下载并安装插件
code --install-extension diffsense-*.vsix
```

### 方式三：本地开发测试
```bash
# 适合想要快速测试功能的开发者
npm install -g @vscode/vsce
vsce package  # 重新打包（如有需要）
```

---

## 📁 目录结构

```
DiffSense-Artifacts/
├── 📦 *.vsix                   # VSCode 插件安装包
├── 📄 package.json            # 插件元数据和配置
├── 📄 tsconfig.json           # TypeScript 配置
├── 🖼️ icon.png                # 插件图标
├── 📄 LICENSE.txt             # 许可证
├── 📄 .vscodeignore           # VSCode 打包忽略配置
├── 📄 runtime-config.json     # 运行时配置和构建信息
│
├── 📂 dist/                   # 编译后的 TypeScript 代码
│   ├── extension.js           # 插件主入口
│   └── ...                   # 其他编译产物
│
├── 📂 ui/                     # 前端 UI 构建产物
│   └── diffsense-frontend/   # React 应用构建结果
│       ├── dist/             # 前端静态资源
│       └── package.json      # 前端包配置
│
└── 📂 analyzers/              # 语言分析器（含运行时依赖）
    ├── node-analyzer/        # Node.js/TypeScript 分析器
    ├── golang-analyzer/      # Golang 分析器
    └── java-analyzer/        # Java 分析器 JAR 文件
```

---

## 🔧 使用场景

### 🐛 快速调试和测试
- **无需编译**：直接使用编译后的产物
- **完整功能**：包含所有分析器和 UI 组件
- **即开即用**：克隆后立即可以在 VS Code 中按 F5 调试

### 📦 插件分发和部署
- **VSIX 安装包**：可直接安装到 VS Code
- **CI/CD 集成**：适合自动化测试和部署
- **版本管理**：每个构建都有对应的版本标识

### 🔬 功能验证
- **API 测试**：测试分析器接口
- **UI 验证**：验证前端界面和交互
- **性能测试**：在生产环境中测试性能

---

## 🛠️ 调试指南

### 在 VS Code 中调试
1. **打开项目**：`code .`
2. **查看调试配置**：检查 `.vscode/launch.json`（如果存在）
3. **启动调试**：按 `F5` 或从调试面板启动
4. **测试功能**：在新的 Extension Development Host 窗口中测试

### 手动测试步骤
1. **安装插件**：
   ```bash
   code --install-extension diffsense-*.vsix
   ```

2. **打开测试项目**：
   - 创建或打开一个 Git 仓库
   - 确保项目包含支持的语言（Java、Golang、TypeScript）

3. **运行分析**：
   - 打开 DiffSense 侧边栏
   - 选择分析范围和类型
   - 查看分析结果

### 故障排除
- **插件无法启动**：检查 `runtime-config.json` 中的构建信息
- **分析器错误**：确保项目类型与分析器匹配
- **UI 显示问题**：检查前端资源是否完整加载

---

## 📊 构建信息

检查 `runtime-config.json` 文件获取详细的构建信息：

```json
{
  "version": "0.1.12",
  "buildTime": "2024-01-20T10:30:00Z",
  "commit": "abc123...",
  "isProduction": true,
  "debugMode": true,
  "artifactsOnly": true
}
```

- **version**: 插件版本号
- **buildTime**: 构建时间
- **commit**: 源码提交哈希
- **isProduction**: 生产构建标识
- **debugMode**: 支持调试模式
- **artifactsOnly**: 仅包含产物标识

---

## ⚡ 性能特点

- **🚀 零编译启动**：无需 TypeScript 编译，直接运行
- **📦 完整依赖**：包含所有运行时依赖，无需额外安装
- **💾 体积优化**：只包含运行时必需文件，去除源码
- **🔄 热更新**：支持调试时的热重载

---

## 🤝 贡献和反馈

这是一个自动生成的产物仓库，**不接受直接 PR**。

### 如何贡献
1. 🔗 前往 [源代码仓库](https://github.com/GoldenSupremeSaltedFish/DiffSense)
2. 🍴 Fork 并创建 feature 分支
3. 📝 提交 PR 到主仓库
4. ✅ 合并后产物会自动更新到此仓库

### 问题反馈
- 🐛 **Bug 报告**：[Issues](https://github.com/GoldenSupremeSaltedFish/DiffSense/issues)
- 💡 **功能建议**：[Discussions](https://github.com/GoldenSupremeSaltedFish/DiffSense/discussions)
- 📞 **技术支持**：通过 DiffSense 插件的内置反馈功能

---

## 🔄 更新频率

- **自动更新**：主仓库每次 push 到 main 分支时自动触发
- **构建触发**：通过 GitHub Actions CI/CD 自动构建
- **版本标识**：每次更新都包含完整的版本和构建信息

---

## 📄 许可证

本产物遵循与源代码相同的 [Apache-2.0](LICENSE.txt) 许可证。

---

<div align="center">

**Made with ❤️ by DiffSense Team**

[🌟 Star](https://github.com/GoldenSupremeSaltedFish/DiffSense) | [📖 Docs](https://github.com/GoldenSupremeSaltedFish/DiffSense/wiki) | [💬 Discussions](https://github.com/GoldenSupremeSaltedFish/DiffSense/discussions)

</div> 