#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CVE数据集转换脚本
将多语言CVE数据集转换为DiffSense PROrules
"""

import json
import os
import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))

from diffsense.converters import PythonCVEDatasetConverter, GoCVEDatasetConverter


def load_cve_dataset(file_path):
    """加载CVE数据集"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_pro_rule(rule, output_dir, language):
    """保存PROrule到文件"""
    # 确保输出目录存在
    lang_dir = os.path.join(output_dir, language)
    os.makedirs(lang_dir, exist_ok=True)
    
    # 生成文件名
    rule_name = rule['name'].replace('prorule.', '')
    file_name = f"{rule_name}.yaml"
    file_path = os.path.join(lang_dir, file_name)
    
    # 写入YAML格式的规则
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(f"{rule['name']}:\n")
        f.write(f"  description: \"{rule['description']}\"\n")
        f.write(f"  language: {rule['language']}\n")
        f.write(f"  triggers_on: [{rule['triggers_on'][0]}]\n")
        f.write(f"  language_specific_patterns:\n")
        for pattern in rule['language_specific_patterns']:
            f.write(f"    - \"{pattern}\"\n")
        f.write(f"  severity: {rule['severity']}\n")
    
    return file_path


def main():
    if len(sys.argv) != 3:
        print("用法: python convert_cve_dataset.py <输入文件> <输出目录>")
        print("示例: python convert_cve_dataset.py sample_cve_dataset.json pro-rules/")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_dir = sys.argv[2]
    
    print(f"加载CVE数据集: {input_file}")
    
    # 加载CVE数据集
    try:
        cve_data = load_cve_dataset(input_file)
    except Exception as e:
        print(f"错误: 无法加载CVE数据集 - {e}")
        sys.exit(1)
    
    print(f"找到 {len(cve_data)} 个CVE条目")
    
    # 初始化转换器
    converters = {
        'python': PythonCVEDatasetConverter(),
        'go': GoCVEDatasetConverter()
    }
    
    converted_count = 0
    
    # 处理每个CVE条目
    for cve_entry in cve_data:
        language = cve_entry.get('language', '').lower()
        
        if language not in converters:
            print(f"警告: 不支持的语言 '{language}'，跳过 CVE {cve_entry.get('cve_id', 'unknown')}")
            continue
        
        try:
            # 转换CVE条目
            converter = converters[language]
            template = converter.parse_cve_entry(cve_entry)
            rule = converter.generate_diffsense_rule(template)
            
            # 保存规则
            rule_file = save_pro_rule(rule, output_dir, language)
            print(f"已生成规则: {rule_file}")
            converted_count += 1
            
        except Exception as e:
            print(f"错误: 转换 CVE {cve_entry.get('cve_id', 'unknown')} 失败 - {e}")
            continue
    
    print(f"\n转换完成! 成功转换 {converted_count} 个CVE规则")


if __name__ == "__main__":
    main()