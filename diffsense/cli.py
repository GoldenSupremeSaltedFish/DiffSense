"""
DiffSense 统一 CLI：diffsense audit | replay | rules list | signals
"""
import os
import sys
import time
from pathlib import Path

import typer

app = typer.Typer(help="DiffSense: MR/PR risk audit. Use 'diffsense audit' in CI.")


def _default_rules_path() -> str:
    # 开发: 同目录下 config/；安装后: 使用 config 包位置
    try:
        import config as config_pkg
        return str(Path(config_pkg.__file__).resolve().parent)
    except Exception:
        return str(Path(__file__).resolve().parent / "config")


@app.command()
def audit(
    platform: str = typer.Option(..., "--platform", "-p", help="CI platform: github | gitlab"),
    token: str = typer.Option(..., "--token", "-t", help="Platform API token", envvar="DIFFSENSE_TOKEN"),
    repo: str = typer.Option(None, "--repo", help="GitHub: owner/repo"),
    pr: int = typer.Option(None, "--pr", help="GitHub PR number"),
    gitlab_url: str = typer.Option("https://gitlab.com", "--gitlab-url", help="GitLab instance URL"),
    project_id: str = typer.Option(None, "--project-id", help="GitLab project ID"),
    mr_iid: int = typer.Option(None, "--mr-iid", help="GitLab merge request IID"),
    rules: str = typer.Option(None, "--rules", help="Path to rules: single YAML file or directory of YAML files"),
    profile: str = typer.Option(None, "--profile", help="Profile: strict (all rules) or lightweight (critical only)"),
    baseline: bool = typer.Option(False, "--baseline", help="Generate baseline file for existing issues"),
    since_baseline: bool = typer.Option(False, "--since-baseline", help="Only report findings not in baseline"),
    baseline_file: str = typer.Option(".diffsense-baseline.json", "--baseline-file", help="Baseline file path"),
    report_json: str = typer.Option("diffsense-report.json", "--report-json", help="Report JSON output path"),
    report_html: str = typer.Option("diffsense-report.html", "--report-html", help="Report HTML output path"),
    comments_json: str = typer.Option("diffsense-comments.json", "--comments-json", help="Inline comments JSON output path"),
    quality_auto_tune: bool = typer.Option(False, "--quality-auto-tune", help="[DEPRECATED] Enable quality auto tune (now only affects reporting)"),
    quality_disable_threshold: float = typer.Option(0.3, "--quality-disable-threshold", help="Disable threshold for reporting"),
    quality_downgrade_threshold: float = typer.Option(0.5, "--quality-downgrade-threshold", help="Downgrade threshold for reporting"),
    quality_min_samples: int = typer.Option(30, "--quality-min-samples", help="Minimum samples before quality warnings"),
    experimental: bool = typer.Option(False, "--experimental", help="Include experimental rules (report-only by default)"),
    experimental_report_only: bool = typer.Option(True, "--experimental-report-only/--experimental-affect-decision", help="Do not affect decision with experimental rules"),
) -> None:
    """Run MR/PR risk audit (GitLab or GitHub). Use in CI with image: ghcr.io/xxx/diffsense:1.0."""
    from adapters.github_adapter import GitHubAdapter
    from adapters.gitlab_adapter import GitLabAdapter
    from run_audit import run_audit as do_audit

    rules_path = rules
    if not rules_path or not os.path.exists(rules_path):
        rules_path = _default_rules_path()

    # Official recommended config from .diffsense.yaml (CLI overrides when provided)
    try:
        from core.run_config import get_run_config
        run_cfg = get_run_config(os.getcwd())
        if not profile and run_cfg.get("profile"):
            profile = run_cfg["profile"]
        if not quality_auto_tune and run_cfg.get("auto_tune"):
            quality_auto_tune = True
    except Exception:
        pass

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

    do_audit(
        adapter,
        rules_path,
        profile=profile,
        baseline=baseline,
        since_baseline=since_baseline,
        baseline_file=baseline_file,
        report_json=report_json,
        report_html=report_html,
        comments_json=comments_json,
        quality_auto_tune=quality_auto_tune,
        quality_disable_threshold=quality_disable_threshold,
        quality_downgrade_threshold=quality_downgrade_threshold,
        quality_min_samples=quality_min_samples,
        experimental=experimental,
        experimental_report_only=experimental_report_only,
    )


@app.command()
def replay(
    diff_file: str = typer.Argument(..., help="Path to .diff file"),
    rules: str = typer.Option(None, "--rules", help="Path to rules: single YAML file or directory of YAML files"),
    format: str = typer.Option("json", "--format", "-f", help="Output: json | markdown"),
    profile: str = typer.Option(None, "--profile", help="Profile: strict or lightweight"),
    baseline: bool = typer.Option(False, "--baseline", help="Generate baseline file for existing issues"),
    since_baseline: bool = typer.Option(False, "--since-baseline", help="Only report findings not in baseline"),
    baseline_file: str = typer.Option(".diffsense-baseline.json", "--baseline-file", help="Baseline file path"),
    report_json: str = typer.Option("diffsense-report.json", "--report-json", help="Report JSON output path"),
    report_html: str = typer.Option("diffsense-report.html", "--report-html", help="Report HTML output path"),
    comments_json: str = typer.Option("diffsense-comments.json", "--comments-json", help="Inline comments JSON output path"),
    quality_auto_tune: bool = typer.Option(False, "--quality-auto-tune", help="[DEPRECATED] Enable quality auto tune (now only affects reporting)"),
    quality_disable_threshold: float = typer.Option(0.3, "--quality-disable-threshold", help="Disable threshold for reporting"),
    quality_downgrade_threshold: float = typer.Option(0.5, "--quality-downgrade-threshold", help="Downgrade threshold for reporting"),
    quality_min_samples: int = typer.Option(30, "--quality-min-samples", help="Minimum samples before quality warnings"),
    experimental: bool = typer.Option(False, "--experimental", help="Include experimental rules (report-only by default)"),
    experimental_report_only: bool = typer.Option(True, "--experimental-report-only/--experimental-affect-decision", help="Do not affect decision with experimental rules"),
) -> None:
    """Run audit on a local diff file (for replay/offline)."""
    rules_path = rules
    if not rules_path or not os.path.exists(rules_path):
        rules_path = _default_rules_path()

    # Official recommended config from .diffsense.yaml (CLI overrides when provided)
    try:
        from core.run_config import get_run_config
        run_cfg = get_run_config(os.getcwd())
        if not profile and run_cfg.get("profile"):
            profile = run_cfg["profile"]
        if not quality_auto_tune and run_cfg.get("auto_tune"):
            quality_auto_tune = True
    except Exception:
        pass

    args = ["diffsense", diff_file, "--rules", rules_path, "--format", format, "--baseline-file", baseline_file, "--report-json", report_json, "--report-html", report_html, "--comments-json", comments_json, "--quality-disable-threshold", str(quality_disable_threshold), "--quality-downgrade-threshold", str(quality_downgrade_threshold), "--quality-min-samples", str(quality_min_samples)]
    if profile:
        args.extend(["--profile", profile])
    if baseline:
        args.append("--baseline")
    if since_baseline:
        args.append("--since-baseline")
    if quality_auto_tune:
        args.append("--quality-auto-tune")
    if experimental:
        args.append("--experimental")
    if not experimental_report_only:
        args.append("--experimental-affect-decision")
    sys.argv = args
    from main import main as replay_main
    replay_main()


rules_app = typer.Typer(help="Manage rules. Use 'rules report' for rule quality from replay JSON; use 'rules health' for persisted rule_metrics.json.")

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
    pro_path = None
    try:
        from core.run_config import get_pro_rules_path
        pro_path = get_pro_rules_path(os.getcwd())
    except Exception:
        pass
    engine = RuleEngine(path, profile=profile, pro_rules_path=pro_path)
    for r in engine.rules:
        typer.echo(r.id)

@rules_app.command("packs")
def rules_packs() -> None:
    from importlib.metadata import entry_points
    eps = []
    try:
        eps = entry_points(group="diffsense.rules")
    except TypeError:
        eps = entry_points().get("diffsense.rules", [])
    if not eps:
        typer.echo("No rule packs installed.")
        return
    for ep in eps:
        typer.echo(f"{ep.name} -> {ep.value}")


@rules_app.command("report")
def rules_report(
    input_file: str = typer.Option(None, "--input", "-i", help="JSON file from replay (must contain _metrics). Default: stdin"),
    noisy: int = typer.Option(0, "--noisy", "-n", help="Mark rules with fp_rate >= this percent as noisy (0 = show all)"),
) -> None:
    """Rule quality / rule health: hits, accepts, ignores, fp_rate from a single replay. Input = replay JSON with _metrics."""
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


@rules_app.command("health")
def rules_health(
    metrics_file: str = typer.Option(None, "--metrics", "-m", help="Path to rule_metrics.json (default: DIFFSENSE_RULE_METRICS or ./rule_metrics.json)"),
) -> None:
    """Rule health from persisted rule_metrics.json (hits, confirmed, false_positive, precision, quality_status)."""
    import json
    path = metrics_file or os.environ.get("DIFFSENSE_RULE_METRICS") or os.path.join(os.getcwd(), "rule_metrics.json")
    if not os.path.exists(path):
        typer.echo(f"No rule_metrics.json at {path}. Run audit/replay with quality tracking first.", err=True)
        raise typer.Exit(1)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    rules = data.get("rules") or {}
    if not rules:
        typer.echo("No rule entries in rule_metrics.json.")
        return
    typer.echo(f"{'rule_id':<45} {'hits':>6} {'confirmed':>9} {'false_positive':>14} {'precision':>9} {'status':>12}")
    typer.echo("-" * 96)
    for rule_id, entry in sorted(rules.items()):
        if not isinstance(entry, dict):
            continue
        hits = entry.get("hits", 0)
        confirmed = entry.get("confirmed", 0)
        fp = entry.get("false_positive", 0)
        prec = entry.get("precision", 1.0)
        prec_str = f"{prec:.2f}" if isinstance(prec, (int, float)) else str(prec)
        status = "normal"
        if hits >= 30:
            if prec < 0.3:
                status = "disabled"
            elif prec < 0.5:
                status = "degraded"
        elif hits > 0:
            status = "insufficient"
        typer.echo(f"{rule_id:<45} {hits:>6} {confirmed:>9} {fp:>14} {prec_str:>9} {status:>12}")


@rules_app.command("sdk")
def rules_sdk() -> None:
    typer.echo("Minimal SDK example:")
    typer.echo("from diffsense.core.rule_base import Rule")
    typer.echo("")
    typer.echo("class MyRule(Rule):")
    typer.echo("    @property")
    typer.echo("    def id(self): return \"custom.rule\"")
    typer.echo("    @property")
    typer.echo("    def severity(self): return \"high\"")
    typer.echo("    @property")
    typer.echo("    def impact(self): return \"runtime\"")
    typer.echo("    @property")
    typer.echo("    def rationale(self): return \"why this matters\"")
    typer.echo("    @property")
    typer.echo("    def status(self): return \"experimental\"")
    typer.echo("    def evaluate(self, diff_data, ast_signals):")
    typer.echo("        return None")


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
        typer.echo("Use --replay-dir or --input to pass replay results.")
        raise typer.Exit(0)
    paths = []
    if replay_dir:
        for root, _, files in os.walk(replay_dir):
            for name in files:
                if name.endswith(".json"):
                    paths.append(os.path.join(root, name))
    if input_list:
        with open(input_list, "r", encoding="utf-8") as f:
            for line in f:
                p = line.strip()
                if p:
                    paths.append(p)
    if not paths:
        typer.echo("No replay JSON files found.")
        raise typer.Exit(0)
    total = 0
    triggered = 0
    for path in paths:
        try:
            import json
            with open(path, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
            total += 1
            level = str(data.get("review_level", "normal")).lower()
            if level in ["elevated", "critical"]:
                triggered += 1
        except Exception:
            continue
    hit_rate = (triggered / total * 100) if total else 0
    typer.echo(f"Total: {total}")
    typer.echo(f"Triggered: {triggered}")
    typer.echo(f"Hit Rate: {hit_rate:.1f}%")


def _get_cache_root() -> str:
    """Return cache root directory (parent of CACHE_VERSION/diff and CACHE_VERSION/ast)."""
    from core.parser import DiffParser
    p = DiffParser()
    # cache_dir is .../cache/<CACHE_VERSION>/diff or .../cache/<CACHE_VERSION>/ast
    return os.path.dirname(os.path.dirname(p.cache_dir))


cache_app = typer.Typer(help="Cache: prune by age to limit disk growth.")

@cache_app.command("prune")
def cache_prune(
    max_age_days: float = typer.Option(7.0, "--max-age-days", help="Remove cache entries older than this many days"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Only print what would be removed"),
) -> None:
    """Remove cache files older than --max-age-days. Use in CI or cron to limit disk usage."""
    import time
    root = _get_cache_root()
    if not os.path.isdir(root):
        typer.echo(f"Cache root not found: {root}")
        return
    cutoff = time.time() - max_age_days * 86400
    removed = 0
    for dirpath, _, filenames in os.walk(root, topdown=False):
        for name in filenames:
            if name.endswith(".tmp"):
                continue
            path = os.path.join(dirpath, name)
            try:
                if os.path.getmtime(path) < cutoff:
                    if not dry_run:
                        os.remove(path)
                    removed += 1
            except OSError:
                pass
    if dry_run:
        typer.echo(f"Would remove {removed} file(s) older than {max_age_days} days under {root}")
    else:
        typer.echo(f"Removed {removed} file(s) older than {max_age_days} days under {root}")


@app.command("benchmark-cold-hot")
def benchmark_cold_hot(
    diff_file: str = typer.Argument(..., help="Path to a .diff file (e.g. tests/fixtures/ast_cases/p0_concurrency.diff)"),
    output: str = typer.Option("benchmark-cold-hot-result.json", "--output", "-o", help="Write cold_s, hot_s and thresholds here"),
    fail_if_over: bool = typer.Option(False, "--fail-if-over", help="Exit with code 1 if cold_s > 10 or hot_s > 3"),
    cold_threshold_s: float = typer.Option(10.0, "--cold-threshold", help="Cold run threshold (seconds)"),
    hot_threshold_s: float = typer.Option(3.0, "--hot-threshold", help="Hot run threshold (seconds)"),
) -> None:
    """Run audit twice (cold then hot) and report timings. For CI: use --fail-if-over to enforce DoD."""
    import subprocess
    import tempfile
    import json as _json
    pkg_dir = os.path.dirname(os.path.abspath(__file__))
    if not os.path.isabs(diff_file):
        for base in [os.getcwd(), pkg_dir, os.path.join(pkg_dir, "..")]:
            candidate = os.path.join(base, diff_file)
            if os.path.isfile(candidate):
                diff_file = candidate
                break
    if not os.path.isfile(diff_file):
        typer.echo(f"Diff file not found: {diff_file}", err=True)
        raise typer.Exit(1)
    tmp = tempfile.mkdtemp(prefix="diffsense_bench_")
    env = {**os.environ, "DIFFSENSE_CACHE_DIR": tmp}
    report_path = os.path.join(tmp, "report.json")
    main_py = os.path.join(pkg_dir, "main.py")
    cmd = [sys.executable, main_py, diff_file, "--report-json", report_path, "--format", "json"] if os.path.isfile(main_py) else [sys.executable, "-m", "main", diff_file, "--report-json", report_path, "--format", "json"]
    try:
        t0 = time.perf_counter()
        r0 = subprocess.run(cmd, env=env, cwd=pkg_dir, capture_output=True, timeout=60)
        cold_s = time.perf_counter() - t0
        t1 = time.perf_counter()
        r1 = subprocess.run(cmd, env=env, cwd=pkg_dir, capture_output=True, timeout=60)
        hot_s = time.perf_counter() - t1
    except subprocess.TimeoutExpired:
        typer.echo("Run timed out (60s).", err=True)
        raise typer.Exit(1)
    except Exception as e:
        typer.echo(f"Run failed: {e}", err=True)
        raise typer.Exit(1)
    finally:
        try:
            import shutil
            shutil.rmtree(tmp, ignore_errors=True)
        except Exception:
            pass
    result = {
        "cold_s": round(cold_s, 3),
        "hot_s": round(hot_s, 3),
        "cold_threshold_s": cold_threshold_s,
        "hot_threshold_s": hot_threshold_s,
        "cold_ok": cold_s <= cold_threshold_s,
        "hot_ok": hot_s <= hot_threshold_s,
    }
    out_dir = os.path.dirname(output)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(output, "w", encoding="utf-8") as f:
        _json.dump(result, f, indent=2)
    typer.echo(f"Cold: {cold_s:.2f}s (threshold {cold_threshold_s}s) — {'OK' if result['cold_ok'] else 'OVER'}")
    typer.echo(f"Hot:  {hot_s:.2f}s (threshold {hot_threshold_s}s) — {'OK' if result['hot_ok'] else 'OVER'}")
    typer.echo(f"Written: {output}")
    if fail_if_over and (not result["cold_ok"] or not result["hot_ok"]):
        raise typer.Exit(1)


@app.command("benchmark")
def benchmark(
    manifest: str = typer.Option("benchmarks/manifest.yaml", "--manifest", "-m", help="Benchmark manifest YAML path"),
    output: str = typer.Option("benchmarks/benchmark_report.json", "--output", "-o", help="Benchmark report JSON output path"),
    rules: str = typer.Option("config", "--rules", help="Path to rules: single YAML file or directory of YAML files"),
    profile: str = typer.Option(None, "--profile", help="Profile: strict or lightweight"),
    experimental: bool = typer.Option(False, "--experimental", help="Include experimental rules (report-only by default)"),
    experimental_report_only: bool = typer.Option(True, "--experimental-report-only/--experimental-affect-decision", help="Do not affect decision with experimental rules"),
) -> None:
    import json
    import time
    import tracemalloc
    import yaml
    from core.parser import DiffParser
    from core.ast_detector import ASTDetector
    from core.rules import RuleEngine

    if not os.path.exists(manifest):
        typer.echo(f"Manifest not found: {manifest}")
        raise typer.Exit(1)
    with open(manifest, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    cases = data.get("cases", [])
    if not isinstance(cases, list) or not cases:
        typer.echo("No benchmark cases found.")
        raise typer.Exit(1)
    base_dir = os.path.dirname(os.path.abspath(manifest))
    rules_path = rules
    if not os.path.exists(rules_path):
        rules_path = _default_rules_path()
    pro_path = None
    try:
        from core.run_config import get_pro_rules_path
        pro_path = get_pro_rules_path(os.getcwd())
    except Exception:
        pass
    engine = RuleEngine(
        rules_path,
        profile=profile,
        config={"experimental": {"enabled": experimental, "report_only": experimental_report_only}},
        pro_rules_path=pro_path,
    )
    parser = DiffParser()
    detector = ASTDetector()
    total_tp = 0
    total_fp = 0
    total_expected = 0
    total_cases = 0
    runtimes = []
    peak_mem_kb = []
    case_reports = []
    for case in cases:
        fixture = case.get("fixture")
        if not fixture:
            continue
        path = fixture if os.path.isabs(fixture) else os.path.join(base_dir, fixture)
        if not os.path.exists(path):
            continue
        content = Path(path).read_text(encoding="utf-8")
        start = time.perf_counter()
        tracemalloc.start()
        diff_data = parser.parse(content)
        if not diff_data.get("file_patches") and content.strip():
            diff_data.setdefault("file_patches", [])
            fname = case.get("file_for_patch", "Dummy.java")
            diff_data["file_patches"].append({"file": fname, "patch": content})
        if "raw_diff" not in diff_data:
            diff_data["raw_diff"] = content
        signals = detector.detect_signals(diff_data)
        triggered = engine.evaluate(diff_data, signals)
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        elapsed_ms = (time.perf_counter() - start) * 1000
        runtimes.append(elapsed_ms)
        peak_mem_kb.append(peak / 1024)
        expected = case.get("expect_rules", [])
        expected_contains = case.get("expect_rules_contain", [])
        expected = expected if isinstance(expected, list) else []
        expected_contains = expected_contains if isinstance(expected_contains, list) else []
        actual_ids = [r.get("id") for r in triggered]
        tp = 0
        for rule_id in actual_ids:
            if rule_id in expected:
                tp += 1
            else:
                for sub in expected_contains:
                    if sub and sub in rule_id:
                        tp += 1
                        break
        fp = max(0, len(actual_ids) - tp)
        total_tp += tp
        total_fp += fp
        total_expected += len(expected) + len(expected_contains)
        total_cases += 1
        precision = (tp / (tp + fp)) if (tp + fp) else 1.0
        case_reports.append({
            "id": case.get("id", os.path.basename(path)),
            "fixture": fixture,
            "runtime_ms": elapsed_ms,
            "peak_mem_kb": peak / 1024,
            "precision": precision,
            "triggered": len(actual_ids),
        })
    avg_runtime = (sum(runtimes) / len(runtimes)) if runtimes else 0.0
    avg_mem = (sum(peak_mem_kb) / len(peak_mem_kb)) if peak_mem_kb else 0.0
    precision = (total_tp / (total_tp + total_fp)) if (total_tp + total_fp) else 1.0
    report = {
        "total_cases": total_cases,
        "precision": precision,
        "avg_runtime_ms": avg_runtime,
        "avg_peak_mem_kb": avg_mem,
        "cases": case_reports,
    }
    out_dir = os.path.dirname(output)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(output, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    typer.echo(f"Benchmark report saved: {output}")


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
    pro_path = None
    try:
        from core.run_config import get_pro_rules_path
        pro_path = get_pro_rules_path(os.getcwd())
    except Exception:
        pass
    engine = RuleEngine(path, pro_rules_path=pro_path)
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


@app.command("signals")
def signals_cmd() -> None:
    """List available signals (emitted by semantic analyzers; rules only consume them)."""
    from core.signals_registry import get_signals_by_group
    typer.echo("Available Signals:")
    typer.echo("")
    for group, ids in get_signals_by_group().items():
        for sid in ids:
            typer.echo(sid)
        typer.echo("")


app.add_typer(rules_app, name="rules")
app.add_typer(cache_app, name="cache")

if __name__ == "__main__":
    app()
