# DiffSense

DiffSense is a powerful code change impact analysis tool provided as a VSCode extension. It helps developers quickly understand the scope of code changes through static code analysis and version difference comparison.

## ✨ Key Features

- 🔍 **Multi-language Support**
  - Java backend code analysis
  - Golang backend code analysis
  - TypeScript/JavaScript frontend code analysis
  - Full-stack project analysis support

- 🎯 **Precise Analysis**
  - Method-level impact analysis
  - Class-level change tracking
  - Call chain visualization
  - Frontend component dependency analysis

- 🌈 **Smart Interface**
  - Automatic VSCode theme adaptation
  - Intuitive analysis result display
  - Interactive call relationship graph
  - Multi-language interface (Chinese/English)

- 📊 **Rich Reports**
  - JSON format export
  - HTML report generation
  - CI/CD support
  - Risk level assessment

## 🚀 Quick Start

1. **Install Extension**
   - Search for "DiffSense" in VSCode marketplace
   - Click install

2. **How to Use**
   - Open any Git repository
   - Find the DiffSense icon in VSCode sidebar
   - Select branch and commit range to analyze
   - Click "Start Analysis" button

3. **View Results**
   - Results display automatically after analysis
   - View affected methods and classes
   - Browse call relationship graph
   - Export analysis reports

## 💡 Analysis Modes

### Backend Analysis
- **Method Impact Analysis**: Identify methods affected by changes
- **Call Chain Analysis**: Track method call relationships
- **Class Level Analysis**: Understand class change impacts

### Frontend Analysis
- **Component Dependency Analysis**: Identify relationships between components
- **Entry Point Analysis**: Find function entry points
- **UI Impact Analysis**: Assess interface change impacts

### Full-stack Analysis
- **API Change Impact**: Analyze interface changes' impact on frontend
- **Data Flow Analysis**: Track data transmission paths
- **Full-stack Impact Assessment**: Comprehensive system impact evaluation

## 📝 Configuration Guide

### Analysis Range Options
- Last 3/5/10 commits
- Today's changes
- This week's changes
- Custom date range
- Specific Commit ID range

### Analysis Type Options
- Method level impact
- Class level impact
- Call chain analysis
- Dependency relationships
- UI impact
- Full-stack analysis

## 🛠️ System Requirements

- VSCode 1.60.0 or higher
- Git 2.20.0 or higher
- For backend analysis:
  - Java projects require JDK 11+
  - Golang projects require Go 1.16+
- For frontend analysis:
  - Node.js 14+ (recommended)

## 🤝 Feedback

If you encounter any issues or have feature suggestions, you can:

1. Use the "Report Issue" feature in the extension
2. Visit our [GitHub Issues](https://github.com/yourusername/diffsense/issues)
3. Send email to support@diffsense.com

## 📄 License

MIT License

## 🌟 Acknowledgments

Thanks to all developers who have contributed to DiffSense! 