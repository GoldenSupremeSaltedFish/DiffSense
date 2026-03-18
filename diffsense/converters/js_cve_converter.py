#!/usr/bin/env python3
"""
JavaScript CVE Converter
Converts raw CVE/GHSA data into DiffSense PROrule format for JavaScript (npm) vulnerabilities.
Output schema matches single-rule YAML (id, language, severity, description, package, patterns)
so the rule engine can load pro-rules/cve/JavaScript/*.yaml with language=javascript.
"""
import re
import yaml
from typing import Dict, List, Any
from pathlib import Path


def _slug_ghsa(ghsa_id: str) -> str:
    return (ghsa_id or "").strip().replace("-", "_").lower()


def _npm_patterns(package_name: str) -> list:
    name = (package_name or "").strip()
    if not name:
        return ["*"]
    return [
        f'require("{name}")',
        f"require('{name}')",
        f'from "{name}"',
        f"from '{name}'",
        f'"{name}":',
    ]


class JSCVEConverter:
    """
    Converts JavaScript/npm CVE data into PROrule single-rule YAML format
    (engine-loadable; same schema as pro-rules/cve/java single files).
    """

    def convert_cve_to_prorule(self, cve_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert CVE-style dict to single-rule PROrule format.
        Accepts either: cve_id, description, affected_library (legacy)
        or GHSA-style: id, summary/details, affected[].package.ecosystem=npm.
        """
        # GHSA-style
        ghsa_id = cve_data.get("id") or cve_data.get("cve_id") or "CVE-UNKNOWN"
        if isinstance(ghsa_id, str) and ghsa_id.startswith("GHSA-"):
            return self._ghsa_to_prorule(cve_data)
        # Legacy: cve_id, description, affected_library
        cve_id = cve_data.get("cve_id", "CVE-UNKNOWN")
        description = (cve_data.get("description") or "")[:500]
        pkg = (cve_data.get("affected_library") or "unknown").strip()
        severity = (cve_data.get("severity") or "high").lower()
        if severity not in ("critical", "high", "medium", "low"):
            severity = "high"
        rule_id = f"prorule.javascript.{severity}.{_slug_ghsa(cve_id)}"
        return {
            "id": rule_id,
            "description": description,
            "severity": severity,
            "language": "javascript",
            "category": "security",
            "tags": ["cve", "vulnerability", "javascript", "npm", cve_id],
            "aliases": [cve_id],
            "package": {"ecosystem": "npm", "name": pkg},
            "patterns": _npm_patterns(pkg),
        }

    def _ghsa_to_prorule(self, ghsa: Dict[str, Any]) -> Dict[str, Any]:
        ghsa_id = ghsa.get("id") or ""
        affected = ghsa.get("affected") or []
        npm_name = ""
        for a in affected:
            pkg = a.get("package") or {}
            if (pkg.get("ecosystem") or "").lower() == "npm":
                npm_name = (pkg.get("name") or "").strip()
                break
        if not npm_name:
            npm_name = "unknown"
        summary = (ghsa.get("summary") or ghsa.get("details") or "")[:500]
        db = ghsa.get("database_specific") or {}
        severity = (db.get("severity") or "high").strip().lower()
        if severity not in ("critical", "high", "medium", "low"):
            severity = "high"
        rule_id = f"prorule.javascript.{severity}.{_slug_ghsa(ghsa_id)}"
        refs = [r.get("url") for r in (ghsa.get("references") or []) if r.get("url")]
        return {
            "id": rule_id,
            "description": summary,
            "severity": severity,
            "language": "javascript",
            "category": "security",
            "tags": ["cve", "vulnerability", "javascript", "npm", ghsa_id.lower()],
            "references": refs[:10],
            "aliases": ghsa.get("aliases") or [],
            "package": {"ecosystem": "npm", "name": npm_name},
            "patterns": _npm_patterns(npm_name),
            "cwe": (db.get("cwe_ids") or [])[:5],
        }

    def batch_convert(self, cve_list: List[Dict[str, Any]], output_dir: str) -> None:
        """Convert multiple CVE/GHSA entries to PROrule YAML files (one file per entry)."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        for cve_data in cve_list:
            prorule = self.convert_cve_to_prorule(cve_data)
            rid = (prorule.get("id") or "prorule.javascript.unknown.unknown").replace(".", "_")
            filename = f"{rid}.yaml" if not rid.endswith(".yaml") else rid
            filename = re.sub(r"[^\w\-_.]", "_", filename)
            filepath = output_path / filename
            with open(filepath, "w", encoding="utf-8") as f:
                yaml.dump(prorule, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    def create_sample_rules(self, output_dir: str) -> None:
        """Create sample JS CVE rules for testing (engine-loadable single-rule YAML)."""
        sample_cves = [
            {
                "cve_id": "CVE-2021-23336",
                "description": "Lodash prototype pollution vulnerability in merge function",
                "affected_library": "lodash",
                "severity": "high",
            },
            {
                "cve_id": "CVE-2020-7598",
                "description": "XSS vulnerability in marked library",
                "affected_library": "marked",
                "severity": "medium",
            },
            {
                "cve_id": "CVE-2021-21315",
                "description": "Command injection in systeminformation package",
                "affected_library": "systeminformation",
                "severity": "critical",
            },
        ]
        self.batch_convert(sample_cves, output_dir)
        print(f"Created {len(sample_cves)} sample JS CVE rules in {output_dir}")

if __name__ == '__main__':
    converter = JSCVEConverter()
    # Default output under pro-rules/cve/JavaScript (relative to repo root)
    js_cve_dir = Path(__file__).resolve().parent.parent.parent / "pro-rules" / "cve" / "JavaScript"
    converter.create_sample_rules(str(js_cve_dir))
    print("JS CVE converter completed successfully!")