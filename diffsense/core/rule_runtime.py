"""
Legacy rule runtime. Prefer core.rules.RuleEngine as the single entry point;
RuleEngine now integrates LifecycleManager, profile, directory/entry_point loading.
"""
import yaml
import time
from typing import Dict, List, Any, Optional
from sdk.rule import BaseRule
from sdk.signal import Signal
from governance.lifecycle import LifecycleManager
from rules.concurrency import (
    ThreadPoolSemanticChangeRule,
    ConcurrencyRegressionRule,
    ThreadSafetyRemovalRule,
    LatchMisuseRule
)
from rules.yaml_adapter import YamlRule

class RuleRuntime:
    """
    The orchestrator for executing rules.
    Handles Lifecycle, Metrics, Suppression, and Feedback.
    """
    def __init__(self, rules_path: str, config: Dict[str, Any] = None):
        self.rules: List[BaseRule] = []
        self.metrics: Dict[str, Dict[str, Any]] = {} 
        self.lifecycle = LifecycleManager(config)
        
        # 1. Register Built-in Rules (Plugins)
        self._register_builtins()
        
        # 2. Load YAML Rules (Plugins)
        self._load_yaml_rules(rules_path)

    def _register_builtins(self):
        """
        Registers core rules. In a real OS, this would be a dynamic plugin loader.
        """
        self.rules.append(ThreadPoolSemanticChangeRule())
        self.rules.append(ConcurrencyRegressionRule())
        self.rules.append(ThreadSafetyRemovalRule())
        self.rules.append(LatchMisuseRule())

    def _load_yaml_rules(self, path: str):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}
                raw_rules = data.get('rules', [])
                for r in raw_rules:
                    self.rules.append(YamlRule(r))
        except FileNotFoundError:
            pass

    def execute(self, diff_data: Dict[str, Any], signals: List[Signal]) -> List[Dict[str, Any]]:
        """
        Main execution pipeline.
        """
        findings = []
        
        for rule in self.rules:
            # 1. Lifecycle Check
            if not self.lifecycle.should_run(rule):
                continue
                
            rule_id = rule.id
            if rule_id not in self.metrics:
                self.metrics[rule_id] = {"calls": 0, "hits": 0, "time_ns": 0, "errors": 0}
            
            self.metrics[rule_id]["calls"] += 1
            
            start_time = time.time_ns()
            match_details = None
            
            try:
                # 2. Execute Rule
                match_details = rule.evaluate(diff_data, signals)
            except Exception:
                self.metrics[rule_id]["errors"] += 1
            finally:
                duration = time.time_ns() - start_time
                self.metrics[rule_id]["time_ns"] += duration
            
            if match_details:
                # 3. Suppress Check (TODO)
                # if self.suppress.is_suppressed(rule_id, match_details): continue
                
                self.metrics[rule_id]["hits"] += 1
                
                # 4. Severity Adjustment
                severity = self.lifecycle.adjust_severity(rule, rule.severity)
                
                findings.append({
                    "id": rule.id,
                    "severity": severity,
                    "impact": rule.impact,
                    "rationale": rule.rationale,
                    "matched_file": match_details.get('file', 'unknown')
                })
                
        return findings
    
    def get_metrics(self) -> Dict[str, Any]:
        return self.metrics
