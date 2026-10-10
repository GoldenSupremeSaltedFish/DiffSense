# AGENTS.md — DiffSense Repository Guide for Coding Agents

This file is the normative orientation for AI coding agents (and humans) working
in this repository. Read it before making changes.

## What DiffSense Is

DiffSense is a **Change Risk Gate** for the PR/MR stage. It evaluates whether a
diff introduces regression risks without full codebase scans or style checks. It
is a deterministic verifier: given the same diff and rules, it produces the same
report.

## Repository Layout (dual-artifact)

```
DiffSense/
├── diffsense/                 # Python package: CLI, rule engine, MCP thin shell
│   ├── cli.py                 #   CLI entry (typer app: audit / replay / rules list / health / sdk)
│   ├── main.py                #   analyze_diff(...) shared pipeline (write_files switch)
│   ├── run_audit.py           #   live CI path (GitHub / GitLab, human-in-the-loop approval)
│   ├── mcp_server.py          #   MCP server (stdio, 4 read-only tools)
│   ├── constants.py           #   SCHEMA_VERSION, exit codes, policy constants
│   ├── sarif.py               #   SARIF 2.1.0 output layer
│   ├── core/ rules/ adapters/ config/ schemas/ sdk/ governance/
│   ├── schemas/audit-report.schema.json  # JSON Schema (draft 2020-12)
│   ├── docs/cli-contract.md   # NORMATIVE contract for machines
│   └── tests/                 # pytest suite + tests/goldens/ static fixtures
├── vscode-extension/          # VS Code extension (separate product line; keep untouched by default)
├── docs/superpowers/specs/    # design specs (agent surface, dual artifact)
├── technical_documentation/   # archival technical docs
└── .github/workflows/         # diffsense-image.yml / diffsense-vscode.yml / contract-check.yml
```

## Build & Test

```bash
cd diffsense
pip install -e ".[dev]"        # dev = pytest, jsonschema, mcp
python -m pytest tests/ -q     # full suite (baseline: 86 passed / 3 skipped / 1 flaky)
pip install -e ".[mcp]"        # extra for the MCP server only
diffsense-mcp                  # read-only MCP server over stdio
```

CI layout:

- `diffsense-image.yml` — image-line pipeline (test → build image → publish PyPI).
- `diffsense-vscode.yml` — VSIX build line.
- `contract-check.yml` — lightweight contract gate: installs `.[dev,mcp]`, runs
  contract/golden/SARIF/MCP tests, and smoke-tests the `diffsense-mcp` console
  script (exactly 4 tools registered).

## Normative Contracts (do not break)

1. **JSON contract** — `diffsense/docs/cli-contract.md` is authoritative.
   - Top-level object's first key MUST be `schema_version` (currently `"1.0"`).
   - Exit codes: `0` pass / `1` blocked (critical, not human-approved) / `2` tool error.
   - Keys prefixed `_` (`_metrics`, `_performance`, ...) are private telemetry:
     MUST NOT be relied on and MUST NOT be projected to SARIF.
2. **SARIF** — `diffsense audit --format sarif` emits SARIF 2.1.0.
   - `ruleId` prefix `diffsense/`; severity → level: high→error, medium→warning, low→note.
   - Always includes rule `diffsense/review_level` carrying review_level/confidence/blocked.
3. **MCP** — `diffsense/mcp_server.py` exposes exactly 4 read-only tools:
   `audit_diff`, `audit_replay`, `list_rules`, `explain_rule`.
   - Thin shell only: translate args, reuse existing APIs, never duplicate logic.
   - Strictly read-only. No disk writes, no repo mutation, no feedback collection.
   - Errors are returned as JSON (`review_level: "error"`); the server never crashes.
   - `record_feedback` is deliberately deferred (see "record_feedback" below).

## Hard Red Lines

- Only diff-regression risk; never full-codebase scanning or style checks.
- Human-in-the-loop MUST be preserved: `blocked` is advisory input, never an
  automatic merge gate.
- MCP is strictly read-only.
- Do not change rule engine semantics or existing CLI parameter/output semantics
  (additive changes only).
- `vscode-extension/` must remain untouched unless the task explicitly targets it.
- Do not touch the dual-product pipelines (`diffsense-image.yml`,
  `diffsense-vscode.yml`) unless the task explicitly requires it.
- Version bumps: `pyproject.toml` and `banner.py` fallback version MUST stay in
  sync. `schema_version` is independent of the package version.

## record_feedback (deferred by design)

`record_feedback` (a write-type MCP tool) was evaluated in the docs batch and is
**intentionally not implemented**: it conflicts with the "MCP strictly read-only"
red line and has no defined storage/authorization protocol yet. When it is
reconsidered, it must ship with a storage contract, an opt-in authorization
model, and its own tests — as a new batch, not as an afterthought.

## Testing Discipline

- Golden fixtures live in `diffsense/tests/goldens/` (JSON contract samples,
  invalid samples, SARIF samples) and are validated by `test_goldens_contract.py`.
- If a test run regenerates report artifacts in the worktree (e.g.
  `diffsense-report.json`, `diffsense-comments.json`), restore them with
  `git checkout -- <file>` or the delete tool before committing. Commit with
  explicit paths — never `git add -A`.
- One phase, one PR, straight from `main`; notify the user after each phase.

## Development Workflow

```bash
git checkout -b <feat/...>
# make changes, run tests
git add <explicit paths>
git commit -m "type(scope): summary"
git push origin <branch>
# open PR via GitHub web (no gh CLI / no GH_TOKEN in this environment)
```