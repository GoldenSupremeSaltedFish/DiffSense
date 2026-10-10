"""Batch A regression tests: finding attribution (#1), serialVersionUID semantics (#2),
bad-input contract (#7) and replay --quiet / stream contract (#6).

Covers:
1. anchor_file anchors findings to the real hunk instead of the first file;
2. anchor_file never attributes to files the semantic layer skips;
3. serialVersionUID is reported as a *change* only when both sides change (first
   introduction is not a compatibility break);
4. main.py emits a machine-readable error report (review_level "error") and exit 2
   on bad input (missing file, UTF-16 diff);
5. `cli.py replay --quiet` keeps stdout empty while still writing --report-json.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

from core.attribution import anchor_file
from rules.api_compatibility import SerialVersionUIDChangedRule

REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURES = REPO_ROOT / "tests" / "fixtures"
LOW_RISK_DIFF = FIXTURES / "misc" / "low_risk.diff"


def _diff_data(file_patches):
    return {"file_patches": file_patches}


def _patch(file_name, text):
    return {"file": file_name, "patch": text}


# --- #1: attribution anchors to the real hunk ---------------------------------


def test_anchor_file_prefers_real_hunk():
    pattern = re.compile(r"^\+.*marker_second_file", re.MULTILINE)
    data = _diff_data([
        _patch("a.py", "diff --git a/a.py b/a.py\n@@ -1 +1 @@\n+print(1)\n"),
        _patch("b.py", "diff --git b/b.py b/b.py\n@@ -1 +1 @@\n+marker_second_file\n"),
    ])
    assert anchor_file(data, pattern) == "b.py"


def test_anchor_file_never_attributes_to_skipped_file():
    """A pattern matching only a .md hunk must NOT attribute to that file."""
    pattern = re.compile(r"marker_in_markdown")
    data = _diff_data([
        _patch("README.md", "diff --git a/README.md b/README.md\n@@ -1 +1 @@\n+marker_in_markdown\n"),
        _patch("a.py", "diff --git a/a.py b/a.py\n@@ -1 +1 @@\n+print(1)\n"),
    ])
    # The markdown hunk matched, but it is not analyzable -> fall back to a.py.
    assert anchor_file(data, pattern) == "a.py"


def test_anchor_file_unknown_when_only_skipped_files():
    pattern = re.compile(r"marker")
    data = _diff_data([
        _patch("README.md", "diff --git a/README.md b/README.md\n+marker\n"),
        _patch("notes.txt", "diff --git a/notes.txt b/notes.txt\n+marker\n"),
    ])
    assert anchor_file(data, pattern) == "unknown"


def test_anchor_file_falls_back_to_first_supported_file():
    pattern = re.compile(r"never_matches")
    data = _diff_data([
        _patch("b.py", "diff --git b/b.py b/b.py\n+print(2)\n"),
        _patch("a.py", "diff --git a/a.py b/a.py\n+print(1)\n"),
    ])
    assert anchor_file(data, pattern) == "b.py"


# --- #2: serialVersionUID added vs changed ------------------------------------


def test_serial_uid_first_introduction_not_flagged():
    rule = SerialVersionUIDChangedRule()
    data = _diff_data([
        _patch(
            "Foo.java",
            "diff --git a/Foo.java b/Foo.java\n@@ -1 +1 @@\n"
            "+\tprivate static final long serialVersionUID = 1L;\n",
        )
    ])
    data["raw_diff"] = "+\tprivate static final long serialVersionUID = 1L;\n"
    assert rule.evaluate(data, []) is None


def test_serial_uid_change_is_flagged():
    rule = SerialVersionUIDChangedRule()
    patch_text = (
        "diff --git a/Foo.java b/Foo.java\n@@ -1 +1 @@\n"
        "-\tprivate static final long serialVersionUID = 1L;\n"
        "+\tprivate static final long serialVersionUID = 2L;\n"
    )
    data = _diff_data([_patch("Foo.java", patch_text)])
    data["raw_diff"] = (
        "-\tprivate static final long serialVersionUID = 1L;\n"
        "+\tprivate static final long serialVersionUID = 2L;\n"
    )
    result = rule.evaluate(data, [])
    assert result is not None
    assert result["file"] == "Foo.java"


# --- #7: bad input -> error report + exit 2 ------------------------------------


def test_main_missing_diff_emits_error_json():
    proc = subprocess.run(
        [sys.executable, "main.py", str(REPO_ROOT / "no_such.diff")],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert proc.returncode == 2
    data = json.loads(proc.stdout)
    assert list(data.keys())[0] == "schema_version"
    assert data["review_level"] == "error"
    assert "error" in data


def test_main_utf16_diff_is_tool_error(tmp_path):
    utf16 = tmp_path / "utf16.diff"
    utf16.write_bytes(
        "diff --git a/a.py b/a.py\n@@ -1 +1 @@\n+print(1)\n".encode("utf-16")
    )
    proc = subprocess.run(
        [sys.executable, "main.py", str(utf16)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert proc.returncode == 2
    data = json.loads(proc.stdout)
    assert data["review_level"] == "error"
    assert "UTF" in data["error"] or "decode" in data["error"].lower()


# --- #6: replay --quiet stream contract ---------------------------------------


def test_replay_quiet_suppresses_stdout(tmp_path):
    report = tmp_path / "quiet.json"
    proc = subprocess.run(
        [
            sys.executable, "cli.py", "replay", str(LOW_RISK_DIFF),
            "--report-json", str(report), "--quiet",
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert proc.returncode == 0
    assert proc.stdout.strip() == ""
    data = json.loads(report.read_text(encoding="utf-8"))
    assert list(data.keys())[0] == "schema_version"


def test_replay_without_quiet_still_prints_report(tmp_path):
    report = tmp_path / "loud.json"
    proc = subprocess.run(
        [
            sys.executable, "cli.py", "replay", str(LOW_RISK_DIFF),
            "--report-json", str(report),
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert proc.returncode == 0
    assert proc.stdout.strip() != ""
