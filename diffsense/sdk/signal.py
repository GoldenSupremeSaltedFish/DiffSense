from dataclasses import dataclass
from typing import Dict, Any, Optional

@dataclass
class Signal:
    """
    Represents a semantic signal extracted from the diff.
    Rules consume Signals, they do not parse code.
    """
    id: str                 # e.g., "runtime.concurrency.lock"
    file: str               # File path where signal was found
    line: Optional[int]     # Line number (if available)
    action: str             # "added", "removed", "changed"
    meta: Dict[str, Any]    # Additional context (e.g., variable name, type info)
