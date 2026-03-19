# CVE Samples Fixtures

本目录存放用于 CVE 规则测试的样本文件，按语言/类型分类组织。

## 目录结构

```
cve_samples/
├── java/                     # Java 漏洞样本
│   └── test_cve_vulnerability.java
├── js/                       # JavaScript 漏洞样本
│   └── test_js_vulnerable.js
├── go/                       # Go 漏洞样本 (diff 格式)
│   └── test_go_vulnerable.diff
└── data/                     # CVE 数据集 JSON 文件
    └── sample_cve_dataset.json
```

## 文件说明

### `java/test_cve_vulnerability.java`
Java 身份验证绕过漏洞样本，用于测试 CVE 规则 `prorule.critical.ghsa_24q2_6x37_cgcx` 的检测能力。

### `js/test_js_vulnerable.js`
JavaScript 多类型漏洞样本，包含：
- XSS (innerHTML 注入)
- 原型污染 (Object.prototype 污染)
- 命令执行 (eval)
- 不安全反序列化 (JSON.parse)

### `go/test_go_vulnerable.diff`
Go 语言漏洞代码的 diff 格式样本，用于测试 Go CVE 规则的语义分析。

### `data/sample_cve_dataset.json`
多语言 CVE 数据集样本，包含 Python 和 Go 的 CVE 条目，用于批量转换测试。

## 使用示例

### 转换 CVE 数据集为 PROrules

```bash
python convert_cve_dataset.py tests/fixtures/cve_samples/data/sample_cve_dataset.json pro-rules/
```

### 运行相关测试

```bash
# 运行 Java CVE 规则测试
pytest tests/test_pro_rules_language_integration.py -v

# 运行 JavaScript CVE 规则测试
pytest tests/test_js_cve_integration.py -v

# 运行 Go CVE 规则测试
pytest diffsense/tests/test_go_cve_rules.py -v
```

## 添加新的测试样本

如需添加新的 CVE 测试样本，请遵循以下命名规范：
- Java 文件：`test_<vulnerability_type>.java`
- JavaScript 文件：`test_<vulnerability_type>.js`
- Go 文件：`test_<vulnerability_type>.diff` (使用 diff 格式)
- 数据集：`<dataset_name>.json`
