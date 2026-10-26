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
      pull-requests: write
      issues: write
      security-events: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Cache DiffSense
        uses: actions/cache@v4
        with:
          path: ~/.diffsense
          key: diffsense-${{ runner.os }}-${{ hashFiles('.github/workflows/diffsense.yml') }}
      - name: Install DiffSense
        run: pip install "git+https://github.com/GoldenSupremeSaltedFish/DiffSense.git@v2.3.1#subdirectory=diffsense"
      - name: Run DiffSense
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          diffsense audit --platform github --token "$GITHUB_TOKEN" --repo "${{ github.repository }}" --pr "${{ github.event.pull_request.number }}"
          # SARIF output for GitHub Code Scanning (#85)
          git diff "${{ github.event.pull_request.base.sha }}...${{ github.event.pull_request.head.sha }}" > pr.diff
          diffsense replay pr.diff --format sarif > diffsense.sarif
      - name: Upload SARIF to Code Scanning
        # Requires security-events: write; results appear under the "Code Scanning" tab.
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: diffsense.sarif
      - name: Post audit summary to PR
        # Posts a summary comment on the PR (#86); requires pull-requests: write.
        uses: actions/github-script@v7
        if: always()
        with:
          script: |
            const fs = require('fs');
            let summary = 'DiffSense audit could not produce a report.';
            try {
              const report = JSON.parse(fs.readFileSync('diffsense-report.json', 'utf8'));
              const rl = report.review_level || 'normal';
              const action = report.suggested_action || 'none';
              const rules = (report.findings || report.details || []).length;
              summary = `**DiffSense audit** — review_level: \`${rl}\`, suggested_action: \`${action}\`, findings: ${rules}\n\nSee the Code Scanning tab for the full SARIF results.`;
            } catch (e) { /* fall back to default summary */ }
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: summary,
            });
```

2. 提交并推送该文件，随后创建或更新 Pull Request。  
   工作流将自动运行，审计结果会以摘要评论发布在 PR 下（#86），SARIF 报告同步上传到仓库的 Code Scanning 标签页（#85）。

**可选**：在仓库根目录添加 [`.diffsense.yaml`](recommended-config.md)，采用官方推荐配置，适用于大多数团队。

---

## 方式二：本地 diff 审计

**适用场景**：对本地生成的 diff 文件进行离线审计。

**步骤：**

1. **安装**（任选其一）  
   - 从 GitHub 安装：  
     `pip install "git+https://github.com/GoldenSupremeSaltedFish/DiffSense.git@v2.3.1#subdirectory=diffsense"`  
   - 或克隆仓库后安装：  
     `cd diffsense && pip install -e .`

2. **执行审计**  
   - 准备一份 diff 文件（例如：`git diff main > my.diff`）。  
   - 执行：`diffsense replay my.diff`  
   - 默认输出为 JSON；可添加 `--report-html diffsense-report.html` 生成 HTML 报告。

**可选**：在工作目录或仓库根目录放置 [`.diffsense.yaml`](recommended-config.md)，使用推荐配置，无需记忆命令行参数。

---

## 方式三：GitLab MR 审计

**适用场景**：在 GitLab 仓库的 Merge Request 上自动执行变更风险审计。

**步骤：**

1. 在目标项目中新建文件 **`.gitlab-ci.yml`**，将下列 YAML 完整粘贴到该文件（完整注释版见仓库 `gitlab-ci-example.yml`）。  
   需先在项目 Settings → CI/CD → Variables 中添加 `DIFFSENSE_TOKEN`（Personal Access Token，scope=api，勾选 Mask）。

```yaml
diffsense_check:
  stage: test
  image: ghcr.io/goldensupremesaltedfish/diffsense:2.3.1
  entrypoint: [""]
  variables:
    GIT_DEPTH: "100"
  rules:
    - if: $CI_PIPELINE_SOURCE == 'merge_request_event'
  script:
    - diffsense audit --platform gitlab --token "$DIFFSENSE_TOKEN" --project-id "$CI_PROJECT_ID" --mr-iid "$CI_MERGE_REQUEST_IID" --gitlab-url "${GITLAB_URL:-$CI_SERVER_URL}"
  allow_failure: true
  artifacts:
    when: always
    paths:
      - diffsense-report.sarif
```

2. 提交并推送后创建 Merge Request。审计结果将以 MR 评论形式发布；job 不会阻断流水线（`allow_failure: true`），SARIF 报告保存在 job artifacts 中。

---

## 后续配置与行为说明

| 主题 | 说明 |
|------|------|
| **CI 行为** | 仅分析本次 diff，不进行全量扫描；不自动阻断流水线；低 precision 规则自动降级；不自动拒绝 PR，仅输出建议。详见 [默认行为与产品承诺](recommended-config.md#二默认行为与产品承诺)。 |
| **退出码** | `diffsense replay` / `diffsense audit` 的进程退出码语义：**0** = 通过（无阻断级发现）；**1** = 存在 critical 级发现（机器可读的阻断语义，如需在 CI 中容忍请使用 `continue-on-error` 或 `|| true`）；**2** = 工具错误。DiffSense 自身不调用平台 API 阻断 PR，是否因退出码 1 中断流水线由 CI 配置决定。 |
| **误报处理** | 通过 [忽略配置](ignoring.md) 或行内注释 `// diffsense-ignore: rule_id` 排除误报。 |
| **自定义规则** | 默认使用内置规则集；编写自定义规则请参阅 [rule-quickstart](rule-quickstart.md)。 |
