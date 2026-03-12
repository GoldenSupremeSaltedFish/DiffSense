#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 GitHub Advisory Database 拉取近一年的 npm/JS CVE，转换为 DiffSense pro-rules 单条规则并写入 pro-rules/cve/JavaScript。
数据源：clone https://github.com/github/advisory-database（或指定本地路径）。
用法:
  python scripts/fetch_js_cve_from_advisory_db.py [--advisory-db PATH] [--output-dir PATH] [--months 12]
"""
import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

# 项目根（DiffSense）
REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ADVISORY_DB = REPO_ROOT / "advisory-database"
DEFAULT_OUTPUT = REPO_ROOT / "pro-rules" / "cve" / "JavaScript"


def _ensure_advisory_db(path: Path, clone_url: str = "https://github.com/github/advisory-database.git") -> Path:
    if path.is_dir() and (path / "advisories").is_dir():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["git", "clone", "--depth", "1", clone_url, str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return path


def _severity_to_lower(severity: str) -> str:
    if not severity:
        return "high"
    s = (severity or "").strip().lower()
    if s in ("critical", "high", "medium", "low"):
        return s
    return "high"


def _slug_ghsa(ghsa_id: str) -> str:
    return ghsa_id.strip().replace("-", "_").lower()


def _npm_patterns(package_name: str) -> list:
    """生成用于匹配 npm 包名的 patterns（require/import/package.json）。"""
    name = (package_name or "").strip()
    if not name:
        return ["*"]
    esc = re.escape(name)
    return [
        f'require("{name}")',
        f"require('{name}')",
        f'from "{name}"',
        f"from '{name}'",
        f'"dependencies": {{',
        f'"{name}":',
        f'"devDependencies": {{',
        f'"resolutions": {{',
    ]


def ghsa_to_prorule(ghsa: dict, out_dir: Path) -> bool:
    """
    将一条 GHSA JSON 转为单条 PROrule YAML 并写入 out_dir。
    仅处理 ecosystem=npm；返回是否已写入。
    """
    ghsa_id = ghsa.get("id") or ""
    if not ghsa_id.startswith("GHSA-"):
        return False
    affected = ghsa.get("affected") or []
    npm_packages = []
    for a in affected:
        pkg = a.get("package") or {}
        if (pkg.get("ecosystem") or "").lower() == "npm":
            npm_packages.append(pkg.get("name") or "")
    if not npm_packages:
        return False

    summary = (ghsa.get("summary") or ghsa.get("details") or "")[:500]
    db = ghsa.get("database_specific") or {}
    severity = _severity_to_lower(db.get("severity"))
    aliases = ghsa.get("aliases") or []
    refs = ghsa.get("references") or []
    ref_urls = [r.get("url") for r in refs if r.get("url")]
    cwe_ids = db.get("cwe_ids") or []

    # 一条 GHSA 可能影响多个包，这里按第一个 npm 包生成一条规则（可后续改为多文件）
    pkg_name = npm_packages[0]
    rule_id = f"prorule.javascript.{severity}.{_slug_ghsa(ghsa_id)}"

    data = {
        "id": rule_id,
        "description": summary,
        "severity": severity,
        "language": "javascript",
        "category": "security",
        "tags": ["cve", "vulnerability", "javascript", "npm", ghsa_id.lower()],
        "references": ref_urls[:10],
        "aliases": aliases,
        "package": {
            "ecosystem": "npm",
            "name": pkg_name,
        },
        "patterns": _npm_patterns(pkg_name),
        "cwe": cwe_ids[:5],
    }
    # 可选：versions from affected[].versions
    vers = affected[0].get("versions") if affected else []
    if vers:
        data["versions"] = {"introduced": vers[:3]}

    filename = f"{ghsa_id.lower().replace('-', '_')}_javascript.yaml"
    filepath = out_dir / filename
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    return True


def collect_npm_ghsa_last_year(advisory_db: Path, months: int = 12) -> list:
    """遍历 advisory-database 中 github-reviewed 下所有 JSON，筛选 ecosystem=npm 且 published 在近 months 月内。"""
    reviewed = advisory_db / "advisories" / "github-reviewed"
    if not reviewed.is_dir():
        return []
    cutoff = datetime.now(timezone.utc) - timedelta(days=months * 31)
    results = []
    for json_path in reviewed.rglob("*.json"):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        affected = data.get("affected") or []
        has_npm = any((a.get("package") or {}).get("ecosystem") == "npm" for a in affected)
        if not has_npm:
            continue
        published = data.get("published") or ""
        try:
            dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            dt = cutoff
        if dt < cutoff:
            continue
        results.append(data)
    return results


def main():
    parser = argparse.ArgumentParser(description="Fetch npm JS CVEs from advisory-database and write pro-rules")
    parser.add_argument("--advisory-db", type=Path, default=DEFAULT_ADVISORY_DB, help="Path to advisory-database repo (clone if missing)")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT, help="Output directory for YAML rules")
    parser.add_argument("--months", type=int, default=12, help="Include advisories published in the last N months")
    parser.add_argument("--no-clone", action="store_true", help="Do not clone; fail if advisory-db missing")
    args = parser.parse_args()

    if yaml is None:
        print("PyYAML required: pip install pyyaml", file=sys.stderr)
        return 2

    advisory_db = args.advisory_db.resolve()
    if not args.no_clone and (not advisory_db.is_dir() or not (advisory_db / "advisories").is_dir()):
        print("Cloning advisory-database (shallow)...")
        _ensure_advisory_db(advisory_db)
    if not (advisory_db / "advisories" / "github-reviewed").is_dir():
        print("advisories/github-reviewed not found", file=sys.stderr)
        return 1

    out_dir = args.output_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Scanning for npm advisories in the last", args.months, "months...")
    items = collect_npm_ghsa_last_year(advisory_db, args.months)
    print(f"Found {len(items)} npm GHSA(s). Converting to PROrules...")

    written = 0
    for ghsa in items:
        if ghsa_to_prorule(ghsa, out_dir):
            written += 1
    print(f"Wrote {written} rule(s) to {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
