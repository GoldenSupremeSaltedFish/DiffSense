# Changelog

Notable changes and breaking changes per release. The upgrade guide for
2.2.x users lives in the "Migrating from 2.2.x to 2.3.x" section below
(#106).

## 2.3.x (current line)

### Breaking changes

- **Config file format (#107)**: the pre-2.2 `diffsense.config.json` /
  `.diffsense.config.json` files are no longer read. Migrate settings to
  `.diffsense.yaml`; a warning is emitted when a legacy file is detected.
- **Deprecated config keys (#93)**: `ci_fail_level`, `cache` and
  `scheduler` in `.diffsense.yaml` are no longer consumed anywhere. They
  emit a warning and are ignored — remove them from your config.
- **Exit codes (#68)**: the CLI now uses three codes — `0` = pass,
  `1` = blocked (a `critical` review level was reported and not
  human-approved), `2` = tool error (bad input / unreadable file).
  CI scripts written for 2.2.x's two-code contract must treat `2` as an
  installation defect, not as "blocked".
- **Report `schema_version` bump (#104)**: JSON reports now declare
  `"1.1"` (renamed `review_level` enum). Consumers that pin `1.0` must
  accept `1.1`.
- **`review_level` enum (#104/#84)**: values are now
  `normal | low | elevated | critical | error`. The 2.2.x `elevated`
  level is reported as `elevated` again (not folded into `critical`),
  and `low` was added below `normal`.
- **`--rules` default expansion (#108)**: 2.2.x defaulted to the single
  file `rules/default.json` (36 rules). Since 2.3.0 the default loads
  the whole `config/rules` directory — **178 rules** in the current
  release. Upgraded pipelines may see new findings on previously passing
  code. To keep the old behavior, pass the old single file explicitly:
  `diffsense replay ... --rules rules/default.json`.
- **`--version` (#74)**: `diffsense --version` now prints the package
  version instead of the usage text.

### Added

- SARIF 2.1.0 output now includes `tool.driver.version` (#130),
  per-rule `fullDescription`, `helpUri` and `defaultLevel` (#138),
  `region` on results, and a complete severity→level mapping
  (`critical|high`→`error`, `medium|warning|elevated`→`warning`,
  `low|info`→`note`, fallback `note`) (#84).
- MCP stdio server: malformed JSON-RPC lines now get a JSON-RPC 2.0
  parse error response (`-32700`, `id=null`) instead of being dropped
  silently (#128); startup/diagnostics banner on stderr (#83).
- MCP server no longer advertises empty `resources`/`prompts`
  capabilities (#129).
- Language rule sets: new `java.*` security rules (JNDI injection,
  native deserialization, SpEL injection, SQL/command injection, SSRF,
  hardcoded secrets) (#88); `typescript.security.code_injection` and
  `go.security.weak_crypto` close cross-language coverage gaps (#92).
- Rule ID conflicts (a YAML rule shadowing a built-in) now emit a
  warning instead of silently overwriting (#122).
- Config validation (#94/#95): booleans are coerced strictly, unknown
  `profile` names warn instead of failing deep inside the engine, and
  non-numeric thresholds are rejected with a warning.

## 2.2.x

Legacy line: `--rules` defaulted to a single `rules/default.json` file
with 36 rules; exit codes were `0`/`1`; config was read from
`diffsense.config.json`; JSON reports declared `schema_version: "1.0"`.
