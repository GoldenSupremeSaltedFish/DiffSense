# VSCode Plugin Documentation

The VSCode Plugin module provides the Visual Studio Code extension implementation for DiffSense, offering an integrated development experience for code change impact analysis directly within the IDE.

## 📋 Documentation Index

### Core Implementation
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - Extension architecture and design patterns
- [`EXTENSION_API.md`](./EXTENSION_API.md) - VSCode extension API usage
- [`UI_COMPONENTS.md`](./UI_COMPONENTS.md) - User interface components and design
- [`WEBVIEW_INTEGRATION.md`](./WEBVIEW_INTEGRATION.md) - Webview and React integration

### Features & Functionality
- [`ANALYSIS_INTEGRATION.md`](./ANALYSIS_INTEGRATION.md) - Integration with analysis engines
- [`COMMAND_SYSTEM.md`](./COMMAND_SYSTEM.md) - Command palette and shortcuts
- [`SETTINGS_CONFIGURATION.md`](./SETTINGS_CONFIGURATION.md) - Extension settings and preferences
- [`THEME_ADAPTATION.md`](./THEME_ADAPTATION.md) - Theme support and customization

### Development & Deployment
- [`DEVELOPMENT_SETUP.md`](./DEVELOPMENT_SETUP.md) - Development environment setup
- [`PACKAGING_GUIDE.md`](./PACKAGING_GUIDE.md) - VSIX packaging and distribution
- [`TESTING_STRATEGY.md`](./TESTING_STRATEGY.md) - Testing approaches and automation
- [`MARKETPLACE_PUBLISHING.md`](./MARKETPLACE_PUBLISHING.md) - VS Code marketplace publishing

### Design & UX
- [`UI_UX_GUIDELINES.md`](./UI_UX_GUIDELINES.md) - User interface design guidelines
- [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) - Accessibility features and compliance
- [`INTERNATIONALIZATION.md`](./INTERNATIONALIZATION.md) - Multi-language support

### Troubleshooting
- [`COMMON_ISSUES.md`](./COMMON_ISSUES.md) - Common problems and solutions
- [`DEBUG_EXTENSION.md`](./DEBUG_EXTENSION.md) - Extension debugging techniques

## 🔧 Key Features

### Extension Capabilities
- **Sidebar Integration** - Dedicated DiffSense panel in activity bar
- **Webview UI** - React-based analysis interface
- **Command Palette** - Quick access to analysis functions
- **Status Bar** - Real-time analysis status
- **Settings Integration** - Configurable analysis options

### Analysis Integration
- **Multi-language Support** - Java, JavaScript/TypeScript, Go
- **Real-time Analysis** - Live code change impact assessment
- **Visual Reports** - Interactive charts and graphs
- **Export Functionality** - JSON/HTML report generation

### User Experience
- **Theme Adaptation** - Automatic light/dark theme support
- **Internationalization** - English and Chinese language support
- **Responsive Design** - Adaptive UI for different screen sizes
- **Keyboard Shortcuts** - Efficient workflow shortcuts

## 🚀 Quick Start

### Development Prerequisites
```bash
# Node.js and npm
node --version  # Requires Node.js 14+
npm --version

# VS Code Extension Development
npm install -g @vscode/vsce
npm install -g yo generator-code

# TypeScript
npm install -g typescript
```

### Development Setup
```bash
# Install dependencies
cd plugin
npm install

# Compile TypeScript
npm run compile

# Start development
code .
# Press F5 to launch Extension Development Host
```

### Building and Packaging
```bash
# Compile extension
npm run compile

# Prepare package
npm run prepare-package

# Create VSIX package
npm run package

# Output: diffsense-x.x.x.vsix
```

## 📊 Extension Architecture

### Core Components

#### Extension Entry Point
```typescript
// src/extension.ts
export function activate(context: vscode.ExtensionContext) {
  // Register commands
  const disposable = vscode.commands.registerCommand('diffsense.runAnalysis', () => {
    // Analysis execution logic
  });
  
  // Create webview provider
  const provider = new DiffSenseViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('diffsense.analysisView', provider)
  );
  
  context.subscriptions.push(disposable);
}
```

#### Webview Integration
```typescript
// Webview provider for React UI
class DiffSenseViewProvider implements vscode.WebviewViewProvider {
  public resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
  }
}
```

### Package.json Configuration
```json
{
  "name": "diffsense",
  "displayName": "DiffSense - Git Code Impact Analysis",
  "version": "0.1.11",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": [
    "Other",
    "Testing",
    "Visualization"
  ],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "diffsense.runAnalysis",
        "title": "Run Analysis",
        "category": "DiffSense"
      }
    ],
    "views": {
      "diffsense": [
        {
          "type": "webview",
          "id": "diffsense.analysisView",
          "name": "Git Impact Analysis"
        }
      ]
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "diffsense",
          "title": "DiffSense",
          "icon": "$(git-branch)"
        }
      ]
    }
  }
}
```

## 🎨 User Interface

### Main Analysis View
- **Project Selection** - Choose analysis target
- **Analysis Options** - Configure analysis parameters
- **Results Display** - Interactive analysis results
- **Export Options** - Save analysis reports

### Webview Components
```typescript
// React components in webview
interface AnalysisResult {
  timestamp: string;
  summary: AnalysisSummary;
  classifications: FileClassification[];
}

const AnalysisView: React.FC = () => {
  const [results, setResults] = useState<AnalysisResult | null>(null);
  
  return (
    <div className="analysis-container">
      <Toolbar onAnalyze={runAnalysis} />
      {results && <ResultsDisplay results={results} />}
    </div>
  );
};
```

### Theme Integration
```css
/* CSS variables for theme adaptation */
.analysis-container {
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
}

.classification-a1 {
  background-color: var(--vscode-errorForeground);
}

.classification-a2 {
  background-color: var(--vscode-warningForeground);
}
```

## ⚙️ Configuration Options

### Extension Settings
```json
{
  "diffsense.analysis.defaultMode": {
    "type": "string",
    "default": "classification",
    "enum": ["classification", "impact", "full"],
    "description": "Default analysis mode"
  },
  "diffsense.ui.language": {
    "type": "string",
    "default": "auto",
    "enum": ["auto", "en", "zh"],
    "description": "UI language preference"
  },
  "diffsense.analysis.autoRun": {
    "type": "boolean",
    "default": false,
    "description": "Automatically run analysis on file changes"
  }
}
```

### Command Contributions
```json
{
  "commands": [
    {
      "command": "diffsense.runAnalysis",
      "title": "Run Analysis",
      "category": "DiffSense",
      "icon": "$(play)"
    },
    {
      "command": "diffsense.refresh",
      "title": "Refresh",
      "category": "DiffSense",
      "icon": "$(refresh)"
    },
    {
      "command": "diffsense.exportReport",
      "title": "Export Report",
      "category": "DiffSense",
      "icon": "$(export)"
    }
  ]
}
```

## 🔧 Development Workflow

### Local Development
```bash
# Start development environment
npm run watch

# Launch Extension Development Host
# Press F5 in VS Code

# Make changes and reload
# Ctrl+R in Extension Development Host
```

### Testing
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Manual testing in Extension Development Host
```

### Debugging
```typescript
// Use VS Code debugging
console.log('Debug message');

// Extension development console
// View -> Output -> DiffSense
```

## 📦 Packaging and Distribution

### VSIX Creation
```bash
# Clean previous builds
npm run clean

# Compile and prepare
npm run compile
npm run prepare-package

# Create VSIX package
vsce package

# Output: diffsense-0.1.11.vsix
```

### Marketplace Publishing
```bash
# Login to marketplace
vsce login <publisher-name>

# Publish extension
vsce publish

# Or publish specific version
vsce publish 0.1.12
```

## 🔗 Integration Points

### Analysis Engine Communication
```typescript
// Communication with analysis engines
async function runAnalysis(projectPath: string): Promise<AnalysisResult> {
  const javaResult = await runJavaAnalysis(projectPath);
  const frontendResult = await runFrontendAnalysis(projectPath);
  const golangResult = await runGolangAnalysis(projectPath);
  
  return mergeAnalysisResults([javaResult, frontendResult, golangResult]);
}
```

### Webview Messaging
```typescript
// Extension to webview communication
webview.postMessage({
  type: 'analysisResult',
  data: analysisResult
});

// Webview to extension communication
webview.onDidReceiveMessage(message => {
  switch (message.type) {
    case 'runAnalysis':
      runAnalysis(message.projectPath);
      break;
  }
});
```

## 🔗 Related Documentation

- [Backend Analyzer](../backend-analyzer/) - Java backend analysis integration
- [Frontend Analyzer](../frontend-analyzer/) - Frontend analysis integration
- [Golang Analyzer](../golang-analyzer/) - Go analysis integration
- [Build Tools](../build-tools/) - Extension build and packaging

---

**English** | [中文版](./README_CN.md) 