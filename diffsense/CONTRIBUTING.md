# Contributing to DiffSense

Thank you for your interest in contributing to DiffSense!

**Important**: DiffSense is an **engineering-grade risk governance platform**, not a simple linter script. Contributions are evaluated based on their ability to solve real-world semantic risks, their performance impact, and their adherence to our architectural philosophy.

Please read this guide carefully before submitting a Pull Request.

---

## 1. Project Vision

> **DiffSense detects semantic risks in code changes, not syntax or style issues.**

Our mission is to catch high-impact bugs (runtime exceptions, concurrency issues, data integrity violations) that slip through traditional static analysis tools.

*   **✅ What We Do**: Focus on `runtime`, `concurrency`, `data`, and `api` compatibility risks.
*   **❌ What We Don't Do**: Code formatting, naming conventions, or style checks (leave that to ESLint/Checkstyle).

**Goal**: Prevent production incidents by understanding the *semantic meaning* of a diff.

---

## 2. What Makes a Good Contribution?

We prioritize contributions that enhance the **intelligence** and **reliability** of our risk detection engine.

### ✅ High Value (Highly Recommended)
*   **New Semantic Signals**: Enhancing `ASTDetector` or `SemanticDiff` to capture new types of meaningful code changes (e.g., "Critical Section Scope Change").
*   **New Risk Patterns**: Rules based on *real-world incidents* (e.g., "Double-checked locking failure").
*   **False Positive Reduction**: Refining logic to ignore safe patterns (e.g., logging changes inside a lock).
*   **Performance Optimization**: Ensuring core analysis logic runs in **< 5ms** per file.
*   **Replay Datasets**: Contributing real-world diffs and expected outcomes for our benchmark suite.

### ❌ Low Value (Likely Rejected)
*   Style/Linting rules without semantic context.
*   Pure AST matching rules that duplicate existing linter functionality.
*   Refactoring for aesthetics without measurable performance or logic benefits.

---

## 3. Architecture Overview

DiffSense follows a strict **Three-Layer Architecture**. Please respect this separation of concerns:

1.  **TypeTag / Parser**: Extracts raw structural data from the diff.
2.  **SemanticDiff (The Core)**: Interprets raw changes into *Semantic Signals* (e.g., `concurrency.lock_scope_changed`, `api.parameter_type_downgraded`).
    *   *This is where the "intelligence" lives.*
3.  **Rule Engine**: Consumes *Signals* to make policy decisions (Severity, Rationale).
    *   *This layer should be thin and declarative.*

**⚠️ Golden Rule:**
> **Never encode complex analysis logic directly inside Rules.**
> Move complex logic to the **Semantic Layer** (`core/ast_detector.py` or `core/semantic_diff.py`) and emit a standardized Signal. The Rule should only *evaluate* that Signal.

---

## 4. Rule Development Checklist

If you are adding a new Rule (via `rules/*.yaml` or Python plugins), you **MUST** meet these engineering standards:

*   [ ] **Real-World Case**: Provide a `.diff` file from a real scenario (or realistic reproduction) in `tests/fixtures`.
*   [ ] **Replay Verified**: Run the rule against our Replay dataset to ensure it behaves as expected.
*   [ ] **Performance**: Average execution time must be **< 5ms**.
*   [ ] **False Positive Analysis**: Document known edge cases where this might trigger incorrectly and how you mitigated it.
*   [ ] **Hit Rate Stats**: Provide data on how often this rule triggers in a typical repository (avoid noisy rules).

**Note**: Rules that cause high false positives or slow down the audit process will be rejected.

---

## 5. Replay / Benchmark Contribution

Your most valuable contribution might be **Data**, not Code.
We maintain a Replay Benchmark to measure precision and recall across thousands of commits.

You can contribute by:
1.  **Submitting Benchmark Cases**: Add new `repo_cases/` with `summary.json` (expected risks).
2.  **Labeling False Positives**: Review `replay_reports/` and mark incorrect detections to help us tune the engine.
3.  **Performance Metrics**: Share `metrics.json` from running DiffSense on large repositories.

---

## 6. Traditional Setup & PR Process

Once you understand the philosophy above, here is the standard workflow:

1.  **Fork & Clone**:
    ```bash
    git clone https://github.com/your-username/diffsense.git
    cd diffsense
    pip install -r requirements.txt
    ```

2.  **Create a Branch**:
    ```bash
    git checkout -b feature/semantic-lock-detection
    ```

3.  **Develop & Test**:
    *   Add your logic to `core/` (Semantic Layer).
    *   Add your rule configuration to `config/rules.yaml` (Rule Layer).
    *   Add tests in `tests/` and verify with `python -m unittest discover tests`.

4.  **Submit Pull Request**:
    *   Describe the **Semantic Risk** you are addressing.
    *   Attach the **Replay Verification** results.
    *   Link to the **Real-World Case** (Issue or Diff).

We look forward to your high-quality contributions!
