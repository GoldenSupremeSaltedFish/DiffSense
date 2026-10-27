import argparse
import hashlib
import json
import sys
import os
import re
import time
from typing import Dict, Any, List, Optional, Tuple
from core.parser import DiffParser
from core.rules import RuleEngine
from core.evaluator import ImpactEvaluator
from core.composer import DecisionComposer
from core.renderer import MarkdownRenderer, HtmlRenderer
from core.ast_detector import ASTDetector
from constants import SCHEMA_VERSION, EXIT_OK, EXIT_RISK, EXIT_ERROR, exit_code_for_review_level
from sarif import build_sarif_report

def _baseline_key(rule: Dict[str, Any]) -> str:
    return f"{rule.get('id', '')}::{rule.get('matched_file', '')}"

def _load_baseline(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        return {"items": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            return data
    except Exception:
        return {"items": []}
    return {"items": []}

def _save_baseline(path: str, items: List[Dict[str, Any]]) -> None:
    data = {"items": items}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _baseline_items(triggered_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    items = []
    for r in triggered_rules:
        items.append({
            "rule_id": r.get("id", ""),
            "file": r.get("matched_file", "")
        })
    return items

def _baseline_set(data: Dict[str, Any]) -> set:
    items = data.get("items", [])
    return {f"{i.get('rule_id', '')}::{i.get('file', '')}" for i in items}

def _first_added_position(patch_text: str) -> Tuple[int, Optional[int]]:
    lines = patch_text.splitlines()
    position = 1
    new_line = None
    saw_hunk = False
    for i, line in enumerate(lines, start=1):
        if line.startswith("@@"):
            m = re.search(r"\+(\d+)", line)
            if m:
                try:
                    new_line = int(m.group(1))
                except Exception:
                    new_line = None
            saw_hunk = True
            position = i
            continue
        if line.startswith("+") and not line.startswith("+++"):
            if not saw_hunk:
                # #112: without a hunk header there is no reliable mapping from
                # diff position to new-file line number. Previously we silently
                # fell back to 1 ("diff first line"), pointing inline comments
                # at a wrong line. Return None so callers can skip attribution.
                return i, None
            return i, new_line
        if line.startswith("-") and not line.startswith("---"):
            continue
        if new_line is not None:
            new_line += 1
    return position, new_line if saw_hunk else None

def _build_inline_comments(triggered_rules: List[Dict[str, Any]], diff_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    patches = {p.get("file"): p.get("patch", "") for p in diff_data.get("file_patches", [])}
    comments = []
    for r in triggered_rules:
        path = r.get("matched_file", "")
        patch_text = patches.get(path, "")
        # 归因修复：找不到真实 hunk 时跳过内联评论，
        # 严禁把评论错误地贴到 diff 中的第一个文件。
        if not patch_text:
            continue
        position, line = _first_added_position(patch_text)
        if line is None:
            # #112: no reliable line attribution (patch has no hunk header) —
            # skip the inline comment instead of pointing at "diff line 1".
            continue
        body = f"{r.get('severity', '').upper()} {r.get('id', '')}: {r.get('rationale', '')}"
        comments.append({
            "path": path,
            "position": position,
            "line": line,
            "body": body,
            "rule_id": r.get("id", "")
        })
    return comments

def _write_json(path: str, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _tool_error_report(message: str) -> str:
    """Machine-readable tool-error report (CLI contract §3.1: review_level 'error')."""
    return json.dumps(
        {"schema_version": SCHEMA_VERSION, "review_level": "error", "error": message},
        indent=2,
        ensure_ascii=False,
    )


# ---------------------------------------------------------------------------
# #134: JUnit XML renderer — CI systems (Jenkins / Azure / GitLab) consume
# JUnit to surface findings as native test failures without extra tooling.
# ---------------------------------------------------------------------------
_CQ_SEVERITY_MAP = {"critical": "critical", "high": "major", "medium": "minor", "low": "info"}


def build_junit_report(result: Dict[str, Any]) -> str:
    from xml.sax.saxutils import escape, quoteattr

    details = result.get("details", []) or []
    failures = len(details)
    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append(
        f'<testsuites name={quoteattr("diffsense")} tests={quoteattr(str(max(failures, 1)))} '
        f'failures={quoteattr(str(failures))}>'
    )
    lines.append(
        f'  <testsuite name={quoteattr("diffsense")} tests={quoteattr(str(max(failures, 1)))} '
        f'failures={quoteattr(str(failures))}>'
    )
    if not details:
        lines.append(f'    <testcase name={quoteattr("no-findings")} classname="diffsense" />')
    for d in details:
        rule_id = str(d.get("id", d.get("rule_id", "unknown")))
        matched_file = str(d.get("matched_file", d.get("file", "unknown")))
        severity = str(d.get("severity", "low")).lower()
        rationale = str(d.get("rationale", ""))
        lines.append(
            f'    <testcase name={quoteattr(f"{matched_file}::{rule_id}")} '
            f'classname={quoteattr(f"diffsense.{rule_id}")}>'
        )
        lines.append(
            f'      <failure message={quoteattr(f"[{severity.upper()}] {rule_id}: {rationale[:160]}")} '
            f'type={quoteattr(severity.upper())}>{escape(rationale)}</failure>'
        )
        lines.append("    </testcase>")
    lines.append("  </testsuite>")
    lines.append("</testsuites>")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# #135: GitLab Code Quality JSON renderer.
# ---------------------------------------------------------------------------
def build_codequality_report(result: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for d in result.get("details", []) or []:
        rule_id = str(d.get("id", d.get("rule_id", "unknown")))
        matched_file = str(d.get("matched_file", d.get("file", "unknown")))
        severity = _CQ_SEVERITY_MAP.get(str(d.get("severity", "low")).lower(), "minor")
        line = d.get("line") or 1
        fp_source = f"{rule_id}|{matched_file}|{line}"
        fingerprint = hashlib.sha1(fp_source.encode("utf-8", errors="ignore")).hexdigest()
        out.append({
            "description": f"[{str(d.get('severity', 'low')).upper()}] {rule_id}: {d.get('rationale', '')}",
            "check_name": rule_id,
            "fingerprint": fingerprint,
            "severity": severity,
            "location": {"path": matched_file, "lines": {"begin": int(line)}},
        })
    return out

def analyze_diff(
    diff_content: str,
    rules_path: str,
    profile=None,
    baseline=False,
    since_baseline=False,
    baseline_file=".diffsense-baseline.json",
    report_json="diffsense-report.json",
    report_html="diffsense-report.html",
    comments_json="diffsense-comments.json",
    quality_auto_tune=False,
    quality_disable_threshold=None,
    quality_downgrade_threshold=None,
    quality_min_samples=None,
    experimental=False,
    experimental_report_only=True,
    format="json",
    write_files=True,
):
    """Run the full audit pipeline on raw diff text and return the report dict.

    Shared by the CLI entrypoint (``main()``) and the MCP thin shell
    (``mcp_server``) so the machine-readable report contract stays in one
    place. The report is never printed to stdout here; callers own rendering
    and exit codes.
    """
    # Apply official recommended config from .diffsense.yaml when not overridden.
    # #96: quality_* use None as the "not explicitly provided" sentinel instead of
    # comparing against the default values, so an explicit CLI value that happens
    # to equal the default can no longer be overridden by the config file.
    run_cfg = {}

    def _config_warning(msg: str) -> None:
        if os.environ.get("DIFFSENSE_QUIET"):
            return
        try:
            sys.stderr.write(f"WARNING: {msg}\n")
            sys.stderr.flush()
        except Exception:
            pass

    try:
        from core.run_config import get_run_config
        run_cfg = get_run_config(os.getcwd()) or {}
        if profile is None and run_cfg.get("profile"):
            profile = run_cfg["profile"]
        if not quality_auto_tune and run_cfg.get("auto_tune"):
            quality_auto_tune = True
        rq = run_cfg.get("rule_quality") or {}
        if quality_downgrade_threshold is None and "degrade_threshold" in rq:
            try:
                quality_downgrade_threshold = float(rq["degrade_threshold"])
            except (TypeError, ValueError):
                _config_warning(f".diffsense.yaml rule_quality.degrade_threshold: {rq['degrade_threshold']!r} is not a number; using built-in default 0.5 (#95)")
        if quality_disable_threshold is None and "disable_threshold" in rq:
            try:
                quality_disable_threshold = float(rq["disable_threshold"])
            except (TypeError, ValueError):
                _config_warning(f".diffsense.yaml rule_quality.disable_threshold: {rq['disable_threshold']!r} is not a number; using built-in default 0.3 (#95)")
        if quality_min_samples is None and "min_samples" in rq:
            try:
                quality_min_samples = int(rq["min_samples"])
            except (TypeError, ValueError):
                _config_warning(f".diffsense.yaml rule_quality.min_samples: {rq['min_samples']!r} is not an integer; using built-in default 30 (#95)")
    except Exception:
        pass

    wall_start = time.perf_counter()

    # 2. Parse Diff
    diff_parser = DiffParser()
    diff_data = diff_parser.parse(diff_content)

    # 2.5 Detect AST Signals
    ast_detector = ASTDetector()
    ast_signals = ast_detector.detect_signals(diff_data)

    # 3. Init Engine & Evaluator
    # Use absolute path for default rules if relative path fails
    if not os.path.exists(rules_path):
        # try relative to script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        rules_path = os.path.join(script_dir, rules_path)

    quality_config = {
        "auto_tune": quality_auto_tune,
        # Built-in fallbacks for values neither CLI nor config provided (#96)
        "disable_threshold": 0.3 if quality_disable_threshold is None else quality_disable_threshold,
        "degrade_threshold": 0.5 if quality_downgrade_threshold is None else quality_downgrade_threshold,
        "min_samples": 30 if quality_min_samples is None else quality_min_samples
    }
    pro_rules_path = None
    try:
        from core.run_config import get_pro_rules_path
        pro_rules_path = get_pro_rules_path(os.getcwd())
    except Exception:
        pass
    engine_config = {
        "rule_quality": quality_config,
        "experimental": {"enabled": experimental, "report_only": experimental_report_only},
    }
    # #99: reuse run_cfg already loaded above instead of calling get_run_config
    # a second time.
    if run_cfg.get("dependency_versions"):
        engine_config["dependency_versions"] = run_cfg["dependency_versions"]
    rule_engine = RuleEngine(
        rules_path,
        profile=profile,
        config=engine_config,
        pro_rules_path=pro_rules_path,
    )
    evaluator = ImpactEvaluator(rule_engine)

    # 4. Evaluate Impact
    triggered_rules = evaluator.evaluate(diff_data, ast_signals)
    if baseline:
        _save_baseline(baseline_file, _baseline_items(triggered_rules))
    if since_baseline:
        baseline_data = _load_baseline(baseline_file)
        baseline_keys = _baseline_set(baseline_data)
        triggered_rules = [r for r in triggered_rules if _baseline_key(r) not in baseline_keys]

    # 5. Compose Decision
    composer = DecisionComposer()
    # #113: findings suppressed by ignore patterns are surfaced as a suppression summary.
    composed = composer.compose(triggered_rules, diff_data.get('files', []), rule_engine.ignored_findings)
    # #148: propagate attributed line numbers into report details (inline
    # comments already use this same attribution, reports previously lost it).
    _patches = {p.get("file"): p.get("patch", "") for p in diff_data.get("file_patches", [])}
    for _d in composed.get("details", []):
        _patch_text = _patches.get(_d.get("file", ""), "")
        if _patch_text:
            _, _line = _first_added_position(_patch_text)
            if _line is not None:
                # #148/#112: only attach a line when attribution is reliable;
                # a hunk-less patch would otherwise claim "line 1".
                _d["line"] = _line
    # Machine-readable contract: schema_version MUST be the first field.
    result = {"schema_version": SCHEMA_VERSION}
    result.update(composed)

    # Add Rule Performance & Cache Metrics (copy so we don't mutate engine.metrics)
    result['_metrics'] = dict(rule_engine.get_metrics())
    result['_metrics']['cache'] = {
        "diff": diff_parser.metrics,
        "ast": ast_detector.metrics
    }
    result["_metrics"]["rule_stats"] = rule_engine.get_rule_stats()
    result["_rule_quality"] = rule_engine.get_rule_quality_metrics()
    result["_quality_warnings"] = rule_engine.get_quality_warnings()

    # Structured performance for CI (machine-readable)
    wall_s = time.perf_counter() - wall_start
    d_m = diff_parser.metrics
    a_m = ast_detector.metrics
    d_total = d_m["hits"] + d_m["misses"]
    a_total = a_m["hits"] + a_m["misses"]
    total_ops = d_total + a_total
    cache_hit_rate_pct = ((d_m["hits"] + a_m["hits"]) / total_ops * 100) if total_ops > 0 else 0.0
    r_stats = result["_metrics"].get("rule_stats", {})
    total_rules = r_stats.get("total_rules", 0)
    executed_count = r_stats.get("executed_count", 0)
    rules_executed_pct = (executed_count / total_rules * 100) if total_rules else 0.0
    result["_performance"] = {
        "wall_clock_s": round(wall_s, 3),
        "cache": {"diff": dict(d_m), "ast": dict(a_m)},
        "cache_hit_rate_pct": round(cache_hit_rate_pct, 2),
        "rules_executed": executed_count,
        "rules_total": total_rules,
        "rules_executed_pct": round(rules_executed_pct, 2),
    }

    # 6. Output report summary to stderr for CI visibility
    # #76: honor DIFFSENSE_QUIET=1 (set by `diffsense replay -q`) to keep stderr clean
    _prev_stderr = sys.stderr
    if os.environ.get("DIFFSENSE_QUIET", "").strip().lower() in ("1", "true", "yes"):
        import io as _io
        sys.stderr = _io.StringIO()
    sys.stderr.write("\n" + "="*40 + "\n")
    sys.stderr.write("🚀 DiffSense Performance Report\n")
    sys.stderr.write("="*40 + "\n")

    # Diff Cache
    d_m = diff_parser.metrics
    d_total = d_m["hits"] + d_m["misses"]
    d_rate = (d_m["hits"] / d_total * 100) if d_total > 0 else 0
    sys.stderr.write(f"🔹 Diff Cache Hit: {d_rate:.1f}% ({d_m['hits']}/{d_total})\n")

    # AST Cache
    a_m = ast_detector.metrics
    a_total = a_m["hits"] + a_m["misses"]
    a_rate = (a_m["hits"] / a_total * 100) if a_total > 0 else 0
    sys.stderr.write(f"🔹 AST Cache Hit:  {a_rate:.1f}% ({a_m['hits']}/{a_total})\n")

    # Saved Time (Estimated)
    d_saved = d_m["hits"] * d_m["saved_ms"]
    a_saved = a_m["hits"] * (a_m["saved_ms"] / a_m["misses"] if a_m["misses"] > 0 else 0)
    total_saved = (d_saved + a_saved) / 1000
    sys.stderr.write(f"⏱️  Estimated Saved Time: {total_saved:.2f}s\n")

    # Rules executed (Q1/Q2 visibility)
    r_stats = result["_metrics"].get("rule_stats", {})
    total_rules = r_stats.get("total_rules", 0)
    executed_count = r_stats.get("executed_count", 0)
    exec_pct = (executed_count / total_rules * 100) if total_rules else 0
    sys.stderr.write(f"🔹 Rules executed: {executed_count} / {total_rules} ({exec_pct:.0f}%)\n")
    if total_rules and exec_pct > 30:
        sys.stderr.write("   💡 Consider enabling more profile/scheduler filters to reduce executed rules.\n")

    # Slowest Rules
    sys.stderr.write("\n🐢 Top 3 Slowest Rules:\n")
    r_stats = result["_metrics"].get("rule_stats", {}).get("top_slow", [])
    for r in r_stats[:3]:
        r_id = r.get("rule_id")
        r_time_ms = r.get("time_ms", 0)
        sys.stderr.write(f"  - {r_id}: {r_time_ms:.2f}ms\n")
    for w in result["_quality_warnings"]:
        sys.stderr.write(f"⚠️ Low quality rule: {w.get('rule_id')} precision {w.get('precision'):.2f} (hits {w.get('hits')})\n")

    # Triggered rules summary
    if triggered_rules:
        sys.stderr.write("\n🎯 Triggered Rules Summary:\n")
        for r in triggered_rules:
            sys.stderr.write(f"  - {r.get('severity', '').upper()} {r.get('id', '')}: {r.get('matched_file', '')}\n")

    sys.stderr.write("="*40 + "\n\n")
    sys.stderr = _prev_stderr
    rule_engine.persist_rule_quality()

    if write_files:
        # 7. Persist machine-readable artifacts (report JSON/HTML + inline comments)
        inline_comments = _build_inline_comments(triggered_rules, diff_data)
        if str(format).lower() == "sarif":
            # #82: in SARIF mode --report-json must persist SARIF 2.1.0 (matching
            # stdout), not the standard JSON report, so upload-sarif steps work.
            _write_json(report_json, build_sarif_report(result))
        else:
            _write_json(report_json, result)
        html_report = HtmlRenderer().render(result)
        with open(report_html, "w", encoding="utf-8") as f:
            f.write(html_report)
        _write_json(comments_json, inline_comments)

    return result


def main():
    parser = argparse.ArgumentParser(description="DiffSense: Event-driven MR Audit Analyzer")
    parser.add_argument(
        "diff_file",
        help="Path to the diff file. Use '-' to read the unified diff from stdin (#136), "
             "e.g. `git diff | diffsense replay -`.",
    )
    parser.add_argument("--rules", default="config", help="Path to rules: single YAML file or directory of YAML files. NOTE: since 2.3.0 the default loads the whole config/rules directory (178 rules, #108), up from a single 36-rule file in 2.2.x; pass the old file explicitly to keep the previous rule set")
    parser.add_argument(
        "--format",
        choices=["json", "markdown", "sarif", "junit", "codequality"],
        default="json",
        help="Output format: json | markdown | sarif | junit (#134) | codequality (#135, GitLab Code Quality JSON)",
    )
    parser.add_argument("--profile", default=None, help="Profile: strict or lightweight")
    parser.add_argument("--baseline", action="store_true", help="Generate baseline file for existing issues")
    parser.add_argument("--since-baseline", action="store_true", help="Only report findings not in baseline")
    parser.add_argument("--baseline-file", default=".diffsense-baseline.json", help="Baseline file path")
    parser.add_argument("--report-json", default="diffsense-report.json", help="Report JSON output path")
    parser.add_argument("--report-html", default="diffsense-report.html", help="Report HTML output path")
    parser.add_argument("--comments-json", default="diffsense-comments.json", help="Inline comments JSON output path")
    parser.add_argument("--quality-auto-tune", action="store_true", help="Enable quality auto tune (skip/downgrade)")
    parser.add_argument("--quality-disable-threshold", type=float, default=None, help="Disable threshold (default: 0.3 or rule_quality.disable_threshold from .diffsense.yaml)")
    parser.add_argument("--quality-downgrade-threshold", type=float, default=None, help="Downgrade threshold (default: 0.5 or rule_quality.degrade_threshold from .diffsense.yaml)")
    parser.add_argument("--quality-min-samples", type=int, default=None, help="Minimum samples before actions (default: 30 or rule_quality.min_samples from .diffsense.yaml)")
    parser.add_argument("--experimental", action="store_true", help="Include experimental rules (report-only by default)")
    parser.add_argument("--experimental-report-only", dest="experimental_report_only", action="store_true", default=True, help="Do not affect decision with experimental rules")
    parser.add_argument("--experimental-affect-decision", dest="experimental_report_only", action="store_false", help="Allow experimental rules to affect decision")

    args = parser.parse_args()
    # 1. Read Diff
    # #136: `-` reads the unified diff from stdin (pre-commit / pipe friendly).
    if args.diff_file == "-":
        diff_content = sys.stdin.read()
        if not diff_content.strip():
            print(_tool_error_report(
                "No diff received on stdin (diff_file='-'). Pipe a unified diff, e.g. "
                "`git diff | diffsense replay -` (#136)."
            ), file=sys.__stdout__)
            sys.exit(EXIT_ERROR)
    else:
        # #145: a directory path (or otherwise unreadable path) previously surfaced
        # as a raw PermissionError traceback; validate up front and emit the
        # machine-readable tool-error report with a fix suggestion (#144).
        if os.path.isdir(args.diff_file):
            print(_tool_error_report(
                f"Diff path is a directory, not a diff file: {args.diff_file}. "
                "DiffSense analyzes a single unified diff — generate one first, e.g. "
                "`git diff main...HEAD > changes.diff`, then replay that file (#145)."
            ), file=sys.__stdout__)
            sys.exit(EXIT_ERROR)
        try:
            with open(args.diff_file, 'r', encoding='utf-8') as f:
                diff_content = f.read()
        except FileNotFoundError:
            print(_tool_error_report(
                f"Diff file not found: {args.diff_file}. "
                "Generate a unified diff first, e.g. `git diff main...HEAD > changes.diff`, "
                "then replay that file (#144)."
            ), file=sys.__stdout__)
            sys.exit(EXIT_ERROR)
        except PermissionError as e:
            print(_tool_error_report(
                f"Permission denied while reading diff file {args.diff_file}: {e}. "
                "Check the file's read permissions, or regenerate the diff in a "
                "writable location (#145)."
            ), file=sys.__stdout__)
            sys.exit(EXIT_ERROR)
        except UnicodeDecodeError as e:
            print(_tool_error_report(
                f"Failed to decode diff file {args.diff_file}: not valid UTF-8 "
                f"(possible UTF-16/UTF-16LE/BOM encoding): {e}. "
                "Re-export the diff with `git diff` (it always writes UTF-8) (#144)."
            ), file=sys.__stdout__)
            sys.exit(EXIT_ERROR)

    # 2-6. Run the shared analysis pipeline (parse -> AST -> rules -> decision -> report)
    # #77: surface malformed-diff parse errors clearly and exit with EXIT_ERROR
    try:
        result = analyze_diff(
        diff_content,
        args.rules,
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
        format=args.format,
    )
    except ValueError as e:
        # #77: emit to the process' real stdout — under `replay -q` sys.stdout is
        # redirected to a buffer, but the tool-error report is a machine-readable
        # contract that must still be emitted.
        print(_tool_error_report(str(e)), file=sys.__stdout__)
        sys.exit(EXIT_ERROR)

    # 7. Output Result
    if args.format == "json":
        print(json.dumps(result, indent=2))
    elif args.format == "markdown":
        renderer = MarkdownRenderer()
        print(renderer.render(result))
    elif args.format == "sarif":
        print(json.dumps(build_sarif_report(result), indent=2))
    elif args.format == "junit":
        # #134: JUnit XML on stdout, e.g. Jenkins JUnit plugin / Azure Pipelines.
        print(build_junit_report(result))
    elif args.format == "codequality":
        # #135: GitLab Code Quality JSON on stdout.
        print(json.dumps(build_codequality_report(result), indent=2))

    # Machine-readable exit code: 0 = pass, 1 = blocked findings, 2 = tool error.
    sys.exit(exit_code_for_review_level(result.get("review_level", "normal")))

if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print(_tool_error_report(f"Unexpected error: {e}"))
        sys.exit(EXIT_ERROR)
