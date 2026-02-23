# DiffSense

**DiffSense** is an automated code audit and risk governance platform. It provides a **VSCode extension** for local self-check and **CI/CD pipeline** integration to audit MR/PR before merge.

[![Version](https://img.shields.io/badge/version-0.2.1-blue.svg)](https://github.com/GoldenSupremeSaltedFish/DiffSense)
[![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)](./LICENSE.txt)
[![VSCode](https://img.shields.io/badge/VSCode-1.74.0+-blueviolet.svg)](https://code.visualstudio.com/)
[![Marketplace](https://img.shields.io/badge/Marketplace-DiffSense-orange.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

## What it does

- **VSCode analyzer**: Run semantic change and impact analysis on Git commits/branches locally, with multi-language support and visualization.
- **CI/CD pipeline**: Integrate with GitLab CI or GitHub Actions to audit MR/PR, post audit comments, and enforce risk-based blocking with Click-to-Ack.

## Quick Start

### CI/CD (GitLab)

1. In your project go to **Settings → CI/CD → Variables** and add `DIFFSENSE_TOKEN` (Personal Access Token with `api` scope; check **Mask variable**).
2. Add this job to `.gitlab-ci.yml`:

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

Example configs: `diffsense/gitlab-ci-example.yml`, `diffsense/gitlab-ci-example.en.yml`.

### VSCode extension

- **Install**: Search for "DiffSense" in the VSCode Extensions marketplace, or run `ext install humphreyLi.diffsense`; you can also download the VSIX from [Releases](https://github.com/GoldenSupremeSaltedFish/DiffSense/releases).
- **Use**: Open a Git repository, open DiffSense in the sidebar, select a commit range or branch, run analysis, and view results and charts.

## Project structure

```
DiffSense/
├── vscode-extension/   # VSCode plugin and multi-language analyzers
├── diffsense/          # CI/CD pipeline audit (Python, rule engine, GitLab/GitHub adapters)
├── technical_documentation/
└── build-tools/
```

## Development

```bash
git clone https://github.com/GoldenSupremeSaltedFish/DiffSense.git
cd DiffSense
./build-all.bat
# Package extension: cd vscode-extension/plugin && npm run package
```

See [Contributing](diffsense/CONTRIBUTING.md) for more.

## License & links

- **License**: [Apache-2.0](LICENSE.txt)
- **Issues**: [Report a bug](https://github.com/GoldenSupremeSaltedFish/DiffSense/issues)
- **Marketplace**: [DiffSense](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

---

**English** | [中文版](./cn_readme.md)
