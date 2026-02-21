"""
Pytest conftest: ensure repo root is on sys.path so that 'diffsense' is importable.
Allows running from repo root without PYTHONPATH, e.g.:
  python -m pytest diffsense/tests/ -v
"""
import sys
from pathlib import Path

_repo_root = Path(__file__).resolve().parents[2]
_repo_root = str(_repo_root)
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)
