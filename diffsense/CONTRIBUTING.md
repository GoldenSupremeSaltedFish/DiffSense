# Contributing to DiffSense

Thank you for your interest in contributing to DiffSense! We welcome contributions from the community to help improve semantic code analysis.

## Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/your-username/diffsense.git
    cd diffsense
    ```
3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

## Development Workflow

1.  Create a new branch for your feature or fix:
    ```bash
    git checkout -b feature/my-new-rule
    ```
2.  Write your code.
    *   If adding a new rule, add it to `rules/` or `config/rules.yaml`.
    *   Add tests in `tests/`.
3.  Run tests:
    ```bash
    python -m unittest discover tests
    ```
4.  Commit your changes with clear messages.
5.  Push to your fork and submit a **Pull Request**.

## Adding a New Rule

You can add rules in two ways:

### 1. YAML Configuration (Simple)
Edit `config/rules.yaml` to add a new rule entry:

```yaml
  - id: my.new.rule
    signal: "runtime.concurrency.lock"
    action: "added"
    severity: medium
    rationale: "My rationale here"
```

### 2. Python Plugin (Advanced)
Create a new class inheriting from `BaseRule` in `sdk/rule.py` and register it in `core/rules.py`.

## Code Style

*   Follow PEP 8 guidelines.
*   Use type hints where possible.
*   Keep functions focused and small.

## Reporting Issues

Please check existing issues before opening a new one. Include:
*   Steps to reproduce.
*   Expected behavior vs actual behavior.
*   Diff snippet that caused the issue.
