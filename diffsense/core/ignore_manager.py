import os
import yaml
import fnmatch
from typing import List, Dict, Any, Optional

class IgnoreManager:
    """
    Manages repository-level ignore configurations.
    """
    
    def __init__(self, repo_root: str = "."):
        self.repo_root = repo_root
        self.ignores = [] # List of {rule_pattern, file_patterns}
        self._load_config()

    def _load_config(self):
        # Try .diffsense.yaml first, then .diffsenseignore (assuming yaml content)
        config_files = [".diffsense.yaml", ".diffsenseignore"]
        
        for fname in config_files:
            path = os.path.join(self.repo_root, fname)
            if os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        data = yaml.safe_load(f)
                        if data and 'ignore' in data:
                            self._parse_ignores(data['ignore'])
                            print(f"Loaded ignore config from {fname}")
                            break
                except Exception as e:
                    print(f"Error loading ignore config {fname}: {e}")

    def _parse_ignores(self, ignore_list: List[Dict[str, Any]]):
        for item in ignore_list:
            rule = item.get('rule') or item.get('id')
            files = item.get('files', [])
            if isinstance(files, str):
                files = [files]
                
            if rule:
                self.ignores.append({
                    "rule": rule,
                    "files": files
                })

    def is_ignored(self, rule_id: str, file_path: str) -> bool:
        """
        Checks if a rule is ignored for a specific file.
        """
        for ignore in self.ignores:
            rule_pattern = ignore["rule"]
            file_patterns = ignore["files"]
            
            # Check Rule Match
            if not fnmatch.fnmatch(rule_id, rule_pattern):
                continue
                
            # If no file patterns, it applies globally (to all files)
            if not file_patterns:
                return True
                
            # Check File Match
            for fp in file_patterns:
                # Normalize paths for matching
                # file_path might be relative or absolute. Pattern is usually relative.
                # Let's assume file_path is relative to repo root or just basename?
                # Usually DiffSense uses relative paths in report.
                if fnmatch.fnmatch(file_path, fp):
                    return True
                    
        return False
