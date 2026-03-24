import argparse
import os
import sys
from adapters.github_adapter import GitHubAdapter
from adapters.gitlab_adapter import GitLabAdapter
from core.parser import DiffParser
from core.ast_detector import ASTDetector
from core.rules import RuleEngine
from core.evaluator import ImpactEvaluator
from core.composer import DecisionComposer
from core.renderer import MarkdownRenderer, HtmlRenderer
from banner import print_banner
from main import _load_baseline, _save_baseline, _baseline_items, _baseline_set, _baseline_key, _build_inline_comments, _write_json


def run_audit(adapter, rules_path, profile=None, pro_rules_path=None, baseline=False, since_baseline=False, baseline_file=".diffsense-baseline.json", report_json="diffsense-report.json", report_html="diffsense-report.html", comments_json="diffsense-comments.json", quality_auto_tune=False, quality_disable_threshold=0.3, quality_downgrade_threshold=0.5, quality_min_samples=30, experimental=False, experimental_report_only=True):
    print_banner()
    
    # Print platform and configuration info
    print(f"{'='*60}")
    print("🚀 DIFFSENSE AUDIT STARTING")
    print(f"{'='*60}")
    print(f"📋 Platform: {type(adapter).__name__}")
    print(f"📋 Profile: {profile or 'default'}")
    print(f"📋 Rules path: {rules_path}")
    if pro_rules_path:
        print(f"📋 Pro rules: {pro_rules_path}")
    print(f"{'='*60}\n")
    
    print("Fetching diff...")
    
    # Try to fetch diff with error handling
    try:
        diff_content = adapter.fetch_diff()
    except Exception as e:
        print(f"❌ ERROR: Failed to fetch diff: {e}")
        import traceback
        traceback.print_exc()
        # Save error to report
        error_report = {
            "error": str(e),
            "review_level": "error",
            "details": [],
            "_metrics": {"fetch_error": str(e)}
        }
        _write_json(report_json, error_report)
        return
    
    print(f"\n{'='*60}")
    print("📊 DIFF FETCH SUMMARY")
    print(f"{'='*60}")
    print(f"✅ Diff fetched successfully")
    print(f"📏 Length: {len(diff_content)} characters")
    print(f"📏 Lines: {len(diff_content.splitlines())}")
    
    # Validate diff format
    diff_lines = diff_content.splitlines()
    has_git_diff = any(line.startswith("diff --git") for line in diff_lines)
    has_plus = any(line.startswith("+") and not line.startswith("+++") for line in diff_lines)
    has_minus = any(line.startswith("-") and not line.startswith("---") for line in diff_lines)
    
    print(f"\n📋 Diff validation:")
    print(f"  - Has 'diff --git' headers: {has_git_diff}")
    print(f"  - Has additions (+): {has_plus}")
    print(f"  - Has deletions (-): {has_minus}")
    
    if not has_git_diff:
        print("\n⚠️  WARNING: Diff doesn't contain expected 'diff --git' headers!")
        print("First 1000 chars preview:")
        print(diff_content[:1000])
    
    if len(diff_content) < 500:
        print(f"\n📄 Full diff content:\n{diff_content}")
    else:
        print(f"\n📄 Diff preview (first 500 chars):\n{diff_content[:500]}...")
    
    print(f"{'='*60}\n")

    if not diff_content.strip():
        print("⚠️  Diff is empty, skipping audit.")
        return

    print("Running Core Analyzer...")
    
    # 1. Parse Diff (Structural)
    print("\n🔍 Step 1: Parsing diff...")
    parser = DiffParser()
    diff_data = parser.parse(diff_content)
    
    print(f"\n{'='*60}")
    print("📊 DIFF PARSING RESULTS")
    print(f"{'='*60}")
    print(f"✅ Parsed {len(diff_data.get('files', []))} files")
    if diff_data.get('files'):
        print(f"\n📁 Files:")
        for f in diff_data.get('files', [])[:20]:  # Show first 20
            print(f"  - {f}")
        if len(diff_data.get('files', [])) > 20:
            print(f"  ... and {len(diff_data.get('files', [])) - 20} more")
    
    print(f"\n📊 Stats:")
    print(f"  - Additions: {diff_data.get('stats', {}).get('add', 0)}")
    print(f"  - Deletions: {diff_data.get('stats', {}).get('del', 0)}")
    print(f"  - New files: {len(diff_data.get('new_files', []))}")
    print(f"  - Change types: {diff_data.get('change_types', [])}")
    print(f"  - File patches: {len(diff_data.get('file_patches', []))}")
    print(f"{'='*60}\n")
    
    # 2. Detect AST Signals (Semantic)
    # This is the "First-Class Signal Source"
    print("\n🔍 Step 2: Detecting AST Signals...")
    ast_detector = ASTDetector()
    ast_signals = ast_detector.detect_signals(diff_data)
    
    print(f"\n{'='*60}")
    print("📊 AST SIGNALS DETECTED")
    print(f"{'='*60}")
    print(f"✅ Found {len(ast_signals)} AST signals")
    if ast_signals:
        print(f"\n📋 Signals by file:")
        signals_by_file = {}
        for sig in ast_signals:
            if sig.file not in signals_by_file:
                signals_by_file[sig.file] = []
            signals_by_file[sig.file].append(sig.id)
        
        for file, signal_ids in signals_by_file.items():
            print(f"  📁 {file}:")
            for sid in signal_ids:
                print(f"    - {sid}")
    print(f"{'='*60}\n")
    
    # 3. Evaluate Rules (Policy / Context)
    # Rules now consume both diff_data (structure) and ast_signals (semantics)
    print("\n🔍 Step 3: Loading rules and evaluating impacts...")
    quality_config = {
        "auto_tune": quality_auto_tune,
        "disable_threshold": quality_disable_threshold,
        "degrade_threshold": quality_downgrade_threshold,
        "min_samples": quality_min_samples
    }
    # 正式运行：若未显式传入 pro_rules_path，则从配置/环境/默认解析，使超级规则可被加载
    if pro_rules_path is None:
        try:
            from core.run_config import get_pro_rules_path
            pro_rules_path = get_pro_rules_path(os.getcwd())
        except Exception:
            pro_rules_path = None
    run_cfg = {}
    try:
        from core.run_config import get_run_config
        run_cfg = get_run_config(os.getcwd())
    except Exception:
        pass
    engine_config = {
        "rule_quality": quality_config,
        "experimental": {"enabled": experimental, "report_only": experimental_report_only},
    }
    if run_cfg.get("dependency_versions"):
        engine_config["dependency_versions"] = run_cfg["dependency_versions"]
    
    print(f"\n📋 Rule configuration:")
    print(f"  - Rules path: {rules_path}")
    print(f"  - Profile: {profile or 'default'}")
    print(f"  - Pro rules path: {pro_rules_path or 'not specified'}")
    print(f"  - Quality auto-tune: {quality_auto_tune}")
    
    engine = RuleEngine(
        rules_path,
        profile=profile,
        config=engine_config,
        pro_rules_path=pro_rules_path,
    )
    
    # Get rule stats before evaluation
    rule_stats = engine.get_rule_stats()
    print(f"\n📊 Rules loaded:")
    print(f"  - Total rules: {rule_stats.get('total_rules', 'N/A')}")
    print(f"  - Enabled rules: {rule_stats.get('enabled_rules', 'N/A')}")
    print(f"  - Rule profiles: {rule_stats.get('profiles', 'N/A')}")
    
    evaluator = ImpactEvaluator(engine)
    
    print("\n⚡ Evaluating rules against diff and AST signals...")
    impacts = evaluator.evaluate(diff_data, ast_signals=ast_signals)
    
    print(f"\n{'='*60}")
    print("📊 RULE EVALUATION RESULTS")
    print(f"{'='*60}")
    print(f"🎯 Total impacts found: {len(impacts)}")
    
    if impacts:
        # Group by file
        print(f"\n📁 Files with triggered rules:")
        severity_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3, "unknown": 4}
        files_with_issues = {}
        for r in impacts:
            file_path = r.get("matched_file", "unknown")
            if file_path not in files_with_issues:
                files_with_issues[file_path] = []
            files_with_issues[file_path].append(r)
        
        for file_path in sorted(files_with_issues.keys(), key=lambda x: (x == "unknown", x)):
            issues = files_with_issues[file_path]
            issues_count = len(issues)
            max_severity = min(issues, key=lambda x: severity_rank.get(x.get("severity", "unknown"), 4))["severity"]
            print(f"\n  📁 {file_path}")
            print(f"     Issues: {issues_count} | Max severity: {max_severity.upper()}")
            for issue in sorted(issues, key=lambda x: severity_rank.get(x.get("severity", "unknown"), 4)):
                print(f"     - [{issue.get('severity', 'unknown').upper()}] {issue.get('id', 'N/A')}: {issue.get('title', 'N/A')[:60]}")
        
        # Group by rule
        print(f"\n🎯 Triggered rules summary:")
        rules_triggered = {}
        for r in impacts:
            rule_id = r.get("id", "unknown")
            if rule_id not in rules_triggered:
                rules_triggered[rule_id] = {"count": 0, "files": [], "severity": r.get("severity", "unknown")}
            rules_triggered[rule_id]["count"] += 1
            rules_triggered[rule_id]["files"].append(r.get("matched_file", "unknown"))
        
        for rule_id in sorted(rules_triggered.keys(), key=lambda x: severity_rank.get(rules_triggered[x]["severity"], 4)):
            rule_info = rules_triggered[rule_id]
            print(f"\n  🎯 {rule_id} [{rule_info['severity'].upper()}]")
            print(f"     Triggered: {rule_info['count']} times")
            print(f"     Files: {', '.join(set(rule_info['files']))[:100]}")
    else:
        print("\n⚠️  No rules were triggered!")
        print("Possible reasons:")
        print("  1. No files matched rule patterns")
        print("  2. No AST signals detected")
        print("  3. Rules are disabled or filtered out")
        print("  4. Diff doesn't contain risky changes")
    
    print(f"\n{'='*60}\n")
    
    if baseline:
        _save_baseline(baseline_file, _baseline_items(impacts))
    if since_baseline:
        baseline_data = _load_baseline(baseline_file)
        baseline_keys = _baseline_set(baseline_data)
        impacts = [r for r in impacts if _baseline_key(r) not in baseline_keys]
    
    composer = DecisionComposer()
    # Ensure composer result matches structure expected by renderer
    # result keys: review_level, details
    result_decision = composer.compose(impacts)
    
    # Prepare Output for Renderer
    # Renderer expects 'result' dict to have 'review_level' and 'details' directly?
    # Or renderer.render takes the whole output_data?
    # Looking at renderer.render:
    # review_level = result.get("review_level", "unknown").capitalize()
    # details = result.get("details", [])
    
    # So we need to construct a dict that matches this structure.
    # composer.compose returns decision dict.
    
    render_input = {
        "review_level": result_decision.get("review_level", "unknown"),
        "details": impacts # Assuming impacts is a list of impact details
    }
    
    renderer = MarkdownRenderer()
    report = renderer.render(render_input)
    render_input["_metrics"] = dict(engine.get_metrics())
    render_input["_metrics"]["cache"] = {"diff": parser.metrics, "ast": ast_detector.metrics}
    render_input["_metrics"]["rule_stats"] = engine.get_rule_stats()
    render_input["_rule_quality"] = engine.get_rule_quality_metrics()
    render_input["_quality_warnings"] = engine.get_quality_warnings()
    engine.persist_rule_quality()
    _write_json(report_json, render_input)
    html_report = HtmlRenderer().render(render_input)
    with open(report_html, "w", encoding="utf-8") as f:
        f.write(html_report)
    inline_comments = _build_inline_comments(impacts, diff_data)
    _write_json(comments_json, inline_comments)
    
    # Print comprehensive summary to stderr for CI logs
    import sys
    sys.stderr.write("\n" + "="*80 + "\n")
    sys.stderr.write("🔍 DIFFSENSE AUDIT COMPLETE\n")
    sys.stderr.write("="*80 + "\n")
    
    if impacts:
        sys.stderr.write(f"\n📊 SUMMARY: {len(impacts)} issue(s) found in {len(files_with_issues)} file(s)\n\n")
        
        severity_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3, "unknown": 4}
        
        # Detailed file breakdown
        sys.stderr.write("📁 FILES WITH ISSUES:\n")
        for file_path in sorted(files_with_issues.keys(), key=lambda x: (x == "unknown", x)):
            if file_path != "unknown":
                issues = files_with_issues[file_path]
                issues_count = len(issues)
                max_severity = min(issues, key=lambda x: severity_rank.get(x.get("severity", "unknown"), 4))["severity"]
                sys.stderr.write(f"\n  📁 {file_path}\n")
                sys.stderr.write(f"     └─ {issues_count} issue(s), max severity: {max_severity.upper()}\n")
                for idx, issue in enumerate(sorted(issues, key=lambda x: severity_rank.get(x.get("severity", "unknown"), 4)), 1):
                    sys.stderr.write(f"        {idx}. [{issue.get('severity', 'unknown').upper()}] {issue.get('id', '')}\n")
                    sys.stderr.write(f"           └─ {issue.get('title', 'N/A')[:70]}\n")
        
        # Rule breakdown
        sys.stderr.write("\n🎯 TRIGGERED RULES:\n")
        rules_triggered = {}
        for r in impacts:
            rule_id = r.get("id", "unknown")
            if rule_id not in rules_triggered:
                rules_triggered[rule_id] = {"count": 0, "files": set(), "severity": r.get("severity", "unknown")}
            rules_triggered[rule_id]["count"] += 1
            rules_triggered[rule_id]["files"].add(r.get("matched_file", "unknown"))
        
        for rule_id in sorted(rules_triggered.keys(), key=lambda x: severity_rank.get(rules_triggered[x]["severity"], 4)):
            rule_info = rules_triggered[rule_id]
            files_list = ", ".join(sorted(rule_info["files"]))
            if len(files_list) > 80:
                files_list = files_list[:77] + "..."
            sys.stderr.write(f"\n  🎯 {rule_id} [{rule_info['severity'].upper()}]\n")
            sys.stderr.write(f"     └─ Triggered {rule_info['count']} time(s) in: {files_list}\n")
        
        # Severity breakdown
        sys.stderr.write("\n📊 SEVERITY BREAKDOWN:\n")
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "unknown": 0}
        for r in impacts:
            sev = r.get("severity", "unknown")
            if sev in severity_counts:
                severity_counts[sev] += 1
        
        for sev in ["critical", "high", "medium", "low", "unknown"]:
            if severity_counts[sev] > 0:
                sys.stderr.write(f"     └─ {sev.upper()}: {severity_counts[sev]}\n")
    else:
        sys.stderr.write("\n⚠️  NO ISSUES FOUND\n")
        sys.stderr.write("   Possible reasons:\n")
        sys.stderr.write("     - No files matched rule patterns\n")
        sys.stderr.write("     - No AST signals detected\n")
        sys.stderr.write("     - Rules are disabled or filtered out\n")
        sys.stderr.write("     - Diff doesn't contain risky changes\n")
    
    sys.stderr.write("\n" + "="*80 + "\n\n")

    print("Posting comment...")
    adapter.post_comment(report)
    # GitLab只保留一条主评论，避免额外的Inline摘要评论造成噪音；
    # GitHub仍可保留inline评论能力。
    if hasattr(adapter, "post_inline_comments") and type(adapter).__name__ != "GitLabAdapter":
        try:
            adapter.post_inline_comments(inline_comments)
        except Exception:
            pass
    
    # Enforcement Logic: Click-to-Ack (Approve-to-Ack)
    # Only CRITICAL level blocks CI, HIGH and below only report in comments
    review_level = result_decision.get("review_level", "normal")
    if review_level == "critical":
        print(f"Risk level: {review_level}. Checking for approval or acknowledgement...")
        
        is_approved = adapter.is_approved()
        has_reaction = False
        
        # Check for reaction if adapter supports it
        if hasattr(adapter, 'has_ack_reaction'):
            has_reaction = adapter.has_ack_reaction()
            
        if is_approved:
            print("✅ PR is approved. Risk acknowledged. CI Passed.")
        elif has_reaction:
            print("✅ Risk acknowledged via reaction (👍). CI Passed.")
        else:
            print("🚨 Risk elevated. Waiting for Approval OR Reaction (👍) on the report comment.")
            print("CI Failed to ensure awareness.")
            sys.exit(1)
            
    for w in render_input["_quality_warnings"]:
        print(f"⚠️ Low quality rule: {w.get('rule_id')} precision {w.get('precision'):.2f} (hits {w.get('hits')})")
    print("Audit finished successfully.")

def main():
    parser = argparse.ArgumentParser(description="DiffSense Audit Runner")
    parser.add_argument("--platform", choices=["github", "gitlab"], required=True, help="CI Platform")
    parser.add_argument("--token", required=True, help="Platform Access Token")
    
    # GitHub Specific
    parser.add_argument("--repo", help="GitHub Repo Name (owner/repo)")
    parser.add_argument("--pr", type=int, help="GitHub PR Number")
    
    # GitLab Specific
    parser.add_argument("--gitlab-url", default="https://gitlab.com", help="GitLab Instance URL")
    parser.add_argument("--project-id", help="GitLab Project ID")
    parser.add_argument("--mr-iid", type=int, help="GitLab Merge Request IID")
    
    # Config
    parser.add_argument("--rules", default="config/rules.yaml", help="Path to rules: single YAML file or directory")
    parser.add_argument("--profile", default=None, help="Profile: strict or lightweight")
    parser.add_argument("--baseline", action="store_true", help="Generate baseline file for existing issues")
    parser.add_argument("--since-baseline", action="store_true", help="Only report findings not in baseline")
    parser.add_argument("--baseline-file", default=".diffsense-baseline.json", help="Baseline file path")
    parser.add_argument("--report-json", default="diffsense-report.json", help="Report JSON output path")
    parser.add_argument("--report-html", default="diffsense-report.html", help="Report HTML output path")
    parser.add_argument("--comments-json", default="diffsense-comments.json", help="Inline comments JSON output path")
    parser.add_argument("--quality-auto-tune", action="store_true", help="Enable quality auto tune (skip/downgrade)")
    parser.add_argument("--quality-disable-threshold", type=float, default=0.3, help="Disable threshold")
    parser.add_argument("--quality-downgrade-threshold", type=float, default=0.5, help="Downgrade threshold")
    parser.add_argument("--quality-min-samples", type=int, default=30, help="Minimum samples before actions")
    parser.add_argument("--experimental", action="store_true", help="Include experimental rules (report-only by default)")
    parser.add_argument("--experimental-report-only", dest="experimental_report_only", action="store_true", default=True, help="Do not affect decision with experimental rules")
    parser.add_argument("--experimental-affect-decision", dest="experimental_report_only", action="store_false", help="Allow experimental rules to affect decision")

    args = parser.parse_args()

    # Official recommended config from .diffsense.yaml (CLI overrides when provided)
    try:
        from core.run_config import get_run_config
        run_cfg = get_run_config(os.getcwd())
        if args.profile is None and run_cfg.get("profile"):
            args.profile = run_cfg["profile"]
        if not args.quality_auto_tune and run_cfg.get("auto_tune"):
            args.quality_auto_tune = True
        rq = run_cfg.get("rule_quality") or {}
        if args.quality_downgrade_threshold == 0.5 and "degrade_threshold" in rq:
            try:
                args.quality_downgrade_threshold = float(rq["degrade_threshold"])
            except (TypeError, ValueError):
                pass
        if args.quality_disable_threshold == 0.3 and "disable_threshold" in rq:
            try:
                args.quality_disable_threshold = float(rq["disable_threshold"])
            except (TypeError, ValueError):
                pass
        if args.quality_min_samples == 30 and "min_samples" in rq:
            try:
                args.quality_min_samples = int(rq["min_samples"])
            except (TypeError, ValueError):
                pass
    except Exception:
        pass

    adapter = None

    if args.platform == "github":
        if not args.repo or not args.pr:
            print("Error: --repo and --pr are required for GitHub")
            sys.exit(1)
        adapter = GitHubAdapter(args.token, args.repo, args.pr)
        
    elif args.platform == "gitlab":
        if not args.project_id or not args.mr_iid:
            print("Error: --project-id and --mr-iid are required for GitLab")
            sys.exit(1)
        adapter = GitLabAdapter(args.gitlab_url, args.token, args.project_id, args.mr_iid)
        
    # Run
    # Handle rules path absolute/relative
    rules_path = args.rules
    if not os.path.exists(rules_path):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        rules_path = os.path.join(script_dir, args.rules)
        
    run_audit(
        adapter,
        rules_path,
        profile=args.profile,
        baseline=args.baseline,
        since_baseline=args.since_baseline,
        baseline_file=args.baseline_file,
        report_json=args.report_json,
        report_html=args.report_html,
        comments_json=args.comments_json,
        quality_auto_tune=args.quality_auto_tune,
        quality_disable_threshold=args.quality_disable_threshold,
        quality_downgrade_threshold=args.quality_downgrade_threshold,
        quality_min_samples=args.quality_min_samples,
        experimental=args.experimental,
        experimental_report_only=args.experimental_report_only,
    )

if __name__ == "__main__":
    main()
