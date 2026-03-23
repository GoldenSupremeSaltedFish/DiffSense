#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Java CVE 规则分级脚本
将 pro-rules/cve/java 目录下的规则按严重性分级，移动到对应的 tier 子目录

分级标准:
- Tier 1 (Critical): severity=critical 或 CVSS >= 9.0 - 立即执行，阻断 CI
- Tier 2 (High): severity=high 或 CVSS >= 7.0 - 优先执行，建议修复  
- Tier 3 (Medium): severity=medium 或 CVSS >= 4.0 - 按需执行，可延后
- Tier 4 (Low): severity=low 或 CVSS < 4.0 - 可选执行，减少噪音
"""
import os
import sys
import shutil
import yaml
from pathlib import Path
from collections import Counter

def get_tier_for_rule(data: dict) -> str:
    """
    根据规则的 severity 和 cvss_score 确定分级
    返回：'tier1', 'tier2', 'tier3', 'tier4'
    """
    severity = (data.get('severity') or '').lower()
    cvss_score = data.get('cvss_score')
    
    # 优先按 severity 字段分级
    if severity == 'critical':
        return 'tier1'
    elif severity == 'high':
        return 'tier2'
    elif severity == 'medium':
        return 'tier3'
    elif severity == 'low':
        return 'tier4'
    
    # 如果没有 severity 或 severity 不明确，使用 CVSS 分数
    if cvss_score is not None:
        try:
            cvss = float(cvss_score)
            if cvss >= 9.0:
                return 'tier1'
            elif cvss >= 7.0:
                return 'tier2'
            elif cvss >= 4.0:
                return 'tier3'
            else:
                return 'tier4'
        except (ValueError, TypeError):
            pass
    
    # 默认归为 tier4（低优先级）
    return 'tier4'


def tier_java_cve_rules(dry_run: bool = False):
    """
    将 Java CVE 规则按分级移动到对应的 tier 子目录
    
    Args:
        dry_run: 如果为 True，只打印操作不实际移动文件
    """
    java_cve_dir = Path(__file__).parent.parent / "pro-rules" / "cve" / "java"
    
    if not java_cve_dir.exists():
        print(f"[ERROR] Directory not found: {java_cve_dir}")
        return False
    
    # 创建 tier 目录
    tier_dirs = {
        'tier1': java_cve_dir / "tier1_critical",
        'tier2': java_cve_dir / "tier2_high",
        'tier3': java_cve_dir / "tier3_medium",
        'tier4': java_cve_dir / "tier4_low"
    }
    
    if not dry_run:
        for tier_dir in tier_dirs.values():
            tier_dir.mkdir(exist_ok=True)
            print(f"[INFO] Created directory: {tier_dir}")
    
    # 统计分级结果
    tier_counter = Counter()
    total_files = 0
    processed_files = 0
    errors = []
    
    yaml_files = list(java_cve_dir.glob("*.yaml"))
    total_files = len(yaml_files)
    print(f"\n[INFO] Found {total_files} Java CVE rule files to classify\n")
    
    for yaml_file in yaml_files:
        try:
            with open(yaml_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            
            if not data or not isinstance(data, dict):
                errors.append(f"{yaml_file.name}: Invalid YAML structure")
                continue
            
            # 确定分级
            tier = get_tier_for_rule(data)
            tier_counter[tier] += 1
            
            # 移动文件
            if not dry_run:
                dest_dir = tier_dirs[tier]
                dest_file = dest_dir / yaml_file.name
                
                # 如果目标文件已存在，添加序号避免冲突
                if dest_file.exists():
                    base = yaml_file.stem
                    suffix = yaml_file.suffix
                    counter = 1
                    while dest_file.exists():
                        dest_file = dest_dir / f"{base}_{counter}{suffix}"
                        counter += 1
                
                shutil.move(str(yaml_file), str(dest_file))
            
            processed_files += 1
            
            # 进度显示（每 1000 个文件打印一次）
            if processed_files % 1000 == 0:
                print(f"[INFO] Processed {processed_files}/{total_files} files...")
                
        except Exception as e:
            errors.append(f"{yaml_file.name}: {str(e)}")
            continue
    
    # 输出统计结果
    print("\n" + "=" * 80)
    print("Java CVE Rule Tier Classification Summary")
    print("=" * 80)
    print(f"Total files: {total_files}")
    print(f"Processed files: {processed_files}")
    if errors:
        print(f"Errors: {len(errors)}")
        for err in errors[:10]:
            print(f"  - {err}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more errors")
    
    print(f"\n[Tier Distribution]:")
    tier_labels = {
        'tier1': 'Tier 1 (Critical)',
        'tier2': 'Tier 2 (High)',
        'tier3': 'Tier 3 (Medium)',
        'tier4': 'Tier 4 (Low)'
    }
    for tier, label in tier_labels.items():
        count = tier_counter[tier]
        percentage = (count / processed_files * 100) if processed_files > 0 else 0
        print(f"  {label:20s}: {count:5d} ({percentage:5.2f}%)")
    
    print("\n[Directory Structure]:")
    print(f"  pro-rules/cve/java/")
    print(f"    ├── tier1_critical/  ({tier_counter['tier1']} rules)")
    print(f"    ├── tier2_high/      ({tier_counter['tier2']} rules)")
    print(f"    ├── tier3_medium/    ({tier_counter['tier3']} rules)")
    print(f"    └── tier4_low/       ({tier_counter['tier4']} rules)")
    
    print("\n" + "=" * 80)
    if dry_run:
        print("[DRY RUN] No files were actually moved. Re-run without --dry-run to apply.")
    else:
        print("[SUCCESS] All files have been classified and moved to tier directories.")
    
    return True


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Classify Java CVE rules into tiers')
    parser.add_argument('--dry-run', action='store_true', 
                        help='Show what would be done without actually moving files')
    args = parser.parse_args()
    
    print("=" * 80)
    print("Java CVE Rule Tier Classification Script")
    print("=" * 80)
    print(f"Mode: {'DRY RUN' if args.dry_run else 'APPLY'}")
    print(f"Target directory: pro-rules/cve/java")
    print("\nClassification Criteria:")
    print("  Tier 1 (Critical): severity=critical OR CVSS >= 9.0")
    print("  Tier 2 (High):     severity=high OR CVSS >= 7.0")
    print("  Tier 3 (Medium):   severity=medium OR CVSS >= 4.0")
    print("  Tier 4 (Low):      severity=low OR CVSS < 4.0")
    print("=" * 80)
    
    success = tier_java_cve_rules(dry_run=args.dry_run)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
