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


def run_audit(adapter, rules_path, profile=None, baseline=False, since_baseline=False, baseline_file=".diffsense-baseline.json", report_json="diffsense-report.json", report_html="diffsense-report.html", comments_json="diffsense-comments.json", quality_auto_tune=False, quality_disable_threshold=0.3, quality_downgrade_threshold=0.5, quality_min_samples=30):
    print_banner()
    print("Fetching diff...")
    diff_content = adapter.fetch_diff()
    
    print(f"DEBUG: Fetched diff content length: {len(diff_content)} chars")
    if len(diff_content) < 500:
        print(f"DEBUG: Diff content preview:\n{diff_content}")
    else:
        print(f"DEBUG: Diff content preview (first 500 chars):\n{diff_content[:500]}...")

    if not diff_content.strip():
        print("Diff is empty, skipping audit.")
        return

    print("Running Core Analyzer...")
    
    # 1. Parse Diff (Structural)
    parser = DiffParser()
    diff_data = parser.parse(diff_content)
    
    print(f"DEBUG: Parsed {len(diff_data.get('files', []))} files: {diff_data.get('files', [])}")
    print(f"DEBUG: File patches count: {len(diff_data.get('file_patches', []))}")
    
    # 2. Detect AST Signals (Semantic)
    # This is the "First-Class Signal Source"
    print("Detecting AST Signals...")
    ast_detector = ASTDetector()
    ast_signals = ast_detector.detect_signals(diff_data)
    
    # Debug: Print signals
    for sig in ast_signals:
        print(f"  [AST Signal] {sig.id} in {sig.file}")
    
    # 3. Evaluate Rules (Policy / Context)
    # Rules now consume both diff_data (structure) and ast_signals (semantics)
    quality_config = {
        "auto_tune": quality_auto_tune,
        "disable_threshold": quality_disable_threshold,
        "degrade_threshold": quality_downgrade_threshold,
        "min_samples": quality_min_samples
    }
    engine = RuleEngine(rules_path, profile=profile, config={"rule_quality": quality_config})
    evaluator = ImpactEvaluator(engine)
    # Evaluator needs update to pass ast_signals or we pass it via engine directly?
    # Actually ImpactEvaluator calls engine.evaluate. Let's see ImpactEvaluator.
    # We might need to bypass ImpactEvaluator or update it. 
    # For now, let's look at ImpactEvaluator content.
    # Assuming ImpactEvaluator wraps engine.evaluate
    
    # We'll need to modify ImpactEvaluator or call engine directly if evaluator is just a thin wrapper.
    # Let's check ImpactEvaluator first. Ideally we update it.
    
    # For now, I will modify this part after checking evaluator.
    # But to proceed, I will assume I update ImpactEvaluator too or just call engine directly for this MVP integration
    # The existing code used `evaluator.evaluate(diff_data)`.
    # I should check `core/evaluator.py`.
    
    impacts = evaluator.evaluate(diff_data, ast_signals=ast_signals)
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
    rule_metrics = engine.get_metrics()
    render_input["_metrics"] = rule_metrics
    render_input["_metrics"]["cache"] = {"diff": parser.metrics, "ast": ast_detector.metrics}
    render_input["_rule_quality"] = engine.get_rule_quality_metrics()
    render_input["_quality_warnings"] = engine.get_quality_warnings()
    engine.persist_rule_quality()
    _write_json(report_json, render_input)
    html_report = HtmlRenderer().render(render_input)
    with open(report_html, "w", encoding="utf-8") as f:
        f.write(html_report)
    inline_comments = _build_inline_comments(impacts, diff_data)
    _write_json(comments_json, inline_comments)
    
    print("Posting comment...")
    adapter.post_comment(report)
    if hasattr(adapter, "post_inline_comments"):
        try:
            adapter.post_inline_comments(inline_comments)
        except Exception:
            pass
    
    # Enforcement Logic: Click-to-Ack (Approve-to-Ack)
    # If risk is elevated/critical, require PR approval to pass CI.
    review_level = result_decision.get("review_level", "normal")
    if review_level in ["elevated", "critical"]:
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

    args = parser.parse_args()
    
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
        
    run_audit(adapter, rules_path, profile=args.profile, baseline=args.baseline, since_baseline=args.since_baseline, baseline_file=args.baseline_file, report_json=args.report_json, report_html=args.report_html, comments_json=args.comments_json, quality_auto_tune=args.quality_auto_tune, quality_disable_threshold=args.quality_disable_threshold, quality_downgrade_threshold=args.quality_downgrade_threshold, quality_min_samples=args.quality_min_samples)

if __name__ == "__main__":
    main()
