"""
批次 D: SQL 注入污点判断
- 数值型拼接 (Long/parseLong/数字字面量) -> security.sql_injection_numeric (warning)
- 用户可控字符串 (request.getParameter / String 变量) -> security.sql_injection (critical, 不变)
- 无法判定来源 -> 保守保持 critical
"""
import unittest

from diffsense.core.ast_detector import ASTDetector
from diffsense.core.parser import DiffParser
from diffsense.core.rules import RuleEngine
from diffsense.tests.regression_helpers import get_rules_path


def _evaluate(diff_content: str):
    parser = DiffParser()
    diff_data = parser.parse(diff_content)
    detector = ASTDetector()
    signals = detector.detect_signals(diff_data)
    engine = RuleEngine(get_rules_path())
    return engine.evaluate(diff_data, signals)


_HUNK_HEADER = """diff --git a/src/UserDao.java b/src/UserDao.java
index 1234567..890abcd 100644
--- a/src/UserDao.java
+++ b/src/UserDao.java
@@ -10,7 +10,7 @@ public class UserDao {
"""


class TestSqlInjectionTaint(unittest.TestCase):
    def _triggered_ids(self, added_lines):
        diff = _HUNK_HEADER + "\n".join("+ " + ln for ln in added_lines) + "\n"
        return [r["id"] for r in _evaluate(diff)]

    def test_long_param_concat_downgraded_to_warning(self):
        ids = self._triggered_ids([
            "public List<User> findById(Long id) {",
            '    String sql = "SELECT * FROM user WHERE id = " + id;',
            "    return mapper.query(sql);",
            "}",
        ])
        self.assertIn("security.sql_injection_numeric", ids)
        self.assertNotIn("security.sql_injection", ids)

    def test_parse_long_concat_downgraded_to_warning(self):
        ids = self._triggered_ids([
            "public User find(String raw) {",
            '    String sql = "SELECT * FROM user WHERE id = " + Long.parseLong(raw);',
            "    return mapper.query(sql);",
            "}",
        ])
        self.assertIn("security.sql_injection_numeric", ids)
        self.assertNotIn("security.sql_injection", ids)

    def test_numeric_literal_concat_downgraded_to_warning(self):
        ids = self._triggered_ids([
            "public String paginate() {",
            '    String sql = "SELECT * FROM user LIMIT " + 100;',
            "    return sql;",
            "}",
        ])
        self.assertIn("security.sql_injection_numeric", ids)
        self.assertNotIn("security.sql_injection", ids)

    def test_string_literal_only_concat_not_critical(self):
        ids = self._triggered_ids([
            "public String constantQuery() {",
            '    String sql = "SELECT * FROM user WHERE status = " + "1";',
            "    return sql;",
            "}",
        ])
        self.assertNotIn("security.sql_injection", ids)

    def test_request_parameter_concat_stays_critical(self):
        ids = self._triggered_ids([
            "public List<User> search(HttpServletRequest request) {",
            '    String name = request.getParameter("name");',
            '    String sql = "SELECT * FROM user WHERE name = " + name;',
            "    return mapper.query(sql);",
            "}",
        ])
        self.assertIn("security.sql_injection", ids)
        self.assertNotIn("security.sql_injection_numeric", ids)

    def test_string_variable_concat_stays_critical(self):
        ids = self._triggered_ids([
            "public List<User> byName(String name) {",
            '    String sql = "SELECT * FROM user WHERE name = " + name;',
            "    return mapper.query(sql);",
            "}",
        ])
        self.assertIn("security.sql_injection", ids)
        self.assertNotIn("security.sql_injection_numeric", ids)

    def test_unresolved_variable_concat_stays_critical(self):
        ids = self._triggered_ids([
            "public List<User> anything() {",
            '    String sql = "SELECT * FROM user WHERE id = " + userId;',
            "    return mapper.query(sql);",
            "}",
        ])
        # Cannot prove userId numeric -> conservative CRITICAL
        self.assertIn("security.sql_injection", ids)

    def test_non_sql_context_concat_not_flagged(self):
        ids = self._triggered_ids([
            "public int sum(int a, int b) {",
            "    return a + b;",
            "}",
        ])
        self.assertNotIn("security.sql_injection", ids)
        self.assertNotIn("security.sql_injection_numeric", ids)


if __name__ == "__main__":
    unittest.main()