"""Finding attribution helpers.

Rules that scan the whole raw diff (cross-file regex rules) must attribute a
finding to the concrete file whose hunk actually matched. This module anchors
findings to real hunks and never attributes to files that the AST/semantic
layer skips (unsupported extensions).
"""

import os
import re
from typing import Any, Dict, Iterable, List, Optional, Union

# Must stay in sync with ASTDetector's supported languages.
SUPPORTED_EXTENSIONS = frozenset({
    ".java", ".py", ".cpp", ".cc", ".cxx", ".c", ".h", ".hpp",
    ".js", ".jsx", ".ts", ".tsx",
})

_Patterns = Union[re.Pattern, Iterable[re.Pattern], None]


def _extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower() if "." in filename else ""


def is_analyzable(filename: str) -> bool:
    """True when the file extension is one the semantic layer actually analyzes."""
    return _extension(filename) in SUPPORTED_EXTENSIONS


def supported_files(diff_data: Dict[str, Any]) -> List[str]:
    """Analyzable files in the diff, in diff order, deduplicated.

    Uses ``file_patches`` (per-hunk patches) when available, else falls back to
    the flat ``files`` list.
    """
    result: List[str] = []
    seen = set()
    patches = diff_data.get("file_patches") or []
    candidates: Iterable[str]
    if patches:
        candidates = (p.get("file") or "" for p in patches)
    else:
        candidates = diff_data.get("files") or []
    for f in candidates:
        if f and f not in seen and is_analyzable(f):
            seen.add(f)
            result.append(f)
    return result


def file_containing(diff_data: Dict[str, Any], patterns: _Patterns) -> Optional[str]:
    """First analyzable file whose hunk patch matches any of the regex patterns.

    Matching is done against the per-file patch text (``file_patches`` entries),
    so the anchored file is the one whose hunk actually triggered the rule.
    """
    if isinstance(patterns, re.Pattern):
        patterns = [patterns]
    patterns = [p for p in (patterns or []) if p is not None]
    if not patterns:
        return None
    patches = diff_data.get("file_patches") or []
    for p in patches:
        f = p.get("file") or ""
        if not is_analyzable(f):
            continue
        patch_text = p.get("patch") or ""
        for pat in patterns:
            if pat.search(patch_text):
                return f
    return None


def anchor_file(diff_data: Dict[str, Any], patterns: _Patterns = None) -> str:
    """Choose the attribution file for a raw-diff rule.

    Prefers the analyzable file whose hunk actually matched the rule pattern;
    falls back to the first analyzable file in the diff; only then to
    ``"unknown"``. Never returns a Skipping (unsupported) file.
    """
    f = file_containing(diff_data, patterns)
    if f:
        return f
    supported = supported_files(diff_data)
    if supported:
        return supported[0]
    return "unknown"
