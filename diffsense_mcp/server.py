"""
DiffSense MCP Server

使用 FastMCP 框架实现的 MCP Server，提供代码审计工具供 AI Agent 调用。
支持多语言规则自动适配和 Git 联动。
"""
import os
import json
import subprocess
import fnmatch
from typing import Optional, Dict, Any, List
from mcp.server.fastmcp import FastMCP

# 创建 FastMCP 实例
mcp = FastMCP("DiffSense", json_response=True)

# 默认配置
DEFAULT_RULES_PATH = "config"
DEFAULT_OUTPUT_DIR = "diffsense-mcp-output"

# 语言与文件扩展名映射
LANG_EXTENSIONS = {
    "python": [".py"],
    "javascript": [".js", ".jsx", ".ts", ".tsx", ".mjs"],
    "java": [".java"],
    "go": [".go"],
    "cpp": [".cpp", ".cxx", ".cc", ".c", ".h", ".hpp", ".hxx"],
}

# 扩展名反查语言
EXT_TO_LANG = {}
for lang, exts in LANG_EXTENSIONS.items():
    for ext in exts:
        EXT_TO_LANG[ext] = lang


def _detect_languages_from_diff(diff_content: str) -> List[str]:
    """从 diff 内容中检测涉及的语言"""
    languages = set()
    for line in diff_content.splitlines():
        if line.startswith("+++ b/") or line.startswith("--- a/"):
            path = line.split("/", 1)[-1] if "/" in line else line[6:]
            _, ext = os.path.splitext(path)
            if ext in EXT_TO_LANG:
                languages.add(EXT_TO_LANG[ext])
    return sorted(languages)


def _detect_languages_from_files(file_paths: List[str]) -> List[str]:
    """从文件列表中检测涉及的语言"""
    languages = set()
    for path in file_paths:
        _, ext = os.path.splitext(path)
        if ext in EXT_TO_LANG:
            languages.add(EXT_TO_LANG[ext])
    return sorted(languages)


def _get_rules_path_for_languages(base_rules_path: str, languages: List[str]) -> str:
    """根据检测到的语言返回合适的规则路径"""
    return base_rules_path


def _run_git(args: List[str], cwd: str = ".") -> tuple:
    """执行 git 命令并返回 (returncode, stdout, stderr)"""
    try:
        result = subprocess.run(
            ["git"] + args,
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=30,
            encoding="utf-8",
            errors="replace",
        )
        return result.returncode, result.stdout, result.stderr
    except FileNotFoundError:
        return 1, "", "git not found"
    except subprocess.TimeoutExpired:
        return 1, "", "git command timed out"
    except Exception as e:
        return 1, "", str(e)


def _is_git_repo(path: str = ".") -> bool:
    """检查是否是 git 仓库"""
    code, _, _ = _run_git(["rev-parse", "--is-inside-work-tree"], cwd=path)
    return code == 0


# ============================================================
# Tools
# ============================================================

@mcp.tool()
async def audit_diff(
    diff_content: str,
    rules_path: str = DEFAULT_RULES_PATH,
    profile: Optional[str] = None,
    output_dir: str = DEFAULT_OUTPUT_DIR,
) -> Dict[str, Any]:
    """
    审计代码变更 diff 内容。自动识别 diff 中涉及的语言并加载对应规则。

    Args:
        diff_content: Git unified diff 内容
        rules_path: 规则配置文件或目录路径
        profile: 规则 profile (strict, lightweight, 或 None)
        output_dir: 输出目录路径

    Returns:
        结构化审计结果，包含 review_level, details, _metrics, _languages 等字段
    """
    from diffsense.core import analyze_diff, build_inline_comments
    from diffsense.adapters.local_adapter import LocalFileAdapter

    # 检测涉及的语言
    languages = _detect_languages_from_diff(diff_content)

    os.makedirs(output_dir, exist_ok=True)

    # 执行核心分析
    result = analyze_diff(
        diff_content=diff_content,
        rules_path=rules_path,
        profile=profile,
    )

    # 构建内联评论
    from diffsense.core.parser import DiffParser
    parser = DiffParser()
    diff_data = parser.parse(diff_content)
    inline_comments = build_inline_comments(result.get("details", []), diff_data)

    # 保存结果
    adapter = LocalFileAdapter(output_dir=output_dir)
    adapter.save_report(result)
    adapter.post_inline_comments(inline_comments)

    # 生成 HTML 报告
    try:
        from diffsense.core.renderer import HtmlRenderer
        html_renderer = HtmlRenderer()
        html_report = html_renderer.render(result)
        adapter.save_html_report(html_report)
    except Exception:
        pass

    # 添加语言信息
    result["_languages"] = languages
    result["_output_paths"] = adapter.get_output_paths()

    return result


@mcp.tool()
async def audit_diff_file(
    diff_file_path: str,
    rules_path: str = DEFAULT_RULES_PATH,
    profile: Optional[str] = None,
    output_dir: str = DEFAULT_OUTPUT_DIR,
) -> Dict[str, Any]:
    """
    审计本地 diff 文件。

    Args:
        diff_file_path: diff 文件路径
        rules_path: 规则配置文件或目录路径
        profile: 规则 profile (strict, lightweight, 或 None)
        output_dir: 输出目录路径

    Returns:
        结构化审计结果
    """
    from diffsense.adapters.local_adapter import LocalFileAdapter

    adapter = LocalFileAdapter(diff_file_path=diff_file_path)
    diff_content = adapter.fetch_diff()

    return await audit_diff(
        diff_content=diff_content,
        rules_path=rules_path,
        profile=profile,
        output_dir=output_dir,
    )


@mcp.tool()
async def audit_git_changes(
    repo_path: str = ".",
    base: str = "HEAD~1",
    head: str = "HEAD",
    rules_path: str = DEFAULT_RULES_PATH,
    profile: Optional[str] = None,
    output_dir: str = DEFAULT_OUTPUT_DIR,
) -> Dict[str, Any]:
    """
    审计 Git 仓库中两个提交之间的代码变更。与 Git 联动，自动获取 diff。

    适用于：
    - 审计最近一次提交的变更
    - 对比两个分支的差异
    - 审计某个 PR 的所有变更

    Args:
        repo_path: Git 仓库路径
        base: 基准提交（默认 HEAD~1，即最近一次提交）
        head: 目标提交（默认 HEAD）
        rules_path: 规则配置文件或目录路径
        profile: 规则 profile (strict, lightweight, 或 None)
        output_dir: 输出目录路径

    Returns:
        结构化审计结果，额外包含 git_info 字段
    """
    # 检查是否是 git 仓库
    if not _is_git_repo(repo_path):
        return {
            "review_level": "error",
            "message": f"Not a git repository: {repo_path}",
            "details": [],
        }

    # 获取 diff
    code, stdout, stderr = _run_git(
        ["diff", "--no-color", f"{base}...{head}"],
        cwd=repo_path,
    )

    if code != 0:
        # 尝试三点语法失败，用两点语法
        code, stdout, stderr = _run_git(
            ["diff", "--no-color", f"{base}", f"{head}"],
            cwd=repo_path,
        )

    if code != 0:
        return {
            "review_level": "error",
            "message": f"Failed to get git diff: {stderr}",
            "details": [],
        }

    diff_content = stdout
    if not diff_content.strip():
        return {
            "review_level": "pass",
            "message": "No changes found between the specified commits.",
            "details": [],
            "git_info": {"base": base, "head": head, "has_changes": False},
        }

    # 获取提交信息
    _, log_stdout, _ = _run_git(
        ["log", "--oneline", f"{base}..{head}"],
        cwd=repo_path,
    )

    # 获取变更文件列表
    _, files_stdout, _ = _run_git(
        ["diff", "--name-only", f"{base}", f"{head}"],
        cwd=repo_path,
    )

    changed_files = [f for f in files_stdout.strip().splitlines() if f]

    # 调用核心审计
    result = await audit_diff(
        diff_content=diff_content,
        rules_path=rules_path,
        profile=profile,
        output_dir=output_dir,
    )

    # 添加 Git 信息
    result["git_info"] = {
        "base": base,
        "head": head,
        "has_changes": True,
        "commits": log_stdout.strip().splitlines(),
        "changed_files": changed_files,
    }

    return result


@mcp.tool()
async def audit_git_staged(
    repo_path: str = ".",
    rules_path: str = DEFAULT_RULES_PATH,
    profile: Optional[str] = None,
    output_dir: str = DEFAULT_OUTPUT_DIR,
) -> Dict[str, Any]:
    """
    审计 Git 暂存区（staged）的代码变更。在 commit 之前进行预检。

    适用于：
    - 提交前自动审计
    - 作为 pre-commit hook 的替代方案
    - AI Agent 辅助代码审查

    Args:
        repo_path: Git 仓库路径
        rules_path: 规则配置文件或目录路径
        profile: 规则 profile (strict, lightweight, 或 None)
        output_dir: 输出目录路径

    Returns:
        结构化审计结果
    """
    if not _is_git_repo(repo_path):
        return {
            "review_level": "error",
            "message": f"Not a git repository: {repo_path}",
            "details": [],
        }

    # 获取暂存区 diff
    code, stdout, stderr = _run_git(
        ["diff", "--cached", "--no-color"],
        cwd=repo_path,
    )

    if code != 0:
        return {
            "review_level": "error",
            "message": f"Failed to get staged diff: {stderr}",
            "details": [],
        }

    diff_content = stdout
    if not diff_content.strip():
        return {
            "review_level": "pass",
            "message": "No staged changes found.",
            "details": [],
        }

    # 获取暂存文件列表
    _, files_stdout, _ = _run_git(
        ["diff", "--cached", "--name-only"],
        cwd=repo_path,
    )

    staged_files = [f for f in files_stdout.strip().splitlines() if f]

    # 调用核心审计
    result = await audit_diff(
        diff_content=diff_content,
        rules_path=rules_path,
        profile=profile,
        output_dir=output_dir,
    )

    result["git_info"] = {
        "type": "staged",
        "staged_files": staged_files,
    }

    return result


@mcp.tool()
async def audit_workspace(
    workspace_path: str = ".",
    file_patterns: str = "*.py,*.js,*.ts,*.java,*.go,*.cpp",
    rules_path: str = DEFAULT_RULES_PATH,
    profile: Optional[str] = None,
    output_dir: str = DEFAULT_OUTPUT_DIR,
) -> Dict[str, Any]:
    """
    审计整个工作区的代码文件。自动识别语言并加载对应规则。

    扫描指定目录下的代码文件，检测潜在的安全问题、性能问题、代码异味等。
    适用于对整个项目进行安全审计或代码质量评估。

    Args:
        workspace_path: 工作区根目录路径
        file_patterns: 要扫描的文件模式（逗号分隔），如 "*.py,*.js"
        rules_path: 规则配置文件或目录路径
        profile: 规则 profile (strict, lightweight, 或 None)
        output_dir: 输出目录路径

    Returns:
        结构化审计结果
    """
    from diffsense.core import analyze_diff
    from diffsense.adapters.local_adapter import LocalFileAdapter

    patterns = [p.strip() for p in file_patterns.split(",")]

    # 收集文件
    scan_files = []
    skip_dirs = {
        '.git', '__pycache__', 'node_modules', 'venv', '.venv',
        'dist', 'build', '.idea', '.vscode', 'target', 'bin', 'obj',
        '.tox', '.mypy_cache', '.pytest_cache', 'egg-info',
    }

    for root, dirs, files in os.walk(workspace_path):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for filename in files:
            for pattern in patterns:
                if fnmatch.fnmatch(filename, pattern):
                    scan_files.append(os.path.join(root, filename))
                    break

    if not scan_files:
        return {
            "review_level": "pass",
            "message": f"No files found matching patterns: {file_patterns}",
            "total_files_scanned": 0,
            "total_issues": 0,
            "issues_by_file": {},
            "severity_summary": {},
            "_languages": [],
        }

    # 检测语言
    languages = _detect_languages_from_files(scan_files)

    # 审计每个文件
    all_issues = []
    files_with_issues = 0

    for file_path in scan_files:
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            if not content.strip():
                continue

            rel_path = os.path.relpath(file_path, workspace_path)
            line_count = len(content.splitlines())

            # 构造 diff（整个文件作为新增）
            diff_content = f"diff --git a/{rel_path} b/{rel_path}\n"
            diff_content += f"new file mode 100644\n"
            diff_content += f"--- /dev/null\n"
            diff_content += f"+++ b/{rel_path}\n"
            diff_content += f"@@ -0,0 +1,{line_count} @@\n"

            for line in content.splitlines():
                diff_content += f"+{line}\n"

            result = analyze_diff(
                diff_content=diff_content,
                rules_path=rules_path,
                profile=profile,
            )

            issues = result.get("details", [])
            if issues:
                files_with_issues += 1
                for issue in issues:
                    issue["file"] = rel_path
                    all_issues.append(issue)

        except Exception:
            continue

    # 统计
    severity_summary = {"critical": 0, "high": 0, "medium": 0, "low": 0, "unknown": 0}
    for issue in all_issues:
        sev = issue.get("severity", "unknown")
        if sev in severity_summary:
            severity_summary[sev] += 1

    if severity_summary["critical"] > 0:
        review_level = "critical"
    elif severity_summary["high"] > 0:
        review_level = "high"
    elif severity_summary["medium"] > 0:
        review_level = "medium"
    elif severity_summary["low"] > 0:
        review_level = "low"
    else:
        review_level = "pass"

    issues_by_file = {}
    for issue in all_issues:
        fp = issue.get("file", "unknown")
        if fp not in issues_by_file:
            issues_by_file[fp] = []
        issues_by_file[fp].append(issue)

    # 保存结果
    os.makedirs(output_dir, exist_ok=True)
    output_data = {
        "review_level": review_level,
        "total_files_scanned": len(scan_files),
        "total_issues": len(all_issues),
        "files_with_issues": files_with_issues,
        "severity_summary": severity_summary,
        "issues_by_file": issues_by_file,
        "_languages": languages,
    }

    adapter = LocalFileAdapter(output_dir=output_dir)
    adapter.save_report(output_data)

    return output_data


@mcp.tool()
async def get_audit_summary(
    report_data: str,
) -> str:
    """
    获取审计报告的文本摘要（用于在 AI 对话中展示）。

    Args:
        report_data: audit_diff/audit_git_changes 等返回的 JSON 字符串

    Returns:
        格式化的文本摘要
    """
    try:
        data = json.loads(report_data) if isinstance(report_data, str) else report_data
    except (json.JSONDecodeError, TypeError):
        data = {}

    review_level = data.get("review_level", "unknown")
    details = data.get("details", [])
    metrics = data.get("_metrics", {})
    languages = data.get("_languages", [])
    git_info = data.get("git_info", {})

    lines = []
    lines.append("=" * 50)
    lines.append("DiffSense Audit Summary")
    lines.append("=" * 50)
    lines.append(f"Review Level: {review_level.upper()}")

    if languages:
        lines.append(f"Languages: {', '.join(languages)}")

    if git_info:
        if "base" in git_info:
            lines.append(f"Git: {git_info['base']}..{git_info['head']}")
            if git_info.get("commits"):
                lines.append(f"Commits: {len(git_info['commits'])}")
            if git_info.get("changed_files"):
                lines.append(f"Changed Files: {len(git_info['changed_files'])}")
        elif git_info.get("type") == "staged":
            lines.append(f"Git: staged changes ({len(git_info.get('staged_files', []))} files)")

    lines.append(f"Total Issues: {len(details)}")

    if details:
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "unknown": 0}
        for d in details:
            sev = d.get("severity", "unknown")
            if sev in severity_counts:
                severity_counts[sev] += 1

        lines.append("")
        lines.append("Severity Breakdown:")
        for sev in ["critical", "high", "medium", "low"]:
            if severity_counts[sev] > 0:
                lines.append(f"  * {sev.upper()}: {severity_counts[sev]}")

        lines.append("")
        lines.append("Top Issues:")
        for i, d in enumerate(details[:5], 1):
            lines.append(f"  {i}. [{d.get('severity', 'unknown').upper()}] {d.get('id', 'N/A')}")
            title = d.get('title', d.get('rationale', 'N/A'))
            lines.append(f"     {str(title)[:60]}")
            if d.get("matched_file") or d.get("file"):
                lines.append(f"     File: {d.get('matched_file', d.get('file', 'N/A'))}")
    else:
        lines.append("")
        lines.append("No issues found!")

    perf = data.get("_performance", {})
    if perf:
        lines.append(f"")
        lines.append(f"Cache Hit Rate: {perf.get('cache_hit_rate_pct', 0)}%")

    lines.append("=" * 50)

    return "\n".join(lines)


# ============================================================
# Resources
# ============================================================

@mcp.resource("diffsense://rules")
async def list_audit_rules() -> List[Dict[str, Any]]:
    """列出当前加载的审计规则"""
    from diffsense.core.rules import RuleEngine

    try:
        engine = RuleEngine(DEFAULT_RULES_PATH)
        rules = engine.get_all_rules()

        return [
            {
                "id": r.get("id", ""),
                "title": r.get("title", ""),
                "severity": r.get("severity", "unknown"),
                "language": r.get("language", "unknown"),
                "description": r.get("description", "")[:200],
            }
            for r in rules
        ]
    except Exception as e:
        return [{"error": str(e)}]


@mcp.resource("diffsense://config")
async def get_audit_config() -> Dict[str, Any]:
    """获取当前审计配置"""
    try:
        from diffsense.core.run_config import get_run_config
        return get_run_config(os.getcwd())
    except Exception:
        return {}


@mcp.resource("diffsense://languages")
async def list_supported_languages() -> Dict[str, Any]:
    """列出支持的语言和对应的文件扩展名"""
    return {
        "languages": LANG_EXTENSIONS,
        "total": len(LANG_EXTENSIONS),
    }


# ============================================================
# Prompts
# ============================================================

@mcp.prompt()
def review_code_changes(
    diff_content: str = "$DIFF_CONTENT",
    focus_areas: str = "security,performance,best_practices",
) -> str:
    """
    生成代码审查提示词，用于让 AI 分析 diff。
    """
    return f"""请审查以下代码变更，重点关注以下方面：{focus_areas}

## Diff 内容
```
{diff_content}
```

请提供：
1. 发现的问题及其严重程度
2. 修复建议
3. 代码质量评估"""


@mcp.prompt()
def review_git_changes(
    repo_path: str = ".",
    base: str = "HEAD~1",
    head: str = "HEAD",
) -> str:
    """
    生成 Git 变更审查提示词。
    """
    return f"""请审查 Git 仓库 {repo_path} 中从 {base} 到 {head} 的代码变更。

请使用 audit_git_changes 工具获取变更详情，然后分析：
1. 变更的整体风险等级
2. 每个文件的安全问题
3. 修复建议"""


def main():
    """MCP Server 入口点"""
    import sys

    transport = "stdio"
    if len(sys.argv) > 1:
        if sys.argv[1] == "--http":
            transport = "streamable-http"

    mcp.run(transport=transport)


if __name__ == "__main__":
    main()
