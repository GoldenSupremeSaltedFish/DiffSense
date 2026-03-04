# 快速开始

本文档提供两种接入方式，按步骤操作即可完成首次运行。无需预先阅读其他文档。

---

## 方式一：GitHub Pull Request 审计

**适用场景**：在 GitHub 仓库的 PR 上自动执行变更风险审计。

**步骤：**

1. 在目标仓库中新建文件 **`.github/workflows/diffsense.yml`**，将下列 YAML 完整粘贴到该文件。  
   使用仓库默认的 `GITHUB_TOKEN`，无需额外配置或密钥。

```yaml
name: DiffSense PR Audit
on:
  pull_request:
    types: [opened, synchronize]
jobs:
  audit:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull_requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Cache DiffSense
        uses: actions/cache@v4
        with:
          path: ~/.diffsense
          key: diffsense-${{ runner.os }}-${{ hashFiles('.github/workflows/diffsense.yml') }}
      - name: Install DiffSense
        run: pip install "git+https://github.com/GoldenSupremeSaltedFish/DiffSense.git@release/2.2.0#subdirectory=diffsense"
      - name: Run DiffSense
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: diffsense audit --platform github --token "$GITHUB_TOKEN" --repo "${{ github.repository }}" --pr "${{ github.event.pull_request.number }}"
```

2. 提交并推送该文件，随后创建或更新 Pull Request。  
   工作流将自动运行，并在 PR 下输出审计结果。

**可选**：在仓库根目录添加 [`.diffsense.yaml`](recommended-config.md)，采用官方推荐配置，适用于大多数团队。

---

## 方式二：本地 diff 审计

**适用场景**：对本地生成的 diff 文件进行离线审计。

**步骤：**

1. **安装**（任选其一）  
   - 从 GitHub 安装：  
     `pip install "git+https://github.com/GoldenSupremeSaltedFish/DiffSense.git@release/2.2.0#subdirectory=diffsense"`  
   - 或克隆仓库后安装：  
     `cd diffsense && pip install -e .`

2. **执行审计**  
   - 准备一份 diff 文件（例如：`git diff main > my.diff`）。  
   - 执行：`diffsense replay my.diff`  
   - 默认输出为 JSON；可添加 `--report-html diffsense-report.html` 生成 HTML 报告。

**可选**：在工作目录或仓库根目录放置 [`.diffsense.yaml`](recommended-config.md)，使用推荐配置，无需记忆命令行参数。

---

## 后续配置与行为说明

| 主题 | 说明 |
|------|------|
| **CI 行为** | 仅分析本次 diff，不进行全量扫描；不自动阻断流水线；低 precision 规则自动降级；不自动拒绝 PR，仅输出建议。详见 [默认行为与产品承诺](recommended-config.md#二默认行为与产品承诺)。 |
| **误报处理** | 通过 [忽略配置](ignoring.md) 或行内注释 `// diffsense-ignore: rule_id` 排除误报。 |
| **自定义规则** | 默认使用内置规则集；编写自定义规则请参阅 [rule-quickstart](rule-quickstart.md)。 |
