#!/usr/bin/env python3
"""
CVE数据集转换示例
演示如何将真实的CVE数据转换为DiffSense PROrules
"""

import json
from pathlib import Path
from diffsense.converters import PythonCVEDatasetConverter, GoCVEDatasetConverter

def convert_cve_dataset_to_pro_rules(cve_dataset_file: str, output_dir: str):
    """
    将CVE数据集文件转换为DiffSense PROrule文件
    
    Args:
        cve_dataset_file: CVE数据集JSON文件路径
        output_dir: 输出PROrule文件的目录
    """
    # 读取CVE数据集
    with open(cve_dataset_file, 'r', encoding='utf-8') as f:
        cve_data = json.load(f)
    
    # 按语言分组处理
    python_cves = [cve for cve in cve_data if cve.get('language') == 'python']
    go_cves = [cve for cve in cve_data if cve.get('language') == 'go']
    
    # 创建转换器
    python_converter = PythonCVEDatasetConverter()
    go_converter = GoCVEDatasetConverter()
    
    # 转换Python CVEs
    python_rules = []
    for cve in python_cves:
        template = python_converter.parse_cve_entry(cve)
        rule = python_converter.generate_diffsense_rule(template)
        python_rules.append(rule)
    
    # 转换Go CVEs  
    go_rules = []
    for cve in go_cves:
        template = go_converter.parse_cve_entry(cve)
        rule = go_converter.generate_diffsense_rule(template)
        go_rules.append(rule)
    
    # 保存为YAML格式的PROrule文件
    _save_rules_to_yaml(python_rules, f"{output_dir}/python_cves.yaml")
    _save_rules_to_yaml(go_rules, f"{output_dir}/go_cves.yaml")
    
    print(f"OK 转换完成!")
    print(f"   Python CVE规则: {len(python_rules)} 条")
    print(f"   Go CVE规则: {len(go_rules)} 条")
    print(f"   输出目录: {output_dir}")

def _save_rules_to_yaml(rules: list, output_file: str):
    """将规则保存为YAML格式"""
    import yaml
    
    # 转换为DiffSense PROrule格式
    pro_rules = {}
    for rule in rules:
        pro_rules[rule['name']] = {
            'description': rule['description'],
            'triggers_on': rule['triggers_on'],
            'language_specific_patterns': rule['language_specific_patterns'],
            'severity': rule['severity']
        }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        yaml.dump(pro_rules, f, allow_unicode=True, default_flow_style=False)

# 示例使用
if __name__ == "__main__":
    # 创建示例CVE数据集
    sample_cve_data = [
        {
            "cve_id": "CVE-2023-1234",
            "language": "python", 
            "description": "Python pickle模块中的不安全反序列化漏洞",
            "cvss_score": 9.8
        },
        {
            "cve_id": "CVE-2023-5678", 
            "language": "go",
            "description": "Go gob包中的反序列化漏洞",
            "cvss_score": 8.5
        }
    ]
    
    # 保存示例数据到 fixtures 目录
    fixtures_dir = Path(__file__).parent / "tests" / "fixtures" / "cve_samples" / "data"
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    sample_cve_path = fixtures_dir / "sample_cve_dataset.json"
    with open(sample_cve_path, "w", encoding="utf-8") as f:
        json.dump(sample_cve_data, f, ensure_ascii=False, indent=2)
    
    # 执行转换
    convert_cve_dataset_to_pro_rules(str(sample_cve_path), "./pro-rules")