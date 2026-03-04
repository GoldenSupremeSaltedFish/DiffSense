# DiffSense Technical Documentation

This directory contains technical documentation for DiffSense-related components, organized by module.

**Note**: The current **release** branch of this repository contains only the **diffsense CLI** (under `diffsense/`). The VSCode plugin and some analyzers (backend/frontend/golang) are maintained on the [vscode-extension](https://github.com/GoldenSupremeSaltedFish/DiffSense/tree/vscode-extension) branch. The following structure describes the full set of components; refer to the active branch for what is present in your clone.

## 📂 Documentation Structure

### 🔧 Backend Analyzer
- [`backend-analyzer/`](./backend-analyzer/) - Java-based backend code analysis engine
  - Change classification system implementation
  - Microservices architecture improvements
  - Performance optimization guides

### 🎨 Frontend Analyzer  
- [`frontend-analyzer/`](./frontend-analyzer/) - Node.js-based frontend code analysis engine
  - React/Vue component analysis
  - Dependency tracking system
  - Snapshot comparison algorithms

### 🐹 Golang Analyzer
- [`golang-analyzer/`](./golang-analyzer/) - Go code analysis engine
  - Go module dependency analysis
  - Goroutine impact tracking
  - Performance profiling integration

### 🛠️ Build Tools
- [`build-tools/`](./build-tools/) - Build system and packaging tools
  - Complete build process documentation
  - Packaging checklists and verification
  - CI/CD integration guides

### 🔌 VSCode Plugin
- [`vscode-plugin/`](./vscode-plugin/) - Visual Studio Code extension
  - Extension architecture and design
  - UI/UX implementation details
  - Plugin API documentation

## 🌐 Language Support

All technical documentation is available in both English and Chinese:
- **English**: Default documentation files
- **中文**: Files with `_CN` suffix (e.g., `ARCHITECTURE_CN.md`)

## 📋 Document Types

- **Architecture**: System design and component relationships
- **Implementation**: Detailed technical implementation guides  
- **API Reference**: Function and class documentation
- **Deployment**: Build, package, and deployment procedures
- **Troubleshooting**: Common issues and solutions

## 🔄 Documentation Standards

### File Naming Convention
- English: `DOCUMENT_NAME.md`
- Chinese: `DOCUMENT_NAME_CN.md`

### Content Structure
1. **Overview** - Brief description and purpose
2. **Architecture** - System design and components
3. **Implementation** - Technical details and code examples
4. **Configuration** - Setup and customization options
5. **API Reference** - Function signatures and usage
6. **Examples** - Practical usage scenarios
7. **Troubleshooting** - Common issues and solutions

## 🚀 Quick Navigation

| Module | English Docs | Chinese Docs | Key Features |
|--------|-------------|-------------|-------------|
| Backend | [📁](./backend-analyzer/) | [📁](./backend-analyzer/) | Java analysis, Spring Boot support |
| Frontend | [📁](./frontend-analyzer/) | [📁](./frontend-analyzer/) | React/Vue analysis, component tracking |
| Golang | [📁](./golang-analyzer/) | [📁](./golang-analyzer/) | Go module analysis, concurrency tracking |
| Build Tools | [📁](./build-tools/) | [📁](./build-tools/) | Automated build, packaging, CI/CD |
| VSCode Plugin | [📁](./vscode-plugin/) | [📁](./vscode-plugin/) | Extension development, UI/UX |

## 📞 Contributing to Documentation

When adding or updating documentation:

1. **Create both versions**: Always provide English and Chinese versions
2. **Follow naming convention**: Use `_CN` suffix for Chinese documents
3. **Update indexes**: Add new documents to relevant module README files
4. **Cross-reference**: Link related documents across modules
5. **Keep synchronized**: Ensure both language versions have equivalent content

---

**English** | [中文版](./README_CN.md) 