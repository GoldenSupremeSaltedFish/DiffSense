"""MyBatis XML Mapper detection (batch B).

DiffSense previously skipped all ``.xml`` files (ProjectStatisticsMapper.xml +1377
lines went fully unanalyzed). This module gives Mapper XMLs first-class diff
coverage:

- reports ``${...}`` string interpolation added in the patch (inline SQL, not
  precompiled; the classic MyBatis injection surface);
- ignores ``#{...}`` prepared parameters (safe by design);
- only reports interpolations on *added* lines so the signal reflects a change
  introduced by the diff, never pre-existing context.

The rule is emitted at warning severity (no taint judgement yet); this avoids
inflating severity for legit ${}-uses (table names, ORDER BY) while flagging the
surface for human review.
"""

import re
from typing import List

from .change import Change, ChangeKind

# Mapper elements that carry SQL text.
_SQL_TAG_RE = re.compile(
    r"<\s*(select|insert|update|delete|sql)\b[^>]*>", re.IGNORECASE | re.DOTALL
)
# ${...} string interpolation (not precompiled).
_INTERPOLATION_RE = re.compile(r"\$\{\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?\s*\}")


class MyBatisXMLDetector:
    """Detect risky MyBatis Mapper SQL changes inside an XML patch."""

    def detect_changes(self, filename: str, patch_content: str) -> List[Change]:
        changes: List[Change] = []

        # Only bother when the file is actually a Mapper (contains SQL elements).
        if not _SQL_TAG_RE.search(patch_content):
            return changes

        added_line_no = 0
        for raw_line in patch_content.splitlines():
            if raw_line.startswith("+++") or raw_line.startswith("---"):
                continue
            if raw_line.startswith("+"):
                added_line_no += 1
                body = raw_line[1:].strip()
                for match in _INTERPOLATION_RE.finditer(body):
                    changes.append(
                        Change(
                            kind=ChangeKind.CALL_ADDED,
                            file=filename,
                            symbol="mybatis_interpolation",
                            before=None,
                            after=match.group(0),
                            meta={
                                "mybatis": True,
                                "interpolation": match.group(0),
                                "action": "added",
                            },
                            line_no=added_line_no,
                        )
                    )
            elif raw_line.startswith("-"):
                continue
            else:
                # Context lines carry line numbers in unified diff (@@ -a,b +c,d @@
                # headers too); we only need an approximate counter for + lines.
                continue

        return changes


def is_mybatis_xml(filename: str) -> bool:
    """True for .xml files (Mapper candidates are resolved on patch content)."""
    return filename.lower().endswith(".xml")