# DiffSense - Git Code Impact Analysis

[![Version](https://img.shields.io/badge/version-0.1.7-blue.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE.txt)
[![VSCode](https://img.shields.io/badge/VSCode-1.74.0+-orange.svg)](https://code.visualstudio.com/)

🚀 **Intelligent Git Code Impact Analysis Tool** - Supports change impact analysis and visualization for Java, Golang, and frontend projects

[中文](readme.md) | English

![DiffSense Demo](https://github.com/GoldenSupremeSaltedFish/DiffSense/raw/main/demo.gif)

## ✨ Key Features

- **🔍 Multi-Language Support**: Java, Golang, TypeScript/React code analysis
- **📊 Impact Analysis**: Automatically detect the impact scope of code changes
- **🎯 Smart Detection**: Automatically identify project types and languages
- **📈 Visualization**: Intuitive call relationship graphs and impact reports
- **📩 One-Click Bug Report**: Smart bug reporting feature
- **🌐 Remote Development**: Full support for SSH, WSL, and container environments
- **🏗️ Microservices Support**: Enhanced deep directory analysis up to 100 levels

## 🚀 Quick Start

1. **Install Extension**
   - Search "DiffSense" in VSCode Extensions
   - Or install from `.vsix` file

2. **Open Your Project**
   - Open a project containing a Git repository in VSCode
   - Find the DiffSense icon in the activity bar

3. **Configure Analysis**
   - Select analysis scope and type
   - Choose Git branch and commit range
   - Click "Start Analysis"

## 📋 Supported Analysis Types

### 🖥️ Backend Analysis
- **Java Projects**: Maven/Gradle project analysis with deep call graph
- **Golang Projects**: Go module analysis with dependency tracking
- **Method Call Chains**: Deep call relationship analysis

### 🌐 Frontend Analysis
- **Dependency Analysis**: File dependency relationships
- **Component Impact**: UI component change impact
- **Entry Point Analysis**: Function call entry analysis
- **Framework Support**: React, Vue, Angular, Svelte

### 🔄 Mixed Projects
- **Full-Stack Analysis**: Frontend-backend interaction impact
- **API Change Impact**: Interface change impact analysis
- **Microservices**: Complex microservice architecture support

## 🛠️ System Requirements

- **VSCode**: 1.74.0 or higher
- **Git**: Any recent version
- **Java Projects**: Maven or Gradle
- **Golang Projects**: Go 1.16+
- **Frontend Projects**: Node.js

## 🌍 Environment Support

### ✅ Local Development
- VSCode Desktop
- Plugin Development Mode
- Compiled Extension Package

### ✅ Remote Development
- **VSCode Remote - SSH**: Linux servers, remote development
- **VSCode Remote - WSL**: Windows Subsystem for Linux
- **VSCode Remote - Containers**: Docker development environments
- **GitHub Codespaces**: Cloud development
- **GitPod**: Browser-based IDE

### ✅ Enterprise Environments
- Corporate networks with proxy settings
- Restricted file system permissions
- Large-scale monorepo structures

## 🔧 Configuration

### Extension Settings

Configure DiffSense through VSCode settings:

```json
{
  "diffsense.maxAnalysisDepth": 100,
  "diffsense.enableTestCoverage": true,
  "diffsense.autoDetectProjectType": true,
  "diffsense.excludePatterns": [
    "**/node_modules/**",
    "**/target/**",
    "**/build/**",
    "**/.git/**"
  ]
}
```

### Project-Specific Configuration

Create a `.diffsense.json` file in your project root:

```json
{
  "projectType": "mixed",
  "frontendPaths": ["ui/", "frontend/", "web/"],
  "backendPaths": ["api/", "service/", "server/"],
  "microservicePaths": ["*_service/", "service_*/", "*-service/"],
  "excludePatterns": ["**/test/**", "**/spec/**"],
  "analysisDepth": 100,
  "riskThresholds": {
    "high": 80,
    "medium": 50,
    "low": 20
  }
}
```

## 📊 Understanding Analysis Results

### Call Graph Visualization
- **Nodes**: Represent methods/functions/components
- **Edges**: Show call relationships and dependencies
- **Colors**: Indicate risk levels (🔴 High, 🟡 Medium, 🟢 Low)
- **Size**: Reflects complexity or impact score

### Risk Assessment Categories
- **🔴 High Risk (80-100)**: Critical changes requiring thorough testing
- **🟡 Medium Risk (50-79)**: Moderate impact, requires review
- **🟢 Low Risk (0-49)**: Minor changes with limited impact

### Impact Analysis Reports
- **Affected Files**: List of files impacted by changes
- **Method Dependencies**: Functions that call or are called by changed code
- **Test Coverage Gaps**: Areas lacking test coverage
- **Regression Risks**: Potential areas for bugs

## 🚨 Troubleshooting

### Common Issues and Solutions

#### "Unsupported backend language: unknown"
**Solution**: 
- Ensure your project has the correct structure (pom.xml for Java, go.mod for Go)
- Check that files are not deeply nested beyond 100 levels
- Verify file permissions in remote environments

#### "Cannot find module 'glob'"
**Solution**: 
- This has been fixed in v0.1.4+
- Update to the latest version
- The glob module is now bundled with the extension

#### "JAR file not found"
**Solution**: 
- Fixed in v0.1.6+ with multi-strategy path resolution
- The Java analyzer JAR is now included in the extension
- Works in all remote environments

#### Path Resolution Issues in Remote Development
**Solution**: 
- Updated in v0.1.7 with enhanced path detection
- Supports SSH, WSL, containers, and cloud environments
- Automatic environment detection and adaptation

### Debug Mode

Enable detailed logging in VSCode Output panel:
1. Open Output panel (View → Output)
2. Select "DiffSense" from the dropdown
3. Look for detailed path resolution and analysis logs

## 📝 Changelog

### Version 0.1.7 (Latest) 🚀
- 🔧 **Enhanced Path Resolution**: 5-strategy path finding for all environments
- 🌐 **Remote Environment Fixes**: Perfect compatibility with SSH/WSL/containers
- 📦 **JAR File Bundling**: Java analyzer now bundled in extension
- 🔍 **Improved Diagnostics**: Detailed environment detection and debugging
- 🏗️ **Microservices Support**: Up to 100-level directory recursion
- 🐛 **Glob Module Fix**: Complete dependency bundling

### Version 0.1.6
- 🛠️ **Path Logic Overhaul**: Multi-strategy JAR file location
- 🌐 **Remote Development**: Enhanced support for remote VSCode environments

### Version 0.1.4
- 📦 **JAR Bundling**: Java analyzer JAR included in extension package
- 🔧 **Dependency Fixes**: Complete glob module bundling

### Version 0.1.2-0.1.3
- 🏗️ **Microservice Enhancement**: Recursive depth increased from 15 to 25+ levels
- 🌐 **Remote Development**: Fixed analyzer path issues in SSH/WSL/container environments
- 📊 **Analysis Accuracy**: Enhanced file type detection for deep directory structures
- 🚀 **Performance**: Optimized file scanning and dependency analysis algorithms

### Version 0.1.0-0.1.1
- 🎉 **Initial Release**: Java, Golang, frontend project analysis support
- 📊 **Call Graph Visualization**: Interactive dependency visualization
- 🔍 **Basic Impact Analysis**: Change impact detection
- 📈 **Risk Scoring System**: Automated risk assessment

## 💻 Supported Project Structures

### Java Projects
```
enterprise-project/
├── user-service/
│   ├── src/main/java/
│   └── pom.xml
├── order-service/
│   ├── src/main/java/
│   └── pom.xml
├── common/
│   └── shared-models/
└── build.gradle (root)
```

### Golang Projects
```
microservice-platform/
├── cmd/
│   ├── user-svc/
│   └── order-svc/
├── internal/
│   ├── domain/
│   ├── repository/
│   └── service/
├── pkg/
└── go.mod
```

### Frontend Projects
```
frontend-workspace/
├── apps/
│   ├── admin-dashboard/
│   └── customer-portal/
├── libs/
│   ├── ui-components/
│   └── shared-utils/
├── package.json
└── nx.json
```

### Mixed Full-Stack Projects
```
full-stack-app/
├── backend/
│   ├── api/
│   ├── service/
│   └── pom.xml
├── frontend/
│   ├── src/
│   └── package.json
└── docker-compose.yml
```

## 📞 Support & Feedback

Encountered an issue? Use the built-in 📩 **One-Click Bug Report** feature for fast response!

**Support Channels**:
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/GoldenSupremeSaltedFish/DiffSense/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/GoldenSupremeSaltedFish/DiffSense/discussions)
- 📚 **Documentation**: [Wiki](https://github.com/GoldenSupremeSaltedFish/DiffSense/wiki)
- 📧 **Direct Contact**: Open DiffSense → Click "Report Bug" → Auto-generated issue

## 🎯 Use Cases

### For Individual Developers
- **Code Review**: Understand the impact of your changes before committing
- **Refactoring**: Safely refactor code with impact visualization
- **Bug Hunting**: Trace call paths to identify potential bug sources

### For Development Teams
- **Pull Request Reviews**: Automated impact analysis for code reviews
- **Testing Strategy**: Identify critical paths that need testing
- **Architecture Understanding**: Visualize system dependencies

### For DevOps & QA
- **Regression Testing**: Focus testing on impacted areas
- **Release Planning**: Risk assessment for deployments
- **Quality Gates**: Automated quality checks in CI/CD pipelines

## 🔮 Roadmap

- **IDE Integration**: IntelliJ IDEA, WebStorm support
- **CI/CD Tools**: Jenkins, GitHub Actions plugins
- **Advanced Analytics**: ML-powered risk prediction
- **Team Collaboration**: Shared analysis reports
- **API Support**: REST API change impact analysis

---

Made with ❤️ by DiffSense Team

**Download Latest Version**: [DiffSense v0.1.7](https://github.com/GoldenSupremeSaltedFish/DiffSense/releases) 