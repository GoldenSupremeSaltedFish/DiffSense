from typing import Dict, Any

class MarkdownRenderer:
    def render(self, result: Dict[str, Any]) -> str:
        """
        Renders the audit result into a Markdown string.
        Expects the new Parser Contract JSON structure.
        """
        review_level = result.get("review_level", "unknown").capitalize()
        reasons = result.get("reasons", [])
        impacts = result.get("impacts", {})
        details = result.get("details", [])
        
        # Emoji mapping for visual cue
        level_emoji = "🚨" if review_level in ["Elevated", "Critical"] else "✅"
        
        lines = []
        lines.append(f"### DiffSense · MR Audit")
        lines.append("")
        lines.append(f"**Review Level:** {level_emoji} {review_level}")
        lines.append("")
        
        # Impact Table
        if impacts:
            lines.append("| Dimension | Impact |")
            lines.append("|-----------|--------|")
            
            # Sort impacts for consistent output
            for dim, level in impacts.items():
                # Bold high/critical impacts
                display_level = level.capitalize()
                if level in ["high", "critical"]:
                    display_level = f"**{display_level}**"
                lines.append(f"| {dim.capitalize()} | {display_level} |")
            lines.append("")
        
        # Reasons Section
        if reasons:
            lines.append("**Detected Issues:**")
            for reason in reasons:
                lines.append(f"- `{reason}`")
            lines.append("")

        # Details Section
        if details:
            lines.append("<details>")
            lines.append("<summary>View Detailed Analysis</summary>")
            lines.append("")
            lines.append("| Rule ID | Severity | File | Rationale |")
            lines.append("|---------|----------|------|-----------|")
            for d in details:
                rule_id = d.get('rule_id', '-')
                sev = d.get('severity', '-')
                f = d.get('file', '-')
                rat = d.get('rationale', '-')
                lines.append(f"| {rule_id} | {sev} | {f} | {rat} |")
            lines.append("")
            lines.append("</details>")
            
        return "\n".join(lines)
