# Rule Plugins (diffsense.rules)

DiffSense discovers rules from pip-installed packages via the entry point group **`diffsense.rules`**. This allows enterprises to ship their own rule sets (e.g. `pip install diffsense-rules-company`) without forking the core.

## Entry point contract

In your package's `pyproject.toml`:

```toml
[project.entry-points."diffsense.rules"]
company = "diffsense_rules_company:get_rules"
```

The referenced callable (`get_rules`) must be importable and must return one of:

1. **`List[Rule]`**  
   A list of rule instances (subclasses of `diffsense.core.rule_base.Rule`). Only rules with `enabled=True` are registered.

2. **`str`**  
   A path to a single YAML file or a directory of YAML files (same semantics as `--rules`). That path is loaded with the same logic as the core (file or directory of `*.yaml` with top-level `rules: [...]`).

## Example: returning rules programmatically

```python
# diffsense_rules_company/__init__.py
from diffsense.core.rule_base import Rule
from diffsense.rules.yaml_adapter import YamlRule

def get_rules():
    return [
        YamlRule({
            "id": "company.custom.rule",
            "category": "security",
            "severity": "high",
            "impact": "security",
            "rationale": "Company policy: ...",
            "file": "**",
            "enabled": True,
        }),
    ]
```

## Example: returning a path

```python
import os

def get_rules():
    return os.path.join(os.path.dirname(__file__), "rules")  # directory of YAMLs
```

## Behavior

- Discovery runs after built-in rules and `--rules` YAML (file or directory) are loaded.
- If a plugin raises an exception, that plugin is skipped; others are still loaded.
- Rule metadata (`category`, `severity`, `enabled`, etc.) is respected; profiles (e.g. `--profile lightweight`) filter the combined rule set as usual.

## Packaging

- Package name convention: `diffsense-rules-<name>` (e.g. `diffsense-rules-enterprise`).
- Publish to PyPI or an internal index; users run `pip install diffsense-rules-company` and use `diffsense audit` (or replay) with or without `--rules`; plugin rules are always merged in.
