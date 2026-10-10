"""
批次 B: MyBatis XML Mapper 分析
- ${...} 字符串插值在新增行出现 -> security.mybatis_string_interpolation (warning, 非阻断)
- #{...} 预编译参数 -> 不报
- 上下文行(非本次新增)中的 ${...} -> 不报
- 非 Mapper 的普通 XML -> 不报
"""
import unittest

from diffsense.core.ast_detector import ASTDetector
from diffsense.core.attribution import SUPPORTED_EXTENSIONS, is_analyzable, supported_files
from diffsense.core.parser import DiffParser
from diffsense.core.rules import RuleEngine
from diffsense.tests.regression_helpers import get_rules_path


def _evaluate(diff_content: str):
    parser = DiffParser()
    diff_data = parser.parse(diff_content)
    detector = ASTDetector()
    signals = detector.detect_signals(diff_data)
    engine = RuleEngine(get_rules_path())
    return diff_data, signals, engine.evaluate(diff_data, signals)


def _mapper_diff(added_lines, context_lines=None):
    ctx = "\n".join(" " + ln for ln in (context_lines or []))
    adds = "\n".join("+ " + ln for ln in added_lines)
    return f"""diff --git a/src/main/resources/mapper/ProjectStatisticsMapper.xml b/src/main/resources/mapper/ProjectStatisticsMapper.xml
index aaaaaaa..bbbbbbb 100644
--- a/src/main/resources/mapper/ProjectStatisticsMapper.xml
+++ b/src/main/resources/mapper/ProjectStatisticsMapper.xml
@@ -15,6 +15,8 @@
{ctx}
{adds}
</mapper>
"""


class TestMyBatisXML(unittest.TestCase):
    def _triggered_ids(self, added_lines, context_lines=None):
        return [r["id"] for r in _evaluate(_mapper_diff(added_lines, context_lines))[2]]

    def test_interpolation_added_flagged_warning(self):
        ids = self._triggered_ids([
            '<select id="findByName" resultType="User">',
            '  SELECT * FROM user WHERE name = \'${name}\'',
            "</select>",
        ])
        self.assertIn("security.mybatis_string_interpolation", ids)
        # should be warning severity, not critical/blocking
        triggered = _evaluate(_mapper_diff([
            '<select id="findByName" resultType="User">',
            '  SELECT * FROM user WHERE name = \'${name}\'',
            "</select>",
        ]))[2]
        rule = next(r for r in triggered if r.get("id") == "security.mybatis_string_interpolation")
        self.assertEqual(rule.get("severity"), "warning")
        self.assertFalse(rule.get("is_blocking", False))

    def test_prepared_parameter_not_flagged(self):
        ids = self._triggered_ids([
            '<select id="findByName" resultType="User">',
            "  SELECT * FROM user WHERE name = #{name}",
            "</select>",
        ])
        self.assertNotIn("security.mybatis_string_interpolation", ids)

    def test_context_only_interpolation_not_flagged(self):
        # ${...} exists only on a context line (unchanged), not added -> no signal
        ids = self._triggered_ids(
            ['<select id="findById" resultType="User">'],
            context_lines=['  SELECT * FROM user WHERE id = ${id}'],
        )
        self.assertNotIn("security.mybatis_string_interpolation", ids)

    def test_non_mapper_xml_not_flagged(self):
        diff = """diff --git a/pom.xml b/pom.xml
index ccccccc..ddddddd 100644
--- a/pom.xml
+++ b/pom.xml
@@ -10,3 +10,4 @@
 <project>
   <groupId>com.example</groupId>
+  <version>1.1.0</version>
 </project>
"""
        _, _, triggered = _evaluate(diff)
        self.assertNotIn("security.mybatis_string_interpolation", [r["id"] for r in triggered])

    def test_xml_is_analyzable_for_attribution(self):
        self.assertIn(".xml", SUPPORTED_EXTENSIONS)
        self.assertTrue(is_analyzable("mapper/ProjectStatisticsMapper.xml"))
        diff_data, _, _ = _evaluate(_mapper_diff([
            '<select id="findByName" resultType="User">',
            "  SELECT * FROM user WHERE name = #{name}",
            "</select>",
        ]))
        self.assertIn("src/main/resources/mapper/ProjectStatisticsMapper.xml", supported_files(diff_data))


if __name__ == "__main__":
    unittest.main()