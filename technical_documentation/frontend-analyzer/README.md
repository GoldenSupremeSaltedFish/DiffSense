# Frontend Analyzer Documentation

The Frontend Analyzer is a Node.js-based analysis engine that provides comprehensive code change impact analysis for frontend applications, with specialized support for React, Vue, and modern JavaScript/TypeScript frameworks.

## 📋 Documentation Index

### Core Implementation
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - System architecture and design patterns
- [`COMPONENT_ANALYSIS.md`](./COMPONENT_ANALYSIS.md) - React/Vue component analysis engine
- [`DEPENDENCY_TRACKING.md`](./DEPENDENCY_TRACKING.md) - Module dependency tracking system
- [`API_REFERENCE.md`](./API_REFERENCE.md) - Node.js API documentation and usage

### Analysis Features
- [`SNAPSHOT_COMPARISON.md`](./SNAPSHOT_COMPARISON.md) - Component snapshot and diff algorithms
- [`HOOK_ANALYSIS.md`](./HOOK_ANALYSIS.md) - React Hooks dependency analysis
- [`ROUTING_IMPACT.md`](./ROUTING_IMPACT.md) - Route change impact assessment
- [`PERFORMANCE_OPTIMIZATION.md`](./PERFORMANCE_OPTIMIZATION.md) - Performance tuning and optimization

### Implementation Guides
- [`SETUP_GUIDE.md`](./SETUP_GUIDE.md) - Development environment setup
- [`CONFIGURATION.md`](./CONFIGURATION.md) - Configuration options and customization
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) - Testing strategies and best practices
- [`PATH_RESOLUTION.md`](./PATH_RESOLUTION.md) - Module path resolution fixes

### Troubleshooting
- [`COMMON_ISSUES.md`](./COMMON_ISSUES.md) - Common problems and solutions
- [`DEBUG_GUIDE.md`](./DEBUG_GUIDE.md) - Debugging techniques and tools

## 🔧 Key Features

### Component Analysis
- **React Components** - Props, state, hooks, lifecycle analysis
- **Vue Components** - Props, data, computed, watchers analysis
- **Component Dependencies** - Parent-child relationships and prop drilling
- **Event Flow** - Event handlers and callback tracking

### Dependency Tracking
- **Module Dependencies** - Import/export relationship mapping
- **Circular Dependencies** - Detection and visualization
- **Bundle Impact** - Code splitting and bundle size analysis
- **Tree Shaking** - Dead code elimination analysis

### Snapshot System
- **Component Snapshots** - Capture component structure and behavior
- **Diff Algorithms** - Precise change detection between versions
- **Regression Detection** - Identify functional regressions
- **Version Comparison** - Git-based version comparison

### Technology Stack
- **Node.js 14+** - Core analysis runtime
- **TypeScript** - Type-aware analysis with ts-morph
- **Madge** - Module dependency analysis
- **Babel/AST** - JavaScript/TypeScript parsing
- **Vue Template Compiler** - Vue SFC analysis

## 🚀 Quick Start

### Prerequisites
```bash
# Node.js and npm
node --version  # Requires Node.js 14+
npm --version

# TypeScript (optional)
npm install -g typescript
```

### Installation and Setup
```bash
# Install dependencies
npm install

# Run analysis
node analyze.js /path/to/frontend/project
```

### Basic Usage
```javascript
// JavaScript API usage
const { FrontendAnalyzer } = require('./analyze');

const analyzer = new FrontendAnalyzer('/path/to/project', {
  includeNodeModules: false,
  filePattern: '**/*.{js,jsx,ts,tsx,vue}',
  maxDepth: 15
});

const result = await analyzer.analyze();
console.log(result);
```

## 📊 Analysis Output

### Component Analysis Results
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "targetDir": "/path/to/project",
  "summary": {
    "totalFiles": 156,
    "totalMethods": 342,
    "totalDependencies": 89,
    "circularDependencies": 2,
    "averageMethodsPerFile": 2.19
  },
  "componentSnapshots": [
    {
      "filePath": "/src/components/UserProfile.tsx",
      "componentName": "UserProfile",
      "type": "react",
      "props": ["userId", "onUpdate"],
      "hooks": ["useState", "useEffect", "useCallback"],
      "dependencies": ["./UserService", "../utils/validation"]
    }
  ],
  "dependencies": {
    "stats": {
      "totalDependencies": 89,
      "circularCount": 2
    },
    "circular": [
      ["src/utils/helper.js", "src/components/App.js"]
    ]
  }
}
```

### Snapshot Comparison
```json
{
  "filePath": "/src/components/TodoList.tsx",
  "changes": [
    {
      "type": "prop_added",
      "name": "sortOrder",
      "riskLevel": "medium",
      "description": "New prop added - may affect parent components"
    },
    {
      "type": "hook_dependency_changed",
      "hook": "useEffect",
      "oldDeps": ["todos"],
      "newDeps": ["todos", "sortOrder"],
      "riskLevel": "high",
      "description": "useEffect dependency changed - may cause infinite re-renders"
    }
  ]
}
```

## 🔍 Supported Frameworks

### React Applications
- **React 16+** - Hooks, functional components, class components
- **TypeScript** - Full type analysis and inference
- **JSX/TSX** - Component structure and prop analysis
- **React Router** - Route change impact analysis

**Example Analysis**:
```typescript
// React component analysis
interface Props {
  userId: string;
  onUpdate: (user: User) => void;
}

const UserProfile: React.FC<Props> = ({ userId, onUpdate }) => {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]); // Dependency analysis
  
  return <div>{/* Component structure analysis */}</div>;
};
```

### Vue Applications
- **Vue 2/3** - Composition API and Options API
- **Single File Components** - Template, script, style analysis
- **TypeScript** - Vue + TypeScript projects
- **Vue Router** - Route and navigation analysis

**Example Analysis**:
```vue
<!-- Vue component analysis -->
<template>
  <div class="user-profile">
    {{ user.name }}
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';

export default defineComponent({
  props: {
    userId: String
  },
  setup(props) {
    const user = ref(null);
    
    onMounted(() => {
      // Lifecycle and dependency analysis
    });
    
    return { user };
  }
});
</script>
```

### Build Tools Integration
- **Webpack** - Bundle analysis and optimization
- **Vite** - Modern build tool support
- **Create React App** - CRA project analysis
- **Vue CLI** - Vue project analysis

## ⚙️ Configuration Options

### Analysis Configuration
```javascript
const options = {
  // File patterns
  filePattern: '**/*.{js,jsx,ts,tsx,vue}',
  exclude: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '**/*.test.*',
    '**/*.spec.*'
  ],
  
  // Analysis depth
  maxDepth: 15,
  includeNodeModules: false,
  
  // Component analysis
  extractSnapshots: true,
  trackHookDependencies: true,
  analyzeRoutes: true,
  
  // Performance
  enableCaching: true,
  parallelAnalysis: true
};
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 🔧 Advanced Features

### Snapshot Extraction
The analyzer can extract detailed snapshots of React and Vue components:

```javascript
// Snapshot extraction example
const snapshots = extractSnapshotsForFile(filePath, fileContent);

// Snapshot structure
{
  componentName: "UserCard",
  type: "react",
  props: ["user", "onClick"],
  hooks: ["useState", "useCallback"],
  eventBindings: ["onClick", "onMouseEnter"],
  renderElements: ["div", "img", "h3", "p"]
}
```

### Dependency Graph Visualization
```javascript
// Generate dependency graph
const dependencyGraph = await analyzer.analyzeDependencies();

// Graph structure
{
  nodes: [
    { id: "src/App.js", label: "App", type: "component" },
    { id: "src/utils/api.js", label: "API Utils", type: "utility" }
  ],
  edges: [
    { from: "src/App.js", to: "src/utils/api.js", type: "import" }
  ]
}
```

### Performance Metrics
```javascript
// Performance analysis
const metrics = {
  bundleSize: "245KB",
  unusedCode: "12KB",
  circularDependencies: 2,
  deepImportChains: 3,
  componentComplexity: {
    average: 4.2,
    max: 12,
    highComplexityComponents: ["Dashboard", "DataTable"]
  }
};
```

## 🔗 Integration Points

### CLI Usage
```bash
# Basic analysis
node analyze.js /path/to/project

# With options
node analyze.js /path/to/project \
  --output analysis-result.json \
  --include-snapshots \
  --max-depth 20
```

### API Integration
```javascript
// Integration with build tools
const analyzer = new FrontendAnalyzer(projectPath);
const result = await analyzer.analyze();

// Use results for build optimization
if (result.dependencies.stats.circularCount > 0) {
  console.warn('Circular dependencies detected:', result.dependencies.circular);
}
```

### VS Code Plugin Integration
```javascript
// Plugin integration
const analysisResult = await runFrontendAnalysis(workspaceRoot);
displayAnalysisResults(analysisResult);
```

## 🔗 Related Documentation

- [Backend Analyzer](../backend-analyzer/) - Java backend code analysis
- [Golang Analyzer](../golang-analyzer/) - Go code analysis
- [Build Tools](../build-tools/) - Build and packaging tools
- [VSCode Plugin](../vscode-plugin/) - IDE integration

---

**English** | [中文版](./README_CN.md) 