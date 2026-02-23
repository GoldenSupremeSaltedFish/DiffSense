"""
DiffSense 统一 CLI：diffsense audit | replay | rules list
"""
import os
import sys
from pathlib import Path

import typer

app = typer.Typer(help="DiffSense: MR/PR risk audit. Use 'diffsense audit' in CI.")


def _default_rules_path() -> str:
    # 开发: 同目录下 config/rules.yaml；安装后: 使用 config 包位置
    try:
        import config as config_pkg
        return str(Path(config_pkg.__file__).resolve().parent / "rules.yaml")
    except Exception:
        return str(Path(__file__).resolve().parent / "config" / "rules.yaml")


@app.command()
def audit(
    platform: str = typer.Option(..., "--platform", "-p", help="CI platform: github | gitlab"),
    token: str = typer.Option(..., "--token", "-t", help="Platform API token", envvar="DIFFSENSE_TOKEN"),
    repo: str = typer.Option(None, "--repo", help="GitHub: owner/repo"),
    pr: int = typer.Option(None, "--pr", help="GitHub PR number"),
    gitlab_url: str = typer.Option("https://gitlab.com", "--gitlab-url", help="GitLab instance URL"),
    project_id: str = typer.Option(None, "--project-id", help="GitLab project ID"),
    mr_iid: int = typer.Option(None, "--mr-iid", help="GitLab merge request IID"),
    rules: str = typer.Option("config/rules.yaml", "--rules", help="Path to rules: single YAML file or directory of YAML files"),
    profile: str = typer.Option(None, "--profile", help="Profile: strict (all rules) or lightweight (critical only)"),
) -> None:
    """Run MR/PR risk audit (GitLab or GitHub). Use in CI with image: ghcr.io/xxx/diffsense:1.0."""
    from adapters.github_adapter import GitHubAdapter
    from adapters.gitlab_adapter import GitLabAdapter
    from run_audit import run_audit as do_audit

    rules_path = rules
    if not os.path.exists(rules_path):
        rules_path = _default_rules_path()

    if platform == "github":
        if not repo or pr is None:
            typer.echo("Error: --repo and --pr are required for GitHub", err=True)
            raise typer.Exit(1)
        adapter = GitHubAdapter(token, repo, pr)
    elif platform == "gitlab":
        if not project_id or mr_iid is None:
            typer.echo("Error: --project-id and --mr-iid are required for GitLab", err=True)
            raise typer.Exit(1)
        adapter = GitLabAdapter(gitlab_url, token, project_id, mr_iid)
    else:
        typer.echo(f"Error: platform must be github or gitlab, got {platform}", err=True)
        raise typer.Exit(1)

    do_audit(adapter, rules_path, profile=profile)


@app.command()
def replay(
    diff_file: str = typer.Argument(..., help="Path to .diff file"),
    rules: str = typer.Option("config/rules.yaml", "--rules", help="Path to rules: single YAML file or directory of YAML files"),
    format: str = typer.Option("json", "--format", "-f", help="Output: json | markdown"),
    profile: str = typer.Option(None, "--profile", help="Profile: strict or lightweight"),
) -> None:
    """Run audit on a local diff file (for replay/offline)."""
    args = ["diffsense", diff_file, "--rules", rules, "--format", format]
    if profile:
        args.extend(["--profile", profile])
    sys.argv = args
    from main import main as replay_main
    replay_main()


rules_app = typer.Typer(help="Manage rules.")

@rules_app.command("list")
def rules_list(
    rules_path: str = typer.Option(None, "--rules", help="Path to rules: single YAML file or directory of YAML files"),
    profile: str = typer.Option(None, "--profile", help="Profile: strict or lightweight (list only rules active in that profile)"),
) -> None:
    """List loaded rule IDs (built-in + YAML)."""
    from core.rules import RuleEngine

    path = rules_path
    if not path or not os.path.exists(path):
        path = _default_rules_path()
    engine = RuleEngine(path, profile=profile)
    for r in engine.rules:
        typer.echo(r.id)


@rules_app.command("report")
def rules_report(
    input_file: str = typer.Option(None, "--input", "-i", help="JSON file from replay (must contain _metrics). Default: stdin"),
    noisy: int = typer.Option(0, "--noisy", "-n", help="Mark rules with fp_rate >= this percent as noisy (0 = show all)"),
) -> None:
    """Rule quality report: hits, accepts, ignores, fp_rate. Input = replay JSON with _metrics."""
    import json
    from core.rules import RuleEngine

    if input_file:
        with open(input_file, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    else:
        data = json.load(sys.stdin)
    metrics = data.get("_metrics") or {}
    rows = RuleEngine.quality_report_from_metrics(metrics)
    if not rows:
        typer.echo("No metrics (run replay first and pass JSON with --input or stdin).")
        return
    # Table header
    typer.echo(f"{'rule_id':<45} {'hits':>6} {'accepts':>7} {'ignores':>7} {'fp_rate':>8}")
    typer.echo("-" * 76)
    for r in rows:
        fp_pct = r["fp_rate"] * 100
        flag = "  noisy" if noisy and fp_pct >= noisy else ""
        typer.echo(f"{r['rule_id']:<45} {r['hits']:>6} {r['accepts']:>7} {r['ignores']:>7} {fp_pct:>6.0f}%{flag}")


@app.command("replay-coverage")
def replay_coverage(
    replay_dir: str = typer.Option(None, "--replay-dir", "-d", help="Directory of replay JSON outputs to aggregate"),
    input_list: str = typer.Option(None, "--input", "-i", help="File listing replay JSON paths (one per line)"),
) -> None:
    """Replay coverage: aggregate many replay runs to compute hit rate (e.g. %% of MRs with risky diffs caught).
    Input: directory of replay JSONs, or a file listing paths. Output: total MRs, triggered count, hit rate.
    Example: diffsense replay-coverage --replay-dir ./replay_reports/
    (Implementation: aggregate review_level and _metrics from each JSON; report total, triggered, hit_rate.)"""
    if not replay_dir and not input_list:
        typer.echo("Use --replay-dir or --input to pass replay results. Aggregation and hit-rate output coming next.")
        raise typer.Exit(0)
    typer.echo("replay-coverage: aggregation not yet implemented. Use rules report on single replay JSON for now.")


@app.command("profile-rules")
def profile_rules(
    rules_path: str = typer.Option(None, "--rules", help="Path to rules: file or directory of YAML"),
    diff_file: str = typer.Option(None, "--diff", "-d", help="Optional .diff file to run against; else minimal diff"),
) -> None:
    """Print top slow rules by execution time (from one run). Use after replay to see which rules cost the most."""
    from core.rules import RuleEngine

    path = rules_path
    if not path or not os.path.exists(path):
        path = _default_rules_path()
    engine = RuleEngine(path)
    if diff_file and os.path.exists(diff_file):
        with open(diff_file, "r", encoding="utf-8") as f:
            content = f.read()
        from core.parser import DiffParser
        from core.ast_detector import ASTDetector
        parser = DiffParser()
        diff_data = parser.parse(content)
        ast_signals = ASTDetector().detect_signals(diff_data)
    else:
        diff_data = {"files": [], "raw_diff": ""}
        ast_signals = []
    engine.evaluate(diff_data, ast_signals)
    metrics = engine.get_metrics()
    # Sort by time_ns desc, show ms
    items = [(rid, m.get("time_ns", 0)) for rid, m in metrics.items()]
    items.sort(key=lambda x: -x[1])
    typer.echo("Top slow rules (this run):")
    for i, (rule_id, time_ns) in enumerate(items[:20], 1):
        ms = time_ns / 1_000_000
        typer.echo(f"  {i:>2}. {rule_id:<45} {ms:>8.2f} ms")


app.add_typer(rules_app, name="rules")

if __name__ == "__main__":
    app()
