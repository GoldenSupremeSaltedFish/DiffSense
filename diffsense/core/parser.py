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
        
        lines = diff_content.splitlines()
        current_file = None
        current_patch_lines = []
        
        for line in lines:
            # Check for new file header
            if line.startswith("diff --git"):
                # Save previous patch if exists
                if current_file and current_patch_lines:
                    file_patches.append({
                        "file": current_file,
                        "patch": "\n".join(current_patch_lines)
                    })
                
                # Reset for new file
                current_file = None
                current_patch_lines = []
            
            # Capture filename from --- or +++
            if line.startswith("--- "):
                path = line[4:].strip()
                if path != "/dev/null":
                    # Remove prefix a/ if present
                    if path.startswith("a/"):
                        path = path[2:]
                    if current_file is None:
                        current_file = path

            if line.startswith("+++ "):
                path = line[4:].strip()
                if path != "/dev/null":
                    # Remove prefix b/ if present
                    if path.startswith("b/"):
                        path = path[2:]
                    current_file = path # Prefer new filename
                
                # If we found a file, add to list if not present
                if current_file and current_file not in files:
                    files.append(current_file)

            # Accumulate patch lines
            # We include headers in the patch content for context
            current_patch_lines.append(line)

            # Stats
            if line.startswith('+') and not line.startswith('+++'):
                stats["add"] += 1
            elif line.startswith('-') and not line.startswith('---'):
                stats["del"] += 1

        # Add the last patch
        if current_file and current_patch_lines:
            file_patches.append({
                "file": current_file,
                "patch": "\n".join(current_patch_lines)
            })

        # Determine change types
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
            "raw_diff": diff_content
        }
