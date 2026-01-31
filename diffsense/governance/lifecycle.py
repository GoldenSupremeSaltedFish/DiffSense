from enum import Enum
from typing import Dict, Any

class RuleStatus(Enum):
    EXPERIMENTAL = "experimental"
    BETA = "beta"
    STABLE = "stable"
    DEPRECATED = "deprecated"
    DISABLED = "disabled"

class LifecycleManager:
    """
    Manages the lifecycle of rules.
    Decides if a rule should run based on its status and configuration.
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        # Default policy: Run everything except DISABLED
        self.min_status = RuleStatus.EXPERIMENTAL 

    def should_run(self, rule) -> bool:
        """
        Determines if a rule should be executed.
        """
        status_str = getattr(rule, 'status', 'experimental').lower()
        
        # Check explicit config override
        # rules:
        #   my.rule.id:
        #     enabled: false
        rule_config = self.config.get(rule.id, {})
        if rule_config.get('enabled') is False:
            return False
            
        try:
            status = RuleStatus(status_str)
        except ValueError:
            status = RuleStatus.EXPERIMENTAL
            
        if status == RuleStatus.DISABLED:
            return False
            
        return True

    def adjust_severity(self, rule, original_severity: str) -> str:
        """
        Adjust severity based on lifecycle (e.g. DEPRECATED rules might be downgraded).
        """
        status_str = getattr(rule, 'status', 'experimental').lower()
        if status_str == "deprecated":
            return "low" # Deprecated rules are always low severity
            
        return original_severity
