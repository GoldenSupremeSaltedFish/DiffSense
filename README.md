# DiffSense

**DiffSense** is an automated code audit and risk governance platform designed for **CI/CD pipelines**. It proactively blocks risky changes before they merge by analyzing semantic differences, while offering a VSCode extension for developers to self-check locally.

[![Version](https://img.shields.io/badge/version-0.2.1-blue.svg)](https://github.com/GoldenSupremeSaltedFish/DiffSense)
[![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)](./LICENSE.txt)
[![VSCode](https://img.shields.io/badge/VSCode-1.74.0+-blueviolet.svg)](https://code.visualstudio.com/)
[![Marketplace](https://img.shields.io/badge/Marketplace-DiffSense-orange.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)
[![DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/GoldenSupremeSaltedFish/DiffSense)

## ✨ Key Features

- 🚀 **CI/CD Pipeline Integration**
  - **Automated Auditing**: Seamless integration with GitLab CI and GitHub Actions to audit every MR/PR.
  - **Bot Feedback**: Posts detailed impact analysis reports directly to code review comments.
  - **Click-to-Ack**: Innovative workflow where high-risk changes require explicit approval to pass build checks.

- 🛡️ **Automated Risk Governance**
  - **Semantic Risk Analysis**: Deep understanding of code changes using AST signals (e.g., concurrency modifications, type downgrades).
  - **Smart Policy Enforcement**: Automatically block CI pipelines for elevated/critical risks until reviewed/approved.
  - **Dynamic Risk Levels**: Real-time classification of changes into Normal, Elevated, or Critical risk categories.

- 🔍 **Multi-language Support**
  - Java backend analysis (Spring Boot, Maven/Gradle projects)
  - Golang backend analysis
  - TypeScript/JavaScript frontend analysis (React, Vue)
  - Full-stack project comprehensive analysis

- 🎯 **Precise Analysis**
  - Method-level impact analysis
  - Class-level change tracking
  - Call chain visualization
  - Frontend component dependency analysis
  - API interface change impact assessment

- 🌈 **Smart Interface**
  - Automatic VSCode theme adaptation
  - Intuitive analysis result display
  - Interactive call relationship graph
  - Multi-language interface (Chinese/English)
  - Risk level color coding

- 📊 **Rich Reports**
  - JSON/HTML format export
  - Detailed change classification reports
  - CI/CD pipeline support
  - Historical change trend analysis

## 🚀 Quick Start

### CI/CD 集成（GitLab）

在你的项目里接入 MR 风险审计：使用官方镜像，无需 clone 或 pip。

**1. 配置变量**  
在 GitLab 项目的 **Settings → CI/CD → Variables** 中新增：

- `DIFFSENSE_TOKEN`（Masked）：具备 API 权限的 Personal Access Token，用于读写 MR 评论。

**2. 在 `.gitlab-ci.yml` 中增加 Job**

```yaml
diffsense_audit:
  stage: test
  image: ghcr.io/goldensupremesaltedfish/diffsense:1.0.0
  rules:
    - if: $CI_PIPELINE_SOURCE == 'merge_request_event'
  script:
    - diffsense audit --platform gitlab
        --token "$DIFFSENSE_TOKEN"
        --project-id "$CI_PROJECT_ID"
        --mr-iid "$CI_MERGE_REQUEST_IID"
        --gitlab-url "${GITLAB_URL:-$CI_SERVER_URL}"
  allow_failure: false
```

**可选**：固定版本请将镜像 tag 改为具体版本（如 `1.0.0`）；Runner 无法访问外网时，在 Variables 中配置 `DIFFSENSE_IMAGE`，Job 中写 `image: $DIFFSENSE_IMAGE` 使用内网镜像。

### VSCode Extension Installation (Optional)

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

#### Option 3: Install from VSIX File
1. Download the latest VSIX file from [Releases](https://github.com/GoldenSupremeSaltedFish/DiffSense/releases)
2. In VSCode, go to Extensions panel
3. Click the "..." menu and select "Install from VSIX..."
4. Choose the downloaded VSIX file

### VSCode Usage
1. Open any Git repository project
2. Find the DiffSense icon in VSCode sidebar
3. Select commit range or branch to analyze
4. Choose analysis type (method/class/full-stack)
5. Click "Start Analysis" button
6. View analysis results and visualization charts

## 💡 Analysis Modes

### Backend Code Analysis
- **A1-Business Logic Changes**: Controller/Service processing logic modifications
- **A2-Interface Changes**: API method signatures, parameters, return value structure changes
- **A3-Data Structure Changes**: Entity/DTO/Database schema changes
- **A4-Middleware Adjustments**: Framework upgrades, configuration files, connection pool parameter adjustments
- **A5-Non-functional Modifications**: Comments, logging, code formatting, performance optimizations

### Frontend Code Analysis
- **Component Dependency Analysis**: Identify dependencies between React/Vue components
- **Props/State Changes**: Track component interface changes
- **Hook Usage Analysis**: useEffect, useState and other Hook dependency changes
- **Routing Impact**: Impact scope of page route changes

### Full-stack Analysis
- **API Contract Changes**: Frontend-backend interface contract consistency check
- **Data Flow Tracking**: Complete data flow analysis from frontend to backend
- **Microservice Dependencies**: Cross-service call impact analysis

## 📝 Supported Project Types

### Java Projects
- Spring Boot applications
- Maven/Gradle build systems
- JDK 8+ support
- Microservice architecture support

### Golang Projects
- Go Module projects
- Gin/Echo and other web frameworks
- Go 1.16+ support

### Frontend Projects
- React 16+ projects
- Vue 2/3 projects
- TypeScript/JavaScript
- Webpack/Vite build tools

## 🛠️ System Requirements

- **VSCode**: 1.74.0 or higher
- **Git**: 2.20.0 or higher
- **Java Projects**: JDK 8+, Maven 3.6+ or Gradle 6+
- **Golang Projects**: Go 1.16+
- **Frontend Projects**: Node.js 14+

## 📁 Project Structure

```
DiffSense/
├── plugin/                    # VSCode extension core
├── ui/                       # Frontend UI components
├── src/main/java/           # Java backend analyzer
├── technical_documentation/ # Technical documentation
└── build-tools/            # Build tools
```

## 🔧 Development & Building

### Local Development
```bash
# Clone the project
git clone https://github.com/GoldenSupremeSaltedFish/DiffSense.git
cd DiffSense

# Build all components
./build-all.bat

# Check build results
./check-build.bat
```

### Package & Release
```bash
# Package VSCode extension
cd plugin
npm run package
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](diffsense/CONTRIBUTING.md) for details on how to submit pull requests, report issues, and contribute to the code.

1. Fork the project to your GitHub
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## 📄 License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE.txt) file for details.

## 🌟 Acknowledgments

Thanks to all developers and users who have contributed to DiffSense!

## 📞 Support & Feedback

- 🐛 [Report Issues](https://github.com/GoldenSupremeSaltedFish/DiffSense/issues)
- 💡 [Feature Requests](https://github.com/GoldenSupremeSaltedFish/DiffSense/discussions)
- 📚 [Technical Documentation](./technical_documentation/)
- 🛒 [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

---

**English** | [中文版](./cn_readme.md)
