import yaml
import time
from typing import Dict, List, Any, Tuple
from core.rule_base import Rule
from rules.concurrency import (
    ThreadPoolSemanticChangeRule,
    ConcurrencyRegressionRule,
    ThreadSafetyRemovalRule,
    LatchMisuseRule
)
from rules.yaml_adapter import YamlRule

class RuleEngine:
    def __init__(self, rules_path: str):
        self.rules: List[Rule] = []
        self.metrics: Dict[str, Dict[str, Any]] = {} # id -> {calls, hits, time_ns, errors}
        
        # 1. Register Built-in Rules (Plugins)
        self._register_builtins()
        
        # 2. Load YAML Rules (Plugins)
        self._load_yaml_rules(rules_path)

    def _register_builtins(self):
        """
        Registers core rules that are implemented as Python classes.
        """
        self.rules.append(ThreadPoolSemanticChangeRule())
        self.rules.append(ConcurrencyRegressionRule())
        self.rules.append(ThreadSafetyRemovalRule())
        self.rules.append(LatchMisuseRule())

    def _load_yaml_rules(self, path: str):
        """
        Loads YAML rules and adapts them using YamlRule adapter.
        """
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}
                raw_rules = data.get('rules', [])
                for r in raw_rules:
                    self.rules.append(YamlRule(r))
        except FileNotFoundError:
            pass

    def evaluate(self, diff_data: Dict[str, Any], ast_signals: List[Any] = None) -> List[Dict[str, Any]]:
        """
        Evaluates all registered rules against the diff.
        """
        triggered_rules = []
        ast_signals = ast_signals or []
        
        for rule in self.rules:
            rule_id = rule.id
            if rule_id not in self.metrics:
                self.metrics[rule_id] = {"calls": 0, "hits": 0, "time_ns": 0, "errors": 0}
            
            self.metrics[rule_id]["calls"] += 1
            
            start_time = time.time_ns()
            match_details = None
            
            try:
                # Execute Rule (Plugin)
                match_details = rule.evaluate(diff_data, ast_signals)
            except Exception:
                self.metrics[rule_id]["errors"] += 1
            finally:
                duration = time.time_ns() - start_time
                self.metrics[rule_id]["time_ns"] += duration
            
            if match_details:
                self.metrics[rule_id]["hits"] += 1
                
                # Transform Rule Object -> Output Dictionary (for Composer)
                # This decouples the internal Rule object from the output format
                triggered = {
                    "id": rule.id,
                    "severity": rule.severity,
                    "impact": rule.impact,
                    "rationale": rule.rationale,
                    "matched_file": match_details.get('file', 'unknown')
                }
                triggered_rules.append(triggered)
                
        return triggered_rules
    
    def get_metrics(self) -> Dict[str, Any]:
        """Returns the collected performance metrics."""
        return self.metrics
