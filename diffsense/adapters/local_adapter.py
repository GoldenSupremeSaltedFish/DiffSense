import os
import json
from typing import Optional, List, Dict, Any
from .base import PlatformAdapter


class LocalFileAdapter(PlatformAdapter):
    """
    本地文件适配器，用于 AI Agent 和本地调试场景。
    
    从本地文件读取 diff，将输出写入本地文件。
    """
    
    def __init__(
        self,
        diff_file_path: Optional[str] = None,
        output_dir: str = ".",
        report_filename: str = "diffsense-report.json",
        comments_filename: str = "diffsense-comments.json",
        html_filename: str = "diffsense-report.html"
    ):
        """
        Args:
            diff_file_path: diff 文件路径。如果为 None，则调用者需要在 fetch_diff 中提供内容
            output_dir: 输出目录
            report_filename: 审计报告文件名
            comments_filename: 内联评论文件名
            html_filename: HTML 报告文件名
        """
        self.diff_file_path = diff_file_path
        self.output_dir = output_dir
        self.report_filename = report_filename
        self.comments_filename = comments_filename
        self.html_filename = html_filename
        self._last_diff_content: Optional[str] = None
        self._last_comments: Optional[List[Dict[str, Any]]] = None
    
    def set_diff_content(self, content: str):
        """直接设置 diff 内容（用于流式场景）"""
        self._last_diff_content = content
    
    def fetch_diff(self) -> str:
        """从文件读取 diff 内容"""
        if self._last_diff_content is not None:
            return self._last_diff_content
        
        if self.diff_file_path is None:
            raise ValueError("diff_file_path not set and no diff content provided")
        
        with open(self.diff_file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def post_comment(self, content: str):
        """
        将报告内容写入本地文件。
        支持 JSON 和 Markdown 格式。
        """
        output_path = os.path.join(self.output_dir, self.report_filename)
        
        # Try to parse as JSON first
        try:
            data = json.loads(content)
            with open(output_path.replace('.json', '-comment.json'), 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except (json.JSONDecodeError, TypeError):
            # Fall back to markdown
            with open(output_path.replace('.json', '-comment.md'), 'w', encoding='utf-8') as f:
                f.write(content)
    
    def save_report(self, report_data: Dict[str, Any]):
        """
        直接保存结构化报告数据（推荐使用）
        """
        output_path = os.path.join(self.output_dir, self.report_filename)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
    
    def save_html_report(self, html_content: str):
        """保存 HTML 报告"""
        output_path = os.path.join(self.output_dir, self.html_filename)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
    
    def post_inline_comments(self, comments: List[Dict[str, Any]]):
        """保存内联评论到文件"""
        output_path = os.path.join(self.output_dir, self.comments_filename)
        self._last_comments = comments
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(comments, f, ensure_ascii=False, indent=2)
    
    def is_approved(self) -> bool:
        """本地模式默认返回 False（无审批流程）"""
        return False
    
    def get_output_paths(self) -> Dict[str, str]:
        """返回所有输出文件路径"""
        return {
            "report": os.path.join(self.output_dir, self.report_filename),
            "comments": os.path.join(self.output_dir, self.comments_filename),
            "html": os.path.join(self.output_dir, self.html_filename),
        }


class StreamingLocalAdapter(LocalFileAdapter):
    """
    流式本地适配器，支持处理未保存的 diff 内容。
    适用于 AI Agent 场景，用户无需先保存 diff 文件。
    """
    
    def __init__(self, output_dir: str = ".", **kwargs):
        super().__init__(diff_file_path=None, output_dir=output_dir, **kwargs)
    
    def analyze_and_save(
        self,
        diff_content: str,
        report_data: Dict[str, Any],
        inline_comments: Optional[List[Dict[str, Any]]] = None,
        html_report: Optional[str] = None
    ):
        """
        一站式分析结果保存。
        
        Args:
            diff_content: 原始 diff 内容
            report_data: 结构化审计报告
            inline_comments: 内联评论列表
            html_report: HTML 报告内容
        """
        self._last_diff_content = diff_content
        self.save_report(report_data)
        
        if inline_comments:
            self.post_inline_comments(inline_comments)
        
        if html_report:
            self.save_html_report(html_report)
