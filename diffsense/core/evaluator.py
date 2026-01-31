from typing import Dict, Any, List
from .rules import RuleEngine

class ImpactEvaluator:
    def __init__(self, rule_engine: RuleEngine):
        self.rule_engine = rule_engine

    def evaluate(self, diff_data: Dict[str, Any], ast_signals: List[Any] = None) -> List[Dict[str, Any]]:
        """
        Calculates impact by delegating to Rule Engine.
        Returns a list of triggered rule objects.
        """
        ast_signals = ast_signals or []
        
        # Tier 3 Check: If Large Refactor detected, skip all other rules
        for sig in ast_signals:
            if sig.id == "meta.large_refactor":
                return [{
                    "id": "meta.large_refactor",
                    "impact": "maintenance",
                    "severity": "low", 
                    "rationale": "Large refactor detected (>30 Java files). Deep analysis skipped.",
                    "matched_file": "meta"
                }]

        return self.rule_engine.evaluate(diff_data, ast_signals)
