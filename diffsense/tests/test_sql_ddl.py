"""Batch C: SQL script / DM DDL diff analysis tests."""

from diffsense.core.sql_detector import SQLDetector, is_sql_script
from diffsense.core.ast_detector import ASTDetector
from diffsense.core.change import ChangeKind


def _patch(added_lines):
    """Build a unified-diff-like patch payload from added lines."""
    return "--- a/test.sql\n+++ b/test.sql\n" + "".join("+" + line + "\n" for line in added_lines)


def test_drop_table_is_detected():
    changes = SQLDetector().detect_changes("a.sql", _patch(["DROP TABLE user_account;"]))
    assert len(changes) == 1
    assert changes[0].symbol == "sql_destructive_ddl"
    assert changes[0].kind == ChangeKind.CALL_ADDED


def test_truncate_is_detected():
    changes = SQLDetector().detect_changes("a.sql", _patch(["TRUNCATE TABLE audit_log;"]))
    assert len(changes) == 1
    assert changes[0].symbol == "sql_destructive_ddl"


def test_alter_drop_column_is_detected():
    changes = SQLDetector().detect_changes("a.sql", _patch(["ALTER TABLE t_user DROP COLUMN id_card;"]))
    assert len(changes) == 1
    assert changes[0].symbol == "sql_destructive_ddl"


def test_drop_index_and_view_detected():
    changes = SQLDetector().detect_changes("a.sql", _patch(["DROP INDEX idx_order_no;", "DROP VIEW v_order;"]))
    assert len(changes) == 2
    assert all(c.symbol == "sql_destructive_ddl" for c in changes)


def test_delete_without_where_is_warning():
    changes = SQLDetector().detect_changes("a.sql", _patch(["DELETE FROM t_order;"]))
    assert len(changes) == 1
    assert changes[0].symbol == "sql_unconditional_mutation"


def test_update_without_where_is_warning():
    changes = SQLDetector().detect_changes("a.sql", _patch(["UPDATE t_order SET status = 1;"]))
    assert len(changes) == 1
    assert changes[0].symbol == "sql_unconditional_mutation"


def test_safe_statements_not_detected():
    changes = SQLDetector().detect_changes(
        "a.sql",
        _patch([
            "CREATE TABLE t_user (id INT);",
            "DELETE FROM t_order WHERE id = 1;",
            "UPDATE t_order SET status = 1 WHERE id = 2;",
            "INSERT INTO t_log VALUES (1);",
            "-- DROP TABLE comment_only;",
        ]),
    )
    assert changes == []


def test_context_lines_ignored():
    patch = "--- a/test.sql\n+++ b/test.sql\n DROP TABLE legacy_table;\n+DROP TABLE new_table;\n"
    changes = SQLDetector().detect_changes("a.sql", patch)
    assert len(changes) == 1
    assert "new_table" in changes[0].after


def test_ast_detector_routes_sql_files():
    detector = ASTDetector()
    diff_data = {
        "file_patches": [
            {"file": "sql/dm/schema.sql", "patch": _patch(["DROP TABLE IF EXISTS t_x;"])}
        ]
    }
    changes = detector.detect_changes(diff_data)
    assert any(c.symbol == "sql_destructive_ddl" for c in changes)


def test_is_sql_script():
    assert is_sql_script("sql/init.sql")
    assert is_sql_script("SCRIPT.SQL")
    assert not is_sql_script("init.txt")