class CVEDatasetConverter:
    """CVE数据集转换器基类"""
    
    def __init__(self, language: str, cve_source: str = "nvd"):
        self.language = language
        self.cve_source = cve_source
    
    def parse_cve_entry(self, cve_data: dict):
        """将原始CVE数据转换为结构化规则模板"""
        raise NotImplementedError("子类必须实现此方法")
    
    def generate_diffsense_rule(self, template: dict):
        """生成DiffSense PROrule"""
        raise NotImplementedError("子类必须实现此方法")
    
    def _determine_severity(self, cve_data: dict):
        """根据CVE数据确定严重程度"""
        # 基于CVSS评分的通用实现
        cvss_score = cve_data.get("cvss_score", 0)
        if cvss_score >= 9.0:
            return "critical"
        elif cvss_score >= 7.0:
            return "high"
        elif cvss_score >= 4.0:
            return "medium"
        else:
            return "low"