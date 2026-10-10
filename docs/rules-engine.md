# Rules Engine Guide

DiffSense ships two rule layers: **built-in rules** (bundled with the package) and **PRO rules**
(1,718+ parameterized rules loaded from the `pro-rules/` directory). This page consolidates the
former `README_multilang.md` and `README_parameterized_rules.md` guides.

## Language Support Matrix

| Language | Parser | Support Level | Rules |
|----------|--------|---------------|-------|
| Java | `JavaParser` | Full | 1,718+ built-in & PRO rules |
| Python | `PythonParser` | Basic AST | Core security / quality rules |
| Go | `GoParser` | Placeholder | Experimental |

All parsers extend `BaseParser` and register through `ParserRegistry`, which selects the parser by
file extension and repository language fingerprint.

### Adding a New Language

1. Subclass `BaseParser` and implement `parse()` returning the unified AST representation.
2. Register the subclass in `ParserRegistry`.
3. Map file extensions in the registry's extension table.
4. Add AST fixture tests under `tests/`.

## PRO Rules

### Directory Layout

```
pro-rules/
  critical/    # 22
  data/        # 10
  high/        # 1647
  performance/ # 10
  runtime/     # 8
  security/    # 10
```

Each rule file is a parameterized YAML definition (pattern, severity, remediation hint, profile
membership) consumed by the rule engine.

### Configuring `RuleEngine`

```python
from core import RuleEngine

# 1. Built-in rules only
engine = RuleEngine()

# 2. Explicit rule directory
engine = RuleEngine(rules_path="rules/")

# 3. Built-in + PRO rules (recommended)
engine = RuleEngine(pro_rules_path="pro-rules/")
```

### Loading Order (CLI)

The CLI resolves the PRO rule directory in this order:

1. Environment variable `DIFFSENSE_PRO_RULES`
2. `pro_rules_path` in `.diffsense.yaml`
3. Default: sibling `pro-rules/` directory next to the working tree

Rule sets and profiles can additionally be tuned via `diffsense.config.json` (`rulesets` section);
see that file for the current configuration used by CI.

## Compatibility Notes

- PRO rule statistics above reflect the current `main` tree; the engine treats rule counts as
  informational, never as a contract.
- Existing audit/replay behavior is unchanged when `pro_rules_path` is omitted — the engine falls
  back to built-in rules only.
- Rule IDs remain stable across releases; new rules are additive.

## Testing

```bash
python -m pytest tests/ -k "rule or parser"
```

## Limitations & Roadmap

- Python and Go coverage is intentionally narrow; Java remains the audit-grade target.
- Cross-language data-flow tracking is experimental and not enabled by default.
- See `AGENTS.md` for contract red lines (rule engine semantics must not change without a
  dedicated spec).
