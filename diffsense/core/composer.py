from typing import Dict, Any, List

class DecisionComposer:
    def compose(self, triggered_rules: List[Dict[str, Any]], diff_files: List[str] = None) -> Dict[str, Any]:
        """
        Synthesizes triggered rules into a final decision adhering to the Parser Contract.
        """
        diff_files = diff_files or []
        reasons = []
        details = []
        impacts_map = {}
        
        severity_map = {
            "critical": 3,
            "high": 2,
            "medium": 1,
            "low": 0
        }
        
        max_score = 0
        
        for rule in triggered_rules:
            rule_id = rule.get('id', 'unknown')
            impact_dim = rule.get('impact', 'general')
            severity = rule.get('severity', 'low')
            rationale = rule.get('rationale', '')
            matched_file = rule.get('matched_file', '')
            precision = rule.get('precision')
            quality_status = rule.get('quality_status')
            
            reasons.append(rule_id)
            
            detail = {
                "rule_id": rule_id,
                "severity": severity,
                "file": matched_file,
                "rationale": rationale,
                "impact": impact_dim
            }
            if precision is not None:
                detail["precision"] = precision
            if quality_status is not None:
                detail["quality_status"] = quality_status
            details.append(detail)
            
            current_dim_score = severity_map.get(impacts_map.get(impact_dim, "low"), 0)
            new_score = severity_map.get(severity, 0)
            
            if new_score > current_dim_score:
                impacts_map[impact_dim] = severity
                
            if new_score > max_score:
                max_score = new_score
                
        # Determine Review Level
        review_level = "normal"
        if max_score >= 3:
            review_level = "critical"
        elif max_score >= 2:
            review_level = "elevated"
            
        # Construct Final JSON Contract
        result = {
            "review_level": review_level,
            "reasons": reasons,
            "files": diff_files,
            "impacts": impacts_map,
            "details": details,
            "meta": {
                "confidence": 1.0, # Placeholder as requested
                "suggested_action": "manual_review" if review_level != "normal" else "auto_merge" # Simple heuristic
            }
        }
        
        return result
