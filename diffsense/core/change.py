from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from enum import Enum

class ChangeKind(Enum):
    TYPE_CHANGED = "TYPE_CHANGED"
    MODIFIER_REMOVED = "MODIFIER_REMOVED"
    MODIFIER_ADDED = "MODIFIER_ADDED"
    CALL_REMOVED = "CALL_REMOVED"
    CALL_ADDED = "CALL_ADDED"
    FIELD_REMOVED = "FIELD_REMOVED"
    FIELD_ADDED = "FIELD_ADDED"
    ANNOTATION_REMOVED = "ANNOTATION_REMOVED"
    ANNOTATION_ADDED = "ANNOTATION_ADDED"
    OBJECT_CREATION = "OBJECT_CREATION"
    # Fallback/Generic
    UNKNOWN = "UNKNOWN"

@dataclass
class Change:
    kind: ChangeKind
    file: str
    symbol: str  # The identifier (variable name, method name, etc.)
    
    # Semantic values (not just raw strings if possible, but strings are fine for now)
    before: Optional[Any] = None
    after: Optional[Any] = None
    
    # Location info
    line_no: Optional[int] = None
    
    # Extra context
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self):
        return {
            "kind": self.kind.value,
            "file": self.file,
            "symbol": self.symbol,
            "before": self.before,
            "after": self.after,
            "meta": self.meta
        }
