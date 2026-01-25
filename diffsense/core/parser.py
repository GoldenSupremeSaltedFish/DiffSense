import re
from typing import List, Dict, Any

class DiffParser:
    def parse(self, diff_content: str) -> Dict[str, Any]:
        """
        Parses a unified diff string and returns a structured object.
        """
        files = []
        stats = {"add": 0, "del": 0}
        file_patches = []
        
        # Split diff into file chunks
        # A robust way is to split by "diff --git"
        chunks = re.split(r'(^diff --git a/.* b/.*$)', diff_content, flags=re.MULTILINE)
        
        current_file = None
        current_patch = []
        
        for chunk in chunks:
            if not chunk.strip():
                continue
                
            # Check if this chunk is a header
            if chunk.startswith("diff --git"):
                # If we have a previous file, save it
                if current_file and current_patch:
                     file_patches.append({
                         "file": current_file,
                         "patch": "".join(current_patch)
                     })
                     current_patch = []
                
                # Extract filename from header? 
                # Actually, "diff --git a/X b/Y"
                # It's better to rely on "+++ b/" inside the patch for the final name
                # But for now let's just use the chunk as context starter.
                pass
            
            # Check for filename in the chunk (+++ b/...)
            match = re.search(r'^\+\+\+ b/(.+)$', chunk, re.MULTILINE)
            if match:
                current_file = match.group(1)
                files.append(current_file)
            
            # Accumulate patch
            current_patch.append(chunk)

        # Add the last one
        if current_file and current_patch:
            file_patches.append({
                "file": current_file,
                "patch": "".join(current_patch)
            })

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
            "file_patches": file_patches,
            "stats": stats,
            "change_types": list(change_types),
            "raw_diff": diff_content # Keep raw diff for rule matching
        }
