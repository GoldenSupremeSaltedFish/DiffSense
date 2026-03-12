from .base_converter import CVEDatasetConverter

class PythonCVEDatasetConverter(CVEDatasetConverter):
    def __init__(self, cve_source="nvd"):
        super().__init__("python", cve_source)
        self.vulnerability_patterns = {
            "insecure_deserialization": [
                "pickle.loads(", "pickle.load(", "yaml.load(",
                "eval(", "exec("
            ],
            "command_injection": [
                "os.system(", "subprocess.call(", "subprocess.run("
            ],
            "path_traversal": [
                "open(", "Path(", "os.path.join("
            ],
            "sql_injection": [
                "cursor.execute(", "db.execute("
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
            "language": "python",
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
        if any("pickle" in f or "yaml" in f or "eval" in f for f in functions):
            return "INSECURE_DESERIALIZATION"
        elif any("os.system" in f or "subprocess" in f for f in functions):
            return "COMMAND_INJECTION"
        elif "open" in str(functions):
            return "PATH_TRAVERSAL"
        elif "execute" in str(functions):
            return "SQL_INJECTION"
        else:
            return "UNKNOWN_VULNERABILITY"
    
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