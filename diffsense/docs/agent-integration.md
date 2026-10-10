# DiffSense Agent Integration Guide

This guide is for **machine consumers** — LLM reviewers, coding agents, CI
pipelines, and MCP clients — that want to integrate DiffSense as a
deterministic verifier. It complements the normative
[CLI Contract](cli-contract.md), which is the authoritative specification for
the JSON report, exit codes, and SARIF output.

DiffSense is a **Change Risk Gate**: it audits the *current diff* for regression
risks and returns an interpretable verdict. It does not scan whole codebases and
never modifies your repository.

## Integration Options

| Path | Interface | Best for | Side effects |
|------|-----------|----------|--------------|
| CLI JSON | `diffsense replay` / `diffsense audit` | Scripts, CI gates, shell | None (read-only) |
| SARIF 2.1.0 | `diffsense audit --format sarif` | GitHub code scanning / SARIF viewers | None (read-only) |
| MCP | `diffsense-mcp` (stdio) | LLM agents with MCP support | None (read-only) |

All three paths are strictly read-only and share the same audit engine.

## 1. CLI JSON Contract (quick reference)

Install:

```bash
pip install diffsense            # or: pip install "git+https://github.com/GoldenSupremeSaltedFish/DiffSense.git@main#subdirectory=diffsense"
pip install "diffsense[mcp]"     # additionally: MCP server
```

Run a local deterministic audit on a diff file:

```bash
diffsense replay path/to/change.diff --format json
```

Key machine-readable facts (details in [CLI Contract](cli-contract.md)):

- The report's first key MUST be `schema_version` — currently `"1.0"`.
  Validate it before parsing anything else; reject reports with unsupported versions.
- Top-level `review_level` is one of `normal | low | critical | error`.
- Exit codes: `0` = pass, `1` = blocked (critical and not human-approved),
  `2` = tool error. Treat any other code as an installation defect.
- Keys prefixed with `_` (`_metrics`, `_performance`, ...) are private telemetry
  of the current release — do not depend on them.
- `meta.suggested_action` (`auto_merge | block_pr | manual_review`) is advisory
  only. `blocked` is a suggestion, never an automatic merge gate:
  **keep a human in the loop.**

Validate the report against the official schema:

```bash
python - <<'EOF'
import json, jsonschema, pathlib

raw = json.loads(subprocess.check_output(["diffsense", "replay", "change.diff", "--format", "json"]))
schema = json.loads(pathlib.Path("diffsense/schemas/audit-report.schema.json").read_text())
jsonschema.validate(raw, schema)
EOF
```

## 2. SARIF 2.1.0

```bash
diffsense audit --format sarif --report-json path/to/out.sarif
```

Mapping contract (authoritative in [CLI Contract](cli-contract.md) §SARIF):

- One finding → one `result`; `ruleId = "diffsense/<rule_id>"`.
- severity → level: `high`→`error`, `medium`→`warning`, `low`→`note`.
- An extra rule `diffsense/review_level` is always included; its `properties`
  carry `review_level`, `confidence`, and `blocked` — the file's overall verdict.
- GitHub code scanning accepts SARIF ≥ 2.1.0; upload via the
  `github/codeql-action/upload-sarif` action or the Code Scanning API.

## 3. MCP (Model Context Protocol)

The MCP server is a **read-only thin shell** over the existing DiffSense
capabilities. It never writes files, never mutates the repo, and never collects
feedback.

### Install & run

```bash
pip install "diffsense[mcp]"
diffsense-mcp              # listens on stdio
```

### Tools (exactly 4)

| Tool | Arguments | Returns |
|------|-----------|---------|
| `audit_diff` | `diff` (str, unified diff text); optional `rules`, `profile` | JSON report (schema_version / review_level / details / ...) |
| `audit_replay` | `diff_path` (local .diff file); optional `rules`, `profile` | JSON report for an offline replay |
| `list_rules` | optional `rules`, `profile` | JSON array: id, severity, impact, status, is_blocking, rule_type |
| `explain_rule` | `rule_id` (e.g. `runtime.concurrency.lock_removed`); optional `rules`, `profile` | JSON rule detail + rationale |

- `rules`: optional path to rules (single YAML file or directory); empty = built-in defaults.
- `profile`: optional filter (`strict` / `lightweight`); empty = default.
- Any error is returned as a JSON object with `review_level: "error"` — the
  server never crashes.

### Minimal client sketch (stdio, JSON-RPC)

```python
import json, queue, subprocess, threading

proc = subprocess.Popen(
    ["diffsense-mcp"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
    text=True, encoding="utf-8", bufsize=1,
)
q = queue.Queue()
threading.Thread(target=lambda: [q.put(l) for l in proc.stdout], daemon=True).start()

def rpc(rid, method, params):
    proc.stdin.write(json.dumps({"jsonrpc": "2.0", "id": rid, "method": method, "params": params}) + "\n")
    proc.stdin.flush()
    return json.loads(q.get(timeout=10))

rpc(1, "initialize", {"protocolVersion": "2024-11-05", "capabilities": {},
                      "clientInfo": {"name": "example", "version": "0"}})
proc.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}) + "\n")
proc.stdin.flush()
print(rpc(2, "tools/list", {}))   # -> 4 tools
```

Note: `initialize` returns a response; `notifications/initialized` is a
notification and MUST NOT be waited on.

## Red Lines (applies to every integration)

- DiffSense analyzes only the provided diff — no full-codebase scans, no style checks.
- `blocked` / `suggested_action` are advisory; **human-in-the-loop is preserved**.
- MCP tools are strictly read-only; there is deliberately no write/follow-up tool
  (see `record_feedback` evaluation in the repository `AGENTS.md`).
- Treat `schema_version` and `cli-contract.md` as the single source of truth for
  the JSON surface; treat SARIF mapping and `diffsense/sarif.py` as the source of
  truth for SARIF.