#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 CVEProject/cvelistV5 拉取近一年的 C++ 相关 CVE，转换为 DiffSense pro-rules 并写入 pro-rules/cve/cpp。

数据源：clone https://github.com/CVEProject/cvelistV5（或指定本地路径）。
CVE 记录为 CVE JSON 5.0 格式；按发布日期筛选近 N 个月，并按描述/产品名筛选 C++ 相关。

用法:
  python scripts/fetch_cpp_cve_from_cvelist.py [--cvelist PATH] [--output-dir PATH] [--months 12]
  python scripts/fetch_cpp_cve_from_cvelist.py --no-clone   # 使用已有 clone，不自动拉取
"""
import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

try:
    import yaml
except ImportError:
    yaml = None

# 项目根（DiffSense）
REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CVELIST = REPO_ROOT / "cvelistV5"
DEFAULT_OUTPUT = REPO_ROOT / "pro-rules" / "cve" / "cpp"


def _ensure_cvelist(path: Path, clone_url: str = "https://github.com/CVEProject/cvelistV5.git") -> Path:
    """若 path 下无 CVE 目录则 clone cvelistV5（浅克隆以节省时间）。"""
    if path.is_dir() and (path / "CVE").is_dir():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    import subprocess
    subprocess.run(
        ["git", "clone", "--depth", "1", clone_url, str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return path


def _parse_cve5_date(date_str: str) -> Optional[datetime]:
    """解析 CVE JSON 5 中的日期字符串为 datetime (UTC)。"""
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _collect_cpp_cves_last_year(cvelist_root: Path, months: int = 12):
    """
    遍历 cvelistV5/CVE 下所有 *.json，筛选：
    - 发布日期在近 months 月内
    - 描述或受影响产品与 C++ 相关（is_cpp_related_cve）
    返回 (cve5_dict, flat_dict) 列表，flat 用于写入规则。
    """
    sys.path.insert(0, str(REPO_ROOT))
    from diffsense.converters.cpp_cve_converter import (
        parse_cve_json5_to_flat,
        is_cpp_related_cve,
    )

    cve_dir = cvelist_root / "CVE"
    if not cve_dir.is_dir():
        return []
    cutoff = datetime.now(timezone.utc) - timedelta(days=months * 31)
    results = []
    for json_path in cve_dir.rglob("*.json"):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        flat = parse_cve_json5_to_flat(data)
        if not flat or not flat.get("description"):
            continue
        date_pub = _parse_cve5_date(flat.get("published_date") or "")
        if date_pub is None or date_pub < cutoff:
            continue
        if not is_cpp_related_cve(
            flat.get("description") or "",
            flat.get("affected_products"),
        ):
            continue
        results.append((data, flat))
    return results


def main():
    parser = argparse.ArgumentParser(
        description="Fetch C++ CVEs from cvelistV5 (last N months) and write pro-rules/cve/cpp"
    )
    parser.add_argument(
        "--cvelist",
        type=Path,
        default=DEFAULT_CVELIST,
        help="Path to cvelistV5 repo (clone if missing)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output directory for YAML rules (default: pro-rules/cve/cpp)",
    )
    parser.add_argument(
        "--months",
        type=int,
        default=12,
        help="Include CVEs published in the last N months (default: 12)",
    )
    parser.add_argument(
        "--no-clone",
        action="store_true",
        help="Do not clone; fail if cvelist path missing or empty",
    )
    args = parser.parse_args()

    if yaml is None:
        print("PyYAML required: pip install pyyaml", file=sys.stderr)
        return 2

    cvelist = args.cvelist.resolve()
    if not args.no_clone and (not cvelist.is_dir() or not (cvelist / "CVE").is_dir()):
        print("Cloning cvelistV5 (shallow)...")
        _ensure_cvelist(cvelist)
    if not (cvelist / "CVE").is_dir():
        print("CVE directory not found under cvelist path", file=sys.stderr)
        return 1

    out_dir = args.output_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Scanning for C++ related CVEs in the last", args.months, "months...")
    items = _collect_cpp_cves_last_year(cvelist, args.months)
    print(f"Found {len(items)} C++ related CVE(s). Converting to PROrules...")

    from diffsense.converters.cpp_cve_converter import CPPCVEConverter
    converter = CPPCVEConverter()
    pro_rules = []
    for cve5, flat in items:
        rule = converter.convert_cve_to_prorule(flat)
        if rule:
            pro_rules.append(rule)
    converter.save_rules_to_yaml(pro_rules, str(out_dir))
    print(f"Wrote {len(pro_rules)} rule(s) to {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
