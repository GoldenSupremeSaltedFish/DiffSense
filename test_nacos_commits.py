#!/usr/bin/env python3
"""测试 Nacos 提交的规则触发情况 - 直接调用核心模块"""

import sys
import os
import io

# 设置 UTF-8 输出编码
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 添加 diffsense 到路径
sys.path.insert(0, r"C:\Users\30871\Desktop\diffsense-work-space\DiffSense\diffsense")

from core.parser import DiffParser
from core.ast_detector import ASTDetector
from core.rules import RuleEngine
from core.evaluator import ImpactEvaluator
from core.composer import DecisionComposer

# Nacos 仓库路径
NACOS_PATH = r"C:\Users\30871\Desktop\diffsense-work-space\DiffSense\test-space\nacos"

# 测试最近的几条提交
TEST_COMMITS = [
    ("1fae1be", "docs: replace defunct Travis CI badge"),
    ("c87f888", "feat(client): add OIDC client-side authentication"),
    ("4042231", "fix(naming): 添加分页参数验证"),
    ("9e031f1", "fix(common): add final to static fields"),
    ("2f89bb21", "refactor(client): replace Random with ThreadLocalRandom"),
    ("d2fd6e22", "test(ai): add mock for publishConfig"),
]

def get_diff(commit_hash):
    """获取 commit 与其父提交的 diff"""
    import subprocess
    result = subprocess.run(
        ["git", "show", commit_hash, "--format="],
        cwd=NACOS_PATH,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='ignore'
    )
    return result.stdout

def run_audit(diff_content):
    """运行 DiffSense 审计 - 直接调用核心模块"""
    # 1. 解析 Diff
    parser = DiffParser()
    diff_data = parser.parse(diff_content)

    if not diff_data.get('files'):
        return {"status": "no_files", "result": None}

    # 2. 检测 AST 信号
    detector = ASTDetector()
    ast_signals = detector.detect_signals(diff_data)

    # 3. 加载规则并评估
    rules_path = r"C:\Users\30871\Desktop\diffsense-work-space\DiffSense\diffsense\config\rules.yaml"
    engine = RuleEngine(rules_path)
    evaluator = ImpactEvaluator(engine)
    impacts = evaluator.evaluate(diff_data, ast_signals=ast_signals)

    # 4. 合成决策
    composer = DecisionComposer()
    decision = composer.compose(impacts)

    return {
        "status": "success",
        "result": {
            "review_level": decision.get("review_level", "normal"),
            "details": impacts,
            "files": diff_data.get('files', []),
            "ast_signals": ast_signals
        }
    }

def main():
    print("=" * 60)
    print("DiffSense 规则触发测试 - Nacos 仓库")
    print("=" * 60)

    for commit, desc in TEST_COMMITS:
        print(f"\n{'=' * 60}")
        print(f"Commit: {commit[:8]} - {desc}")
        print("=" * 60)

        diff = get_diff(commit)
        if not diff:
            print("No diff found")
            continue

        # 过滤 Java 文件的改动
        java_lines = [line for line in diff.split('\n') if line.endswith('.java') or line.startswith('diff') or line.startswith('@@') or line.startswith('+') or line.startswith('-') or line.startswith(' ')]
        java_diff = '\n'.join(java_lines[:500])  # 限制大小

        if len(diff) > 10000:
            print(f"Diff 长度: {len(diff)} 字符 (截取前 500 行)")
        else:
            print(f"Diff 长度: {len(diff)} 字符")

        # 运行审计
        print("\n运行 DiffSense 审计...")
        result = run_audit(java_diff)

        if result["status"] == "success":
            data = result["result"]
            print(f"\n审查级别: {data['review_level']}")
            print(f"修改文件数: {len(data.get('files', []))}")
            print(f"AST 信号数: {len(data.get('ast_signals', []))}")

            if data.get('details'):
                print("\n触发的规则:")
                for d in data['details'][:10]:  # 只显示前 10 条
                    print(f"  - {d.get('id', 'unknown')}: {d.get('severity', '?')} - {d.get('rationale', '')[:60]}")
            else:
                print("\n无规则触发 [OK]")
        else:
            print(f"审计失败: {result['status']}")

if __name__ == "__main__":
    main()