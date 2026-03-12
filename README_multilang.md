# DiffSense Multi-Language Support

DiffSense now supports multiple programming languages through a pluggable parser architecture.

## Supported Languages

- **Java**: Full support with 1718+ PRO rules
- **Python**: Basic support with built-in AST parser  
- **Go**: Parser framework ready (implementation pending)

## Architecture Overview

```
Source Code → Language-specific Parser → Unified Signal Format → Rule Engine → Risk Assessment
```

### Key Components

1. **BaseParser**: Abstract base class defining the parser interface
2. **Language Parsers**: 
   - `JavaParser`: Java-specific implementation
   - `PythonParser`: Python-specific implementation using built-in `ast` module
   - `GoParser`: Go-specific implementation (placeholder)
3. **ParserRegistry**: Automatic parser discovery and registration
4. **Multi-language Rules**: YAML rules can specify `language` field

## Usage Examples

### 1. Basic Multi-language Usage

```python
from diffsense.core.rules import RuleEngine

# Automatically detects language based on file extension
engine = RuleEngine(pro_rules_path="pro-rules/")

# Analyze mixed-language repository
results = engine.analyze_diff("path/to/diff.patch")
```

### 2. Explicit Language Specification

```yaml
# pro-rules/python/security.yaml
- id: prorule.python.critical.pickle_unsafe
  description: "Unsafe pickle usage detected"
  severity: critical
  domain: security
  language: python
  match: "pickle\\.loads\\(|pickle\\.load\\("
```

### 3. Configuration-based Language Support

```json
// diffsense.config.json
{
  "rulesets": {
    "default": ["rules/"],
    "pro": ["rules/", "pro-rules/"],
    "java_only": ["rules/", "pro-rules/java/"],
    "python_only": ["rules/", "pro-rules/python/"]
  }
}
```

## Adding New Languages

To add support for a new language:

1. **Create a parser class** inheriting from `BaseParser`
2. **Implement required methods**:
   - `parse_file()`: Parse source code into AST
   - `extract_signals()`: Extract semantic signals from AST
   - `get_file_extensions()`: Return supported file extensions
3. **Place parser in `diffsense/parsers/` directory**
4. **Create language-specific rules** in `pro-rules/<language>/`

### Example Parser Template

```python
from .base_parser import BaseParser

class MyLanguageParser(BaseParser):
    def __init__(self):
        super().__init__("mylanguage")
    
    def parse_file(self, file_path: str, content: str) -> Dict[str, Any]:
        # Parse your language's AST here
        pass
    
    def extract_signals(self, ast_data: Dict[str, Any], diff_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        # Extract semantic signals from AST
        pass
    
    def get_file_extensions(self) -> List[str]:
        return [".myext"]
```

## Testing Multi-language Support

Run the comprehensive test suite:

```bash
# Test basic multi-language functionality
python test_multilang_rules.py

# Test regression scenarios
python test_regression_multilang.py

# Test specific language parsers
python -m pytest tests/parsers/test_python_parser.py
```

## Current Limitations

- **Go parser**: Currently a placeholder; needs proper AST implementation
- **Rule coverage**: Python and Go have limited rule sets compared to Java
- **Performance**: Multi-language analysis may be slower than single-language

## Future Improvements

- Add support for JavaScript/TypeScript
- Implement tree-sitter based parsers for better performance
- Add IDE integration for real-time multi-language analysis
- Expand PRO rule coverage for Python and Go