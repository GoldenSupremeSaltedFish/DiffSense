import re
from typing import List, Dict, Any

class DiffParser:
    def parse(self, diff_content: str) -> Dict[str, Any]:
        """
        Parses a unified diff string and returns a structured object.
        """
        files = []
        stats = {"add": 0, "del": 0}
        
        # Simple regex to find file names in diff
        # --- a/src/foo.py
        # +++ b/src/foo.py
        file_pattern = re.compile(r'^\+\+\+ b/(.+)$', re.MULTILINE)
        
        matches = file_pattern.findall(diff_content)
        files = matches
        
        # Count additions and deletions
        for line in diff_content.splitlines():
            if line.startswith('+') and not line.startswith('+++'):
                stats["add"] += 1
            elif line.startswith('-') and not line.startswith('---'):
                stats["del"] += 1
                
        # Determine change types (mock logic for now, can be enhanced)
        change_types = set()
        for f in files:
            if f.endswith('.json') or f.endswith('.yaml') or f.endswith('.yml'):
                change_types.add("config")
            elif f.endswith('.ts') or f.endswith('.py') or f.endswith('.go') or f.endswith('.java'):
                change_types.add("logic")
            elif f.endswith('.md') or f.endswith('.txt'):
                change_types.add("doc")
            else:
                change_types.add("other")

        return {
            "files": files,
            "stats": stats,
            "change_types": list(change_types),
            "raw_diff": diff_content # Keep raw diff for rule matching
        }
