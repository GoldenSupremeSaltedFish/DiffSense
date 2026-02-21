from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List

class Rule(ABC):
    """
    Abstract Base Class for all DiffSense Rules.
    This defines the Plugin Interface (SDK).
    """

    @property
    @abstractmethod
    def id(self) -> str:
        """Unique Rule ID (e.g., 'runtime.concurrency.lock_removed')"""
        pass

    @property
    @abstractmethod
    def severity(self) -> str:
        """Severity level: critical, high, medium, low"""
        pass

    @property
    @abstractmethod
    def impact(self) -> str:
        """Impact dimension: security, runtime, data, maintenance"""
        pass

    @property
    @abstractmethod
    def rationale(self) -> str:
        """Explanation of why this rule exists and what risk it prevents"""
        pass

    # Optional metadata (defaults for built-in rules; YamlRule overrides from YAML)
    @property
    def category(self) -> str:
        """Rule category: concurrency, performance, reliability, security, general"""
        return "general"

    @property
    def confidence(self) -> float:
        """Confidence score 0.0-1.0"""
        return 1.0

    @property
    def tags(self) -> List[str]:
        """Optional tags for filtering"""
        return []

    @property
    def enabled(self) -> bool:
        """Whether this rule is enabled (engine skips if False)"""
        return True

    @property
    def language(self) -> str:
        """Language scope: * for all, or java, go, js, etc."""
        return "*"

    @property
    def scope(self) -> str:
        """File scope pattern (e.g. ** or **/core/**)"""
        return "**"

    @abstractmethod
    def evaluate(self, diff_data: Dict[str, Any], ast_signals: List[Any]) -> Optional[Dict[str, Any]]:
        """
        Execute the rule logic against the diff and signals.
        
        Args:
            diff_data: The raw diff parsing result
            ast_signals: List of AST signals detected by ASTDetector
            
        Returns:
            Dict with match details (must contain 'file' key) if matched,
            None if not matched.
        """
        pass
