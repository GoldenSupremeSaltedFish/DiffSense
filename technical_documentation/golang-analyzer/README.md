# Golang Analyzer Documentation

The Golang Analyzer is a Node.js-based analysis engine specifically designed for Go code analysis, providing comprehensive impact analysis for Go modules, packages, and concurrent programming patterns.

## 📋 Documentation Index

### Core Implementation
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - System architecture and design patterns
- [`GO_MODULE_ANALYSIS.md`](./GO_MODULE_ANALYSIS.md) - Go module and package analysis
- [`CONCURRENCY_TRACKING.md`](./CONCURRENCY_TRACKING.md) - Goroutine and channel analysis
- [`API_REFERENCE.md`](./API_REFERENCE.md) - Node.js API documentation and usage

### Analysis Features
- [`DEPENDENCY_ANALYSIS.md`](./DEPENDENCY_ANALYSIS.md) - Go module dependency tracking
- [`INTERFACE_ANALYSIS.md`](./INTERFACE_ANALYSIS.md) - Interface implementation analysis
- [`PERFORMANCE_PROFILING.md`](./PERFORMANCE_PROFILING.md) - Performance analysis integration
- [`ERROR_HANDLING.md`](./ERROR_HANDLING.md) - Error handling pattern analysis

### Implementation Guides
- [`SETUP_GUIDE.md`](./SETUP_GUIDE.md) - Development environment setup
- [`CONFIGURATION.md`](./CONFIGURATION.md) - Configuration options and customization
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) - Testing strategies and best practices

### Troubleshooting
- [`COMMON_ISSUES.md`](./COMMON_ISSUES.md) - Common problems and solutions
- [`DEBUG_GUIDE.md`](./DEBUG_GUIDE.md) - Debugging techniques and tools

## 🔧 Key Features

### Go-Specific Analysis
- **Module Dependencies** - go.mod and go.sum analysis
- **Package Structure** - Package organization and imports
- **Interface Implementation** - Interface satisfaction analysis
- **Goroutine Tracking** - Concurrent execution analysis
- **Channel Communication** - Channel usage and deadlock detection

### Technology Stack
- **Node.js 14+** - Core analysis runtime
- **Go AST Parser** - Go source code parsing
- **Module Graph** - Dependency relationship mapping
- **Concurrency Analysis** - Goroutine and channel tracking

## 🚀 Quick Start

### Prerequisites
```bash
# Node.js and npm
node --version  # Requires Node.js 14+
npm --version

# Go development tools
go version  # Requires Go 1.16+
```

### Installation and Setup
```bash
# Install dependencies
npm install

# Run analysis
node analyze.js /path/to/go/project
```

### Basic Usage
```javascript
// JavaScript API usage
const { GolangAnalyzer } = require('./analyze');

const analyzer = new GolangAnalyzer('/path/to/project', {
  includeVendor: false,
  analyzeTests: true,
  trackGoroutines: true
});

const result = await analyzer.analyze();
console.log(result);
```

## 📊 Analysis Output

### Go Module Analysis
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "targetDir": "/path/to/go/project",
  "summary": {
    "totalPackages": 23,
    "totalFunctions": 156,
    "totalGoroutines": 12,
    "moduleVersion": "v1.2.3"
  },
  "modules": {
    "main": "github.com/example/project",
    "dependencies": [
      {
        "module": "github.com/gin-gonic/gin",
        "version": "v1.9.1",
        "indirect": false
      }
    ]
  },
  "concurrency": {
    "goroutines": 12,
    "channels": 8,
    "mutexes": 3,
    "potentialDeadlocks": 0
  }
}
```

## 🔗 Related Documentation

- [Backend Analyzer](../backend-analyzer/) - Java backend code analysis
- [Frontend Analyzer](../frontend-analyzer/) - Frontend code analysis
- [Build Tools](../build-tools/) - Build and packaging tools
- [VSCode Plugin](../vscode-plugin/) - IDE integration

---

**English** | [中文版](./README_CN.md) 