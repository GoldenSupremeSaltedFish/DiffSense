# DiffSense

**DiffSense** is a Change Risk Gate for the PR stage: it evaluates whether the current diff introduces regression risks without performing full codebase scans or style checks. Designed for minimal alerts, high precision, low latency, and interpretable results.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/GoldenSupremeSaltedFish/DiffSense)
[![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)](./LICENSE.txt)
[![VSCode](https://img.shields.io/badge/VSCode-1.74.0+-blueviolet.svg)](https://code.visualstudio.com/)
[![Marketplace](https://img.shields.io/badge/Marketplace-DiffSense-orange.svg)](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)
[![DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/GoldenSupremeSaltedFish/DiffSense)

---

## Quick Start

| Scenario | Action |
|----------|--------|
| **GitHub Pull Request** | Copy the workflow from [diffsense/docs/quickstart.md](diffsense/docs/quickstart.md) (Method 1) to `.github/workflows/diffsense.yml` in your target repository. Uses the default `GITHUB_TOKEN` with no additional configuration required. After committing and creating/updating a PR, the workflow will automatically execute the audit and post results under the PR. |
| **Local Audit** | Run `pip install -e diffsense` in the repository root, or `pip install "git+https://github.com/GoldenSupremeSaltedFish/DiffSense.git@release/2.2.0#subdirectory=diffsense"`, then execute `diffsense replay <path-to-diff>`. |

Complete steps are available at **[diffsense/docs/quickstart.md](diffsense/docs/quickstart.md)**.

Optional: Add [`.diffsense.yaml`](diffsense/docs/recommended-config.md) to your repository root to use the officially recommended configuration, suitable for most teams.

---

## Features

- **CI / Local**: Performs semantic risk auditing on MR/PR diffs, outputting `review_level` and recommended actions. Analyzes only changed content without slowing down pipelines. Low-quality rules are automatically downgraded. Does not automatically modify CI status; decisions to block are made manually or by downstream processes.
- **VSCode Extension**: Maintained in the [vscode-extension](https://github.com/GoldenSupremeSaltedFish/DiffSense/tree/vscode-extension) branch. This branch contains only the CLI and rule engine.

---

## Quick Start (Detailed)

### GitHub Actions

Copy the complete YAML from [diffsense/docs/quickstart.md](diffsense/docs/quickstart.md) (Method 1) to your repository's `.github/workflows/diffsense.yml` to enable PR auditing.

### GitLab CI

1. In your project, go to **Settings → CI/CD → Variables** and add the variable `DIFFSENSE_TOKEN` (Personal Access Token with `api` permissions; recommended to check **Mask variable**).
2. Add the corresponding job to `.gitlab-ci.yml`. See the example at [diffsense/gitlab-ci-example.yml](diffsense/gitlab-ci-example.yml).

### VSCode Extension

Maintained in the [vscode-extension](https://github.com/GoldenSupremeSaltedFish/DiffSense/tree/vscode-extension) branch. Install from the Marketplace or download the VSIX from [Releases](https://github.com/GoldenSupremeSaltedFish/DiffSense/releases).

---

## Project Structure (This Branch)

```
DiffSense/
├── diffsense/          # CLI, rule engine, GitHub/GitLab adapters; see docs/quickstart.md for quick start
└── technical_documentation/
```

---

## Development

```bash
git clone https://github.com/GoldenSupremeSaltedFish/DiffSense.git
cd DiffSense/diffsense
pip install -e ".[dev]"
pytest tests/ -v
```

See [diffsense/CONTRIBUTING.md](diffsense/CONTRIBUTING.md) for details.

---

## License & Links

- **License**: [Apache-2.0](LICENSE.txt)
- **Issues**: [Report a bug](https://github.com/GoldenSupremeSaltedFish/DiffSense/issues)
- **Marketplace**: [DiffSense](https://marketplace.visualstudio.com/items?itemName=humphreyLi.diffsense)

**English** | [中文版](./cn_readme.md)
