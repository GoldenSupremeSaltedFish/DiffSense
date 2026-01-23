from typing import Dict, Any
from .rules import RuleEngine

class ImpactEvaluator:
    def __init__(self, rule_engine: RuleEngine):
        self.rule_engine = rule_engine

    def evaluate(self, diff_data: Dict[str, Any]) -> Dict[str, str]:
        """
        Calculates impact for each dimension.
        Current MVP delegates fully to Rule Engine.
        Future: Add heuristic logic here.
        """
        return self.rule_engine.evaluate(diff_data)
