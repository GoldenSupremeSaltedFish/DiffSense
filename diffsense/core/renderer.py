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
            lines.append("⚠️ **A human reviewer must explicitly acknowledge and approve this risk.**")
            lines.append("")
            lines.append("To acknowledge this risk and unblock the CI, please:")
            lines.append("1. **Review** the changes carefully.")
            lines.append("2. Add the **`risk-accepted`** label to this Pull Request.")
            lines.append("3. Re-run this job.")
            
        else:
            lines.append(f"# ✅ DiffSense Audit: {review_level}")
            lines.append("")
            lines.append("No high-risk changes detected. Standard review process applies.")
            
        return "\n".join(lines)
