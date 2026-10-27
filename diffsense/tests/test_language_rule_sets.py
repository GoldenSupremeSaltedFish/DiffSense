"""Language-specific rule-set coverage tests (#88/#92).

#88: Java (a first-class supported language) shipped with zero java.*
rules; #92: TypeScript lacked code_injection and Go lacked weak_crypto
while sibling languages had them.
"""
from functools import lru_cache
from pathlib import Path

from diffsense.core.rules import RuleEngine

RULES_DIR = Path(__file__).resolve().parent.parent / "config" / "rules"


@lru_cache(maxsize=1)
def _all_ids() -> frozenset:
    engine = RuleEngine(str(RULES_DIR))
    return frozenset(
        getattr(r, "id", getattr(r, "rule_id", "")) for r in engine.rules
    )


def test_java_security_rules_exist() -> None:
    # #88: JNDI injection, native deserialization, SpEL, SQL, command
    # injection, SSRF and hardcoded secrets must exist as java.* rules.
    java = {i for i in _all_ids() if i.startswith("java.security.")}
    expected = {
        "java.security.jndi_injection",
        "java.security.deserialization",
        "java.security.spel_injection",
        "java.security.sql_injection",
        "java.security.runtime_injection",
        "java.security.ssrf",
        "java.security.hardcoded_secret",
    }
    assert expected <= java, f"missing: {expected - java}"


def test_typescript_code_injection_and_go_weak_crypto_exist() -> None:
    # #92: close the cross-language security coverage asymmetry.
    ids = _all_ids()
    assert "typescript.security.code_injection" in ids
    assert "go.security.weak_crypto" in ids


def test_every_supported_language_has_rules() -> None:
    # #88: all six supported languages must ship language-specific rules.
    ids = _all_ids()
    for prefix in ("python.", "javascript.", "typescript.", "go.", "cpp.", "java."):
        assert any(i.startswith(prefix) for i in ids), prefix
