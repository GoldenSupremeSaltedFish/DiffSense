"""Smoke + behavior tests for the DiffSense MCP thin shell (stage 4).

Expectations from docs/superpowers/specs/2026-10-09-agent-surface-design.md:
1. ``diffsense-mcp`` entry point exists and speaks stdio JSON-RPC (official mcp SDK);
2. ``tools/list`` returns exactly the 4 read-only tools (no ``record_feedback`` yet);
3. each tool returns well-formed JSON with the expected shape and reuses the
   existing DiffSense pipeline (no re-implemented business logic).
"""

import json
import subprocess
import sys
import threading
import queue
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURES = REPO_ROOT / "tests" / "fixtures"
CRITICAL_DIFF = FIXTURES / "ast_cases" / "critical" / "lock_removal.diff"
LOW_RISK_DIFF = FIXTURES / "misc" / "low_risk.diff"

sys.path.insert(0, str(REPO_ROOT))

EXPECTED_TOOLS = {"audit_diff", "audit_replay", "list_rules", "explain_rule"}


def _rpc(proc: subprocess.Popen, payload: dict, q: queue.Queue, timeout: float = 20.0) -> dict:
    proc.stdin.write(json.dumps(payload) + "\n")
    proc.stdin.flush()
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            line = q.get(timeout=0.5)
        except queue.Empty:
            continue
        return json.loads(line)
    raise TimeoutError(f"no stdio response for {payload.get('method')}")


def _start_server() -> tuple[subprocess.Popen, queue.Queue]:
    proc = subprocess.Popen(
        [sys.executable, "mcp_server.py"],
        cwd=REPO_ROOT,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        bufsize=1,
    )
    q: queue.Queue = queue.Queue()

    def _reader() -> None:
        for line in proc.stdout:
            q.put(line)

    threading.Thread(target=_reader, daemon=True).start()
    return proc, q


def test_stdio_server_exposes_exact_four_readonly_tools() -> None:
    proc, q = _start_server()
    try:
        init = _rpc(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "diffsense-test", "version": "0"},
                },
            },
            q,
        )
        assert "result" in init, init
        # Notifications carry no response; write and move on.
        proc.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}) + "\n")
        proc.stdin.flush()
        listed = _rpc(proc, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}, q)
        tools = {t["name"] for t in listed["result"]["tools"]}
        assert tools == EXPECTED_TOOLS, f"unexpected tool set: {tools}"
    finally:
        proc.kill()


def test_audit_diff_returns_contract_report() -> None:
    import mcp_server

    raw = CRITICAL_DIFF.read_text(encoding="utf-8")
    out = json.loads(mcp_server.audit_diff(raw))
    assert "error" not in out, out
    assert list(out.keys())[0] == "schema_version"
    assert out["schema_version"] == "1.0"
    assert out["review_level"] == "critical"


def test_audit_replay_reads_diff_path() -> None:
    import mcp_server

    out = json.loads(mcp_server.audit_replay(str(LOW_RISK_DIFF)))
    assert "error" not in out, out
    assert out["schema_version"] == "1.0"
    assert out["review_level"] in ("normal", "low")


def test_audit_replay_missing_file_returns_error_json() -> None:
    import mcp_server

    out = json.loads(mcp_server.audit_replay(str(REPO_ROOT / "does-not-exist.diff")))
    assert out.get("review_level") == "error"
    assert "error" in out


def test_list_rules_returns_metadata_array() -> None:
    import mcp_server

    rows = json.loads(mcp_server.list_rules())
    assert isinstance(rows, list) and rows
    for row in rows:
        assert "id" in row
        assert "severity" in row
        assert "impact" in row


def test_explain_rule_found_and_missing() -> None:
    import mcp_server

    rows = json.loads(mcp_server.list_rules())
    known_id = rows[0]["id"]
    detail = json.loads(mcp_server.explain_rule(known_id))
    assert detail.get("id") == known_id
    assert "rationale" in detail

    missing = json.loads(mcp_server.explain_rule("no.such.rule"))
    assert missing.get("error")