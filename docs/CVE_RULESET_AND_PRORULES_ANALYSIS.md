# CVE 规则集与 pro-rules 集成分析报告

## 1. 问题背景：openclaw 创建项目 CVE 集合导致内容分散

### 1.1 现象

- **openclaw** 在创建/维护项目 CVE 规则集时，将部分内容放在了 **DiffSense 项目目录之外** 的以下位置：
  - `diffsense-prorule-commercial/diffsense_prorule_commercial/rules/`（如 `security_high.yaml`、`critical_cves.yaml`）
  - `openclaw/skills/扩充diffsense-skills/diffsense_prorule_commercial/rules/`
- 同一套规则文件（如 `security_high.yaml`、`critical_cves.yaml`）在工作区内存在 **三份**：
  - `DiffSense/pro-rules/`（主仓）
  - `diffsense-prorule-commercial/.../rules/`
  - `openclaw/skills/扩充diffsense-skills/.../rules/`
- 部分测试脚本（如工作区根目录的 `test_high_rules_fixed.py`）**写死了 commercial 路径**，依赖的是“工作区外”的 commercial 包，而不是 `DiffSense/pro-rules`，导致：
  - 仅在 DiffSense 仓库内跑测试时，会报错“security_high.yaml not found”或依赖 incident_data 等路径；
  - 规则集“逻辑上”被拆散，不利于单一数据源和 CI。

### 1.2 代码中的硬编码与路径问题

| 位置 | 问题 |
|------|------|
| `test_high_rules_fixed.py` | 使用 `diffsense-prorule-commercial/diffsense_prorule_commercial/rules/security_high.yaml` 和 `diffsense-prorule-commercial/incident_data` |
| `test_rule_separation_final_fixed2.py` | 使用 `pro_rules`（错误拼写，应为 `pro-rules`）且为绝对路径 |
| `test_rule_separation_final_fixed3.py` | 同上，绝对路径 + 错误目录名 |
| `test_rules_final.py` | 使用环境变量指向绝对路径 `.../DiffSense/pro-rules` |
| `js_cve_converter.py` 末尾 `if __name__` | 硬编码绝对路径 `C:\Users\...\pro-rules\cve\JavaScript` |

---

## 2. CVE 规则集完成状态

### 2.1 DiffSense/pro-rules 当前结构（实际）

```
DiffSense/pro-rules/
├── concurrency.yaml
├── critical_cves.yaml
├── critical_vulnerabilities.yaml
├── data_integrity.yaml
├── performance.yaml
├── security.yaml
├── security_high.yaml
├── test_generated_critical_rules.yaml
├── __init__.py
├── cve/          # 按需存在，如 cve/JavaScript
├── go/
├── java/         # 约 9900+ 个单文件 YAML（见下）
└── python/
```

### 2.2 规则加载格式要求（RuleEngine）

- `diffsense/core/rules.py` 的 `_load_yaml_file()` **只识别顶层为 `rules: [...]` 的 YAML**。
- 每个元素需具备 YamlRule 所需字段（如 `id`, `signal`, `action`, `file`, `severity` 等）。

### 2.3 完成度结论

| 类型 | 位置 | 格式 | 是否被 RuleEngine 加载 |
|------|------|------|------------------------|
| 聚合规则文件 | pro-rules 根目录 *.yaml | `rules: [...]` | ✅ 是 |
| Java CVE 单文件 | pro-rules/java/*.yaml | 单条规则 schema（id/description/patterns/...），**无** `rules:` 键 | ❌ **否** |

- **已完成的**：根目录下 8 个 YAML 与文档 `README_parameterized_rules.md` 一致，可被引擎加载，对应文档中的领域划分（critical、high、security、runtime 等）。
- **未接入引擎的**：`java/` 下约 9900+ 个单文件是“新 schema”（如 id、description、patterns、package、cwe），当前 **不会被加载**；若需作为 PRO 规则参与扫描，需要：
  - 在 `_load_yaml_file` 中增加对“单条规则 YAML”的兼容（例如顶层有 `id` 且无 `rules` 时当作单条规则包装成 `[data]` 再交给 YamlRule），或
  - 通过脚本将 java 单文件合并为若干 `rules: [...]` 的聚合文件。

---

## 3. pro-rules 能否进行“PO 规则”集成测试

### 3.1 结论：**可以，但需统一路径与格式**

- **能做的**：
  - 使用 `RuleEngine(pro_rules_path="DiffSense/pro-rules")` 或相对路径 `pro-rules`（以工作区根或测试 cwd 为基准）可正常加载 pro-rules 根目录下所有 `rules: [...]` 的 YAML。
  - 现有 `test_param_rules.py`、`test_final_verification.py`、`test_cve_trigger.py`、`test_parameterized_rules.py` 等已使用 `pro_rules_path="pro-rules"`，在从 DiffSense 目录或工作区根执行且 `pro-rules` 存在时，**可以**作为 pro 规则集成测试运行。
- **需要注意的**：
  - 部分测试依赖 **diffsense-prorule-commercial** 或绝对路径，若只克隆 DiffSense、不拉 commercial/openclaw，会失败。
  - 建议：集成测试**统一以 `DiffSense/pro-rules` 为唯一数据源**，将 `test_high_rules_fixed.py` 等改为指向 `DiffSense/pro-rules/security_high.yaml`，并去掉对 `incident_data` 的硬编码路径依赖（或改为可选）。

### 3.2 建议的集成测试方式

- 以项目根或 `DiffSense` 为 cwd，执行：
  - `python -m pytest DiffSense/tests/ -v`（若测试里 pro_rules_path 使用相对路径 `pro-rules`，则需在 `DiffSense` 下执行或设置好路径）。
- 或显式指定 pro-rules 路径，避免依赖环境变量或 commercial：
  - 在测试中统一使用：  
    `pro_rules_path=os.path.join(os.path.dirname(__file__), "..", "pro-rules")`  
    或通过环境变量 `DIFFSENSE_PRO_RULES` 指向 `DiffSense/pro-rules`。

---

## 4. 规则层级是否完善

### 4.1 文档约定（README_parameterized_rules.md）

- 领域划分：critical、data、high、performance、runtime、security，合计约 1718 条 PROrules。
- 根目录 YAML 按用途命名：critical_cves、security_high、concurrency、performance 等。

### 4.2 当前实现情况

- **语义层级**：已具备。规则 id 含 `prorule.high.*`、`prorule.ghsa_*_introduced` 等，根级 YAML 按 severity/用途分文件，与文档一致。
- **目录层级**：**未**按 domain 分子目录（无 `pro-rules/critical/`、`pro-rules/high/` 等），而是：
  - 根目录：按“用途/严重性”分文件（concurrency、critical_cves、security_high 等）；
  - 子目录：按**语言**分（java、go、python、cve/JavaScript），其中 java 为单文件 schema，当前未接入引擎。
- **结论**：规则层级在“文件与 id 命名”上**已按文档完善**；目录结构上是“根级聚合 + 按语言子目录”，与文档中的“领域”划分一致的是根级 YAML 的命名与内容，不是子目录名。若希望目录也按 domain 划分，需要后续重构（例如增加 critical/、high/ 等子目录并移动或链接文件）。

---

## 5. 修复与改进建议汇总

1. **统一 CVE/PRO 规则数据源**
   - 以 `DiffSense/pro-rules` 为唯一权威来源；避免测试或脚本依赖 `diffsense-prorule-commercial` 或 `openclaw` 下的副本。
2. **修正测试脚本路径**
   - `test_high_rules_fixed.py`：改为使用 `DiffSense/pro-rules/security_high.yaml`（或通过环境变量/参数指定），incident_data 改为可选或从 pro-rules 同仓配置读取。
   - `test_rule_separation_final_fixed*.py`、`test_rules_final.py`：改用相对路径或 `DIFFSENSE_PRO_RULES`，且目录名为 `pro-rules` 而非 `pro_rules`。
3. **去除硬编码绝对路径**
   - `js_cve_converter.py`：`if __name__ == '__main__'` 中的输出目录改为基于 `Path(__file__)` 的相对路径或从参数/环境变量读取。
4. **Java 单文件规则是否接入引擎**
   - 若希望 java/ 下 9900+ 条 CVE 规则参与扫描：在规则加载层增加对“单条规则 YAML”的兼容，或提供脚本将 java 转为 `rules: [...]` 聚合文件再放入 pro-rules。
5. **集成测试约定**
   - 所有 pro 规则相关测试统一使用 `DiffSense/pro-rules`（或通过环境变量配置），不依赖 commercial 或 openclaw 路径；CI 仅需克隆 DiffSense 即可跑通 pro 规则集成测试。

---

*报告生成后，可根据上述建议逐项修改代码与测试，使 CVE 规则集状态清晰、pro-rules 集成测试可仅基于 DiffSense 仓库运行。*
