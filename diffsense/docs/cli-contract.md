# DiffSense CLI Contract

Version: 1.0 · Applies to CLI surface of `diffsense audit` / `diffsense replay` (and the underlying `main.py` / `run_audit.py` entry points).

This document is the normative contract for machine consumers (agents, CI gates, MCP clients). The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## 1. Scope

This contract governs:

- `diffsense audit` — live PR/MR audit against a remote platform (GitHub / GitLab).
- `diffsense replay` — deterministic local audit from a diff file.

Both commands emit a JSON report (stdout and/or `--report-json`) whose top-level object MUST conform to `diffsense/schemas/audit-report.schema.json` (JSON Schema draft 2020-12).

The following are explicitly **out of scope** and MUST NOT be relied upon by consumers as stable:

- All keys prefixed with a single underscore (`_metrics`, `_rule_quality`, `_quality_warnings`, `_performance`, ...). They are private telemetry of the current release and MAY change or disappear at any time.
- Any human-facing rendering (Markdown / HTML / banner output).

## 2. Exit Codes

`audit` and `replay` MUST exit with one of exactly three codes:

| Code | Meaning | Typical conditions |
|------|---------|--------------------|
| `0` | Pass — no blocked findings | Empty diff; `review_level` is `normal` or `low`; or `critical` findings that a human explicitly approved / acknowledged (`run_audit` only). |
| `1` | Risk — findings reached the blocking threshold and were not human-approved | Composed `review_level` is `critical`; the report comment carries no approval (`approve` mark) and no `👍` reaction. |
| `2` | Tool error — the audit did not complete | Bad arguments (missing `--repo`/`--pr`/`--project-id`/`--mr-iid`, unknown `--platform`); diff fetch failure; local diff file not found; any unexpected internal exception. |

Constraints:

- Consumers MUST treat any other exit code as a tool/installation defect and SHOULD fail the pipeline.
- `run_audit` — the live CI path — keeps its human-in-the-loop semantics: a `critical` report with human approval resolves to `0`, without weakening the report itself.
- Exit code `1` MUST NOT be used as a generic failure signal; use `2` for any "could not complete" scenario.

## 3. JSON Report

### 3.1 Top-level object

The report is a single JSON object printed once. The first key MUST be `schema_version`.

| Field | Type | Presence | Semantics |
|-------|------|----------|-----------|
| `schema_version` | string | MUST | Version of this contract, currently `"1.0"`. Consumers MUST validate this field first and MUST NOT parse a report whose version they do not support. |
| `review_level` | string | MUST | One of `normal`, `low`, `critical`; `error` on tool-error reports. Only `critical` reaches the blocking threshold. |
| `reasons` | array[string] | optional | Decision reasons, human-readable. |
| `files` | array[string] | optional | Files in the diff. |
| `impacts` | object | optional | Impact summary, category/file keyed. |
| `details` | array[object] | optional | Per-finding entries. Each entry SHOULD carry at least `rule` (rule id), `severity`, and a `message`. Shape is open for forward compatibility. |
| `meta` | object | optional | `confidence` (number 0–1) and `suggested_action` (`auto_merge` / `block_pr` / `manual_review`). Advisory only. |
| `error` | string | optional | Present only when `review_level` is `error`; the human-readable failure detail. |

### 3.2 Forward compatibility

- `additionalProperties` is intentionally permissive in the JSON Schema. Consumers MUST accept unknown top-level keys and unknown keys inside open objects.
- Additive changes (new optional fields) MUST NOT bump `schema_version`.
- Breaking changes (removal, renaming, semantic change of a documented field) MUST bump `schema_version` and MUST be announced in the changelog before a release.
- `schema_version` is the **only** stable version signal for the report; the package version is unrelated.

### 3.3 Reading the report

- Consumers SHOULD read the report from `--report-json` when available instead of re-parsing stdout, and MUST treat the two as equivalent when both are produced.
- On tool error, a report MAY still be emitted (with `review_level: "error"` and `error` detail); in that case the process MUST exit `2`.

## 4. Invocation Notes

- `diffsense replay <diff-file> [--report-json <path>]` and the underlying `main.py` accept a local unified diff file path as the positional argument. A nonexistent file is a tool error (`2`).
- `diffsense audit --platform github|gitlab ...` requires the platform-specific identity arguments (repo/pr or project-id/mr-iid, and a token). Missing them is a tool error (`2`).
- Rules loading, baseline reading and quality-metrics files remain internal behavior; their absence MUST be handled as non-fatal warnings where today's CLI already tolerates them.

## 5. SARIF Output

`diffsense audit --format sarif` (and `diffsense replay --format sarif`, `main.py --format sarif`) MUST emit a single SARIF 2.1.0 log object on stdout.

- The log object MUST set `version` to `"2.1.0"` and SHOULD set `$schema` to `https://json.schemastore.org/sarif-2.1.0.json`.
- The log contains exactly one run. `run.tool.driver` carries `name: "DiffSense"` and a `rules` array whose `shortDescription.text` mirrors the finding message.
- Every finding in the JSON report `details` becomes one result:
  - `ruleId` MUST be `diffsense/<rule_id>` (prefixed with a literal `diffsense/`).
  - `level` MUST map from severity as: `critical`/`high` → `error`; `medium` → `warning`; `low` → `note`. Unrecognized severities MUST resolve to `note`.
  - `message.text` carries the finding rationale (or the rule id when absent).
  - `locations[].physicalLocation.artifactLocation.uri` carries the affected file when known; the entry MAY omit `locations` otherwise.
  - `properties` retains `ruleId`, `severity`, `impact`, `precision` for the agent.
- In addition, the run MUST include one result with `ruleId` `diffsense/review_level` representing the overall verdict:
  - `level` is `error` when the composed `review_level` is `critical`, `warning` for `elevated`, and `note` for `normal`/`low`.
  - `properties.review_level` holds the composed level; `properties.blocked` is `true` only when `review_level` is `critical` (the same condition as exit code `1`); `properties.confidence` mirrors `meta.confidence` when present.
- SARIF output MUST NOT change exit codes: the same `0`/`1`/`2` semantics from §2 apply regardless of the chosen format.
- Private telemetry keys (`_metrics`, `_rule_quality`, `_quality_warnings`, ...) MUST NOT be projected into SARIF; SARIF carries only the stable public surface described above.

## 6. MCP Server

DiffSense ships a read-only MCP server over stdio, installed via the `mcp` extra
(`pip install "diffsense[mcp]"`) and started with the `diffsense-mcp` entry point.
The server is built on the official MCP SDK and exposes the same audit engine as
the CLI (§1–§5) — it MUST NOT re-implement analysis logic.

### 6.1 Tools

`tools/list` MUST expose exactly these four tools (all read-only):

| Tool | Description | Output |
|------|-------------|--------|
| `audit_diff` | Runs the audit pipeline on an inline diff string | JSON report as in §3 |
| `audit_replay` | Runs the audit pipeline on a local unified diff file path | JSON report as in §3 |
| `list_rules` | Lists loaded rule metadata (built-in + YAML + pro) | JSON array of `{id, severity, impact, status, is_blocking, rule_type}` |
| `explain_rule` | Describes a single rule by `rule_id` | JSON object with the rule's metadata and `rationale`, or `{"error": ...}` |

Rules / profile arguments are optional on every tool; an empty value selects the
built-in defaults, mirroring CLI defaults. Absent or invalid paths are returned
as JSON errors — the server MUST NOT crash on bad input.

### 6.2 Contract guarantees

- The server is strictly read-only: it never writes report artifacts, baseline
  files, quality caches, or any repository state. (CLI-side file outputs are
  deliberately disabled on the MCP path.)
- `audit_diff` / `audit_replay` output MUST satisfy §3: a single JSON object whose
  first key is `schema_version`, with `review_level` (`normal` / `low` /
  `critical` / `error`) and optional `error` detail on failures.
- Exit codes from §2 do not apply to MCP tool calls; the composed
  `review_level` is returned in-band inside the report JSON instead.
- The MCP server communicates over stdio using newline-delimited JSON-RPC
  (official MCP SDK transport). All audit reports MUST be returned as tool
  result text; the server MUST NOT print the report or any logs to stdout.
- Feedback capture (`record_feedback`) is intentionally absent in this release;
  it will follow in a later agent-surface batch and MUST NOT be added ad hoc.