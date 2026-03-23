#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validate CVE rule consistency to reduce cross-language false positives.

Checks:
1) Required fields: id, language, severity
2) language <-> package.ecosystem consistency
3) versions format consistency (introduced/fixed list[str])
4) patterns quality (too-generic / missing package hints)
5) legacy schema detection (rule_name + affected_versions...)

Usage:
  python scripts/validate_cve_rule_consistency.py --path pro-rules/cve/java
  python scripts/validate_cve_rule_consistency.py --path pro-rules/cve --max-files 2000 --strict-exit
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml


ALLOWED_SEVERITIES = {"critical", "high", "medium", "low"}

# language -> valid ecosystems
LANG_ECOSYSTEM_MAP = {
    "java": {"maven", "gradle"},
    "javascript": {"npm", "yarn", "pnpm"},
    "typescript": {"npm", "yarn", "pnpm"},
    "go": {"go", "golang"},
    "python": {"pypi", "pip"},
    "cpp": {"conan", "vcpkg", "cmake"},
    "c": {"conan", "vcpkg", "cmake"},
    "csharp": {"nuget"},
    "dotnet": {"nuget"},
    "ruby": {"rubygems"},
    "rust": {"cargo"},
    "php": {"composer"},
}

# Very loose language hints for pattern-level sanity checks.
LANG_PATTERN_HINTS = {
    "java": ("<groupId>", "<artifactId>", "implementation '", "compile '", "import "),
    "javascript": ("require(", "import ", "package.json", "npm", "yarn"),
    "go": ("go.mod", "module ", "require ", "import "),
    "python": ("requirements.txt", "pyproject.toml", "import ", "from "),
}

GENERIC_PATTERN_BAD_SUBSTRINGS = (
    "import ",
    "<dependency>",
    "implementation '",
    "compile '",
)


@dataclass
class Finding:
    level: str  # ERROR | WARN
    file: str
    message: str


def _is_list_of_str(value: object) -> bool:
    return isinstance(value, list) and all(isinstance(x, str) for x in value)


def _load_yaml(path: Path) -> Tuple[Optional[dict], Optional[str]]:
    try:
        content = path.read_text(encoding="utf-8")
        data = yaml.safe_load(content)
    except Exception as exc:
        return None, f"YAML parse failed: {exc}"
    if not isinstance(data, dict):
        return None, "Top-level YAML must be an object/dict"
    return data, None


def _is_legacy_schema(rule: dict) -> bool:
    # legacy examples observed in this repo
    return "rule_name" in rule and ("affected_versions" in rule or "fixed_versions" in rule)


def _validate_required_fields(rule: dict, path: Path) -> List[Finding]:
    findings: List[Finding] = []
    for field in ("id", "language", "severity"):
        if field not in rule or not isinstance(rule.get(field), str) or not str(rule.get(field)).strip():
            findings.append(Finding("ERROR", str(path), f"missing/invalid required field `{field}`"))
    sev = str(rule.get("severity", "")).lower()
    if sev and sev not in ALLOWED_SEVERITIES:
        findings.append(Finding("WARN", str(path), f"unknown severity `{sev}` (expected one of {sorted(ALLOWED_SEVERITIES)})"))
    return findings


def _validate_language_ecosystem(rule: dict, path: Path) -> List[Finding]:
    findings: List[Finding] = []
    language = str(rule.get("language", "")).strip().lower()
    package = rule.get("package")
    if not package:
        findings.append(Finding("WARN", str(path), "missing `package` block; may increase false positives"))
        return findings
    if not isinstance(package, dict):
        findings.append(Finding("ERROR", str(path), "`package` must be an object"))
        return findings

    ecosystem = str(package.get("ecosystem", "")).strip().lower()
    name = str(package.get("name", "")).strip()
    if not ecosystem:
        findings.append(Finding("ERROR", str(path), "missing `package.ecosystem`"))
    if not name:
        findings.append(Finding("ERROR", str(path), "missing `package.name`"))

    expected = LANG_ECOSYSTEM_MAP.get(language)
    if expected and ecosystem and ecosystem not in expected:
        findings.append(
            Finding(
                "ERROR",
                str(path),
                f"language/ecosystem mismatch: language={language}, ecosystem={ecosystem}, expected one of {sorted(expected)}",
            )
        )
    return findings


def _validate_versions(rule: dict, path: Path) -> List[Finding]:
    findings: List[Finding] = []
    versions = rule.get("versions")
    if not versions:
        findings.append(Finding("WARN", str(path), "missing `versions` block; cannot do version-range precision match"))
        return findings
    if not isinstance(versions, dict):
        findings.append(Finding("ERROR", str(path), "`versions` must be an object"))
        return findings

    introduced = versions.get("introduced", [])
    fixed = versions.get("fixed", [])
    if introduced and not _is_list_of_str(introduced):
        findings.append(Finding("ERROR", str(path), "`versions.introduced` must be list[str]"))
    if fixed and not _is_list_of_str(fixed):
        findings.append(Finding("ERROR", str(path), "`versions.fixed` must be list[str]"))
    if not introduced and not fixed:
        findings.append(Finding("WARN", str(path), "`versions` exists but both introduced/fixed are empty"))
    return findings


def _validate_patterns(rule: dict, path: Path) -> List[Finding]:
    findings: List[Finding] = []
    language = str(rule.get("language", "")).strip().lower()
    patterns = rule.get("patterns")
    if not isinstance(patterns, list) or not patterns:
        findings.append(Finding("WARN", str(path), "missing/empty `patterns`; rule may be too weak or never match"))
        return findings
    if not all(isinstance(x, str) for x in patterns):
        findings.append(Finding("ERROR", str(path), "`patterns` must be list[str]"))
        return findings

    joined = "\n".join(patterns).lower()
    hints = LANG_PATTERN_HINTS.get(language, ())
    if hints and not any(h.lower() in joined for h in hints):
        findings.append(Finding("WARN", str(path), f"patterns have weak `{language}` hints; possible cross-language noise"))

    # generic-only patterns can be noisy
    if all(any(bad in p for bad in GENERIC_PATTERN_BAD_SUBSTRINGS) for p in patterns):
        findings.append(Finding("WARN", str(path), "patterns appear generic-only; consider adding package-specific anchors"))
    return findings


def validate_rule(rule: dict, path: Path) -> List[Finding]:
    findings: List[Finding] = []
    if _is_legacy_schema(rule):
        findings.append(Finding("WARN", str(path), "legacy schema detected (`rule_name`/`affected_versions`); normalize before loading"))
    findings.extend(_validate_required_fields(rule, path))
    findings.extend(_validate_language_ecosystem(rule, path))
    findings.extend(_validate_versions(rule, path))
    findings.extend(_validate_patterns(rule, path))
    return findings


def scan(path: Path, max_files: int) -> Tuple[int, List[Finding]]:
    findings: List[Finding] = []
    files = sorted(path.rglob("*.yaml")) if path.is_dir() else [path]
    scanned = 0
    for f in files:
        if max_files > 0 and scanned >= max_files:
            break
        # skip tier readme docs accidentally named yaml none
        if not f.name.lower().endswith(".yaml"):
            continue
        data, err = _load_yaml(f)
        scanned += 1
        if err:
            findings.append(Finding("ERROR", str(f), err))
            continue
        findings.extend(validate_rule(data or {}, f))
    return scanned, findings


def print_report(scanned: int, findings: List[Finding]) -> None:
    errors = [x for x in findings if x.level == "ERROR"]
    warns = [x for x in findings if x.level == "WARN"]

    print("=" * 80)
    print("CVE Rule Consistency Report")
    print("=" * 80)
    print(f"Scanned files: {scanned}")
    print(f"Errors: {len(errors)}")
    print(f"Warnings: {len(warns)}")
    print("-" * 80)

    for row in findings[:120]:
        print(f"[{row.level}] {row.file} :: {row.message}")

    if len(findings) > 120:
        print(f"... truncated, remaining findings: {len(findings) - 120}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate CVE rule consistency")
    parser.add_argument("--path", default="pro-rules/cve/java", help="file or directory to scan")
    parser.add_argument("--max-files", type=int, default=0, help="limit scanned files (0 = all)")
    parser.add_argument("--strict-exit", action="store_true", help="return non-zero when warnings exist")
    args = parser.parse_args()

    target = Path(args.path)
    if not target.exists():
        print(f"[ERROR] Path not found: {target}")
        return 2

    scanned, findings = scan(target, args.max_files)
    print_report(scanned, findings)

    has_error = any(x.level == "ERROR" for x in findings)
    has_warn = any(x.level == "WARN" for x in findings)
    if has_error:
        return 1
    if args.strict_exit and has_warn:
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
