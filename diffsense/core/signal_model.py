from dataclasses import dataclass, field
from typing import Optional, Dict, Any

@dataclass
class Signal:
    id: str
    file: str
    confidence: float = 1.0
    meta: Dict[str, Any] = field(default_factory=dict)
    action: str = "added"  # "added" or "removed"
    
    def to_dict(self):
        return {
            "signal_id": self.id,
            "file": self.file,
            "confidence": self.confidence,
            "meta": self.meta,
            "action": self.action
        }
