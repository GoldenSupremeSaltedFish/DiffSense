#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 pro-rules/java/*.yaml 中的规则 ID 规范为 prorule.java.<severity>.<ghsa_id>。
原格式: prorule.ghsa-2c3p-9j5f-33g3_java
新格式: prorule.java.high.ghsa_2c3p_9j5f_33g3
"""
import os
import re
import yaml
from pathlib import Path

PRO_RULES_JAVA = Path(__file__).resolve().parent.parent / "pro-rules" / "java"
ID_OLD_PATTERN = re.compile(r"^prorule\.(ghsa-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4})_java$", re.I)


def normalize_id(ghsa_part: str, severity: str) -> str:
    """ghsa-2c3p-9j5f-33g3 -> ghsa_2c3p_9j5f_33g3; severity 如 high/low/critical."""
    slug = ghsa_part.replace("-", "_").lower()
    return f"prorule.java.{severity}.{slug}"


def process_file(path: Path, dry_run: bool = True) -> bool:
    try:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        data = yaml.safe_load(text)
    except Exception as e:
        print(f"[SKIP] {path.name}: load error - {e}")
        return False
    if not data or not isinstance(data, dict):
        return False
    old_id = (data.get("id") or "").strip()
    severity = (data.get("severity") or "high").lower()
    m = ID_OLD_PATTERN.match(old_id)
    if not m:
        if old_id.startswith("prorule.java."):
            return False
        print(f"[SKIP] {path.name}: id not in old format: {old_id!r}")
        return False
    ghsa_part = m.group(1)
    new_id = normalize_id(ghsa_part, severity)
    if new_id == old_id:
        return False
    if dry_run:
        print(f"[DRY-RUN] {path.name}: {old_id} -> {new_id}")
        return True
    # 只替换 id 行，保留文件其余内容和格式
    new_text = re.sub(
        r"^(\s*id\s*:\s*)" + re.escape(old_id) + r"(\s*)$",
        r"\g<1>" + new_id + r"\2",
        text,
        count=1,
        flags=re.MULTILINE,
    )
    if new_text == text:
        new_text = re.sub(
            r"^(\s*id\s*:\s*)" + re.escape(old_id) + r"(\s*)$",
            r"\g<1>" + new_id + r"\2",
            text,
            count=1,
            flags=re.MULTILINE | re.IGNORECASE,
        )
    if new_text != text:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_text)
        print(f"[OK] {path.name}: {old_id} -> {new_id}")
        return True
    return False


def main():
    import argparse
    p = argparse.ArgumentParser(description="Normalize Java CVE rule IDs to prorule.java.<severity>.<ghsa_id>")
    p.add_argument("--write", action="store_true", help="Actually write files (default: dry-run)")
    p.add_argument("--dir", type=Path, default=PRO_RULES_JAVA, help="pro-rules/java directory")
    args = p.parse_args()
    if not args.dir.is_dir():
        print(f"Not a directory: {args.dir}")
        return 2
    dry_run = not args.write
    if dry_run:
        print("DRY-RUN (use --write to apply changes)\n")
    n = 0
    for f in sorted(args.dir.glob("*.yaml")):
        if process_file(f, dry_run=dry_run):
            n += 1
    print(f"\nTotal touched: {n} files")
    return 0


if __name__ == "__main__":
    exit(main())
