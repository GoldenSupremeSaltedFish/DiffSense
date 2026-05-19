"""PyPI / 源码双布局兼容导入（flat: core, config vs diffsense.core）。"""
from __future__ import annotations

import os
from typing import Any, Callable, Type


def resolve_rules_path(rules_path: str = "config") -> str:
    """解析规则目录：优先用户路径，否则使用已安装的 config 包路径。"""
    if rules_path and rules_path != "config" and os.path.exists(rules_path):
        return rules_path
    try:
        import config

        return list(config.__path__)[0]
    except Exception:
        return rules_path or "config"


def _import_attr(module_paths: tuple[str, ...], attr: str) -> Any:
    last_err: Exception | None = None
    for mod in module_paths:
        try:
            import importlib

            m = importlib.import_module(mod)
            return getattr(m, attr)
        except (ModuleNotFoundError, AttributeError) as e:
            last_err = e
    raise last_err or ImportError(f"Cannot import {attr} from {module_paths}")


def get_analyze_diff() -> Callable[..., dict]:
    return _import_attr(("diffsense.core", "core"), "analyze_diff")


def get_build_inline_comments() -> Callable[..., list]:
    return _import_attr(("diffsense.core", "core"), "build_inline_comments")


def get_diff_parser() -> Type:
    return _import_attr(("diffsense.core.parser", "core.parser"), "DiffParser")


def get_local_file_adapter() -> Type:
    return _import_attr(
        ("diffsense.adapters.local_adapter", "adapters.local_adapter"),
        "LocalFileAdapter",
    )


def get_html_renderer() -> Type:
    return _import_attr(("diffsense.core.renderer", "core.renderer"), "HtmlRenderer")


def get_rule_engine() -> Type:
    return _import_attr(("diffsense.core.rules", "core.rules"), "RuleEngine")


def get_run_config() -> Callable[..., dict]:
    return _import_attr(("diffsense.core.run_config", "core.run_config"), "get_run_config")
