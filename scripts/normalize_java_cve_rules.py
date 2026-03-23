#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Normalize Java CVE YAML rules into a unified schema.

Target schema (single-rule):
  id, description, severity, language, category, tags, references, aliases,
  package{ecosystem,name,group_id,artifact_id}, versions{introduced,fixed},
  patterns, cwe
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml


def _safe_list_str(v: Any) -> List[str]:
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if v is None:
        return []
    s = str(v).strip()
    return [s] if s else []


def _sanitize_broken_description(text: str) -> str:
    """
    Repair common YAML breakage:
    description: "aaa "bbb" ccc"
    """
    out: List[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("description:") and '"' in line:
            m = re.match(r'^(\s*description:\s*)"(.+)"\s*$', line)
            if m:
                raw = m.group(2)
                # Convert to single-quoted scalar and escape single quote per YAML.
                raw = raw.replace("'", "''")
                line = f"{m.group(1)}'{raw}'"
        out.append(line)
    return "\n".join(out) + ("\n" if text.endswith("\n") else "")


def _load_yaml_with_repair(path: Path) -> Tuple[Optional[Dict[str, Any]], Optional[str], bool]:
    """
    returns: (data, error, repaired)
    """
    txt = path.read_text(encoding="utf-8")
    try:
        data = yaml.safe_load(txt)
        return data if isinstance(data, dict) else None, None if isinstance(data, dict) else "top-level is not dict", False
    except Exception:
        repaired_txt = _sanitize_broken_description(txt)
        try:
            data = yaml.safe_load(repaired_txt)
            if isinstance(data, dict):
                return data, None, True
            return None, "top-level is not dict after repair", True
        except Exception as exc:
            return None, f"yaml parse failed after repair: {exc}", True


def _build_package(pkg_name: str) -> Dict[str, str]:
    pkg_name = (pkg_name or "").strip()
    if ":" in pkg_name:
        group_id, artifact_id = pkg_name.split(":", 1)
    else:
        group_id, artifact_id = "", pkg_name
    return {
        "ecosystem": "maven",
        "name": pkg_name,
        "group_id": group_id,
        "artifact_id": artifact_id,
    }


def _build_patterns(group_id: str, artifact_id: str, name: str) -> List[str]:
    g = (group_id or "").strip()
    a = (artifact_id or "").strip()
    n = (name or "").strip()
    if not n:
        return []
    return [
        f"<groupId>{g}</groupId>" if g else "",
        f"<artifactId>{a}</artifactId>" if a else "",
        f"implementation '{n}:'",
        f"compile '{n}:'",
        f"compileOnly '{n}:'",
        f"runtimeOnly '{n}:'",
        f"testImplementation '{n}:'",
    ]


def _to_standard_rule(raw: Dict[str, Any], path: Path) -> Dict[str, Any]:
    # Already standard enough
    if raw.get("id") and raw.get("package") and raw.get("versions") and raw.get("language"):
        out = dict(raw)
        out["severity"] = str(out.get("severity", "medium")).lower()
        out["language"] = str(out.get("language", "java")).lower()
        return out

    rule_id = str(raw.get("id") or raw.get("rule_name") or "").strip()
    ghsa_id = str(raw.get("ghsa_id") or raw.get("cve_id") or "").strip()
    if not rule_id:
        if ghsa_id:
            token = ghsa_id.lower().replace(" ", "-")
            rule_id = f"prorule.{token}_java"
        else:
            rule_id = f"prorule.{path.stem}_java"

    description = str(raw.get("description") or raw.get("details") or "").strip()
    severity = str(raw.get("severity") or "medium").strip().lower()
    language = str(raw.get("language") or "java").strip().lower()

    affected_pkgs = raw.get("affected_packages") or []
    pkg_name = ""
    if isinstance(affected_pkgs, list) and affected_pkgs:
        pkg_name = str(affected_pkgs[0]).strip()
    elif isinstance(raw.get("package"), dict):
        pkg_name = str(raw["package"].get("name") or "").strip()

    package = _build_package(pkg_name) if pkg_name else {"ecosystem": "maven", "name": ""}
    versions = {
        "introduced": [x for x in _safe_list_str(raw.get("affected_versions")) if x != "0"],
        "fixed": _safe_list_str(raw.get("fixed_versions")),
    }

    refs = _safe_list_str(raw.get("references"))
    aliases: List[str] = []
    cve_id = str(raw.get("cve_id") or "").strip()
    if cve_id.startswith("CVE-"):
        aliases.append(cve_id)

    tags = ["cve", "vulnerability", "java", "maven"]
    if ghsa_id:
        tags.append(ghsa_id.lower())

    group_id = package.get("group_id", "")
    artifact_id = package.get("artifact_id", "")
    patterns = _build_patterns(group_id, artifact_id, package.get("name", ""))

    cwe = _safe_list_str(raw.get("cwe_ids") or raw.get("cwe"))

    out: Dict[str, Any] = {
        "id": rule_id,
        "description": description,
        "severity": severity if severity in {"critical", "high", "medium", "low"} else "medium",
        "language": language,
        "category": "security",
        "tags": tags,
        "references": refs,
        "aliases": aliases,
        "package": package,
        "versions": versions,
        "patterns": [p for p in patterns if p],
        "cwe": cwe,
    }

    return out


def normalize(root: Path, dry_run: bool = False) -> Tuple[int, int, int]:
    files = sorted(root.rglob("*.yaml"))
    total = len(files)
    changed = 0
    failed = 0

    for i, f in enumerate(files, 1):
        try:
            data, err, repaired = _load_yaml_with_repair(f)
            if err or not isinstance(data, dict):
                failed += 1
                continue

            std = _to_standard_rule(data, f)
            new_text = yaml.safe_dump(std, allow_unicode=True, sort_keys=False)
            old_text = f.read_text(encoding="utf-8")
            if repaired or new_text != old_text:
                changed += 1
                if not dry_run:
                    f.write_text(new_text, encoding="utf-8")
        except Exception:
            failed += 1
        if i % 2000 == 0:
            print(f"[INFO] processed {i}/{total}")

    return total, changed, failed


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize Java CVE YAML rules")
    parser.add_argument("--path", default="pro-rules/cve/java", help="target directory")
    parser.add_argument("--dry-run", action="store_true", help="do not write files")
    args = parser.parse_args()

    root = Path(args.path)
    if not root.exists() or not root.is_dir():
        print(f"[ERROR] invalid path: {root}")
        return 2

    total, changed, failed = normalize(root, dry_run=args.dry_run)
    print("=" * 80)
    print("Java CVE normalize summary")
    print("=" * 80)
    print(f"Total files : {total}")
    print(f"Changed     : {changed}")
    print(f"Failed      : {failed}")
    print(f"Mode        : {'DRY RUN' if args.dry_run else 'APPLY'}")
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
