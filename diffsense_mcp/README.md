# DiffSense MCP Server

将 DiffSense 代码审计能力通过 MCP 协议暴露给 AI Agent。

## 功能特性

- **audit_diff**: 直接审计 diff 内容
- **audit_diff_file**: 审计本地 diff 文件
- **get_audit_summary**: 获取审计报告的文本摘要
- **list_audit_rules**: 列出当前加载的审计规则
- **get_audit_config**: 获取当前审计配置

## 安装

```bash
# 1. 安装 MCP 依赖
pip install mcp>=1.0.0

# 或者安装所有依赖
pip install -r diffsense/requirements-mcp.txt
```

## 配置 Cursor

在 `~/.cursor/mcp.json` 中添加配置：

```json
{
  "mcpServers": {
    "diffsense": {
      "command": "python",
      "args": [
        "-m",
        "diffsense_mcp.server"
      ],
      "env": {
        "PYTHONPATH": "diffsense"
      },
      "workingDirectory": "."
    }
  }
}
```

## 使用方式

### 通过 AI Agent (Cursor)

在 Cursor 中，你可以直接让 AI 分析代码变更：

```
请使用 DiffSense 审计这个 diff：
diff --git a/src/main.py b/src/main.py
--- a/src/main.py
+++ b/src/main.py
@@ -1,3 +1,8 @@
+import os
+import sys
+
 def hello():
-    print("hello")
+    print("hello world")
+    return 0
+
+if __name__ == "__main__":
+    sys.exit(hello())
```

### 通过命令行

```bash
# 启动 stdio 模式（默认）
python -m diffsense_mcp.server

# 启动 HTTP 模式
python -m diffsense_mcp.server --http
```

## 输出文件

审计结果会保存在指定目录：

```
output_dir/
├── diffsense-report.json      # 结构化报告
├── diffsense-comments.json     # 内联评论
└── diffsense-report.html       # HTML 报告
```

## 架构说明

```
┌─────────────────────────────────────────────────────────────┐
│                    DiffSense MCP Architecture               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐    ┌─────────────────┐    ┌───────────┐  │
│   │ MCP Client  │───▶│ diffsense_mcp   │───▶│ diffsense │  │
│   │ (Cursor)   │    │   .server       │    │  .core    │  │
│   └─────────────┘    └─────────────────┘    └───────────┘  │
│                                                    │         │
│                                           ┌────────┴────────┐│
│                                           │                 ││
│                                    ┌──────▼──────┐   ┌──────▼──────┐
│                                    │   Parser    │   │  Rules      │
│                                    │   AST       │   │  Evaluator  │
│                                    │   Detector  │   │  Composer   │
│                                    └─────────────┘   └─────────────┘
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 与 CI/CD 解耦

MCP 模式的引入实现了：

1. **AI Agent 集成**: AI 可以直接调用审计能力
2. **CI/CD 解耦**: 审计逻辑与平台交互分离
3. **灵活部署**: 支持 stdio、HTTP 等多种传输方式
4. **本地调试**: 便于开发和测试审计规则
