# DiffSense Pro 规则与工程化检查报告

## 一、Pro 规则集（pro-rules）检查

### 1.1 层级与文档

| 项 | 状态 | 说明 |
|----|------|------|
| 层级文档 | ✅ | `pro-rules/RULE_HIERARCHY.md` 已说明领域（critical/high/runtime/security/data/performance）、ID 约定、根目录与 cve/java 的加载关系 |
| 参数化文档 | ✅ | `README_parameterized_rules.md` 含用法、正式运行加载顺序（DIFFSENSE_PRO_RULES / .diffsense.yaml / 默认） |
| 根目录聚合 YAML | ✅ | concurrency、critical_cves、security_high、data_integrity、performance、security 等，引擎按 `rules: [...]` 加载 |
| 按语言 CVE | ✅ | `cve/java`、`cve/JavaScript` 下单条规则会被加载并带 `language`，供按语言识别；根下 java/go/python 不递归以控制规模 |

### 1.2 加载与集成

| 项 | 状态 | 说明 |
|----|------|------|
| 引擎加载 | ✅ | `RuleEngine(pro_rules_path=...)`，且 `_load_yaml_rules(..., skip_single_rule_subdirs=True)` 仅跳过根下 java/go/python，不跳过 cve |
| 单条规则兼容 | ✅ | `_load_yaml_file` 支持无 `rules` 但有 `id` 的 YAML，经 `_single_rule_to_engine_format` 转成引擎格式并保留 `language` |
| 正式入口 | ✅ | `run_audit`、`main`、`cli`（audit / replay / rules list / profile-rules / benchmark）均通过 `get_pro_rules_path()` 解析并传入 `pro_rules_path` |
| 解析优先级 | ✅ | 环境变量 `DIFFSENSE_PRO_RULES` → `.diffsense.yaml` 的 `pro_rules_path` → 与 diffsense 包同级的 `pro-rules`，仅当路径存在且为目录时加载 |

### 1.3 版本与仓库

| 项 | 状态 | 说明 |
|----|------|------|
| .gitignore | ✅ | `DiffSense/.gitignore` 已包含 `pro-rules/`，规则集不进入版本库 |
| 配置与代码一致性 | ⚠️ | `diffsense.config.json` 中有 `rulesets.pro` 等，当前正式加载走 `get_pro_rules_path()` 与 `pro_rules_path` 参数，未读该 JSON；若需统一可后续让 run_config 或 CLI 读取该文件 |

---

## 二、工程化程度检查

### 2.1 测试

| 项 | 状态 | 说明 |
|----|------|------|
| 回归主入口 | ✅ | `diffsense/tests/test_regression.py` 按 manifest 驱动全量回归 |
| 包内单元/行为测 | ✅ | `diffsense/tests/` 下 profile、cache、lifecycle、entry_point、critical_removal、semantic_regression 等 |
| 项目级集成 | ✅ | `tests/` 下 `test_pro_rules_language_integration.py`（pro 规则按语言）、C++ 回归、parsers/go、parsers/js |
| 临时脚本清理 | ✅ | 根目录重复的 rule_separation/pro_rules/param 等 18 个 test_*.py 已删除，见 `tests/README.md` |

### 2.2 CI

| 项 | 状态 | 说明 |
|----|------|------|
| 根仓库 CI | ✅ | `.github/workflows/build.yaml`：Python 3.10、`pip install -e diffsense[dev]`、`pytest diffsense/tests/` |
| 包内 CI | ✅ | `diffsense/.github/workflows/test.yml`：回归 + cache + ignore 等，`pytest tests/test_regression.py tests/test_cache_and_scheduling.py tests/test_repo_ignore.py` |
| 集成测试入 CI | ⚠️ | 根 build 只跑 `diffsense/tests/`，未跑顶层 `tests/`（如 test_pro_rules_language_integration）；可增加一步 `pytest tests/ -v` 或单独 job（pro-rules 为可选目录时跳过需 pro-rules 的用例） |

### 2.3 依赖与包

| 项 | 状态 | 说明 |
|----|------|------|
| 包定义 | ✅ | `diffsense/pyproject.toml`：requires-python >=3.10，依赖 PyYAML/typer 等，dev 含 pytest |
| 入口 | ✅ | `diffsense = "cli:app"`，CLI 与 run_audit/main 均接入 pro_rules_path |

### 2.4 文档与配置

| 项 | 状态 | 说明 |
|----|------|------|
| 主 README | ✅ | 快速开始、GitHub/GitLab、VSCode、项目结构 |
| 规则与配置 | ✅ | `diffsense/docs/` 下 quickstart、rule-quickstart、signals、recommended-config 等；`.diffsense.yaml` 推荐配置 |
| run_config | ✅ | `core.run_config` 提供 `get_run_config()`、`get_pro_rules_path()`，与 CLI/主流程一致 |

---

## 三、建议（可选）

1. **CI 中跑顶层集成测试**：在根 `.github/workflows/build.yaml` 的 test 步骤中增加 `pytest tests/ -v`（或仅 `tests/test_pro_rules_language_integration.py`），pro-rules 目录不存在时现有 fixture 测试仍可过。
2. **diffsense.config.json**：若希望“规则集配置”单一来源，可让 `get_pro_rules_path()` 在无 env/无 .diffsense.yaml 时读取该 JSON 的 `rulesets.pro` 或新增字段 `pro_rules_path`，与当前逻辑合并即可。
3. **pro-rules 占位说明**：因 pro-rules 已 gitignore，可在仓库中保留 `pro-rules/README.md`（用 `!pro-rules/README.md` 取消忽略）说明如何获取或生成规则集，便于新人与 CI 理解。

---

*检查基准：当前 DiffSense 代码与文档；pro-rules 以“存在则加载、不存在则跳过”为前提。*
