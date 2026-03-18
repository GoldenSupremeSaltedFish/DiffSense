# JS CVE 规则生成与集成测试

## 概述

- **数据源**：GitHub Advisory Database（`github/advisory-database`），clone 后按 `ecosystem=npm` 与发布时间（近一年）筛选，转为 PROrule 单条 YAML 写入 `pro-rules/cve/JavaScript`。
- **转换器**：`diffsense/converters/js_cve_converter.py`，输出与 Java 单条规则一致的 schema（id、language、severity、package、patterns 等），可被规则引擎直接加载。
- **集成测试**：`tests/test_js_cve_integration.py` 使用 fixture 校验 `language=javascript` 被正确识别；可选环境变量跑完整 pro-rules 校验。

## 1. 生成近一年 JS CVE 规则

在 **DiffSense 根目录** 执行：

```bash
cd DiffSense
python scripts/fetch_js_cve_from_advisory_db.py
```

- 若本地没有 `advisory-database`，脚本会尝试 `git clone https://github.com/github/advisory-database.git` 到当前目录；若 clone 失败或需代理，可先手动 clone 后指定路径：
  ```bash
  python scripts/fetch_js_cve_from_advisory_db.py --advisory-db /path/to/advisory-database
  ```
- 输出目录默认：`pro-rules/cve/JavaScript`（可通过 `--output-dir` 覆盖）。
- 时间范围默认近 12 个月（`--months 12`），可改。

## 2. 集成测试

- **仅 fixture（不依赖 pro-rules 目录）**：
  ```bash
  python tests/test_js_cve_integration.py
  ```
  或：
  ```bash
  pytest tests/test_js_cve_integration.py -v
  ```

- **完整 pro-rules 校验**（需已生成 `pro-rules/cve/JavaScript`）：
  ```bash
  set DIFFSENSE_FULL_PRO_RULES_TEST=1
  pytest tests/test_js_cve_integration.py -v
  ```

## 3. 规则 ID 与加载

- JS CVE 规则 ID 格式：`prorule.javascript.<severity>.<ghsa_slug>`（如 `prorule.javascript.high.ghsa_xxxx_xxxx`）。
- 规则引擎会递归加载 `pro-rules/cve/`，故 `cve/JavaScript/*.yaml` 会被加载，且 `language=javascript` 用于按语言识别。

## 4. 相关文件

| 文件 | 说明 |
|------|------|
| `scripts/fetch_js_cve_from_advisory_db.py` | 从 advisory-database 拉取近 N 月 npm 公告并转为 YAML |
| `diffsense/converters/js_cve_converter.py` | GHSA/旧版 CVE 转单条 PROrule YAML |
| `tests/fixtures/pro_rules_js_sample/` | 集成测试用 JS 规则 fixture |
| `tests/test_js_cve_integration.py` | JS CVE 集成测试入口 |
