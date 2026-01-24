# DiffSense Parser Contract

## Product Positioning
**DiffSense Parser is a diff-first engineering impact analyzer designed for MR-level decision support.**

It is an independent component that:
1.  **Input**: Accepts a standard Unified Diff (string/file).
2.  **Output**: Returns a stable JSON Impact Report.
3.  **Context**: Is agnostic of MR/PR concepts, IDEs, or specific CI platforms. It only knows Diff, Rules, and Decision.

## 1. Input Specification
The parser accepts a path to a file containing a **Unified Diff**.

```bash
python main.py <diff_file_path> --rules <rules_config_path> --format json
```

## 2. Output Specification (JSON)
The output is a strict JSON object with the following schema.

```json
{
  "review_level": "elevated", 
  "reasons": [
    "runtime.async_change",
    "data.schema_change"
  ],
  "files": [
    "src/core/processor.py",
    "migrations/001_initial.sql"
  ],
  "impacts": {
    "runtime": "medium",
    "data": "high"
  },
  "details": [
    {
      "rule_id": "runtime.async_change",
      "severity": "medium",
      "file": "src/core/processor.py",
      "rationale": "Async behavior change affects execution model"
    }
  ],
  "meta": {
    "confidence": 0.72,
    "suggested_action": "manual_review"
  }
}
```

### Fields Definition
*   **review_level**: `normal` | `elevated` | `critical`. The overall risk assessment.
*   **reasons**: List of rule IDs that triggered the elevated/critical status.
*   **files**: List of all files modified in the diff.
*   **impacts**: Key-value pairs of dimension (e.g., `runtime`, `data`) and their highest severity.
*   **details**: List of specific rule matches for debugging or detailed display.
*   **meta**: Reserved fields for future ML/heuristic extensions.
    *   `confidence`: (Float 0-1) Confidence score of the analysis.
    *   `suggested_action`: Recommended action (e.g., `auto_merge`, `manual_review`).
