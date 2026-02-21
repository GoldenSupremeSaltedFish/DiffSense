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


app.add_typer(rules_app, name="rules")

if __name__ == "__main__":
    app()
