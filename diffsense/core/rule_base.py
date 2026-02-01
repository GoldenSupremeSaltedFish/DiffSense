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
