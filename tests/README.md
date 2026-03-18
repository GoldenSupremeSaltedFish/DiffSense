# DiffSense 测试说明

## 保留的测试（以回归与集成为主）

- **`diffsense/tests/`**（包内正式测试）
  - **`test_regression.py`**：主回归入口，按 `regression_manifest.yaml` 执行全量回归。
  - 其余为单元/行为测试：规则加载、profile、调度、生命周期、entry point、P0 并发、inline ignore 等。

- **`tests/`**（项目级集成/回归）
  - **`test_pro_rules_language_integration.py`**：pro-rules 按语言识别的集成测试。
  - **`test_js_cve_integration.py`**：JS CVE 规则集成测试（fixture + 可选完整 pro-rules 校验）。
  - **`test_cpp_regression.py`** / **`test_cpp_regression_simple.py`**：C++ CVE 转换与回归。
  - **`tests/parsers/go/test_go_parser.py`**、**`tests/parsers/js/test_js_parser.py`**：Go/JS 解析器回归。

## 运行方式

```bash
# 从 DiffSense 目录
cd DiffSense

# 包内回归（manifest 驱动）
python -m pytest diffsense/tests/test_regression.py -v

# 包内全部单元测试
python -m pytest diffsense/tests/ -v

# 项目级集成测试
python -m pytest tests/ -v
```

## 已清理的临时测试

根目录下原有多份重复/临时验证脚本（如 `test_rule_separation*.py`、`test_pro_rules*.py`、`test_param*.py`、`test_final_verification.py`、`test_multilang*.py` 等）已删除，逻辑已由上述正式回归与集成测试覆盖。
