import argparse
import os
import sys
from adapters.github_adapter import GitHubAdapter
from adapters.gitlab_adapter import GitLabAdapter
from core.parser import DiffParser
from core.rules import RuleEngine
from core.evaluator import ImpactEvaluator
from core.composer import DecisionComposer
from core.renderer import MarkdownRenderer

def run_audit(adapter, rules_path):
    print("Fetching diff...")
    diff_content = adapter.fetch_diff()
    
    if not diff_content.strip():
        print("Diff is empty, skipping audit.")
        return

    print("Running Core Analyzer...")
    # Core Logic (Reuse from main.py but modular)
    parser = DiffParser()
    diff_data = parser.parse(diff_content)
    
    engine = RuleEngine(rules_path)
    evaluator = ImpactEvaluator(engine)
    impacts = evaluator.evaluate(diff_data)
    
    composer = DecisionComposer()
    result = composer.compose(impacts)
    
    # Prepare Output
    output_data = {
        "audit_result": result,
        "details": {
            "files_changed": diff_data["files"],
            "stats": diff_data["stats"],
            "raw_impacts": impacts
        }
    }
    
    renderer = MarkdownRenderer()
    report = renderer.render(output_data)
    
    print("Posting comment...")
    adapter.post_comment(report)
    
    # Enforcement Logic: Click-to-Ack (Approve-to-Ack)
    # If risk is elevated/critical, require PR approval to pass CI.
    review_level = result.get("review_level", "normal")
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
    parser.add_argument("--rules", default="config/rules.yaml", help="Path to rules config")

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
        
    run_audit(adapter, rules_path)

if __name__ == "__main__":
    main()
