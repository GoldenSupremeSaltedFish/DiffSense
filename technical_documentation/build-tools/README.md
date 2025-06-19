# Build Tools Documentation

The Build Tools module provides comprehensive build automation, packaging, and deployment utilities for the DiffSense project. It includes scripts, checklists, and CI/CD integration tools to ensure consistent and reliable builds across all components.

## 📋 Documentation Index

### Build Process
- [`BUILD_PROCESS.md`](./BUILD_PROCESS.md) - Complete build process documentation
- [`PACKAGING_GUIDE.md`](./PACKAGING_GUIDE.md) - Packaging and VSIX creation guide
- [`VERIFICATION_CHECKLIST.md`](./VERIFICATION_CHECKLIST.md) - Build verification and quality checks

### Automation Scripts
- [`SCRIPT_REFERENCE.md`](./SCRIPT_REFERENCE.md) - Build script reference and usage
- [`CI_CD_INTEGRATION.md`](./CI_CD_INTEGRATION.md) - Continuous integration and deployment
- [`AUTOMATION_TOOLS.md`](./AUTOMATION_TOOLS.md) - Automated build tools and utilities

### Configuration
- [`BUILD_CONFIGURATION.md`](./BUILD_CONFIGURATION.md) - Build system configuration options
- [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md) - Development environment setup
- [`DEPENDENCY_MANAGEMENT.md`](./DEPENDENCY_MANAGEMENT.md) - Dependency management strategies

### Troubleshooting
- [`COMMON_BUILD_ISSUES.md`](./COMMON_BUILD_ISSUES.md) - Common build problems and solutions
- [`DEBUG_BUILD_PROCESS.md`](./DEBUG_BUILD_PROCESS.md) - Build debugging techniques

## 🔧 Build Components

### Core Build Scripts

#### `build-all.bat`
Complete build automation script for Windows environments.

**Features**:
- Java analyzer compilation
- Frontend application building
- Node.js analyzer preparation
- Golang analyzer setup
- Plugin compilation and packaging
- VSIX generation

**Usage**:
```bash
# Run complete build
./build-all.bat

# Build output includes:
# - Java JAR files
# - Frontend dist files
# - Plugin compilation
# - VSIX package
```

#### `check-build.bat`
Build verification and validation script.

**Features**:
- Verify all required files exist
- Check file sizes and integrity
- Validate plugin structure
- Generate build report

**Usage**:
```bash
# Verify build completeness
./check-build.bat

# Output: Build verification report
```

### Build Targets

#### Java Backend Analyzer
```bash
# Maven build
mvn clean package -DskipTests

# Output: target/gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar
```

#### Frontend Application
```bash
# React/TypeScript build
cd ui/diffsense-frontend
npm install
npm run build

# Output: dist/ directory with built assets
```

#### Node.js Analyzers
```bash
# Frontend analyzer
cd ui/node-analyzer
npm install

# Golang analyzer
cd ui/golang-analyzer
npm install

# Output: Ready-to-use analyzer modules
```

#### VSCode Plugin
```bash
# Plugin compilation and packaging
cd plugin
npm run compile
npm run package

# Output: diffsense-x.x.x.vsix
```

## 📦 Packaging System

### VSIX Package Structure
```
diffsense-x.x.x.vsix
├── extension.js           # Compiled plugin code
├── package.json          # Plugin manifest
├── icon.png             # Plugin icon
├── analyzers/           # Java analyzers
│   └── *.jar
├── ui/                  # Analysis engines
│   ├── node-analyzer/
│   └── golang-analyzer/
└── dist/               # Frontend assets
    ├── index.html
    ├── assets/
    └── ...
```

### Build Artifacts
- **Java Analyzer**: `gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar` (24MB)
- **Frontend Assets**: React application build output
- **Plugin Code**: Compiled TypeScript extension
- **VSIX Package**: Complete plugin package for distribution

## ⚙️ Build Configuration

### Environment Variables
```bash
# Java configuration
JAVA_HOME=/path/to/jdk
MAVEN_OPTS="-Xmx2g"

# Node.js configuration
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=4096"

# Build options
SKIP_TESTS=true
PARALLEL_BUILD=true
```

### Maven Configuration
```xml
<!-- pom.xml build configuration -->
<build>
  <plugins>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-shade-plugin</artifactId>
      <version>3.2.4</version>
      <executions>
        <execution>
          <phase>package</phase>
          <goals>
            <goal>shade</goal>
          </goals>
          <configuration>
            <createDependencyReducedPom>false</createDependencyReducedPom>
            <finalName>gitimpact-1.0-SNAPSHOT-jar-with-dependencies</finalName>
          </configuration>
        </execution>
      </executions>
    </plugin>
  </plugins>
</build>
```

### NPM Scripts
```json
{
  "scripts": {
    "build": "npm run build:frontend && npm run build:plugin",
    "build:frontend": "cd ui/diffsense-frontend && npm run build",
    "build:plugin": "cd plugin && npm run compile",
    "package": "cd plugin && npm run package",
    "verify": "./check-build.bat"
  }
}
```

## 🚀 CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/build.yml
name: Build and Package
on: [push, pull_request]

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
        with:
          java-version: '11'
      - uses: actions/setup-node@v3
        with:
          node-version: '16'
      
      - name: Build All Components
        run: ./build-all.bat
      
      - name: Verify Build
        run: ./check-build.bat
      
      - name: Upload VSIX
        uses: actions/upload-artifact@v3
        with:
          name: diffsense-vsix
          path: plugin/*.vsix
```

### Build Pipeline Stages
1. **Environment Setup** - JDK, Node.js, dependencies
2. **Code Compilation** - Java, TypeScript, React
3. **Asset Preparation** - Copy files, optimize resources
4. **Package Creation** - Generate VSIX package
5. **Verification** - Validate build completeness
6. **Artifact Storage** - Store build outputs

## 📊 Build Metrics

### Performance Benchmarks
- **Complete Build Time**: ~3-5 minutes
- **Java Compilation**: ~45 seconds
- **Frontend Build**: ~60 seconds
- **Plugin Packaging**: ~15 seconds
- **Verification**: ~10 seconds

### Build Size Analysis
```
Component Sizes:
├── Java Analyzer JAR: 24MB
├── Frontend Assets: 2.5MB
├── Node Analyzers: 15MB
├── Plugin Code: 500KB
└── Total VSIX: ~42MB
```

## 🔧 Build Optimization

### Performance Improvements
- **Parallel Builds** - Run independent builds simultaneously
- **Incremental Compilation** - Only rebuild changed components
- **Caching** - Cache dependencies and build artifacts
- **Resource Optimization** - Minimize asset sizes

### Build Caching Strategy
```bash
# Maven dependency caching
.m2/repository/

# Node.js module caching
node_modules/
ui/*/node_modules/

# Build output caching
target/
dist/
plugin/dist/
```

## 🔗 Integration Points

### Development Workflow
```bash
# Development build (fast)
npm run dev

# Production build (optimized)
npm run build

# Package for distribution
npm run package

# Verify build quality
npm run verify
```

### Release Process
1. **Version Update** - Update version numbers
2. **Complete Build** - Run full build process
3. **Quality Check** - Verify all components
4. **Package Creation** - Generate VSIX
5. **Testing** - Install and test package
6. **Distribution** - Publish to VS Code marketplace

## 🔗 Related Documentation

- [Backend Analyzer](../backend-analyzer/) - Java backend build process
- [Frontend Analyzer](../frontend-analyzer/) - Node.js frontend build process
- [VSCode Plugin](../vscode-plugin/) - Plugin development and packaging
- [Golang Analyzer](../golang-analyzer/) - Go analyzer build process

---

**English** | [中文版](./README_CN.md) 