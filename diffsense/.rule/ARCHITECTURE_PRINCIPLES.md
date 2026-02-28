# DiffSense Architecture Principles: Automation Boundaries and Human Decision Checklist

DiffSense is a CI Gate + Code Audit system. As a "blocking tool," it must maintain high trust. These principles define the boundaries of automation within DiffSense.

## 🟥 Class I: Absolute Prohibition (Human Decision Mandatory)

These actions MUST NOT be automated. Automation here risks undermining tool credibility and project safety.

1.  **Auto-Disable Rules**
    *   **Prohibited**: Automatically disabling a rule based on noise or false positive (FP) statistics.
    *   **Reasoning**: Small sample sizes lead to misjudgment; repository differences lead to accidental disabling; rules may "atrophy" over time.
    *   **Correct Way**: Statistics and reporting only. Provide a dashboard for human decision-making.

2.  **Auto-Downgrade Severity**
    *   **Prohibited**: Automatically lowering the severity level of a rule based on statistics.
    *   **Reasoning**: Severity defines risk semantics, not frequency. High-risk issues (e.g., lock removal, SQL injection) must remain high-severity even if they have many FPs.
    *   **Correct Way**: Alert users of "low precision" and allow them to manually adjust YAML configuration.

3.  **Auto-Modify CI Results (Fail → Pass)**
    *   **Prohibited**: Automatically changing a CI status from "fail" to "pass" based on statistical fluctuations or "noise detection."
    *   **Reasoning**: CI is a policy boundary. The tool must not silently allow potential risks to pass. Semantic stability is paramount.
    *   **Correct Way**: CI results must be strictly determined by rule semantics.

4.  **Auto-Rewrite Rule Logic (Self-Learning/Auto-Optimization)**
    *   **Prohibited**: Automatically modifying regex, generating new rules, or merging rules based on data.
    *   **Reasoning**: This compromises explainability and makes the tool unpredictable in an engineering environment.
    *   **Correct Way**: Human-in-the-loop for rule refinement.

5.  **Auto-Ignore Specific Files/Repositories**
    *   **Prohibited**: Automatically skipping high-noise repositories or files without explicit configuration.
    *   **Reasoning**: Creates security blind spots.
    *   **Correct Way**: Explicit user configuration for ignore lists.

## 🟨 Class II: Conditional Automation (Must be Explicitly Enabled)

These are optional enhancements and must be disabled by default.

6.  **Rule Quality Auto-Tuning**
    *   Must require an explicit flag (e.g., `--quality-auto-tune`).
    *   Must respect `min_samples`, `threshold`, and provide clear logging.
    *   Must be reversible.

7.  **Auto-Caching Strategy**
    *   Safe to automate as it only affects performance, not results ("Equivalent Optimization").

8.  **Rule-Level Incremental Scheduling**
    *   Safe to automate as it skips redundant checks without changing semantics.

9.  **Auto-Parallelization/Thread Pooling**
    *   Safe to automate for performance optimization.

## 🟩 Class III: Strong Automation (Boldly Implement)

These areas should be aggressively automated to provide maximum value.

10. **Observability (Default ON)**
    *   Automatically output rule hits, precision, cache hit rate, saved time, and slow rules.
    *   This provides "Engineering Transparency" without side effects.

11. **Profiling**
    *   Automatically identify top 5 slow/noisy/high-value rules to assist in manual optimization.

12. **Replay / Regression Testing**
    *   Automatically replay historical MRs to verify precision and performance.

13. **Rule Sandbox / Experimental Mode**
    *   Support for experimental rules that report findings but do not block CI (e.g., `--experimental-rules`).

---

### Core Philosophy
**DiffSense only automates "Equivalent Optimization" and "Data Statistics." All actions that "Change Risk Semantics" must be decided by a human.**

*   **Machine Responsible for**: Speed, Clarity, Transparency.
*   **Human Responsible for**: Defining Risk, Enabling/Disabling Rules, Setting Severity, Blocking CI.
