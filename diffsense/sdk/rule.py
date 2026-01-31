from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from sdk.signal import Signal

class BaseRule(ABC):
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
    
    @property
    def status(self) -> str:
        """Lifecycle status: experimental, beta, stable, deprecated, disabled"""
        return "experimental"

    @abstractmethod
    def evaluate(self, diff_data: Dict[str, Any], signals: List[Signal]) -> Optional[Dict[str, Any]]:
        """
        Execute the rule logic against the diff and signals.
        
        Args:
            diff_data: The raw diff parsing result (Legacy support, prefer signals)
            signals: List of Semantic Signals detected
            
        Returns:
            Dict with match details (must contain 'file' key) if matched,
            None if not matched.
        """
        pass
