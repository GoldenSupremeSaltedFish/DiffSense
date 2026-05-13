"""
DiffSense MCP Server

使用 FastMCP 框架实现的 MCP Server，提供代码审计工具供 AI Agent 调用。
"""
import os
import json
from typing import Optional, Dict, Any, List
from mcp.server.fastmcp import FastMCP

# 创建 FastMCP 实例
mcp = FastMCP("DiffSense", json_response=True)

# 默认配置
DEFAULT_RULES_PATH = "config"
DEFAULT_OUTPUT_DIR = "diffsense-mcp-output"


@mcp.tool()
async def audit_diff(
    diff_content: str,
    rules_path: str = DEFAULT_RULES_PATH,
    profile: Optional[str] = None,
    output_dir: str = DEFAULT_OUTPUT_DIR,
) -> Dict[str, Any]:
    """
    审计代码变更 diff 内容。
    
    Args:
        diff_content: Git unified diff 内容
        rules_path: 规则配置文件或目录路径
        profile: 规则 profile (strict, lightweight, 或 None)
        output_dir: 输出目录路径
    
    Returns:
        结构化审计结果，包含 review_level, details, _metrics 等字段
    """
    from diffsense.core import analyze_diff, build_inline_comments
    from diffsense.adapters.local_adapter import LocalFileAdapter
    from diffsense.core.renderer import HtmlRenderer
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. 执行核心分析
    result = analyze_diff(
        diff_content=diff_content,
        rules_path=rules_path,
        profile=profile,
    )
    
    # 2. 构建内联评论
    from diffsense.core.parser import DiffParser
    parser = DiffParser()
    diff_data = parser.parse(diff_content)
    inline_comments = build_inline_comments(result.get("details", []), diff_data)
    
    # 3. 保存结果到本地文件
    adapter = LocalFileAdapter(output_dir=output_dir)
    adapter.save_report(result)
    adapter.post_inline_comments(inline_comments)
    
    # 4. 生成 HTML 报告
    html_renderer = HtmlRenderer()
    html_report = html_renderer.render(result)
    adapter.save_html_report(html_report)
    
    # 添加输出路径信息到结果
    output_paths = adapter.get_output_paths()
    result["_output_paths"] = output_paths
    
    return result


@mcp.tool()
async def audit_diff_file(
    diff_file_path: str,
    rules_path: str = DEFAULT_RULES_PATH,
    profile: Optional[str] = None,
    output_dir: str = DEFAULT_OUTPUT_DIR,
    baseline_file: Optional[str] = None,
    since_baseline: bool = False,
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
    
    # 从文件读取 diff 内容
    adapter = LocalFileAdapter(diff_file_path=diff_file_path)
    diff_content = adapter.fetch_diff()
    
    # 调用已有的 audit_diff 工具
    return await audit_diff(
        diff_content=diff_content,
        rules_path=rules_path,
        profile=profile,
        output_dir=output_dir,
    )


@mcp.tool()
async def get_audit_summary(
    report_data: str,
) -> str:
    """
    获取审计报告的文本摘要（用于在 AI 对话中展示）。
    
    Args:
        report_data: audit_diff 或 audit_diff_file 返回的结构化报告
    
    Returns:
        格式化的文本摘要
    """
    review_level = report_data.get("review_level", "unknown")
    details = report_data.get("details", [])
    metrics = report_data.get("_metrics", {})
    
    lines = []
    lines.append("=" * 50)
    lines.append("🔍 DiffSense Audit Summary")
    lines.append("=" * 50)
    lines.append(f"Review Level: {review_level.upper()}")
    lines.append(f"Total Issues: {len(details)}")
    
    if details:
        # 按严重程度分组
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "unknown": 0}
        for d in details:
            sev = d.get("severity", "unknown")
            if sev in severity_counts:
                severity_counts[sev] += 1
        
        lines.append("\n📊 Severity Breakdown:")
        for sev in ["critical", "high", "medium", "low"]:
            if severity_counts[sev] > 0:
                lines.append(f"  • {sev.upper()}: {severity_counts[sev]}")
        
        # 显示前 5 个问题
        lines.append("\n⚠️ Top Issues:")
        for i, d in enumerate(details[:5], 1):
            lines.append(f"  {i}. [{d.get('severity', 'unknown').upper()}] {d.get('id', 'N/A')}")
            lines.append(f"     {d.get('title', 'N/A')[:60]}")
            lines.append(f"     File: {d.get('matched_file', 'N/A')}")
    else:
        lines.append("\n✅ No issues found!")
    
    # 性能指标
    perf = report_data.get("_performance", {})
    if perf:
        lines.append(f"\n📈 Cache Hit Rate: {perf.get('cache_hit_rate_pct', 0)}%")
        lines.append(f"📈 Rules Executed: {perf.get('rules_executed_pct', 0)}%")
    
    lines.append("=" * 50)
    
    return "\n".join(lines)


@mcp.resource("diffsense://rules")
async def list_audit_rules() -> List[Dict[str, Any]]:
    """
    列出当前加载的审计规则。
    
    Returns:
        规则列表，每条包含 id, title, severity, description
    """
    from diffsense.core.rules import RuleEngine
    
    try:
        engine = RuleEngine(DEFAULT_RULES_PATH)
        rules = engine.get_all_rules()
        
        return [
            {
                "id": r.get("id", ""),
                "title": r.get("title", ""),
                "severity": r.get("severity", "unknown"),
                "description": r.get("description", "")[:200],
            }
            for r in rules
        ]
    except Exception as e:
        return [{"error": str(e)}]


@mcp.resource("diffsense://config")
async def get_audit_config() -> Dict[str, Any]:
    """
    获取当前审计配置。
    
    Returns:
        配置字典
    """
    try:
        from diffsense.core.run_config import get_run_config
        return get_run_config(os.getcwd())
    except Exception:
        return {}


@mcp.prompt()
def review_code_changes(
    diff_content: str = "$DIFF_CONTENT",
    focus_areas: str = "security,performance,best_practices",
) -> str:
    """
    生成代码审查提示词，用于让 AI 分析 diff。
    
    Args:
        diff_content: Git diff 内容
        focus_areas: 关注的审查领域（逗号分隔）
    
    Returns:
        完整的提示词
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
