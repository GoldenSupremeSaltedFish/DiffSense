#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
分析 pro-rules/cve/java 目录下 CVE 规则的严重性分布
"""
import os
import sys
import yaml
from pathlib import Path
from collections import Counter

def analyze_java_cve_severity():
    java_cve_dir = Path(__file__).parent.parent / "pro-rules" / "cve" / "java"
    
    if not java_cve_dir.exists():
        print(f"[ERROR] Directory not found: {java_cve_dir}")
        return
    
    severity_counter = Counter()
    cvss_scores = []
    cwe_counter = Counter()
    total_files = 0
    processed_files = 0
    
    # 统计文件总数
    yaml_files = list(java_cve_dir.glob("*.yaml"))
    total_files = len(yaml_files)
    print(f"[INFO] Found {total_files} Java CVE rule files\n")
    
    # 抽样分析前 1000 个文件
    sample_size = min(1000, total_files)
    print(f"[INFO] Analyzing first {sample_size} files...\n")
    
    for yaml_file in yaml_files[:sample_size]:
        try:
            with open(yaml_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            
            if not data:
                continue
                
            processed_files += 1
            
            # 提取 severity
            severity = data.get('severity', 'unknown')
            severity_counter[severity] += 1
            
            # 提取 CVSS 分数
            cvss = data.get('cvss_score')
            if cvss is not None:
                cvss_scores.append(cvss)
            
            # 提取 CWE
            cwe_ids = data.get('cwe_ids', [])
            for cwe in cwe_ids:
                cwe_counter[cwe] += 1
                
        except Exception as e:
            print(f"⚠️  读取 {yaml_file.name} 失败：{e}")
            continue
    
    # 输出统计结果
    print("=" * 80)
    print("Java CVE Rule Severity Distribution")
    print("=" * 80)
    print(f"Processed files: {processed_files}/{sample_size}")
    print(f"\n[Severity Distribution]")
    for severity, count in severity_counter.most_common():
        percentage = (count / processed_files * 100) if processed_files > 0 else 0
        print(f"  {severity:15s}: {count:5d} ({percentage:5.2f}%)")
    
    if cvss_scores:
        print(f"\n[CVSS Score Distribution]")
        cvss_ranges = [
            (9.0, 10.0, "Critical"),
            (7.0, 8.9, "High"),
            (4.0, 6.9, "Medium"),
            (0.1, 3.9, "Low"),
            (0.0, 0.0, "None/Unknown")
        ]
        for low, high, label in cvss_ranges:
            count = sum(1 for s in cvss_scores if low <= s <= high)
            percentage = (count / len(cvss_scores) * 100) if cvss_scores else 0
            print(f"  {label:15s} ({low:4.1f}-{high:4.1f}): {count:5d} ({percentage:5.2f}%)")
        
        print(f"\n  Average CVSS: {sum(cvss_scores)/len(cvss_scores):.2f}")
        print(f"  Max CVSS: {max(cvss_scores):.2f}")
        print(f"  Min CVSS: {min(cvss_scores):.2f}")
    
    if cwe_counter:
        print(f"\n[Top 10 CWE Types]")
        for cwe, count in cwe_counter.most_common(10):
            percentage = (count / processed_files * 100) if processed_files > 0 else 0
            print(f"  {cwe:15s}: {count:5d} ({percentage:5.2f}%)")
    
    print("\n" + "=" * 80)
    
    # 分级建议
    print("\n[Tier Classification Recommendation]:")
    print("-" * 80)
    critical_count = severity_counter.get('critical', 0) + sum(1 for s in cvss_scores if s >= 9.0)
    high_count = severity_counter.get('high', 0) + sum(1 for s in cvss_scores if 7.0 <= s < 9.0)
    medium_count = severity_counter.get('medium', 0) + sum(1 for s in cvss_scores if 4.0 <= s < 7.0)
    low_count = severity_counter.get('low', 0) + sum(1 for s in cvss_scores if s < 4.0)
    
    print(f"  Critical (Tier 1): ~{critical_count} rules - Execute immediately, block CI")
    print(f"  High (Tier 2):     ~{high_count} rules - High priority, recommended fix")
    print(f"  Medium (Tier 3):   ~{medium_count} rules - On-demand, can be deferred")
    print(f"  Low (Tier 4):      ~{low_count} rules - Optional, reduce noise")
    print("\n[Recommended Tier Loading Strategy]:")
    print("  - lightweight profile: Load Critical only")
    print("  - standard profile: Load Critical + High")
    print("  - strict profile: Load all tiers")

if __name__ == "__main__":
    analyze_java_cve_severity()
