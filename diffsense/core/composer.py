from typing import Dict, Any, List

class DecisionComposer:
    def compose(self, impacts: Dict[str, str]) -> Dict[str, Any]:
        """
        Synthesizes impacts into a final decision.
        """
        reasons = []
        max_severity = "low"
        
        severity_map = {
            "critical": 3,
            "high": 2,
            "medium": 1,
            "low": 0
        }
        
        current_max_score = 0
        
        for dimension, level in impacts.items():
            score = severity_map.get(level, 0)
            if score > current_max_score:
                current_max_score = score
                max_severity = level
            
            if score >= 2: # high or critical
                reasons.append(f"{dimension}_{level}")
                
        review_level = "normal"
        if current_max_score >= 2:
            review_level = "elevated"
            
        return {
            "review_level": review_level,
            "reasons": reasons,
            "impacts": impacts # Include detailed impacts for rendering
        }
