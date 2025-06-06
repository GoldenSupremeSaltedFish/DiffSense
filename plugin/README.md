# DiffSense - Git Code Impact Analysis

[![Version](https://img.shields.io/badge/version-0.1.1-blue.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE.txt)
[![VSCode](https://img.shields.io/badge/VSCode-1.74.0+-orange.svg)](https://code.visualstudio.com/)

🚀 智能Git代码影响分析工具，支持Java、Golang、前端代码的变更影响分析和可视化

[English](README_EN.md) | 中文

## ✨ 主要功能

- **🔍 多语言支持**: Java、Golang、TypeScript/React代码分析
- **📊 影响分析**: 自动检测代码变更的影响范围
- **🎯 智能检测**: 自动识别项目类型和语言
- **📈 可视化**: 直观的调用关系图和影响报告
- **📩 一键汇报**: 智能bug汇报功能

## 🚀 快速开始

1. 安装扩展
2. 打开包含Git仓库的项目
3. 在活动栏找到DiffSense图标
4. 选择分析范围和类型
5. 点击"开始分析"

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

### 版本 0.1.1 (最新)
- 🚀 **增强微服务支持**: 递归深度从5层增加到15层，支持复杂的微服务项目结构
- 🔧 **远程开发修复**: 修复VSCode远程环境（SSH、WSL、容器）中的分析器路径问题
- 📊 **提升分析精度**: 增强文件类型检测，支持更深层次的目录结构
- 🐛 **问题修复**: 解决前端分析器在远程环境中的路径解析问题
- 📈 **性能优化**: 优化文件扫描和依赖分析算法

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

---

Made with ❤️ by DiffSense Team 