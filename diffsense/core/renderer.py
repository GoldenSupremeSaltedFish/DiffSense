from typing import Dict, Any

class MarkdownRenderer:
    def render(self, result: Dict[str, Any]) -> str:
        """
        Renders the audit result into a Markdown string.
        """
        review_level = result.get("review_level", "unknown").capitalize()
        details = result.get("details", [])
        
        lines = []
        
        if review_level == "Elevated":
            lines.append(f"# 🚨 DiffSense Risk Signal: {review_level}")
            lines.append("")
            lines.append("**Detected high-risk changes:**")
            
            for d in details:
                if d.get('severity') == 'high':
                    lines.append(f"- **Dimension:** {d.get('impact', 'Unknown').capitalize()}")
                    lines.append(f"- **Rule:** `{d.get('rule_id')}`")
                    lines.append(f"- **File:** `{d.get('file')}`")
                    lines.append("")
                    lines.append(f"> **Rationale:** {d.get('rationale')}")
                    lines.append("")
            
            lines.append("---")
            lines.append("**Required action:**")
            lines.append("This is a risk signal, not a block.")
            lines.append("")
            lines.append("👉 **Approve this PR** OR **React with 👍** to this comment, then **Re-run this job** to pass.")
            
        else:
            lines.append(f"# ✅ DiffSense Audit: {review_level}")
            lines.append("")
            lines.append("No high-risk changes detected. Standard review process applies.")
            
        return "\n".join(lines)
