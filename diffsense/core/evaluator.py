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
        return self.rule_engine.evaluate(diff_data, ast_signals)
