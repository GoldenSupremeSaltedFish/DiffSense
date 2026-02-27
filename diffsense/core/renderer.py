from typing import Dict, Any
import html as _html

class MarkdownRenderer:
    def render(self, result: Dict[str, Any]) -> str:
        """
        Renders the audit result into a Markdown string.
        """
        review_level = result.get("review_level", "unknown").capitalize()
        details = result.get("details", [])

        lines = []

        if review_level in ["Elevated", "Critical"]:
            lines.append(f"# 🚨 DiffSense Risk Signal: {review_level}")
        else:
            lines.append(f"# ✅ DiffSense Audit: {review_level}")
        lines.append("")

        if not details:
            lines.append("No warnings detected.")
            return "\n".join(lines)

        severity_rank = {
            "critical": 0,
            "high": 1,
            "medium": 2,
            "low": 3,
            "unknown": 4
        }

        grouped = {}
        for d in details:
            file_path = d.get("file") or d.get("matched_file") or "unknown"
            rule_id = d.get("rule_id") or d.get("id") or "unknown"
            severity = (d.get("severity") or "unknown").lower()
            impact = d.get("impact") or "unknown"
            rationale = d.get("rationale") or ""
            grouped.setdefault(file_path, []).append({
                "rule_id": rule_id,
                "severity": severity,
                "impact": impact,
                "rationale": rationale
            })

        lines.append("## ⚠️ Warnings by File")
        for file_path in sorted(grouped.keys()):
            lines.append("")
            lines.append(f"### `{file_path}`")
            for item in sorted(grouped[file_path], key=lambda x: severity_rank.get(x["severity"], 4)):
                sev_label = item["severity"].upper() if item["severity"] else "UNKNOWN"
                lines.append(f"- **{sev_label}** `{item['rule_id']}` ({item['impact']})")
                if item["rationale"]:
                    lines.append(f"  - {item['rationale']}")

        if review_level in ["Elevated", "Critical"]:
            lines.append("")
            lines.append("---")
            lines.append("**Required action:**")
            lines.append("This is a risk signal, not a block.")
            lines.append("")
            lines.append("👉 **Approve this PR** OR **React with 👍** to this comment, then **Re-run this job** to pass.")

        return "\n".join(lines)

class HtmlRenderer:
    def render(self, result: Dict[str, Any]) -> str:
        review_level = result.get("review_level", "unknown")
        details = result.get("details", [])
        metrics = result.get("_metrics", {})
        rule_metrics = result.get("_metrics", {})
        rule_quality = result.get("_rule_quality", {})

        def esc(value: Any) -> str:
            return _html.escape(str(value))

        rows = []
        for d in details:
            rows.append(
                "<tr>"
                f"<td>{esc(d.get('rule_id', ''))}</td>"
                f"<td>{esc(d.get('severity', ''))}</td>"
                f"<td>{esc(d.get('file', ''))}</td>"
                f"<td>{esc(d.get('impact', ''))}</td>"
                f"<td>{esc(d.get('rationale', ''))}</td>"
                f"<td>{esc(d.get('precision', ''))}</td>"
                f"<td>{esc(d.get('quality_status', ''))}</td>"
                "</tr>"
            )
        detail_table = "\n".join(rows) if rows else "<tr><td colspan='7'>No warnings detected.</td></tr>"

        cache = metrics.get("cache", {})
        diff_cache = cache.get("diff", {})
        ast_cache = cache.get("ast", {})
        d_total = diff_cache.get("hits", 0) + diff_cache.get("misses", 0)
        a_total = ast_cache.get("hits", 0) + ast_cache.get("misses", 0)
        d_rate = (diff_cache.get("hits", 0) / d_total * 100) if d_total else 0
        a_rate = (ast_cache.get("hits", 0) / a_total * 100) if a_total else 0

        rule_rows = []
        for rule_id, m in rule_metrics.items():
            if rule_id == "cache":
                continue
            time_ms = (m.get("time_ns", 0) / 1_000_000) if isinstance(m, dict) else 0
            hits = m.get("hits", 0) if isinstance(m, dict) else 0
            ignores = m.get("ignores", 0) if isinstance(m, dict) else 0
            errors = m.get("errors", 0) if isinstance(m, dict) else 0
            precision = ""
            q = rule_quality.get(rule_id)
            if isinstance(q, dict):
                precision = q.get("precision", "")
            rule_rows.append(
                "<tr>"
                f"<td>{esc(rule_id)}</td>"
                f"<td>{esc(hits)}</td>"
                f"<td>{esc(ignores)}</td>"
                f"<td>{esc(errors)}</td>"
                f"<td>{esc(time_ms)}</td>"
                f"<td>{esc(precision)}</td>"
                "</tr>"
            )
        rule_table = "\n".join(rule_rows) if rule_rows else "<tr><td colspan='6'>No rule metrics.</td></tr>"

        return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>DiffSense Report</title>
<style>
body{{font-family:Arial,sans-serif;margin:20px}}
table{{border-collapse:collapse;width:100%}}
th,td{{border:1px solid #ddd;padding:8px;text-align:left}}
th{{background:#f4f4f4}}
.summary{{margin-bottom:16px}}
</style>
</head>
<body>
<h1>DiffSense Report</h1>
<div class="summary">
<div>Review Level: {esc(review_level)}</div>
<div>Diff Cache Hit: {d_rate:.1f}% ({diff_cache.get("hits", 0)}/{d_total})</div>
<div>AST Cache Hit: {a_rate:.1f}% ({ast_cache.get("hits", 0)}/{a_total})</div>
</div>
<h2>Findings</h2>
<table>
<thead>
<tr>
<th>Rule</th><th>Severity</th><th>File</th><th>Impact</th><th>Rationale</th><th>Precision</th><th>Quality</th>
</tr>
</thead>
<tbody>
{detail_table}
</tbody>
</table>
<h2>Rule Metrics</h2>
<table>
<thead>
<tr>
<th>Rule</th><th>Hits</th><th>Ignores</th><th>Errors</th><th>Time(ms)</th><th>Precision</th>
</tr>
</thead>
<tbody>
{rule_table}
</tbody>
</table>
</body>
</html>"""
