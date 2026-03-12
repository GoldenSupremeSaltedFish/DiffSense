# -*- coding: utf-8 -*-
"""
从 Go 官方漏洞库 (vuln.go.dev) 拉取 OSV 格式数据并转换为 DiffSense PROrule YAML。
用于完善 pro-rules/cve/Go 下的 CVE 规则。
"""
from __future__ import annotations

import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

VULN_INDEX_URL = "https://vuln.go.dev/index/vulns.json"
VULN_ID_URL = "https://vuln.go.dev/ID/{vuln_id}.json"


def _infer_triggers_on(summary: str, details: str) -> List[str]:
    """根据 summary/details 推断 triggers_on 类别（与现有 Go 规则一致）."""
    text = (summary or "") + " " + (details or "")
    text_lower = text.lower()
    if "denial of service" in text_lower or "dos" in text_lower or "hang" in text_lower:
        return ["DENIAL_OF_SERVICE"]
    if "insecure" in text_lower and ("deserialization" in text_lower or "unmarshal" in text_lower):
        return ["INSECURE_DESERIALIZATION"]
    if "path traversal" in text_lower or "arbitrary file" in text_lower:
        return ["PATH_TRAVERSAL"]
    if "panic" in text_lower or "infinite loop" in text_lower:
        return ["DENIAL_OF_SERVICE"]
    return ["UNKNOWN_VULNERABILITY"]


def _symbols_to_patterns(affected: List[Dict[str, Any]]) -> List[str]:
    """从 OSV affected[].ecosystem_specific.imports 提取 path + symbol -> 'path.Symbol'."""
    patterns: List[str] = []
    seen: set = set()
    for item in affected or []:
        imp = (item.get("ecosystem_specific") or {}).get("imports")
        if not imp:
            continue
        for imp_item in imp:
            path = (imp_item.get("path") or "").strip()
            for sym in imp_item.get("symbols") or []:
                if not sym:
                    continue
                if not path:
                    continue
                p = f"{path}.{sym}"
                if p not in seen:
                    seen.add(p)
                    patterns.append(p)
    return patterns


def osv_to_prorule(osv: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    将单条 OSV (vuln.go.dev) 条目转为 PROrule 结构（与现有 pro-rules/cve/Go/*.yaml 一致）.
    返回 None 表示跳过（无有效 patterns 等）.
    """
    vuln_id = osv.get("id") or ""
    if not vuln_id or not vuln_id.startswith("GO-"):
        return None
    summary = (osv.get("summary") or "").strip()
    details = (osv.get("details") or "").strip()
    description = summary or details or f"CVE检测规则 - {vuln_id}"
    if len(description) > 200:
        description = description[:197] + "..."
    affected = osv.get("affected") or []
    patterns = _symbols_to_patterns(affected)
    if not patterns:
        return None
    triggers = _infer_triggers_on(summary, details)
    aliases = list(osv.get("aliases") or [])
    rule_name = f"prorule.{vuln_id.lower().replace('-', '_')}_go"
    return {
        "name": rule_name,
        "description": f"CVE检测规则 - {vuln_id}",
        "language": "go",
        "triggers_on": triggers,
        "language_specific_patterns": patterns,
        "severity": "high",
        "aliases": aliases,
    }


def fetch_vulns_index() -> List[Dict[str, Any]]:
    """拉取 vuln.go.dev index/vulns.json，返回条目列表（每项含 id、modified 等）."""
    r = requests.get(VULN_INDEX_URL, timeout=30)
    r.raise_for_status()
    data = r.json()
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        # 可能是 { "GO-2020-xxx": { "modified": "..." }, ... }
        return [{"id": k, **v} if isinstance(v, dict) else {"id": k} for k, v in data.items()]
    return []


def fetch_vuln_detail(vuln_id: str) -> Optional[Dict[str, Any]]:
    """拉取单条漏洞详情 (OSV)."""
    url = VULN_ID_URL.format(vuln_id=vuln_id)
    r = requests.get(url, timeout=15)
    if r.status_code != 200:
        return None
    return r.json()


def filter_last_n_days(entries: List[Dict[str, Any]], days: int = 365) -> List[str]:
    """从 index 条目中筛出最近 days 天内的 GO-* id 列表."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    ids = []
    for e in entries:
        vid = e.get("id") if isinstance(e, dict) else e
        if isinstance(vid, dict):
            vid = vid.get("id")
        if not vid or not str(vid).startswith("GO-"):
            continue
        mod = e.get("modified") if isinstance(e, dict) else None
        if mod:
            try:
                # 允许带 Z 的 ISO 时间
                if isinstance(mod, str):
                    mod = mod.replace("Z", "+00:00")
                    dt = datetime.fromisoformat(mod.replace("+00:00", ""))
                else:
                    dt = cutoff
                if dt.replace(tzinfo=None) < cutoff.replace(tzinfo=None):
                    continue
            except Exception:
                pass
        ids.append(str(vid))
    return ids


def run_fetch_and_convert(
    output_dir: str,
    days: int = 365,
    index_url: Optional[str] = None,
    dry_run: bool = False,
    limit: Optional[int] = None,
) -> int:
    """
    拉取 vuln 索引、筛选最近 days 天的 GO-*，逐条拉详情并转换为 PROrule，写入 output_dir（即 pro-rules/cve/Go）.
    返回成功写入的规则数量。
    """
    index_url = index_url or VULN_INDEX_URL
    r = requests.get(index_url, timeout=30)
    r.raise_for_status()
    data = r.json()
    entries: List[Dict[str, Any]] = []
    if isinstance(data, list):
        entries = data
    elif isinstance(data, dict):
        for k, v in data.items():
            if isinstance(v, dict):
                entries.append({"id": k, **v})
            else:
                entries.append({"id": k})

    go_ids = [e.get("id") for e in entries if str(e.get("id", "")).startswith("GO-")]
    if not go_ids:
        go_ids = []
    cap = limit or 600
    # 取最后 cap 条（索引多为按 id 升序，较新漏洞在后）
    if len(go_ids) > cap:
        go_ids = go_ids[-cap:]
    else:
        go_ids = go_ids[:cap]
    cutoff = datetime.utcnow() - timedelta(days=days)
    os.makedirs(output_dir, exist_ok=True)
    total = len(go_ids)
    max_workers = min(10, total)
    rules_to_write: List[Tuple[str, Dict[str, Any]]] = []

    def _fetch_one(vuln_id: str) -> Optional[Dict[str, Any]]:
        detail = fetch_vuln_detail(vuln_id)
        if not detail:
            return None
        if days > 0:
            published = detail.get("published") or ""
            if published:
                try:
                    pub = published.replace("Z", "+00:00")[:19]
                    dt = datetime.fromisoformat(pub.replace("+00:00", ""))
                    if dt.replace(tzinfo=None) < cutoff.replace(tzinfo=None):
                        return None
                except Exception:
                    pass
        rule = osv_to_prorule(detail)
        return rule

    done = 0
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        fut = {ex.submit(_fetch_one, vid): vid for vid in go_ids}
        for f in as_completed(fut):
            done += 1
            if total > 20 and done % 100 == 0:
                print(f"  拉取进度: {done}/{total}")
            try:
                rule = f.result()
                if rule:
                    rules_to_write.append((output_dir, rule))
            except Exception:
                pass

    if dry_run:
        return len(rules_to_write)
    count = 0
    for out_dir, rule in rules_to_write:
        name = rule["name"]
        filename = name.replace("prorule.", "") + ".yaml"
        path = os.path.join(out_dir, filename)
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"{name}:\n")
            f.write(f"  description: \"{rule['description']}\"\n")
            f.write(f"  language: {rule['language']}\n")
            triggers = rule["triggers_on"]
            f.write(f"  triggers_on: [{', '.join(triggers)}]\n")
            f.write("  language_specific_patterns:\n")
            for p in rule["language_specific_patterns"]:
                f.write(f'    - "{p}"\n')
            f.write(f"  severity: {rule['severity']}\n")
            aliases = rule["aliases"]
            if aliases:
                f.write(f"  aliases: {aliases}\n")
            else:
                f.write("  aliases: []\n")
        count += 1
    return count


def run_convert_from_local_dir(
    local_dir: str,
    output_dir: str,
    days: int = 365,
    dry_run: bool = False,
) -> int:
    """
    从本地目录（如 clone 或解压的 vuln 数据）读取 GO-*.json，筛选最近 days 天内发布的漏洞并转换为 PROrule.
    local_dir 下可为扁平 GO-*.json 或 ID/ 子目录下的 GO-*.json.
    """
    from datetime import datetime, timedelta

    path = Path(local_dir)
    if not path.is_dir():
        return 0
    id_dir = path / "ID"
    if id_dir.is_dir():
        json_files = list(id_dir.glob("GO-*.json"))
    else:
        json_files = list(path.glob("GO-*.json"))
    cutoff = datetime.utcnow() - timedelta(days=days)
    count = 0
    os.makedirs(output_dir, exist_ok=True)
    for jf in sorted(json_files):
        try:
            with open(jf, "r", encoding="utf-8") as f:
                detail = json.load(f)
        except Exception:
            continue
        published = detail.get("published") or ""
        if published:
            try:
                pub = published.replace("Z", "+00:00")[:19]
                dt = datetime.fromisoformat(pub.replace("+00:00", ""))
                if dt.replace(tzinfo=None) < cutoff.replace(tzinfo=None):
                    continue
            except Exception:
                pass
        rule = osv_to_prorule(detail)
        if not rule:
            continue
        name = rule["name"]
        filename = name.replace("prorule.", "") + ".yaml"
        out_path = os.path.join(output_dir, filename)
        if dry_run:
            count += 1
            continue
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(f"{name}:\n")
            f.write(f"  description: \"{rule['description']}\"\n")
            f.write(f"  language: {rule['language']}\n")
            triggers = rule["triggers_on"]
            f.write(f"  triggers_on: [{', '.join(triggers)}]\n")
            f.write("  language_specific_patterns:\n")
            for p in rule["language_specific_patterns"]:
                f.write(f'    - "{p}"\n')
            f.write(f"  severity: {rule['severity']}\n")
            aliases = rule["aliases"]
            if aliases:
                f.write(f"  aliases: {aliases}\n")
            else:
                f.write("  aliases: []\n")
        count += 1
    return count
