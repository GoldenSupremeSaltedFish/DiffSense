#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 Go 官方漏洞库拉取近一年的 Go CVE，转换为 DiffSense PROrule 并写入 pro-rules/cve/Go。

数据源（二选一）:
  1) 在线 API（默认）: 从 https://vuln.go.dev 拉取 index 与各 GO-*.json
  2) 本地目录: 使用 --from-dir 指定已 clone 或解压的数据（目录下含 GO-*.json 或 ID/GO-*.json）

用法:
  python scripts/fetch_go_cve_from_vulndb.py [--days 365] [--output-dir PATH]
  python scripts/fetch_go_cve_from_vulndb.py --from-dir /path/to/vuln-data [--days 365] [--output-dir PATH]
  python scripts/fetch_go_cve_from_vulndb.py --dry-run

集成测试（规则生成后）:
  pytest diffsense/tests/test_regression.py diffsense/tests/test_go_cve_rules.py -v
"""
import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = REPO_ROOT / "pro-rules" / "cve" / "Go"


def main():
    parser = argparse.ArgumentParser(description="Fetch Go CVE from vuln.go.dev and convert to PROrules")
    parser.add_argument("--days", type=int, default=365, help="仅处理最近 N 天的漏洞（默认 365）")
    parser.add_argument("--output-dir", type=str, default=str(DEFAULT_OUTPUT), help="输出 YAML 规则目录")
    parser.add_argument("--from-dir", type=str, default=None, help="本地 vuln 数据目录（含 GO-*.json 或 ID/GO-*.json）")
    parser.add_argument("--dry-run", action="store_true", help="只统计，不写文件")
    parser.add_argument("--limit", type=int, default=None, help="最多处理 N 条（默认 600，用于快速测试可设 10）")
    args = parser.parse_args()

    sys.path.insert(0, str(REPO_ROOT))
    from diffsense.converters.go_vuln_osv import run_fetch_and_convert, run_convert_from_local_dir

    output_dir = args.output_dir
    if args.from_dir:
        count = run_convert_from_local_dir(
            args.from_dir,
            output_dir,
            days=args.days,
            dry_run=args.dry_run,
        )
        print(f"本地目录转换: 共 {count} 条 Go CVE 规则（--dry-run={args.dry_run}）")
    else:
        count = run_fetch_and_convert(
            output_dir,
            days=args.days,
            dry_run=args.dry_run,
            limit=args.limit,
        )
        print(f"vuln.go.dev 拉取并转换: 共 {count} 条 Go CVE 规则（--dry-run={args.dry_run}）")

    if not args.dry_run and count > 0:
        print(f"输出目录: {output_dir}")
        print("建议运行集成测试: pytest diffsense/tests/test_regression.py diffsense/tests/test_go_cve_rules.py -v")
    return 0


if __name__ == "__main__":
    sys.exit(main())
