from typing import Dict, Any, List

class DecisionComposer:
    def compose(self, triggered_rules: List[Dict[str, Any]], diff_files: List[str] = None, suppressed_rules: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Synthesizes triggered rules into a final decision adhering to the Parser Contract.
        `suppressed_rules` (optional) carries findings removed by ignore patterns so the
        report can expose a suppression summary (#113) instead of losing them silently.
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
        has_blocking_rule = False
        
        for rule in triggered_rules:
            rule_id = rule.get('id', 'unknown')
            impact_dim = rule.get('impact', 'general')
            severity = rule.get('severity', 'low')
            rationale = rule.get('rationale', '')
            matched_file = rule.get('matched_file', '')
            precision = rule.get('precision')
            quality_status = rule.get('quality_status')
            is_experimental = bool(rule.get("experimental"))
            is_blocking = rule.get('is_blocking', False)
            
            if is_blocking:
                has_blocking_rule = True
            
            reasons.append(rule_id)
            
            detail = {
                "rule_id": rule_id,
                "severity": severity,
                "file": matched_file,
                "rationale": rationale,
                "impact": impact_dim,
                "is_blocking": bool(is_blocking),  # #119: surface blocking semantics in the report
            }
            # #115: richer rationale context -- actionable fix guidance and a
            # doc link when the rule defines them (never emitted empty).
            if rule.get("remediation"):
                detail["remediation"] = rule["remediation"]
            if rule.get("help_uri"):
                detail["help_uri"] = rule["help_uri"]
            if precision is not None:
                detail["precision"] = precision
            if quality_status is not None:
                detail["quality_status"] = quality_status
            if is_experimental:
                detail["experimental"] = True
            details.append(detail)
            if not is_experimental:
                current_dim_score = severity_map.get(impacts_map.get(impact_dim, "low"), 0)
                new_score = severity_map.get(severity, 0)
                
                if new_score > current_dim_score:
                    impacts_map[impact_dim] = severity
                    
                if new_score > max_score:
                    max_score = new_score
                
        # Determine Review Level
        # 只对 CRITICAL 级别触发失败（需要确认），HIGH 及以下仅在评论中报告
        review_level = "normal"
        if len(triggered_rules) > 0:
            # CRITICAL 级别触发 critical review（需要审批/反应）
            # HIGH 及以下只报告，不阻止 CI
            if has_blocking_rule or max_score >= 3:
                review_level = "critical"
            else:
                review_level = "low"  # 标记为低风险，仅报告不阻止
            
        # Construct Final JSON Contract
        # #110/#111: HIGH severity findings (max_score >= 2) must never suggest
        # auto_merge -- that branch was previously dead code for `elevated`.
        suggested_action = "auto_merge"
        if review_level == "critical":
            suggested_action = "block_pr"
        elif max_score >= 2:
            suggested_action = "manual_review"

        result = {
            "review_level": review_level,
            "reasons": reasons,
            "files": diff_files,
            "impacts": impacts_map,
            "details": details,
            "meta": {
                "confidence": 1.0, # Placeholder as requested
                "suggested_action": suggested_action
            }
        }

        # #113: findings hidden by ignore patterns are summarised instead of silently dropped.
        suppressed_rules = suppressed_rules or []
        if suppressed_rules:
            result["suppression_summary"] = {
                "count": len(suppressed_rules),
                "suppressed": suppressed_rules,
            }

        return result
