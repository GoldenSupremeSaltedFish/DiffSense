"""Smoke + behavior tests for the DiffSense MCP thin shell (stage 4).

Expectations from docs/superpowers/specs/2026-10-09-agent-surface-design.md:
1. ``diffsense-mcp`` entry point exists and speaks stdio JSON-RPC (official mcp SDK);
2. ``tools/list`` returns exactly the 4 read-only tools (no ``record_feedback`` yet);
3. each tool returns well-formed JSON with the expected shape and reuses the
   existing DiffSense pipeline (no re-implemented business logic).
"""

import json
import pytest
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


def test_malformed_jsonrpc_line_gets_parse_error() -> None:
    # #128: a line that is not valid JSON must get a JSON-RPC 2.0 parse error
    # response (-32700, id=null) on the wire instead of being dropped silently.
    proc, q = _start_server()
    try:
        proc.stdin.write("not valid json at all\n")
        proc.stdin.flush()
        resp = json.loads(q.get(timeout=20))
        assert "error" in resp, resp
        assert resp["id"] is None
        assert resp["error"]["code"] == -32700
    finally:
        proc.kill()


def test_valid_traffic_still_works_after_parse_error() -> None:
    # #128: the parse-error responder must not wedge the stdio stream; normal
    # initialize + tools/list after a malformed line still succeed.
    proc, q = _start_server()
    try:
        proc.stdin.write("garbage\n")
        proc.stdin.flush()
        first = json.loads(q.get(timeout=20))
        assert first.get("error", {}).get("code") == -32700, first  # drain the parse error first
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
        listed = _rpc(proc, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}, q)
        assert {t["name"] for t in listed["result"]["tools"]} == EXPECTED_TOOLS
    finally:
        proc.kill()


def test_audit_diff_returns_contract_report() -> None:
    import mcp_server

    raw = CRITICAL_DIFF.read_text(encoding="utf-8")
    out = json.loads(mcp_server.audit_diff(raw))
    assert "error" not in out, out
    assert list(out.keys())[0] == "schema_version"
    assert out["schema_version"] == "1.1"  # #104: bumped with review_level rename
    assert out["review_level"] == "critical"


def test_audit_replay_reads_diff_path() -> None:
    import mcp_server

    out = json.loads(mcp_server.audit_replay(str(LOW_RISK_DIFF)))
    assert "error" not in out, out
    assert out["schema_version"] == "1.1"  # #104: bumped with review_level rename
    assert out["review_level"] in ("normal", "low")


def test_audit_replay_missing_file_raises_tool_error() -> None:
    # #124/#153: a missing diff_path is a tool error (exception, SDK maps to isError=true),
    # not a JSON error payload masquerading as a clean report.
    import mcp_server

    with pytest.raises(ValueError, match="does not exist"):
        mcp_server.audit_replay(str(REPO_ROOT / "does-not-exist.diff"))


def test_audit_replay_rejects_path_outside_allowed_roots(tmp_path: Path) -> None:
    # #153/#154: paths resolving outside the allowed roots (cwd by default) are
    # rejected even when the file exists and carries a diff extension — a remote
    # MCP client must not be able to read arbitrary files via audit_replay.
    import mcp_server

    outside = tmp_path / "outside.diff"
    outside.write_text("diff --git a/x b/x\n@@ -1 +1 @@\n-a\n+b\n", encoding="utf-8")
    with pytest.raises(ValueError, match="outside the allowed roots"):
        mcp_server.audit_replay(str(outside))


def test_allowed_roots_env_widens_scope(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # #153/#154: operators widen the sandbox with DIFFSENSE_MCP_ALLOWED_ROOTS.
    import mcp_server

    outside = tmp_path / "outside.diff"
    outside.write_text("diff --git a/x b/x\n@@ -1 +1 @@\n-a\n+b\n", encoding="utf-8")
    monkeypatch.setenv("DIFFSENSE_MCP_ALLOWED_ROOTS", str(tmp_path))
    real = mcp_server._validate_diff_file_path(str(outside))
    assert Path(real) == outside.resolve()


def test_resolve_rules_path_rejects_outside_roots(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # #154: explicitly provided rules paths must stay inside the allowed roots;
    # arbitrary YAML rule loading from any filesystem location is a rule-injection vector.
    import mcp_server

    outside = tmp_path / "rules.yaml"
    outside.write_text("rules: []\n", encoding="utf-8")
    monkeypatch.delenv("DIFFSENSE_MCP_ALLOWED_ROOTS", raising=False)
    with pytest.raises(ValueError, match="outside the allowed roots"):
        mcp_server._resolve_rules_path(str(outside))
    monkeypatch.setenv("DIFFSENSE_MCP_ALLOWED_ROOTS", str(tmp_path))
    assert Path(mcp_server._resolve_rules_path(str(outside))) == outside.resolve()


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

    with pytest.raises(LookupError, match="not found"):
        mcp_server.explain_rule("no.such.rule")