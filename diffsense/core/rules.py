import os
import yaml
import time
from typing import Dict, List, Any, Tuple, Optional
from core.rule_base import Rule

try:
    from importlib.metadata import entry_points
except ImportError:
    entry_points = None  # type: ignore
from core.ignore_manager import IgnoreManager
from rules.concurrency import (
    ThreadPoolSemanticChangeRule,
    ConcurrencyRegressionRule,
    ThreadSafetyRemovalRule,
    LatchMisuseRule
)
from rules.yaml_adapter import YamlRule

class RuleEngine:
    def __init__(self, rules_path: str, profile: Optional[str] = None):
        self.rules: List[Rule] = []
        self.metrics: Dict[str, Dict[str, Any]] = {} # id -> {calls, hits, time_ns, errors}
        self.ignore_manager = IgnoreManager()
        self.profile = profile

        # 1. Register Built-in Rules (Plugins)
        self._register_builtins()

        # 2. Load YAML Rules (Plugins)
        self._load_yaml_rules(rules_path)

        # 3. Load rules from pip-installed packages (entry point group: diffsense.rules)
        self._load_entry_point_rules()

        # 4. Apply profile filter (lightweight = only critical; strict/None = all)
        if profile == "lightweight":
            self.rules = [r for r in self.rules if getattr(r, 'enabled', True) and getattr(r, 'severity', '') == "critical"]

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
        Loads YAML rules from a single file or a directory of .yaml files.
        If path is a directory, loads all .yaml files in that directory (one level, no recursion).
        Each file must have top-level 'rules: [...]'. Load order is deterministic (sorted by name).
        """
        if os.path.isdir(path):
            files = sorted(f for f in os.listdir(path) if f.endswith('.yaml'))
            for name in files:
                file_path = os.path.join(path, name)
                self._load_yaml_file(file_path)
        else:
            self._load_yaml_file(path)

    def _load_yaml_file(self, path: str):
        """Loads a single YAML file with top-level 'rules: [...]'."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}
                raw_rules = data.get('rules', [])
                for r in raw_rules:
                    self.rules.append(YamlRule(r))
        except FileNotFoundError:
            pass

    def _load_entry_point_rules(self):
        """
        Discovers and loads rules from packages that register under entry point group 'diffsense.rules'.
        Each entry point must be a callable returning either List[Rule] or a str path (file or directory).
        Failures in a single plugin are caught so one bad package does not break the engine.
        """
        if entry_points is None:
            return
        try:
            eps = entry_points(group="diffsense.rules")
        except TypeError:
            # Python < 3.10: entry_points() takes no keyword argument
            eps = entry_points().get("diffsense.rules", [])
        for ep in eps:
            try:
                fn = ep.load()
                result = fn()
                if isinstance(result, list):
                    for r in result:
                        if isinstance(r, Rule) and getattr(r, 'enabled', True):
                            self.rules.append(r)
                elif isinstance(result, str) and result:
                    self._load_yaml_rules(result)
            except Exception:
                pass  # skip broken plugin

    def evaluate(self, diff_data: Dict[str, Any], ast_signals: List[Any] = None) -> List[Dict[str, Any]]:
        """
        Evaluates all registered rules against the diff.
        """
        triggered_rules = []
        ast_signals = ast_signals or []
        
        for rule in self.rules:
            if not getattr(rule, 'enabled', True):
                continue
            rule_id = rule.id
            if rule_id not in self.metrics:
                self.metrics[rule_id] = {"calls": 0, "hits": 0, "time_ns": 0, "errors": 0}
            
            self.metrics[rule_id]["calls"] += 1
            
            start_time = time.time_ns()
            match_details = None
            
            try:
                # Execute Rule (Plugin)
                match_details = rule.evaluate(diff_data, ast_signals)
                
                # Check Ignore Manager
                if match_details:
                    matched_file = match_details.get('file', 'unknown')
                    if self.ignore_manager.is_ignored(rule_id, matched_file):
                        match_details = None # Suppress

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
