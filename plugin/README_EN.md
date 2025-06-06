# DiffSense - Git Code Impact Analysis

[![Version](https://img.shields.io/badge/version-0.1.1-blue.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE.txt)
[![VSCode](https://img.shields.io/badge/VSCode-1.74.0+-orange.svg)](https://code.visualstudio.com/)

**DiffSense** is an intelligent Git code impact analysis tool that supports change impact analysis and visualization for Java, Golang, and frontend projects. It helps developers understand the impact scope of code changes and provides smart regression analysis.

![DiffSense Demo](https://github.com/GoldenSupremeSaltedFish/DiffSense/raw/main/demo.gif)

## 🚀 Key Features

### 📊 Multi-Language Code Analysis
- **Java Projects**: Maven/Gradle project support with deep call graph analysis
- **Golang Projects**: Go modules, test coverage, goroutine and channel analysis
- **Frontend Projects**: React/Vue/Angular/TypeScript dependency analysis
- **Mixed Projects**: Comprehensive analysis for full-stack applications

### 🔍 Advanced Impact Analysis
- **Call Graph Analysis**: Visualize method call relationships and dependencies
- **Change Impact Detection**: Identify affected code areas from Git changes
- **Test Coverage Analysis**: Find untested code paths and potential risks
- **Regression Risk Scoring**: Smart risk assessment for code changes

### 🎯 Smart Project Detection
- **Automatic Type Detection**: Intelligently recognizes project types
- **Microservices Support**: Enhanced recursive depth for complex project structures
- **Monorepo Compatibility**: Supports multi-project repositories
- **Deep Directory Analysis**: Up to 15 levels of directory recursion

### 📈 Visual Analytics
- **Interactive Call Graphs**: Explore code relationships visually
- **Impact Heatmaps**: Visualize change impact intensity
- **Risk Dashboards**: Comprehensive risk assessment reports
- **Export Options**: HTML, Markdown, and JSON report formats

## 🛠️ Installation

### From VSCode Marketplace
1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "DiffSense"
4. Click Install

### From VSIX File
1. Download the latest `.vsix` file
2. Open VSCode
3. Press `Ctrl+Shift+P` and type "Extensions: Install from VSIX..."
4. Select the downloaded VSIX file

## 📖 Quick Start

### 1. Basic Usage
1. Open your project in VSCode
2. Click the DiffSense icon in the activity bar
3. The extension will automatically detect your project type
4. Configure analysis parameters:
   - Select Git branch
   - Choose commit range
   - Set analysis scope

### 2. Supported Project Types

#### Java Projects
```
project/
├── src/main/java/
├── pom.xml (Maven)
└── build.gradle (Gradle)
```

#### Golang Projects
```
project/
├── go.mod
├── main.go
└── internal/
    ├── service/
    └── domain/
```

#### Frontend Projects
```
project/
├── package.json
├── src/
│   ├── components/
│   └── pages/
└── tsconfig.json
```

### 3. Analysis Configuration

#### Basic Analysis
- **Branch Selection**: Choose the branch to analyze
- **Commit Range**: Specify start and end commits
- **File Filters**: Include/exclude specific file patterns

#### Advanced Options
- **Call Graph Depth**: Configure analysis depth (default: 10)
- **Test Coverage**: Enable/disable test coverage analysis
- **Risk Thresholds**: Set custom risk scoring parameters

## 🔧 Configuration Options

### Extension Settings

```json
{
  "diffsense.maxAnalysisDepth": 10,
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
  "frontendPaths": ["ui/", "frontend/"],
  "backendPaths": ["api/", "service/"],
  "excludePatterns": ["**/test/**"],
  "analysisDepth": 15,
  "riskThresholds": {
    "high": 80,
    "medium": 50,
    "low": 20
  }
}
```

## 📊 Understanding Analysis Results

### Call Graph Visualization
- **Nodes**: Represent methods/functions
- **Edges**: Show call relationships
- **Colors**: Indicate risk levels (Red: High, Yellow: Medium, Green: Low)
- **Size**: Reflects complexity or impact score

### Risk Assessment
- **High Risk (80-100)**: Critical changes requiring thorough testing
- **Medium Risk (50-79)**: Moderate impact, requires review
- **Low Risk (0-49)**: Minor changes with limited impact

### Test Coverage Gaps
- **Uncovered Methods**: Functions without test coverage
- **Risk Patterns**: Commonly risky code patterns
- **Recommendations**: Suggested testing strategies

## 🌍 Environment Support

### Local Development
- ✅ VSCode Desktop
- ✅ Plugin Development Mode
- ✅ Compiled Extension Package

### Remote Development
- ✅ VSCode Remote - SSH
- ✅ VSCode Remote - WSL
- ✅ VSCode Remote - Containers
- ✅ GitHub Codespaces
- ✅ GitPod

### CI/CD Integration
- ✅ Command Line Interface
- ✅ Docker Support
- ✅ Jenkins/GitHub Actions Integration

## 🚨 Troubleshooting

### Common Issues

#### "Analyzer not found" Error
```bash
# Ensure dependencies are installed
cd ui/node-analyzer && npm install
cd ui/golang-analyzer && npm install
```

#### Path Resolution Issues
- Check VSCode Output panel for detailed path information
- Verify extension installation location
- Ensure analyzer scripts have proper permissions

#### Performance Issues
- Reduce analysis depth for large projects
- Use file exclusion patterns
- Enable incremental analysis mode

### Debug Mode
Enable detailed logging by setting:
```json
{
  "diffsense.debug": true,
  "diffsense.verboseLogging": true
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/GoldenSupremeSaltedFish/DiffSense.git

# Install dependencies
cd DiffSense/plugin
npm install

# Install analyzer dependencies
cd ../ui/node-analyzer && npm install
cd ../golang-analyzer && npm install

# Build the project
npm run compile

# Package for testing
npm run package
```

### Running Tests
```bash
npm test
```

## 📝 Changelog

### Version 0.1.1 (Latest)
- 🚀 **Enhanced Microservices Support**: Increased recursive depth from 5 to 15 levels
- 🔧 **Remote Development Fix**: Fixed analyzer path resolution for VSCode remote environments
- 📊 **Improved Analysis Accuracy**: Enhanced file type detection for complex project structures
- 🐛 **Bug Fixes**: Resolved path issues in SSH, WSL, and container environments
- 📈 **Performance Improvements**: Optimized file scanning and dependency analysis

### Version 0.1.0
- 🎉 Initial release with basic Java, Golang, and frontend analysis
- 📊 Call graph visualization
- 🔍 Basic impact analysis
- 📈 Risk scoring system

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE.txt](LICENSE.txt) file for details.

## 🙏 Acknowledgments

- [Eclipse JGit](https://www.eclipse.org/jgit/) for Git integration
- [Spoon](https://spoon.gforge.inria.fr/) for Java code analysis
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript) for frontend analysis
- [Visual Studio Code Extension API](https://code.visualstudio.com/api)

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/GoldenSupremeSaltedFish/DiffSense/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/GoldenSupremeSaltedFish/DiffSense/discussions)
- 📧 **Email**: support@diffsense.com
- 📚 **Documentation**: [Wiki](https://github.com/GoldenSupremeSaltedFish/DiffSense/wiki)

---

**Made with ❤️ by the DiffSense Team**

*Empowering developers with intelligent code impact analysis* 