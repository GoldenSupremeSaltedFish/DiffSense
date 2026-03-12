#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
C++ CVE Converter for DiffSense
Converts C++ CVE data into PROrule format for DiffSense analysis.
Supports CVE JSON 5.0 (cvelistV5) and flat dict input.
Output schema matches single-rule YAML (id, language, severity, description, ...)
so the rule engine can load pro-rules/cve/cpp/*.yaml with language=cpp.
"""

import json
import yaml
import re
from typing import Dict, List, Any, Optional
from datetime import datetime


# C++ 相关性关键词：描述或产品名包含则视为 C++ 相关 CVE
CPP_RELATED_KEYWORDS = re.compile(
    r'\bc\+\+|c\+\+11|c\+\+17|c\+\+20|\bcpp\b|\(c\+\+\)|c/c\+\+|'
    r'c\+\+ (?:library|code|application|component|project)|'
    r'std::|stl\b|boost\.|qt\s+(?:framework|library)|'
    r'native\s+code|compiled\s+(?:c\+\+|native)|'
    r'\bcxx\b|clang\+\+|g\+\+|msvc|visual\s+studio\s+c\+\+',
    re.I
)


def is_cpp_related_cve(description: str, affected_products: Optional[List[str]] = None) -> bool:
    """
    根据描述或受影响产品判断是否为 C++ 相关 CVE。
    用于从 cvelistV5 中筛选近一年 C++ 相关条目。
    """
    text = (description or "").lower()
    if CPP_RELATED_KEYWORDS.search(text):
        return True
    for product in (affected_products or []):
        if CPP_RELATED_KEYWORDS.search((product or "").lower()):
            return True
    return False


def parse_cve_json5_to_flat(cve5: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    将 CVE JSON 5.0 单条记录解析为扁平结构，供 convert_cve_to_prorule 使用。
    参见 https://github.com/CVEProject/cve-schema
    """
    if not cve5 or not isinstance(cve5, dict):
        return None
    meta = cve5.get("cveMetadata") or {}
    cve_id = meta.get("cveId") or ""
    if not cve_id.startswith("CVE-"):
        return None
    date_published = meta.get("datePublished") or ""
    containers = cve5.get("containers") or {}
    cna = containers.get("cna") or {}
    if isinstance(cna, list):
        cna = cna[0] if cna else {}
    descriptions = cna.get("descriptions") or []
    desc_en = ""
    for d in descriptions:
        if (d.get("lang") or "").lower() == "en":
            desc_en = (d.get("value") or "").strip()
            break
    if not desc_en and descriptions:
        desc_en = (descriptions[0].get("value") or "").strip()
    refs = cna.get("references") or []
    ref_urls = [r.get("url") for r in refs if r.get("url")]
    affected = cna.get("affected") or []
    products = []
    for a in affected:
        vendor = (a.get("vendor") or "").strip()
        product = (a.get("product") or "").strip()
        if product:
            products.append(f"{vendor} {product}".strip() or product)
    metrics = cna.get("metrics") or []
    cvss_score = None
    for m in metrics:
        if not isinstance(m, dict):
            continue
        cvss = m.get("cvssV3_1") or m.get("cvssV3_0") or m.get("cvssV2_0")
        if isinstance(cvss, dict) and "baseScore" in cvss:
            cvss_score = float(cvss["baseScore"])
            break
    problem_types = cna.get("problemTypes") or []
    cwe_ids = []
    for pt in problem_types:
        for desc in (pt.get("descriptions") or []):
            cwe = (desc.get("cweId") or "").strip()
            if cwe and cwe.startswith("CWE-"):
                cwe_ids.append(cwe)
    return {
        "cve_id": cve_id,
        "description": desc_en[:2000] if desc_en else "",
        "published_date": date_published,
        "references": ref_urls[:15],
        "cvss_score": cvss_score,
        "cwe_ids": cwe_ids[:10],
        "affected_products": products,
    }


class CPPCVEConverter:
    """
    Converts C++ CVE entries into DiffSense PROrule format.
    Handles C++ specific vulnerability patterns including:
    - Memory safety issues (buffer overflows, use-after-free, double-free)
    - Concurrency problems (race conditions, deadlocks)
    - Security vulnerabilities (injection, improper validation)
    - Resource management issues (leaks, improper cleanup)
    """
    
    def __init__(self):
        self.vulnerability_patterns = {
            'memory_safety': {
                'buffer_overflow': [
                    r'buffer\s+(overflow|overrun)',
                    r'array\s+bounds?\s+(exceeded|violated)',
                    r'stack\s+smash',
                    r'heap\s+overflow'
                ],
                'use_after_free': [
                    r'use[-\s]?after[-\s]?free',
                    r'dangling\s+pointer',
                    r'access\s+freed\s+memory'
                ],
                'double_free': [
                    r'double[-\s]?free',
                    r'free\s+twice',
                    r'multiple\s+deletion'
                ]
            },
            'concurrency': {
                'race_condition': [
                    r'race\s+condition',
                    r'data\s+race',
                    r'concurrent\s+access'
                ],
                'deadlock': [
                    r'deadlock',
                    r'circular\s+wait',
                    r'mutex\s+ordering'
                ]
            },
            'security': {
                'command_injection': [
                    r'command\s+injection',
                    r'shell\s+injection',
                    r'arbitrary\s+code\s+execution'
                ],
                'format_string': [
                    r'format\s+string\s+vulnerability',
                    r'printf\s+without\s+format'
                ]
            }
        }
        
    def _cve_slug(self, cve_id: str) -> str:
        """CVE ID 转规则用 slug，与 JS/Java 风格一致."""
        return (cve_id or "unknown").replace("-", "_").lower()

    def convert_cve_to_prorule(self, cve_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert a single CVE entry to PROrule format（引擎可加载的单条规则 schema）。
        
        Args:
            cve_data: 扁平 CVE 字典，含 cve_id, description, references, published_date, cvss_score, cwe_ids 等。
            
        Returns:
            PROrule 字典，与 pro-rules/cve/java、cve/JavaScript 单文件 schema 一致。
        """
        severity = self._determine_severity(cve_data)
        category = self._categorize_vulnerability(cve_data)
        cve_id = cve_data.get('cve_id', 'UNKNOWN')
        slug = self._cve_slug(cve_id)
        rule_id = f"prorule.cpp.{severity}.{slug}"
        patterns = self._generate_patterns(cve_data, category)
        cwe = (cve_data.get("cwe_ids") or [])[:5]
        refs = cve_data.get("references") or []
        description = (cve_data.get('description') or '')[:500]
        
        pro_rule = {
            'id': rule_id,
            'description': description,
            'severity': severity,
            'language': 'cpp',
            'category': 'security',
            'tags': ['cve', 'vulnerability', 'cpp', cve_id.lower(), category],
            'references': refs[:10],
            'aliases': [cve_id],
            'patterns': patterns,
            'cwe': cwe,
            'metadata': {
                'cve_id': cve_id,
                'published_date': cve_data.get('published_date'),
                'conversion_date': datetime.now().isoformat(),
            }
        }
        return pro_rule

    def from_cve_json5(self, cve5: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        从 CVE JSON 5.0 单条记录转换为 PROrule。
        若解析失败返回 None。
        """
        flat = parse_cve_json5_to_flat(cve5)
        if not flat or not flat.get("description"):
            return None
        return self.convert_cve_to_prorule(flat)
    
    def _generate_rule_id(self, cve_data: Dict[str, Any]) -> str:
        """Generate a unique rule ID from CVE data (legacy style)."""
        cve_id = cve_data.get('cve_id', 'UNKNOWN')
        severity = self._determine_severity(cve_data)
        return f"prorule.cpp.{severity}.{self._cve_slug(cve_id)}"
    
    def _determine_severity(self, cve_data: Dict[str, Any]) -> str:
        """Determine severity level based on CVSS score or description."""
        # Check for CVSS score first
        if 'cvss_score' in cve_data:
            score = float(cve_data['cvss_score'])
            if score >= 9.0:
                return 'critical'
            elif score >= 7.0:
                return 'high'
            elif score >= 4.0:
                return 'medium'
            else:
                return 'low'
        
        # Fallback to description analysis
        desc_lower = cve_data.get('description', '').lower()
        if any(keyword in desc_lower for keyword in ['remote code execution', 'arbitrary code', 'complete system compromise']):
            return 'critical'
        elif any(keyword in desc_lower for keyword in ['denial of service', 'information disclosure', 'privilege escalation']):
            return 'high'
        else:
            return 'medium'
    
    def _categorize_vulnerability(self, cve_data: Dict[str, Any]) -> str:
        """Categorize the vulnerability type based on description."""
        desc_lower = cve_data.get('description', '').lower()
        
        # Check memory safety patterns
        for pattern_type, patterns in self.vulnerability_patterns['memory_safety'].items():
            if any(re.search(pattern, desc_lower) for pattern in patterns):
                return f'memory_safety.{pattern_type}'
        
        # Check concurrency patterns
        for pattern_type, patterns in self.vulnerability_patterns['concurrency'].items():
            if any(re.search(pattern, desc_lower) for pattern in patterns):
                return f'concurrency.{pattern_type}'
        
        # Check security patterns
        for pattern_type, patterns in self.vulnerability_patterns['security'].items():
            if any(re.search(pattern, desc_lower) for pattern in patterns):
                return f'security.{pattern_type}'
        
        return 'general.vulnerability'
    
    def _extract_signals(self, cve_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract semantic signals from CVE data for AST-based detection."""
        signals = []
        desc_lower = cve_data.get('description', '').lower()
        
        # Memory allocation/deallocation signals
        if any(keyword in desc_lower for keyword in ['malloc', 'free', 'new', 'delete', 'alloc']):
            signals.append({
                'type': 'memory_operation',
                'context': 'allocation_deallocation',
                'severity': 'high'
            })
        
        # Pointer usage signals
        if any(keyword in desc_lower for keyword in ['pointer', 'reference', 'dereference']):
            signals.append({
                'type': 'pointer_operation',
                'context': 'memory_access',
                'severity': 'medium'
            })
        
        # Concurrency signals
        if any(keyword in desc_lower for keyword in ['thread', 'mutex', 'lock', 'atomic', 'concurrent']):
            signals.append({
                'type': 'concurrency_operation',
                'context': 'thread_safety',
                'severity': 'high'
            })
        
        # Input validation signals
        if any(keyword in desc_lower for keyword in ['input', 'validation', 'sanitization', 'user input']):
            signals.append({
                'type': 'input_validation',
                'context': 'security_check',
                'severity': 'medium'
            })
        
        return signals
    
    def _generate_patterns(self, cve_data: Dict[str, Any], category: str) -> List[str]:
        """Generate code patterns for detection based on vulnerability category."""
        patterns = []
        
        if 'memory_safety.buffer_overflow' in category:
            patterns.extend([
                r'\bmemcpy\s*\([^,]*,\s*[^,]*,\s*[^)]*\s*\+\s*\d+\s*\)',
                r'\bstrncpy\s*\([^,]*,\s*[^,]*,\s*[^)]*\s*\+\s*\d+\s*\)',
                r'\bstrcpy\s*\(',
                r'\bsprintf\s*\('
            ])
        elif 'memory_safety.use_after_free' in category:
            patterns.extend([
                r'\bfree\s*\([^)]*\)\s*;.*\b\w+\s*->',
                r'\bdelete\s+\w+\s*;.*\b\w+\s*->',
                r'\bdelete\s+\[\]\s+\w+\s*;.*\b\w+\s*\['
            ])
        elif 'concurrency.race_condition' in category:
            patterns.extend([
                r'\bstd::thread\b',
                r'\bpthread_create\b',
                r'\bstd::async\b',
                r'\bstd::future\b'
            ])
        elif 'security.command_injection' in category:
            patterns.extend([
                r'\bsystem\s*\(',
                r'\bpopen\s*\(',
                r'\bexec[lv][ep]?\s*\(',
                r'\bCreateProcess[AW]?\s*\('
            ])
        
        # Add general C++ patterns
        patterns.extend([
            r'\b(new|delete)\s+',
            r'\b(malloc|free|calloc|realloc)\s*\(',
            r'\bstd::(shared_ptr|unique_ptr)\b'
        ])
        
        return patterns
    
    def batch_convert(self, cve_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert a list of CVE entries to PROrules."""
        pro_rules = []
        for cve_data in cve_list:
            try:
                pro_rule = self.convert_cve_to_prorule(cve_data)
                pro_rules.append(pro_rule)
            except Exception as e:
                print(f"Error converting CVE {cve_data.get('cve_id', 'UNKNOWN')}: {e}")
                continue
        return pro_rules
    
    def save_rules_to_yaml(self, pro_rules: List[Dict[str, Any]], output_dir: str):
        """Save PROrules to YAML files (output_dir 一般为 pro-rules/cve/cpp)。"""
        import os
        os.makedirs(output_dir, exist_ok=True)
        for rule in pro_rules:
            rid = (rule.get("id") or "prorule_cpp_unknown").replace(".", "_")
            safe = re.sub(r"[^\w\-_.]", "_", rid)
            filename = f"{safe}.yaml"
            filepath = os.path.join(output_dir, filename)
            with open(filepath, "w", encoding="utf-8") as f:
                yaml.dump(rule, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        print(f"Saved {len(pro_rules)} C++ PROrules to {output_dir}")

def main():
    """Main function for testing the converter."""
    converter = CPPCVEConverter()
    
    # Example CVE data
    example_cve = {
        'cve_id': 'CVE-2023-1234',
        'description': 'Buffer overflow in memcpy function when processing user input',
        'cvss_score': 8.5,
        'published_date': '2023-03-10',
        'references': ['https://example.com/cve-2023-1234']
    }
    
    pro_rule = converter.convert_cve_to_prorule(example_cve)
    print("Generated PROrule:")
    print(json.dumps(pro_rule, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()