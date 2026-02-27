import os
import json
import time
from typing import Dict, Any, Tuple, List

class RuleQualityManager:
    def __init__(self, path: str, auto_tune: bool, degrade_threshold: float, disable_threshold: float, min_samples: int):
        self.path = path
        self.auto_tune = auto_tune
        self.degrade_threshold = degrade_threshold
        self.disable_threshold = disable_threshold
        self.min_samples = min_samples
        self.data = self._load()

    def _load(self) -> Dict[str, Any]:
        if not os.path.exists(self.path):
            return {"rules": {}}
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("rules"), dict):
                return data
        except Exception:
            return {"rules": {}}
        return {"rules": {}}

    def persist(self) -> None:
        self.data["updated_at"] = int(time.time())
        try:
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def get_metrics(self) -> Dict[str, Any]:
        return self.data.get("rules", {})

    def _entry(self, rule_id: str) -> Dict[str, Any]:
        rules = self.data.setdefault("rules", {})
        entry = rules.get(rule_id)
        if not isinstance(entry, dict):
            entry = {"hits": 0, "confirmed": 0, "false_positive": 0, "precision": 1.0}
            rules[rule_id] = entry
        if "precision" not in entry:
            entry["precision"] = self._precision(entry)
        return entry

    def _precision(self, entry: Dict[str, Any]) -> float:
        hits = int(entry.get("hits", 0))
        confirmed = int(entry.get("confirmed", 0))
        return (confirmed / hits) if hits else 1.0

    def record_hit(self, rule_id: str) -> Dict[str, Any]:
        entry = self._entry(rule_id)
        entry["hits"] = int(entry.get("hits", 0)) + 1
        entry["confirmed"] = int(entry.get("confirmed", 0)) + 1
        entry["precision"] = self._precision(entry)
        return entry

    def record_false_positive(self, rule_id: str) -> Dict[str, Any]:
        entry = self._entry(rule_id)
        entry["hits"] = int(entry.get("hits", 0)) + 1
        entry["false_positive"] = int(entry.get("false_positive", 0)) + 1
        entry["precision"] = self._precision(entry)
        return entry

    def status(self, rule_id: str) -> Tuple[str, float, int]:
        entry = self._entry(rule_id)
        hits = int(entry.get("hits", 0))
        precision = float(entry.get("precision", 1.0))
        if hits < self.min_samples:
            return "insufficient", precision, hits
        if precision < self.disable_threshold:
            return "disabled", precision, hits
        if precision < self.degrade_threshold:
            return "degraded", precision, hits
        return "normal", precision, hits

    def should_skip(self, rule_id: str) -> bool:
        if not self.auto_tune:
            return False
        status, _, _ = self.status(rule_id)
        return status == "disabled"

    def adjust_severity(self, severity: str, rule_id: str) -> str:
        if not self.auto_tune:
            return severity
        status, _, _ = self.status(rule_id)
        if status != "degraded":
            return severity
        order = ["low", "medium", "high", "critical"]
        sev = (severity or "").lower()
        if sev not in order:
            return severity
        idx = order.index(sev)
        if idx <= 0:
            return "low"
        return order[idx - 1]

    def warnings(self) -> List[Dict[str, Any]]:
        rows = []
        for rule_id, entry in self.get_metrics().items():
            if not isinstance(entry, dict):
                continue
            status, precision, hits = self.status(rule_id)
            if status in ["degraded", "disabled"]:
                rows.append({
                    "rule_id": rule_id,
                    "precision": precision,
                    "hits": hits,
                    "false_positive": entry.get("false_positive", 0),
                    "confirmed": entry.get("confirmed", 0),
                    "status": status
                })
        return sorted(rows, key=lambda r: (r["status"], r["precision"]))
