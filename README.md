# DiffSense

**DiffSense** 是 PR 阶段的变更风险守门人（Change Risk Gate）：仅针对当前 diff 判断是否引入回归风险，不做全量扫描与代码规范检查。设计目标为少告警、高精度、低延迟、结果可解释。

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/GoldenSupremeSaltedFish/DiffSense)
[![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)](./LICENSE.txt)
[![VSCode](https://img.shields.io/badge/VSCode-1.74.0+-blueviolet.svg)](https://code.visualstudio.com/)
[![Marketplace](https://img.shields.io/badge/Marketplace-DiffSense-orange.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)
[![DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/GoldenSupremeSaltedFish/DiffSense)

---

## 快速开始

| 场景 | 操作 |
|------|------|
| **GitHub Pull Request** | 将 [diffsense/docs/quickstart.md](diffsense/docs/quickstart.md) 中「方式一」的 workflow 复制到目标仓库的 `.github/workflows/diffsense.yml`，使用默认 `GITHUB_TOKEN`，无需额外配置。提交并创建/更新 PR 后，工作流将自动执行审计并在 PR 下输出结果。 |
| **本地审计** | 在仓库根目录执行 `pip install -e diffsense`，或 `pip install "git+https://github.com/GoldenSupremeSaltedFish/DiffSense.git@release/2.2.0#subdirectory=diffsense"`，然后执行 `diffsense replay <path-to-diff>`。 |

完整步骤见 **[diffsense/docs/quickstart.md](diffsense/docs/quickstart.md)**。用户文档与契约的完整索引见 **[diffsense/docs/README.md](diffsense/docs/README.md)**。

**10 分钟写一条规则：** [rule-quickstart](diffsense/docs/rule-quickstart.md) · [Signal 列表](diffsense/docs/signals.md) · `diffsense signals`

可选：在仓库根目录添加 [`.diffsense.yaml`](diffsense/docs/recommended-config.md) 以使用官方推荐配置，适用于大多数团队。

---

## 功能概览

- **CI / 本地**：对 MR/PR 的 diff 进行语义风险审计，输出 `review_level` 与建议动作；仅分析变更内容，不拖慢流水线；低质量规则自动降级；不自动修改 CI 状态，由人工或下游流程决定是否阻断。
- **VSCode 插件**：在分支 [vscode-extension](https://github.com/GoldenSupremeSaltedFish/DiffSense/tree/vscode-extension) 维护；本分支仅包含 CLI 与规则引擎。

---

## Quick Start（详细）

### GitHub Actions

将 [diffsense/docs/quickstart.md](diffsense/docs/quickstart.md) 中「方式一」的完整 YAML 复制到你的仓库 `.github/workflows/diffsense.yml` 即可启用 PR 审计。

### GitLab CI

1. 在项目中进入 **Settings → CI/CD → Variables**，添加变量 `DIFFSENSE_TOKEN`（Personal Access Token，具备 `api` 权限；建议勾选 **Mask variable**）。
2. 在 `.gitlab-ci.yml` 中加入以下 job：

```yaml
diffsense_audit:
  stage: test
  image: ghcr.io/goldensupremesaltedfish/diffsense:1.0.0
  entrypoint: [""]
  rules:
    - if: $CI_PIPELINE_SOURCE == 'merge_request_event'
  script:
    - diffsense audit --platform gitlab
        --token "$DIFFSENSE_TOKEN"
        --project-id "$CI_PROJECT_ID"
        --mr-iid "$CI_MERGE_REQUEST_IID"
        --gitlab-url "${GITLAB_URL:-$CI_SERVER_URL}"
  allow_failure: false
```

参考示例：`diffsense/gitlab-ci-example.yml`、`diffsense/gitlab-ci-example.en.yml`。

### VSCode 插件

在分支 [vscode-extension](https://github.com/GoldenSupremeSaltedFish/DiffSense/tree/vscode-extension) 维护。可从 Marketplace 安装或从 [Releases](https://github.com/GoldenSupremeSaltedFish/DiffSense/releases) 下载 VSIX。

---

## 项目结构（本分支）

```
DiffSense/
├── diffsense/          # CLI、规则引擎、GitHub/GitLab 适配器；快速开始见 docs/quickstart.md
└── technical_documentation/
```

---

## 开发

```bash
git clone https://github.com/GoldenSupremeSaltedFish/DiffSense.git
cd DiffSense/diffsense
pip install -e ".[dev]"
pytest tests/ -v
```

详见 [diffsense/CONTRIBUTING.md](diffsense/CONTRIBUTING.md)。

## 高级用法：参数化规则路径

DiffSense现在支持通过`pro_rules_path`参数指定PROrules的路径，无需依赖配置文件：

```python
from diffsense.core.rules import RuleEngine

# 仅加载普通规则
engine = RuleEngine()

# 同时加载普通规则和PROrules
engine = RuleEngine(pro_rules_path="path/to/pro-rules")
```

这使得在不同环境中灵活配置规则集变得更加容易。

## 多语言CVE规则转换器

DiffSense现在支持将多种编程语言的CVE数据集转换为PROrules格式。已实现Python和Go语言的转换器：

### 使用示例

```python
from diffsense.converters import PythonCVEDatasetConverter, GoCVEDatasetConverter

# Python CVE转换
python_converter = PythonCVEDatasetConverter()
cve_data = {
    "cve_id": "CVE-2023-1234",
    "description": "Python pickle模块中的不安全反序列化漏洞",
    "cvss_score": 9.8
}
template = python_converter.parse_cve_entry(cve_data)
rule = python_converter.generate_diffsense_rule(template)

# Go CVE转换  
go_converter = GoCVEDatasetConverter()
cve_data = {
    "cve_id": "CVE-2023-5678", 
    "description": "Go语言gob包中的反序列化漏洞",
    "cvss_score": 8.5
}
template = go_converter.parse_cve_entry(cve_data)
rule = go_converter.generate_diffsense_rule(template)
```

### 支持的漏洞类型

**Python**: 不安全反序列化(pickle/yaml/eval)、命令注入、路径遍历、SQL注入  
**Go**: 不安全反序列化(gob/json/xml)、命令执行、Goroutine泄漏、竞态条件

转换器会自动识别CVE描述中的语言特定模式，并生成相应的DiffSense PROrules，同时映射到通用的漏洞信号类型以保持跨语言兼容性。

---

## License & links

- **License**: [Apache-2.0](LICENSE.txt)
- **Issues**: [Report a bug](https://github.com/GoldenSupremeSaltedFish/DiffSense/issues)
- **Marketplace**: [DiffSense](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

**English** | [中文版](./cn_readme.md)
