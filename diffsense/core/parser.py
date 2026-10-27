import re
import os
import json
import time
import hashlib
from typing import List, Dict, Any, Optional, Union
from . import CACHE_VERSION
from . import get_cache_max_age_seconds

class DiffParser:
    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = cache_dir or self._resolve_cache_dir()
        self.metrics = {"hits": 0, "misses": 0, "saved_ms": 0}
        self.warnings: List[str] = []

    # #137: Windows clients frequently pipe diffs produced by non-UTF-8 codepages
    # (GBK/cp936 etc). Decode leniently instead of crashing so multibyte content
    # still reaches the rule engine; record a lossy-decode warning for operators.
    def _read_diff_text(self, diff_content: Union[str, bytes]) -> str:
        if not isinstance(diff_content, bytes):
            return diff_content
        try:
            return diff_content.decode("utf-8")
        except UnicodeDecodeError:
            self.warnings.append(
                "Diff is not valid UTF-8; decoded with GBK fallback (lossy). "
                "Prefer `git diff` output, which is UTF-8 (#137)."
            )
            try:
                return diff_content.decode("gbk")
            except UnicodeDecodeError:
                return diff_content.decode("utf-8", errors="replace")

    def _resolve_cache_dir(self) -> str:
        base_dir = os.environ.get("DIFFSENSE_CACHE_DIR")
        if not base_dir:
            base_dir = os.path.join(os.path.expanduser("~"), ".diffsense", "cache")
        return os.path.join(base_dir, CACHE_VERSION, "diff")

    def _cache_key(self, diff_content: str) -> str:
        digest = hashlib.sha1(diff_content.encode("utf-8", errors="ignore")).hexdigest()
        return digest

    def _cache_path(self, cache_key: str) -> str:
        return os.path.join(self.cache_dir, f"{cache_key}.json")

    def _load_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        path = self._cache_path(cache_key)
        if not os.path.exists(path):
            return None
        max_age = get_cache_max_age_seconds()
        if max_age > 0:
            try:
                mtime = os.path.getmtime(path)
                if (time.time() - mtime) > max_age:
                    try:
                        os.remove(path)
                    except OSError:
                        pass
                    return None
            except OSError:
                return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def _save_cache(self, cache_key: str, data: Dict[str, Any]) -> None:
        os.makedirs(self.cache_dir, exist_ok=True)
        # #103: sweep stale .tmp orphans left behind by crashed writers. Only
        # remove .tmp files older than 1h so a concurrently running writer
        # (same cache dir) is never interrupted mid-write.
        try:
            now = time.time()
            for name in os.listdir(self.cache_dir):
                if not name.endswith(".tmp"):
                    continue
                tmp_full = os.path.join(self.cache_dir, name)
                try:
                    if now - os.path.getmtime(tmp_full) > 3600:
                        os.remove(tmp_full)
                except OSError:
                    pass
        except OSError:
            pass
        path = self._cache_path(cache_key)
        tmp_path = f"{path}.{os.getpid()}.tmp"
        try:
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(data, f)
            # Atomic rename (replace existing if any)
            os.replace(tmp_path, path)
        except Exception:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            pass

    _STRUCTURAL_NOISE_PREFIXES = (
        "diff --git", "index ", "--- ", "+++ ", "old mode", "new mode",
        "new file mode", "deleted file mode", "similarity index",
        "dissimilarity index", "rename from", "rename to", "copy from",
        "copy to", "Binary files", "GIT binary patch", "Literal", "Delta",
    )

    def _validate_diff_structure(self, diff_content: str) -> None:
        """#77: a payload that looks like git diff output but has no hunk headers (@@)
        would previously be silently analyzed as plain text. Raise a clear error instead.
        Binary-only sections (Binary files differ / GIT binary patch) are legitimate and skipped."""
        if not diff_content or "diff --git" not in diff_content or "@@" in diff_content:
            return
        for section in re.split(r"(?=diff --git )", diff_content):
            if "diff --git" not in section:
                continue
            if "Binary files" in section or "GIT binary patch" in section:
                continue
            body = [l for l in section.splitlines()
                    if l.strip() and not l.startswith(self._STRUCTURAL_NOISE_PREFIXES)]
            if body:
                raise ValueError(
                    "Malformed diff: file section has content lines but no hunk header "
                    "('@@'). Diff appears truncated or hand-edited. First line of offending "
                    "section: %r" % section.splitlines()[0][:80]
                )

    # #79: a single line at or above this size can stall regex-based rules
    # (catastrophic backtracking / quadratic scans). Truncate with a warning
    # instead of hanging; truncation runs before the cache lookup so the cache
    # key stays consistent across runs.
    MAX_LINE_LENGTH = 100_000

    @staticmethod
    def _warn(msg: str) -> None:
        if os.environ.get("DIFFSENSE_QUIET"):
            return
        try:
            import sys
            sys.stderr.write(f"WARNING: {msg}\n")
            sys.stderr.flush()
        except Exception:
            pass

    def _guard_long_lines(self, diff_content: str) -> str:
        """#79: truncate pathological single lines (>100k chars) with a warning."""
        if not diff_content:
            return diff_content
        out = []
        truncated = 0
        for line in diff_content.splitlines(True):
            if len(line) > self.MAX_LINE_LENGTH:
                truncated += 1
                out.append(
                    line[: self.MAX_LINE_LENGTH]
                    + f" ... [truncated by diffsense: line exceeded {self.MAX_LINE_LENGTH} chars]\n"
                )
            else:
                out.append(line)
        if truncated:
            self._warn(
                f"diff contains {truncated} line(s) longer than {self.MAX_LINE_LENGTH} chars; "
                "long lines were truncated to keep analysis responsive (issue #79)"
            )
            diff_content = "".join(out)
        return diff_content

    def parse(self, diff_content: Union[str, bytes]) -> Dict[str, Any]:
        """
        Parses a unified diff string and returns a structured object.
        """
        import time
        start_time = time.perf_counter()

        # #137: accept bytes input (e.g. subprocess output), decoding leniently.
        diff_content = self._read_diff_text(diff_content)

        # #77: validate BEFORE the cache lookup — a malformed payload must neither
        # reuse a cached result nor have its (bad) result cached.
        self._validate_diff_structure(diff_content)

        # #79: cap pathological single-line sizes before matching/caching.
        diff_content = self._guard_long_lines(diff_content)

        files = []
        new_files = []
        stats = {"add": 0, "del": 0}
        file_patches = []
        
        cache_key = self._cache_key(diff_content)
        cached = self._load_cache(cache_key)
        if cached:
            self.metrics["hits"] += 1
            return cached

        self.metrics["misses"] += 1

        # Check if content looks like JSON
        if diff_content.strip().startswith('{') or diff_content.strip().startswith('['):
            print("Warning: Diff content looks like JSON. Parser expects Unified Diff format.")
            result = {"files": [], "new_files": [], "file_patches": [], "stats": stats, "change_types": [], "raw_diff": diff_content}
            self._save_cache(cache_key, result)
            return result

        lines = diff_content.splitlines()
        current_file = None
        current_patch_lines = []
        is_new_file = False
        
        for line in lines:
            # Check for new file header
            if line.startswith("diff --git"):
                # Save previous patch if exists
                if current_file and current_patch_lines:
                    file_patches.append({
                        "file": current_file,
                        "patch": "\n".join(current_patch_lines),
                        "is_new": is_new_file
                    })
                    if is_new_file:
                        new_files.append(current_file)
                
                # Reset for new file
                current_file = None
                current_patch_lines = []
                is_new_file = False
            
            # Capture filename from --- or +++
            if line.startswith("--- "):
                path = line[4:].strip()
                if path == "/dev/null":
                    is_new_file = True
                else:
                    if path.startswith("a/"):
                        path = path[2:]
                    if current_file is None:
                        current_file = path

            if line.startswith("+++ "):
                path = line[4:].strip()
                if path != "/dev/null":
                    if path.startswith("b/"):
                        path = path[2:]
                    current_file = path
                
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
                "patch": "\n".join(current_patch_lines),
                "is_new": is_new_file
            })
            if is_new_file:
                new_files.append(current_file)

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
            "new_files": new_files,
            "file_patches": file_patches,
            "stats": stats,
            "change_types": list(change_types),
            "raw_diff": diff_content
        }
        
        # Track how much time this parse took to estimate future savings
        duration_ms = (time.perf_counter() - start_time) * 1000
        self.metrics["saved_ms"] = duration_ms # Proxy for saved time on hit
        
        self._save_cache(cache_key, result)
        return result
