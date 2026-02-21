# DiffSense

**DiffSense** is an automated code audit and risk governance platform. It provides **VSCode extension** for local self-check and **CI/CD pipeline** integration to audit MR/PR before merge.

[![Version](https://img.shields.io/badge/version-0.2.1-blue.svg)](https://github.com/GoldenSupremeSaltedFish/DiffSense)
[![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)](./LICENSE.txt)
[![VSCode](https://img.shields.io/badge/VSCode-1.74.0+-blueviolet.svg)](https://code.visualstudio.com/)
[![Marketplace](https://img.shields.io/badge/Marketplace-DiffSense-orange.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

## What it does

- **VSCode 分析器**：在本地对 Git 提交/分支做语义变更与影响分析，支持多语言与可视化。
- **CI/CD 流水线分析**：在 GitLab CI / GitHub Actions 中对接 MR/PR，自动发审计评论，支持按风险等级拦截与 Click-to-Ack。

## Quick Start

### CI/CD（GitLab）

1. 在项目 **Settings → CI/CD → Variables** 添加 `DIFFSENSE_TOKEN`（Personal Access Token，scope=api，勾选 Mask）。
2. 在 `.gitlab-ci.yml` 中加入：

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

示例：`diffsense/gitlab-ci-example.yml`、`diffsense/gitlab-ci-example.en.yml`。

### VSCode 扩展

- **安装**：VSCode 扩展市场搜索 “DiffSense”，或 `ext install humphreyLi.diffsense`；也可从 [Releases](https://github.com/GoldenSupremeSaltedFish/DiffSense/releases) 下载 VSIX 安装。
- **使用**：打开 Git 仓库，在侧栏打开 DiffSense，选择提交范围或分支后执行分析，查看结果与图表。

## Project structure

```
DiffSense/
├── vscode-extension/   # VSCode 插件与多语言分析器
├── diffsense/          # CI/CD 流水线审计（Python，规则引擎与 GitLab/GitHub 对接）
├── technical_documentation/
└── build-tools/
```

## Development

```bash
git clone https://github.com/GoldenSupremeSaltedFish/DiffSense.git
cd DiffSense
./build-all.bat
# 打包插件: cd vscode-extension/plugin && npm run package
```

详见 [Contributing](diffsense/CONTRIBUTING.md)。

## License & Links

- **License**: [Apache-2.0](LICENSE.txt)
- **Issues**: [Report a bug](https://github.com/GoldenSupremeSaltedFish/DiffSense/issues)
- **Marketplace**: [DiffSense](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

---

**English** | [中文版](./cn_readme.md)
