# DiffSense

[![Version](https://img.shields.io/badge/version-0.1.12-blue.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE.txt)
[![VSCode](https://img.shields.io/badge/VSCode-1.74.0+-orange.svg)](https://code.visualstudio.com/)
[![Marketplace](https://img.shields.io/badge/Marketplace-DiffSense-orange.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

🚀 智能Git代码影响分析工具，支持Java、Golang、前端代码的变更影响分析和可视化

[English](./README_EN.md) | 中文

## ✨ 主要功能

- **🔍 多语言支持**: Java、Golang、TypeScript/React代码分析
- **📊 影响分析**: 自动检测代码变更的影响范围
- **🎯 智能检测**: 自动识别项目类型和语言
- **📈 可视化**: 直观的调用关系图和影响报告
- **📩 一键汇报**: 智能bug汇报功能

## 🚀 快速开始

### 安装方式

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

### 使用步骤
1. 打开包含Git仓库的项目
2. 在活动栏找到DiffSense图标
3. 选择分析范围和类型
4. 点击"开始分析"

## 📋 支持的分析类型

### 后端分析
- **Java项目**: Maven/Gradle项目分析
- **Golang项目**: Go模块分析
- **方法调用链**: 深度调用关系分析

### 前端分析
- **依赖分析**: 文件依赖关系
- **组件影响**: UI组件变更影响
- **入口点分析**: 函数调用入口

### 混合项目
- **全栈分析**: 前后端交互影响
- **API变更**: 接口变更影响分析

## 🛠️ 系统要求

- VSCode 1.74.0+
- Git
- Java项目需要Maven/Gradle
- Golang项目需要Go 1.16+
- 前端项目需要Node.js

## 📝 更新日志

### 版本 0.1.12 (最新)
- 🎯 **插件名称优化**: 简化显示名称为"DiffSense"，提升品牌识别度
- 📝 **Issue模板改进**: 中文化模板，智能内容截断，URL编码优化
- 📦 **打包优化**: 解决重复文件问题，包大小从52MB优化到37MB
- 🔧 **路径配置修复**: 确保TypeScript编译产物正确包含
- 🌐 **远程开发支持**: 完善SSH/WSL/容器环境兼容性

### 版本 0.1.7
- 🔧 **增强路径解析**: 5种策略自动适配各种环境，完美解决远程开发问题
- 🌐 **远程环境修复**: 完全兼容SSH/WSL/容器/云端开发环境
- 📦 **JAR文件捆绑**: Java分析器现已内置到扩展中，无需外部依赖
- 🔍 **改进诊断**: 详细的环境检测和调试功能，快速定位问题
- 🏗️ **微服务增强**: 支持最多100层目录递归，适配复杂企业级项目
- 🐛 **依赖修复**: 完整的glob模块捆绑，解决"模块未找到"错误

### 版本 0.1.0
- 🎉 首次发布，支持Java、Golang、前端项目分析
- 📊 调用图可视化
- 🔍 基础影响分析
- 📈 风险评分系统

## 📞 支持与反馈

遇到问题？使用内置的📩一键汇报功能，我们会快速响应！

**支持渠道**:
- 🐛 问题报告: [GitHub Issues](https://github.com/GoldenSupremeSaltedFish/DiffSense/issues)
- 💡 功能建议: [GitHub Discussions](https://github.com/GoldenSupremeSaltedFish/DiffSense/discussions)
- 📚 文档: [Wiki](https://github.com/GoldenSupremeSaltedFish/DiffSense/wiki)
- 🛒 插件市场: [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

---

Made with ❤️ by DiffSense Team 