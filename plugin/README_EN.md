# DiffSense

[![Version](https://img.shields.io/badge/version-0.1.12-blue.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE.txt)
[![VSCode](https://img.shields.io/badge/VSCode-1.74.0+-orange.svg)](https://code.visualstudio.com/)
[![Marketplace](https://img.shields.io/badge/Marketplace-DiffSense-orange.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

🚀 Intelligent Git code impact analysis tool supporting Java, Golang, and frontend code change impact analysis and visualization

[English](./README_EN.md) | 中文

## ✨ Key Features

- **🔍 Multi-language Support**: Java, Golang, TypeScript/React code analysis
- **📊 Impact Analysis**: Automatically detect the scope of code changes
- **🎯 Smart Detection**: Automatically identify project types and languages
- **📈 Visualization**: Intuitive call relationship graphs and impact reports
- **📩 One-click Reporting**: Smart bug reporting functionality

## 🚀 Quick Start

### Installation

#### Option 1: Install from VSCode Marketplace (Recommended)
1. Open VSCode
2. Press `Ctrl+P` (or `Cmd+P` on Mac) to open Quick Open
3. Type: `ext install humphreyLi.diffsense`
4. Press Enter to install

#### Option 2: Install from Extensions Panel
1. Open VSCode
2. Go to Extensions panel (`Ctrl+Shift+X`)
3. Search for "DiffSense"
4. Click Install

### Usage Steps
1. Open a project containing a Git repository
2. Find the DiffSense icon in the activity bar
3. Select the analysis scope and type
4. Click "Start Analysis"

## 📋 Supported Analysis Types

### Backend Analysis
- **Java Projects**: Maven/Gradle project analysis
- **Golang Projects**: Go module analysis
- **Method Call Chains**: Deep call relationship analysis

### Frontend Analysis
- **Dependency Analysis**: File dependency relationships
- **Component Impact**: UI component change impact
- **Entry Point Analysis**: Function call entry points

### Mixed Projects
- **Full-stack Analysis**: Frontend-backend interaction impact
- **API Changes**: Interface change impact analysis

## 🛠️ System Requirements

- VSCode 1.74.0+
- Git
- Java projects require Maven/Gradle
- Golang projects require Go 1.16+
- Frontend projects require Node.js

## 📝 Changelog

### Version 0.1.12 (Latest)
- 🎯 **Extension Name Optimization**: Simplified display name to "DiffSense" for better brand recognition
- 📝 **Issue Template Improvements**: Chinese localization, intelligent content truncation, URL encoding optimization
- 📦 **Package Optimization**: Resolved duplicate file issues, reduced package size from 52MB to 37MB
- 🔧 **Path Configuration Fix**: Ensured TypeScript compilation artifacts are correctly included
- 🌐 **Remote Development Support**: Enhanced SSH/WSL/container environment compatibility

### Version 0.1.7
- 🔧 **Enhanced Path Resolution**: 5 strategies to automatically adapt to various environments, perfectly solving remote development issues
- 🌐 **Remote Environment Fix**: Fully compatible with SSH/WSL/container/cloud development environments
- 📦 **JAR File Bundling**: Java analyzer now built into the extension, no external dependencies required
- 🔍 **Improved Diagnostics**: Detailed environment detection and debugging features for quick problem identification
- 🏗️ **Microservice Enhancement**: Support for up to 100 levels of directory recursion, adapting to complex enterprise-level projects
- 🐛 **Dependency Fix**: Complete glob module bundling, resolving "module not found" errors

### Version 0.1.0
- 🎉 Initial release supporting Java, Golang, and frontend project analysis
- 📊 Call graph visualization
- 🔍 Basic impact analysis
- 📈 Risk scoring system

## 📞 Support & Feedback

Having issues? Use the built-in 📩 one-click reporting feature, and we'll respond quickly!

**Support Channels**:
- 🐛 Issue Reports: [GitHub Issues](https://github.com/GoldenSupremeSaltedFish/DiffSense/issues)
- 💡 Feature Requests: [GitHub Discussions](https://github.com/GoldenSupremeSaltedFish/DiffSense/discussions)
- 📚 Documentation: [Wiki](https://github.com/GoldenSupremeSaltedFish/DiffSense/wiki)
- 🛒 Marketplace: [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

---

Made with ❤️ by DiffSense Team 