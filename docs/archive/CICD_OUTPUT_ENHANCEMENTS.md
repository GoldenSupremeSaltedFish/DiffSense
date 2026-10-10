# CICD 审计报告输出增强

## 概述

本次增强主要改进了 DiffSense 在 CICD 环境中的审计报告输出，使开发人员能够更清楚地了解：
- 为什么某些文件没有触发对应的规则
- 哪些规则被触发了
- 每个文件的具体问题详情

## 主要改进

### 1. GitHub Actions 工作流增强 (`diffsense/.github/workflows/audit.yml`)

在 CICD 日志中添加了详细的调试输出：

```yaml
- name: Run DiffSense Audit
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    echo "🔍 Starting DiffSense Audit..."
    echo "📊 Repository: ${{ github.repository }}"
    echo "📊 PR Number: ${{ github.event.pull_request.number }}"
    echo "📊 PR Head SHA: ${{ github.event.pull_request.head.sha }}"
    # ... 更多调试信息
    
    # 显示输出文件检查结果
    echo "📁 Checking output files..."
    if [ -f "diffsense-report.json" ]; then
      echo "✅ diffsense-report.json exists"
      echo "📊 Report size: $(wc -c < diffsense-report.json) bytes"
      # ... 更多报告详情
    fi
```

**好处**：
- 快速验证审计是否成功运行
- 查看报告文件大小和内容摘要
- 诊断文件生成问题

### 2. Diff 获取和验证增强 (`diffsense/run_audit.py`)

#### 2.1 Diff 获取阶段的详细输出

```
🔍 Step 1: Parsing diff...

============================================================
📊 DIFF PARSING RESULTS
============================================================
✅ Parsed 5 files

📁 Files:
  - src/main/java/com/example/Service.java
  - src/test/java/com/example/ServiceTest.java
  ...

📊 Stats:
  - Additions: 150
  - Deletions: 45
  - New files: 1
  - Change types: ['logic', 'test']
  - File patches: 5
============================================================
```

**诊断信息**：
- 解析的文件列表
- 代码变更统计
- 文件类型分类

#### 2.2 AST 信号检测输出

```
🔍 Step 2: Detecting AST Signals...

============================================================
📊 AST SIGNALS DETECTED
============================================================
✅ Found 12 AST signals

📋 Signals by file:
  📁 src/main/java/com/example/Service.java:
    - JAVA_RESOURCE_LEAK
    - JAVA_EXCEPTION_SWALLOW
    - JAVA_NULL_POINTER
  📁 src/main/java/com/example/Controller.java:
    - JAVA_CVE_2023_1234
============================================================
```

**诊断信息**：
- 检测到的 AST 信号总数
- 按文件分组的信号列表
- 每个信号的具体 ID

#### 2.3 规则评估结果输出

```
🔍 Step 3: Loading rules and evaluating impacts...

📋 Rule configuration:
  - Rules path: config/rules.yaml
  - Profile: strict
  - Pro rules path: config/pro-rules
  - Quality auto-tune: true

📊 Rules loaded:
  - Total rules: 156
  - Enabled rules: 142
  - Rule profiles: ['java', 'python', 'javascript']

⚡ Evaluating rules against diff and AST signals...

============================================================
📊 RULE EVALUATION RESULTS
============================================================
🎯 Total impacts found: 8

📁 Files with triggered rules:

  📁 src/main/java/com/example/Service.java
     Issues: 3 | Max severity: HIGH
     - [HIGH] JAVA_RESOURCE_LEAK: Database connection not closed
     - [MEDIUM] JAVA_EXCEPTION_SWALLOW: Empty catch block
     - [LOW] JAVA_LOGGING_MISSING: No logging for error

  📁 src/main/java/com/example/Controller.java
     Issues: 5 | Max severity: CRITICAL
     - [CRITICAL] JAVA_CVE_2023_1234: Vulnerable dependency version
     - [HIGH] JAVA_INPUT_VALIDATION: Missing input validation
     ...

🎯 Triggered rules summary:

  🎯 JAVA_CVE_2023_1234 [CRITICAL]
     Triggered: 1 times
     Files: src/main/java/com/example/Controller.java

  🎯 JAVA_RESOURCE_LEAK [HIGH]
     Triggered: 2 times
     Files: src/main/java/com/example/Service.java, src/main/java/com/example/Repository.java
============================================================
```

**诊断信息**：
- 规则加载统计
- 按文件分组的问题列表
- 按规则分组的触发统计
- 严重程度分布

### 3. CICD 日志中的完整摘要（stderr 输出）

```
================================================================================
🔍 DIFFSENSE AUDIT COMPLETE
================================================================================

📊 SUMMARY: 8 issue(s) found in 2 file(s)

📁 FILES WITH ISSUES:

  📁 src/main/java/com/example/Controller.java
     └─ 5 issue(s), max severity: CRITICAL
        1. [CRITICAL] JAVA_CVE_2023_1234
           └─ Vulnerable dependency version detected
        2. [HIGH] JAVA_INPUT_VALIDATION
           └─ Missing input validation on user-provided data
        ...

  📁 src/main/java/com/example/Service.java
     └─ 3 issue(s), max severity: HIGH
        1. [HIGH] JAVA_RESOURCE_LEAK
           └─ Database connection not closed in finally block
        ...

🎯 TRIGGERED RULES:

  🎯 JAVA_CVE_2023_1234 [CRITICAL]
     └─ Triggered 1 time(s) in: src/main/java/com/example/Controller.java

  🎯 JAVA_RESOURCE_LEAK [HIGH]
     └─ Triggered 2 time(s) in: src/main/java/com/example/Service.java, ...

📊 SEVERITY BREAKDOWN:
     └─ CRITICAL: 1
     └─ HIGH: 3
     └─ MEDIUM: 2
     └─ LOW: 2

================================================================================
```

**好处**：
- 在 GitHub Actions 日志中直接查看完整摘要
- 快速定位问题文件和规则
- 了解整体风险分布

## 使用场景

### 场景 1：诊断为什么文件没有触发规则

当你在 CICD 中看到某个文件没有触发预期的规则时，查看日志中的：

1. **DIFF PARSING RESULTS** - 确认文件是否在 diff 中
2. **AST SIGNALS DETECTED** - 确认是否检测到 AST 信号
3. **RULE EVALUATION RESULTS** - 确认规则是否被评估

如果文件不在 diff 列表中，说明 diff 获取有问题。
如果文件在 diff 中但没有 AST 信号，说明 AST 检测器没有识别到相关模式。
如果有 AST 信号但没有触发规则，说明规则模式不匹配。

### 场景 2：验证规则是否正确加载

查看 **Rules loaded** 部分：
- 确认规则总数是否符合预期
- 确认启用的规则数量
- 确认规则配置文件路径正确

### 场景 3：了解整体代码质量趋势

查看 **SEVERITY BREAKDOWN** 部分：
- 跟踪不同严重程度的问题数量
- 评估代码审查的优先级
- 监控代码质量改进进度

## 输出文件

审计完成后会生成以下文件：

1. **diffsense-report.json** - 完整的 JSON 格式报告
2. **diffsense-report.html** - 可视化的 HTML 报告
3. **diffsense-comments.json** - 用于 GitHub 行级评论的 JSON

在 CICD 日志中可以通过以下命令检查：

```bash
# 检查报告文件
ls -la diffsense-report.*

# 查看 JSON 报告摘要
python -c "import json; data=json.load(open('diffsense-report.json')); print(f'Review Level: {data.get(\"review_level\", \"N/A\")}'); print(f'Details count: {len(data.get(\"details\", []))}')"

# 查看 HTML 报告大小
wc -c < diffsense-report.html
```

## 故障排查

### 问题：Diff 为空

**症状**：日志显示 "Diff is empty, skipping audit."

**可能原因**：
- PR 没有代码变更
- GitHub API 调用失败
- Token 权限不足

**解决方法**：
1. 检查 GITHUB_TOKEN 是否正确配置
2. 检查 PR 是否有实际的代码变更
3. 查看错误日志中的详细异常信息

### 问题：没有文件被解析

**症状**：日志显示 "Parsed 0 files"

**可能原因**：
- Diff 格式不是标准的 unified diff
- Diff 内容被截断
- 解析器配置问题

**解决方法**：
1. 查看 diff content preview 确认格式
2. 检查是否有 'diff --git'  headers
3. 验证 diff 内容是否完整

### 问题：规则没有触发

**症状**：文件在 diff 中，但没有规则被触发

**可能原因**：
- 规则模式不匹配代码变更
- AST 信号检测失败
- 规则被质量过滤器禁用

**解决方法**：
1. 查看 AST SIGNALS DETECTED 确认信号检测
2. 检查规则配置文件中的模式
3. 查看规则质量警告，确认规则未被禁用

## 版本

- Tag: v2.2.5
- 日期：2026-03-23
- 提交：7b30626

## 相关文档

- [CICD 工作流配置](.github/workflows/audit.yml)
- [审计报告 runner](diffsense/run_audit.py)
- [规则配置指南](diffsense/config/rules.yaml)
