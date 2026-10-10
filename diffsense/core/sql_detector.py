"""SQL script analysis (batch C).

DiffSense previously skipped all ``*.sql`` files (e.g. ``sql/*.sql`` DM (达梦)
DDL scripts), leaving destructive schema changes invisible to review. This
module gives SQL scripts diff-aware coverage:

- destructive DDL added in the patch (``DROP TABLE``, ``TRUNCATE``, ``DROP INDEX``,
  ``DROP VIEW``, ``ALTER TABLE ... DROP COLUMN``) -> CRITICAL/blocking;
- unconditional mutations added (``DELETE FROM`` / ``UPDATE`` without ``WHERE``) ->
  WARNING, since a full-table mutation is risky but may be an intended reset.

Only *added* lines are reported so the signal reflects a change introduced by the
diff, never pre-existing script content. Statement terminators are ignored; the
detection is line-based so it tolerates DM dialect details like ``STORAGE(...)``.
"""

import re
from typing import List

from .change import Change, ChangeKind

# Destructive DDL start patterns. `(?:...DB )?` tolerates `DROP TABLE IF EXISTS`.
_DESTRUCTIVE_DDL_RE = re.compile(
    r"^\s*(DROP\s+(?:TABLE|VIEW|INDEX|SEQUENCE|TRIGGER|PROCEDURE|FUNCTION|SYNONYM|TYPE)|TRUNCATE\s+(?:TABLE\s+)?|ALTER\s+TABLE\b[^;]*\bDROP\s+(?:COLUMN\s+)?)",
    re.IGNORECASE,
)

# Unconditional mutation start patterns (no WHERE clause).
_UNCONDITIONAL_MUTATION_RE = re.compile(
    r"^\s*(DELETE\s+FROM|UPDATE\b)[^;]*;?\s*$",
    re.IGNORECASE,
)
_HAS_WHERE_RE = re.compile(r"\bWHERE\b", re.IGNORECASE)


class SQLDetector:
    """Detect risky statement changes inside an SQL script patch."""

    def detect_changes(self, filename: str, patch_content: str) -> List[Change]:
        changes: List[Change] = []
        added_line_no = 0
        for raw_line in patch_content.splitlines():
            if raw_line.startswith("+++") or raw_line.startswith("---"):
                continue
            if not raw_line.startswith("+"):
                continue
            added_line_no += 1
            body = raw_line[1:].strip()
            if not body or body.startswith("--") or body.startswith("/*"):
                continue
            if _DESTRUCTIVE_DDL_RE.match(body):
                changes.append(
                    Change(
                        kind=ChangeKind.CALL_ADDED,
                        file=filename,
                        symbol="sql_destructive_ddl",
                        before=None,
                        after=body,
                        meta={"sql": True, "statement": body, "action": "added"},
                        line_no=added_line_no,
                    )
                )
            elif _UNCONDITIONAL_MUTATION_RE.match(body) and not _HAS_WHERE_RE.search(body):
                changes.append(
                    Change(
                        kind=ChangeKind.CALL_ADDED,
                        file=filename,
                        symbol="sql_unconditional_mutation",
                        before=None,
                        after=body,
                        meta={"sql": True, "statement": body, "action": "added"},
                        line_no=added_line_no,
                    )
                )
        return changes


def is_sql_script(filename: str) -> bool:
    return filename.lower().endswith(".sql")