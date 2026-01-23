from typing import Dict, Any

class MarkdownRenderer:
    def render(self, result: Dict[str, Any]) -> str:
        """
        Renders the audit result into a Markdown string.
        """
        audit = result.get("audit_result", {})
        review_level = audit.get("review_level", "unknown").capitalize()
        reasons = audit.get("reasons", [])
        impacts = audit.get("impacts", {})
        
        # Emoji mapping for visual cue
        level_emoji = "🚨" if review_level == "Elevated" else "✅"
        
        lines = []
        lines.append(f"### DiffSense · MR Audit")
        lines.append("")
        lines.append(f"**Review Level:** {level_emoji} {review_level}")
        lines.append("")
        
        # Impact Table
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
        
        # Why section
        if reasons:
            lines.append("**Why:**")
            for reason in reasons:
                # Format reason: dimension_level -> Dimension: Level detected
                # Or just output the raw reason string if it's custom
                parts = reason.split('_')
                if len(parts) == 2:
                    dim, lvl = parts
                    lines.append(f"- **{dim.capitalize()}**: {lvl.capitalize()} impact detected")
                else:
                    lines.append(f"- {reason}")
        else:
            lines.append("**Why:**")
            lines.append("- No elevated risks detected.")
            
        return "\n".join(lines)
