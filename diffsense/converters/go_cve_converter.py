class GoCVEDatasetConverter:
    def __init__(self, cve_source="nvd"):
        self.language = "go"
        self.cve_source = cve_source
        self.vulnerability_patterns = {
            "insecure_deserialization": [
                "gob.Decode(", "json.Unmarshal(", "xml.Unmarshal("
            ],
            "command_execution": [
                "exec.Command(", "os/exec.Command("
            ],
            "goroutine_leak": [
                "make(chan ", "select {", "default:"
            ],
            "race_condition": [
                "sync.Mutex", "Lock()", "Unlock()"
            ]
        }
    
    def parse_cve_entry(self, cve_data: dict):
        """将原始CVE数据转换为结构化规则模板"""
        cve_id = cve_data.get("cve_id")
        description = cve_data.get("description", "")
        affected_functions = self._extract_affected_functions(description)
        vulnerability_type = self._classify_vulnerability(description, affected_functions)
        
        return {
            "cve_id": cve_id,
            "language": "go",
            "vulnerability_type": vulnerability_type,
            "patterns": affected_functions,
            "severity": self._determine_severity(cve_data)
        }
    
    def _extract_affected_functions(self, description: str):
        """从CVE描述中提取受影响的函数"""
        functions = []
        for vuln_type, patterns in self.vulnerability_patterns.items():
            for pattern in patterns:
                if pattern[:-1] in description:  # 移除括号进行匹配
                    functions.append(pattern)
        return functions
    
    def _classify_vulnerability(self, description: str, functions: list):
        """根据函数模式分类漏洞类型"""
        if any("gob.Decode" in f or "json.Unmarshal" in f for f in functions):
            return "INSECURE_DESERIALIZATION"
        elif "exec.Command" in str(functions):
            return "COMMAND_EXECUTION"
        elif "make(chan" in str(functions):
            return "GOROUTINE_LEAK"
        elif "sync.Mutex" in str(functions):
            return "RACE_CONDITION"
        else:
            return "UNKNOWN_VULNERABILITY"
    
    def _determine_severity(self, cve_data: dict):
        """根据CVE数据确定严重程度"""
        # 简单实现：基于CVSS评分
        cvss_score = cve_data.get("cvss_score", 0)
        if cvss_score >= 9.0:
            return "critical"
        elif cvss_score >= 7.0:
            return "high"
        elif cvss_score >= 4.0:
            return "medium"
        else:
            return "low"
    
    def generate_diffsense_rule(self, template: dict):
        """生成DiffSense PROrule"""
        rule_name = f"prorule.{template['cve_id'].lower().replace('-', '_')}_{template['language']}"
        
        rule = {
            "name": rule_name,
            "description": f"CVE检测规则 - {template['cve_id']}",
            "language": template["language"],
            "triggers_on": [template["vulnerability_type"]],
            "language_specific_patterns": template["patterns"],
            "severity": template["severity"]
        }
        
        return rule