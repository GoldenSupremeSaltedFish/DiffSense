# Backend Change Classification System

## Overview

The DiffSense Backend Change Classification System provides a structured approach to categorizing code changes in Java backend applications. This system replaces the previous risk-scoring approach with precise, actionable change categories that help developers understand the nature and impact of their modifications.

## Classification Categories

### A1: Business Logic Changes
**Definition**: Modifications to core business processing logic in Controllers, Services, and business components.

**Detection Criteria**:
- Files in `/controller/`, `/service/`, `/business/` packages
- Methods containing business processing keywords: `process`, `handle`, `execute`, `calculate`
- Modification of business rules and workflow logic
- Changes to transaction boundaries and business validations

**Examples**:
```java
// Business logic modification
@Service
public class OrderService {
    public OrderResult processOrder(OrderRequest request) {
        // Modified business logic here
        return calculateOrderTotal(request);
    }
}
```

**Confidence Scoring**:
- Package location: 35 points
- Method name patterns: 20 points
- Business annotations: 15 points
- Code complexity: 10 points

### A2: Interface Changes
**Definition**: Modifications to API contracts, method signatures, parameters, and return structures.

**Detection Criteria**:
- REST API endpoint modifications (`@RequestMapping`, `@GetMapping`, etc.)
- Method signature changes (parameters, return types)
- DTO/Request/Response object modifications
- API versioning changes

**Examples**:
```java
// API interface change
@RestController
public class UserController {
    @GetMapping("/users/{id}")
    public UserResponse getUser(@PathVariable Long id, 
                               @RequestParam String includeDetails) { // New parameter
        // Implementation
    }
}
```

**Confidence Scoring**:
- REST annotations: 40 points
- Method signature changes: 25 points
- DTO modifications: 20 points
- Parameter changes: 15 points

### A3: Data Structure Changes
**Definition**: Modifications to data models, entities, DTOs, and database schema.

**Detection Criteria**:
- Entity class modifications (`@Entity`, `@Table`)
- DTO and data transfer object changes
- Database migration files
- JPA/Hibernate mapping changes

**Examples**:
```java
// Data structure change
@Entity
@Table(name = "users")
public class User {
    @Id
    private Long id;
    
    @Column(name = "email", unique = true) // New constraint
    private String email;
    
    // New field added
    @Column(name = "phone_number")
    private String phoneNumber;
}
```

**Confidence Scoring**:
- Entity annotations: 30 points
- Field additions/removals: 25 points
- Database constraints: 20 points
- Migration files: 25 points

### A4: Middleware/Framework Adjustments
**Definition**: Changes to framework configurations, middleware components, and infrastructure settings.

**Detection Criteria**:
- Configuration files (`application.yml`, `application.properties`)
- Framework version upgrades
- Security configuration changes
- Database connection and pool settings

**Examples**:
```yaml
# Configuration change
spring:
  datasource:
    hikari:
      maximum-pool-size: 20  # Changed from 10
      connection-timeout: 30000
  
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: ${GOOGLE_CLIENT_ID}  # New OAuth provider
```

**Confidence Scoring**:
- Configuration file changes: 35 points
- Framework annotations: 25 points
- Infrastructure modifications: 20 points
- Version upgrades: 20 points

### A5: Non-functional Modifications
**Definition**: Changes that don't affect business logic but improve code quality, performance, or maintainability.

**Detection Criteria**:
- Comment additions/modifications
- Code formatting and style changes
- Logging improvements
- Performance optimizations without logic changes
- Refactoring without behavioral changes

**Examples**:
```java
// Non-functional change
@Service
public class UserService {
    
    private static final Logger logger = LoggerFactory.getLogger(UserService.class);
    
    public User findUser(Long id) {
        logger.debug("Finding user with id: {}", id); // Added logging
        
        // Optimized query (performance improvement)
        return userRepository.findByIdWithCache(id);
    }
}
```

**Confidence Scoring**:
- Comment changes: 20 points
- Logging additions: 25 points
- Performance optimizations: 30 points
- Code formatting: 10 points

## Implementation Architecture

### Core Components

#### BackendChangeClassifier
```java
public class BackendChangeClassifier {
    public ClassificationResult classifyChanges(List<String> changedFiles) {
        // Classification logic implementation
    }
    
    private double calculateA1Score(String filePath, String content) {
        // Business logic classification
    }
    
    private double calculateA2Score(String filePath, String content) {
        // Interface change classification
    }
    
    // Additional classification methods...
}
```

#### Classification Result Structure
```java
public class ClassificationResult {
    private List<FileClassification> fileClassifications;
    private ClassificationSummary summary;
    private double overallConfidence;
}

public class FileClassification {
    private String filePath;
    private ChangeCategory category;
    private double confidence;
    private List<String> indicators;
}
```

### Integration Points

#### CLI Integration
```bash
# Command line usage
java -jar gitimpact-analyzer.jar \
  --analyze /path/to/project \
  --classification-mode \
  --output classification-result.json
```

#### API Integration
```java
// Programmatic usage
AnalysisConfig config = new AnalysisConfig();
config.setClassificationMode(true);
config.setTargetDirectory("/path/to/project");

ImpactAnalyzer analyzer = new ImpactAnalyzer(config);
ClassificationResult result = analyzer.classifyChanges();
```

## Output Format

### JSON Structure
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "projectPath": "/path/to/project",
  "changeClassifications": [
    {
      "filePath": "src/main/java/com/example/service/OrderService.java",
      "category": "A1_BUSINESS_LOGIC",
      "confidence": 87.5,
      "indicators": [
        "Business processing method: processOrder",
        "Service layer modification",
        "Transaction boundary change"
      ]
    },
    {
      "filePath": "src/main/java/com/example/controller/UserController.java",
      "category": "A2_INTERFACE_CHANGES",
      "confidence": 92.0,
      "indicators": [
        "REST endpoint modification",
        "Method signature change",
        "New request parameter added"
      ]
    }
  ],
  "classificationSummary": {
    "A1_BUSINESS_LOGIC": 12,
    "A2_INTERFACE_CHANGES": 5,
    "A3_DATA_STRUCTURE": 3,
    "A4_MIDDLEWARE": 2,
    "A5_NON_FUNCTIONAL": 8
  },
  "totalFiles": 30,
  "overallConfidence": 84.2
}
```

### HTML Report
The system generates comprehensive HTML reports with:
- Visual classification distribution charts
- Detailed file-by-file analysis
- Confidence scoring explanations
- Actionable recommendations

## Configuration Options

### Analysis Settings
```yaml
diffsense:
  classification:
    confidence-threshold: 70.0
    enable-categories:
      - A1_BUSINESS_LOGIC
      - A2_INTERFACE_CHANGES
      - A3_DATA_STRUCTURE
      - A4_MIDDLEWARE
      - A5_NON_FUNCTIONAL
    
    scoring-weights:
      package-location: 0.35
      method-patterns: 0.25
      annotations: 0.20
      complexity: 0.20
```

### Custom Rules
```java
// Custom classification rules
public class CustomClassificationRules {
    @Rule(category = "A1_BUSINESS_LOGIC")
    public boolean isBusinessLogic(String filePath, String content) {
        return filePath.contains("/business/") && 
               content.contains("@BusinessRule");
    }
}
```

## Performance Considerations

### Optimization Strategies
- **Lazy Loading**: Classification rules loaded on-demand
- **Caching**: File analysis results cached for repeated runs
- **Parallel Processing**: Multi-threaded analysis for large codebases
- **Memory Management**: Streaming analysis for large files

### Benchmarks
- **Small Projects** (< 100 files): < 2 seconds
- **Medium Projects** (100-1000 files): < 30 seconds
- **Large Projects** (> 1000 files): < 2 minutes

## Troubleshooting

### Common Issues

#### Low Confidence Scores
**Problem**: Classification confidence consistently below 70%
**Solution**: 
- Verify project structure matches expected patterns
- Check if custom rules are needed for domain-specific code
- Review file path patterns in classification logic

#### Incorrect Classifications
**Problem**: Files classified in wrong categories
**Solution**:
- Examine classification indicators in output
- Adjust scoring weights in configuration
- Add custom classification rules for specific patterns

#### Performance Issues
**Problem**: Analysis takes too long
**Solution**:
- Enable parallel processing
- Increase JVM heap size
- Use file filtering to exclude unnecessary directories

### Debug Mode
```bash
# Enable debug logging
java -Dlogging.level.com.yourorg.gitimpact=DEBUG \
  -jar gitimpact-analyzer.jar --analyze /path/to/project
```

## Migration from Risk Scoring

### Key Changes
1. **Data Structure**: `riskScore` field replaced with `changeClassifications`
2. **Analysis Logic**: Risk calculation replaced with category classification
3. **Output Format**: JSON structure updated to include classification details
4. **UI Components**: Frontend updated to display categories instead of scores

### Migration Steps
1. Update backend analysis configuration
2. Rebuild Java analyzer with new classification system
3. Update frontend components to handle new data structure
4. Test with existing projects to verify accuracy

---

**English** | [中文版](./CLASSIFICATION_SYSTEM_CN.md) 