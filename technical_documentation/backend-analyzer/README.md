# Backend Analyzer Documentation

The Backend Analyzer is a Java-based analysis engine that provides comprehensive code change impact analysis for backend applications, with specialized support for Spring Boot and microservices architectures.

## 📋 Documentation Index

### Core Implementation
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - System architecture and design patterns
- [`CLASSIFICATION_SYSTEM.md`](./CLASSIFICATION_SYSTEM.md) - Change classification system implementation
- [`API_REFERENCE.md`](./API_REFERENCE.md) - Java API documentation and usage

### Architecture & Design
- [`MICROSERVICES_IMPROVEMENTS.md`](./MICROSERVICES_IMPROVEMENTS.md) - Microservices architecture enhancements
- [`SPRING_BOOT_INTEGRATION.md`](./SPRING_BOOT_INTEGRATION.md) - Spring Boot specific analysis features
- [`PERFORMANCE_OPTIMIZATION.md`](./PERFORMANCE_OPTIMIZATION.md) - Performance tuning and optimization

### Implementation Guides
- [`SETUP_GUIDE.md`](./SETUP_GUIDE.md) - Development environment setup
- [`CONFIGURATION.md`](./CONFIGURATION.md) - Configuration options and customization
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) - Testing strategies and best practices

### Troubleshooting
- [`COMMON_ISSUES.md`](./COMMON_ISSUES.md) - Common problems and solutions
- [`DEBUG_GUIDE.md`](./DEBUG_GUIDE.md) - Debugging techniques and tools

## 🔧 Key Features

### Change Classification System
- **A1: Business Logic Changes** - Controller/Service processing logic modifications
- **A2: Interface Changes** - API method signatures, parameters, return structures
- **A3: Data Structure Changes** - Entity/DTO/Database schema modifications
- **A4: Middleware Adjustments** - Framework upgrades, configuration changes
- **A5: Non-functional Modifications** - Comments, logging, formatting, performance

### Technology Stack
- **Java 8+** - Core analysis engine
- **Spring Boot** - Framework-specific analysis
- **Maven/Gradle** - Build system integration
- **Spoon** - Java source code analysis
- **AST Processing** - Abstract syntax tree manipulation

### Supported Frameworks
- Spring Boot 2.x/3.x
- Spring MVC
- Spring Data JPA
- Spring Security
- Microservices (Spring Cloud)

## 🚀 Quick Start

### Prerequisites
```bash
# Java Development Kit
java -version  # Requires JDK 8+

# Maven or Gradle
mvn --version
gradle --version
```

### Build and Run
```bash
# Build the analyzer
mvn clean package -DskipTests

# Run analysis
java -jar target/gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar \
  --analyze /path/to/project \
  --output analysis-result.json
```

### Integration Example
```java
// Java API usage
AnalysisConfig config = new AnalysisConfig();
config.setTargetDirectory("/path/to/project");
config.setOutputFormat(OutputFormat.JSON);

ImpactAnalyzer analyzer = new ImpactAnalyzer(config);
AnalysisResult result = analyzer.analyze();
```

## 📊 Analysis Output

### Classification Results
```json
{
  "changeClassifications": [
    {
      "filePath": "src/main/java/com/example/UserController.java",
      "category": "A1_BUSINESS_LOGIC",
      "confidence": 85.5,
      "indicators": ["Business processing method", "Service layer modification"]
    }
  ],
  "classificationSummary": {
    "A1_BUSINESS_LOGIC": 12,
    "A2_INTERFACE_CHANGES": 5,
    "A3_DATA_STRUCTURE": 3,
    "A4_MIDDLEWARE": 2,
    "A5_NON_FUNCTIONAL": 8
  }
}
```

## 🔗 Related Documentation

- [Frontend Analyzer](../frontend-analyzer/) - Frontend code analysis
- [Golang Analyzer](../golang-analyzer/) - Go code analysis  
- [Build Tools](../build-tools/) - Build and packaging tools
- [VSCode Plugin](../vscode-plugin/) - IDE integration

---

**English** | [中文版](./README_CN.md) 