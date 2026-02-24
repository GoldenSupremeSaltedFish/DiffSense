from typing import Dict, Any

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
