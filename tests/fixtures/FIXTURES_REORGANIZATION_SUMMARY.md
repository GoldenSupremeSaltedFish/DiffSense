# 测试文件规整总结

## 规整日期
2026-03-18

## 规整内容

### 移动到 `tests/fixtures/cve_samples/` 的文件

本次规整将散落在项目根目录的测试相关文件和样本数据统一移动到 `tests/fixtures/cve_samples/` 目录下，按类型分类组织：

#### 1. Java 漏洞样本
- **源位置**: `test_cve_vulnerability.java`
- **新位置**: `tests/fixtures/cve_samples/java/test_cve_vulnerability.java`
- **用途**: 测试 CVE 规则 `prorule.critical.ghsa_24q2_6x37_cgcx`（Nacos 认证绕过漏洞）

#### 2. JavaScript 漏洞样本
- **源位置**: `test_js_vulnerable.js`
- **新位置**: `tests/fixtures/cve_samples/js/test_js_vulnerable.js`
- **用途**: 测试多种 JavaScript 漏洞（XSS、原型污染、eval 命令执行、不安全反序列化）

#### 3. Go 漏洞样本（Diff 格式）
- **源位置**: `test_go_vulnerable.diff`
- **新位置**: `tests/fixtures/cve_samples/go/test_go_vulnerable.diff`
- **用途**: 测试 Go CVE 规则的语义分析能力

#### 4. CVE 数据集样本
- **源位置**: `sample_cve_dataset.json`
- **新位置**: `tests/fixtures/cve_samples/data/sample_cve_dataset.json`
- **用途**: 多语言 CVE 数据集样本，用于批量转换测试

#### 5. C++ CVE 样本数据
- **源位置**: `test_data/cpp_cve_samples.json`
- **新位置**: `tests/fixtures/cve_samples/data/cpp_cve_samples.json`
- **用途**: C++ CVE 样本数据，包含缓冲区溢出、释放后使用、整数溢出等漏洞

### 已删除的空目录
- `test_data/`（移动文件后为空，已删除）

## 更新的脚本引用

### 1. `convert_cve_dataset.py`
- **第 53 行**: 更新示例命令中的文件路径
- **修改前**: `python convert_cve_dataset.py sample_cve_dataset.json pro-rules/`
- **修改后**: `python convert_cve_dataset.py tests/fixtures/cve_samples/data/sample_cve_dataset.json pro-rules/`

### 2. `example_cve_conversion.py`
- **第 88-93 行**: 更新样本数据的保存路径和转换调用
- **修改前**: 直接使用 `"sample_cve_dataset.json"`
- **修改后**: 使用 `Path(__file__).parent / "tests" / "fixtures" / "cve_samples" / "data" / "sample_cve_dataset.json"`

## 新增文档

### `tests/fixtures/cve_samples/README.md`
新增 fixtures 目录说明文档，包含：
- 目录结构说明
- 各文件用途描述
- 使用示例
- 添加新样本的命名规范

## 目录结构

规整后的 `tests/fixtures/cve_samples/` 目录结构：

```
tests/fixtures/cve_samples/
├── README.md                     # 目录说明文档
├── java/                         # Java 漏洞样本
│   └── test_cve_vulnerability.java
├── js/                           # JavaScript 漏洞样本
│   └── test_js_vulnerable.js
├── go/                           # Go 漏洞样本 (diff 格式)
│   └── test_go_vulnerable.diff
└── data/                         # CVE 数据集 JSON 文件
    ├── sample_cve_dataset.json   # 多语言 CVE 样本
    └── cpp_cve_samples.json      # C++ CVE 样本
```

## 影响范围

### 不受影响的测试
以下测试不受影响，因为它们使用的是其他 fixtures 目录：
- `tests/test_pro_rules_language_integration.py` - 使用 `tests/fixtures/pro_rules_java_sample/`
- `tests/test_js_cve_integration.py` - 使用 `tests/fixtures/pro_rules_js_sample/`
- `diffsense/tests/test_go_cve_rules.py` - 使用 `pro-rules/cve/Go/` 目录
- 其他使用 `diffsense/tests/fixtures/` 的测试

### 可能需要验证的测试
如果存在直接引用这些文件名的测试（目前搜索未发现），需要更新路径为：
- `tests/fixtures/cve_samples/java/test_cve_vulnerability.java`
- `tests/fixtures/cve_samples/js/test_js_vulnerable.js`
- `tests/fixtures/cve_samples/go/test_go_vulnerable.diff`
- `tests/fixtures/cve_samples/data/sample_cve_dataset.json`
- `tests/fixtures/cve_samples/data/cpp_cve_samples.json`

## 验证步骤

### 1. 确认文件已移动
```bash
ls tests/fixtures/cve_samples/java/
ls tests/fixtures/cve_samples/js/
ls tests/fixtures/cve_samples/go/
ls tests/fixtures/cve_samples/data/
```

### 2. 确认根目录已清理
```bash
ls *.java *.js *.diff *.json  # 应无测试相关文件
```

### 3. 运行相关测试
```bash
# Java CVE 规则测试
pytest tests/test_pro_rules_language_integration.py -v

# JavaScript CVE 规则测试
pytest tests/test_js_cve_integration.py -v

# Go CVE 规则测试
pytest diffsense/tests/test_go_cve_rules.py -v

# C++ CVE 转换器测试
pytest tests/test_cpp_cve_integration.py -v
```

### 4. 验证示例脚本
```bash
# 运行示例脚本（应能正常生成规则到 pro-rules/）
python example_cve_conversion.py
```

## 后续建议

### 1. 统一测试 fixtures 位置
考虑将以下分散的 fixtures 也逐步统一：
- `diffsense/tests/fixtures/` → 合并到 `tests/fixtures/`
- `tests/fixtures/pro_rules_java_sample/` → 考虑按语言分类到 `tests/fixtures/pro_rules/java/`
- `tests/fixtures/pro_rules_js_sample/` → 考虑按语言分类到 `tests/fixtures/pro_rules/javascript/`

### 2. 添加 fixtures 索引
可以考虑在 `tests/fixtures/` 根目录添加一个总的 README，列出所有 fixtures 目录及其用途。

### 3. CI/CD 路径更新
如果 CI/CD 流程中硬编码了这些文件的路径，需要相应更新。

## 规整原则

本次规整遵循以下原则：
1. **按语言分类**: Java、JavaScript、Go 等按语言分开存放
2. **按类型分类**: 代码样本（.java/.js）与数据集（.json）分开
3. **Diff 格式统一**: Go 使用 diff 格式，保持与语义分析一致
4. **文档齐全**: 每个 fixtures 目录都有 README 说明用途
5. **向后兼容**: 更新所有已知引用点，确保测试不受影响
