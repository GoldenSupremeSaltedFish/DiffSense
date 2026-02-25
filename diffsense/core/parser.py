import re
import os
import json
import hashlib
from typing import List, Dict, Any, Optional

class DiffParser:
    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = cache_dir or self._resolve_cache_dir()

    def _resolve_cache_dir(self) -> str:
        base_dir = os.environ.get("DIFFSENSE_CACHE_DIR")
        if not base_dir:
            base_dir = os.path.join(os.path.expanduser("~"), ".diffsense", "cache")
        return os.path.join(base_dir, "diff")

    def _cache_key(self, diff_content: str) -> str:
        digest = hashlib.sha1(diff_content.encode("utf-8", errors="ignore")).hexdigest()
        return f"v1_{digest}"

    def _cache_path(self, cache_key: str) -> str:
        return os.path.join(self.cache_dir, f"{cache_key}.json")

    def _load_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        path = self._cache_path(cache_key)
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def _save_cache(self, cache_key: str, data: Dict[str, Any]) -> None:
        os.makedirs(self.cache_dir, exist_ok=True)
        path = self._cache_path(cache_key)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f)
        except Exception:
            pass

    def parse(self, diff_content: str) -> Dict[str, Any]:
        """
        Parses a unified diff string and returns a structured object.
        """
        files = []
        stats = {"add": 0, "del": 0}
        file_patches = []
        
        cache_key = self._cache_key(diff_content)
        cached = self._load_cache(cache_key)
        if cached:
            return cached

        # Check if content looks like JSON (GitLab API response leak)
        if diff_content.strip().startswith('{') or diff_content.strip().startswith('['):
            # It seems we got raw JSON instead of diff text.
            # This happens if the fetcher returned API response text directly.
            # Let's try to handle this edge case or return empty to fail safely.
            print("Warning: Diff content looks like JSON. Parser expects Unified Diff format.")
            result = {"files": [], "file_patches": [], "stats": stats, "change_types": [], "raw_diff": diff_content}
            self._save_cache(cache_key, result)
            return result

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

        result = {
            "files": files,
            "file_patches": file_patches,
            "stats": stats,
            "change_types": list(change_types),
            "raw_diff": diff_content
        }
        self._save_cache(cache_key, result)
        return result
