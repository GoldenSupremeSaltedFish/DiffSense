# DiffSense MCP Server

将 DiffSense 代码审计能力通过 MCP 协议暴露给 AI Agent。

## 功能特性

- **多语言支持**: 自动检测并适配 Python、JavaScript、Java、Go、C++ 等语言规则
- **Git 联动**: 支持直接审计 Git 仓库的变更、暂存区
- **工作区审计**: 对整个项目进行安全扫描

### MCP Tools

| 工具 | 功能 |
|------|------|
| `audit_diff` | 审计 diff 内容 |
| `audit_diff_file` | 审计本地 diff 文件 |
| `audit_git_changes` | 审计 Git 提交间变更 |
| `audit_git_staged` | 审计暂存区（commit 前预检） |
| `audit_workspace` | 审计整个工作区 |
| `get_audit_summary` | 获取文本摘要 |

### MCP Resources

| 资源 | 功能 |
|------|------|
| `diffsense://rules` | 列出审计规则 |
| `diffsense://config` | 获取审计配置 |
| `diffsense://languages` | 支持的语言列表 |

## 安装

```bash
# 方式 1: 安装 DiffSense（含 MCP 支持）
pip install diffsense[mcp]

# 方式 2: 单独安装
pip install diffsense-mcp
```

## 配置 Cursor

在 `~/.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "diffsense": {
      "command": "diffsense-mcp"
    }
  }
}
```

或者使用 Python 模块方式：

```json
{
  "mcpServers": {
    "diffsense": {
      "command": "python",
      "args": ["-m", "diffsense_mcp.server"]
    }
  }
}
```

## 使用示例

### 审计 Git 变更

```
请审计当前仓库最近一次提交的变更
```

### 审计暂存区

```
请审计我暂存的文件变更
```

### 审计 diff 内容

```
请用 DiffSense 审计这个 diff：
diff --git a/auth.py b/auth.py
--- a/auth.py
+++ b/auth.py
@@ -10,6 +10,8 @@ def verify_token(token):
+    query = f"SELECT * FROM users WHERE token = '{token}'"
     return True
```

## 发布到 PyPI

```bash
# 1. 安装发布工具
pip install build twine

# 2. 构建
python -m build

# 3. 上传到 PyPI
twine upload dist/*

# 或先上传到 TestPyPI 测试
twine upload --repository testpypi dist/*
```

## License

MIT
