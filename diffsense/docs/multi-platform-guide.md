# Multi-Platform Integration Guide

Version: 1.0 · Applies to `diffsense audit` / `diffsense replay` CLI and their exit codes / output formats as defined in `docs/cli-contract.md`.

This guide shows how to wire DiffSense into CI systems other than GitHub Actions. All examples rely only on the stable CLI contract:

- **Exit codes**: `0` = pass (no blocking findings), `1` = critical findings present, `2` = tool error (never treat anything else as valid; see `docs/cli-contract.md` §2).
- **Output formats**: `--format json | markdown | sarif | junit | codequality` (JUnit XML for test publishers, GitLab Code Quality JSON for MR widgets).
- **stdin**: `diffsense replay -` reads the unified diff from stdin (#136), so no intermediate file is required.

---

## 1. GitLab CI

### 1.1 MR risk audit (existing example)

The repository ships a ready-to-copy job: [`gitlab-ci-example.yml`](../gitlab-ci-example.yml) (English variant: [`gitlab-ci-example.en.yml`](../gitlab-ci-example.en.yml)). It runs on the published container image and comments findings back to the MR via the API:

```yaml
diffsense_check:
  stage: diffsense
  image: ghcr.io/goldensupremesaltedfish/diffsense:1.0.0
  entrypoint: [""]
  rules:
    - if: $CI_PIPELINE_SOURCE == 'merge_request_event'
  script:
    - diffsense audit --platform gitlab --token "$DIFFSENSE_TOKEN" --project-id "$CI_PROJECT_ID" --mr-iid "$CI_MERGE_REQUEST_IID" --gitlab-url "${GITLAB_URL:-$CI_SERVER_URL}"
```

### 1.2 Code Quality widget (no API token needed)

If you only want the MR "Code Quality" widget, run the CLI offline and export the Code Quality report as an artifact (#135):

```yaml
diffsense_codequality:
  stage: diffsense
  image: ghcr.io/goldensupremesaltedfish/diffsense:1.0.0
  entrypoint: [""]
  rules:
    - if: $CI_PIPELINE_SOURCE == 'merge_request_event'
  script:
    - git diff origin/"$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"...HEAD > changes.diff
    - diffsense replay changes.diff --format codequality --report-json diffsense-report.json > diffsense-codequality.json || test $? -eq 1
  artifacts:
    when: always
    paths: [diffsense-codequality.json]
    reports:
      codequality: diffsense-codequality.json
```

Notes:

- `git diff A...HEAD` (three dots) diffs from the merge base, which is what you want for MR audits.
- `|| test $? -eq 1` tolerates "critical findings found" (exit `1`) so the report artifact is still uploaded; genuine tool errors (`2`) still fail the job.

---

## 2. Jenkins (Declarative Pipeline)

Use the JUnit output (#134) with the built-in JUnit publisher:

```groovy
pipeline {
  agent any
  stages {
    stage('DiffSense') {
      steps {
        sh 'git diff origin/${CHANGE_TARGET}...HEAD > changes.diff || true'
        sh '''#!/bin/bash
          pip install "git+https://github.com/GoldenSupremeSaltedFish/DiffSense.git@v2.3.1#subdirectory=diffsense"
          diffsense replay changes.diff --format junit --report-json diffsense-report.json > diffsense-junit.xml || test $? -eq 1
        '''
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'diffsense-junit.xml'
          archiveArtifacts artifacts: 'diffsense-report.json', allowEmptyArchive: true
        }
      }
    }
  }
}
```

The JUnit report maps every finding to a failed testcase, so they appear in the "Tests" tab with rule id + file + line. A clean diff produces a `no-findings` testcase.

---

## 3. Azure DevOps

Same JUnit artifact, published with `PublishTestResults@2`:

```yaml
stages:
  - stage: DiffSense
    jobs:
      - job: audit
        steps:
          - script: git diff origin/$(System.PullRequest.TargetBranch)...HEAD > changes.diff || true
          - script: |
              pip install "git+https://github.com/GoldenSupremeSaltedFish/DiffSense.git@v2.3.1#subdirectory=diffsense"
              diffsense replay changes.diff --format junit --report-json diffsense-report.json > diffsense-junit.xml || test $? -eq 1
          - task: PublishTestResults@2
            condition: always()
            inputs:
              testResultsFormat: JUnit
              testResultsFiles: diffsense-junit.xml
              testRunTitle: DiffSense risk audit
```

---

## 4. Local / pre-commit (stdin)

`replay -` reads the diff from stdin (#136), which makes piping natural — no temp file needed:

```bash
# Uncommitted working-tree changes
git diff | diffsense replay -

# Staged changes only (e.g. inside a pre-commit hook)
git diff --cached | diffsense replay - --format codequality
```

`-q` keeps stdout/stderr clean while the JSON report is still written to `--report-json`, which is what hook frameworks prefer.

Minimal `.pre-commit-hooks.yaml` example:

```yaml
- id: diffsense
  name: DiffSense risk audit
  entry: bash -c 'git diff --cached | diffsense replay - -q --report-json .diffsense-report.json || test $? -eq 1'
  language: system
  pass_filenames: false
  always_run: true
```

---

## 5. GitHub Actions

GitHub Actions is covered in [`docs/quickstart.md`](quickstart.md) (PR audit workflow + SARIF upload to Code Scanning) and [`docs/ci-cache.md`](ci-cache.md) (cache configuration). SARIF output: `diffsense replay changes.diff --format sarif`.

## 6. Related docs

- [`docs/cli-contract.md`](cli-contract.md) — stable CLI contract (exit codes, stdout/stderr separation, SARIF/JUnit/Code Quality schemas).
- [`docs/quickstart.md`](quickstart.md) — first-run quickstart.
- [`docs/ci-cache.md`](ci-cache.md) — cache semantics for CI runners.
- [`docs/ignoring.md`](ignoring.md) — suppress known/accepted findings.
