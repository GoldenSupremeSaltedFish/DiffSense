"""
DiffSense Signal Registry — single source of truth for all signals emitted by semantic analyzers.
Rules only consume these signals; they do not emit them.
Used by: docs/signals.md, CLI `diffsense signals`.
"""
from typing import Dict, List

# Grouped by category for docs and CLI output. Order and grouping match docs/signals.md.
SIGNALS_BY_GROUP: Dict[str, List[str]] = {
    "runtime.concurrency": [
        "runtime.concurrency.synchronized",
        "runtime.concurrency.lock",
        "runtime.concurrency.lock_removed",
        "runtime.concurrency.volatile",
        "runtime.concurrency.volatile_removed",
        "runtime.concurrency.final_removed",
        "runtime.concurrency.concurrent_map",
        "runtime.concurrency.thread_safety_downgrade",
        "runtime.concurrency.static_unsafe_collection",
        "runtime.concurrency.atomic_to_non_atomic_write",
        "runtime.concurrency.threadpool_param_change",
        "runtime.concurrency.threadpool_creation",
        "runtime.concurrency.threadpool_unbounded_queue",
        "runtime.concurrency.executors_factory_risk",
        "runtime.concurrency.future_get_without_timeout",
        "runtime.concurrency.busy_wait_added",
    ],
    "runtime.performance": [
        "runtime.performance.sleep_added",
    ],
    "runtime.resource": [
        "runtime.resource.try_with_resource_removed",
        "runtime.resource.cache_eviction_removed",
    ],
    "runtime.network": [
        "runtime.network.timeout_removed",
    ],
    "runtime.data": [
        "runtime.data.null_check_removed",
        "runtime.data.equals_to_reference_compare",
    ],
    "runtime": [
        "runtime.input_normalization_removed",
        "runtime.collection_mutation_inside_loop",
    ],
    "data": [
        "data.pagination_semantic_change",
    ],
}


def get_all_signals() -> List[str]:
    """Flat list of all signal IDs, sorted."""
    out = []
    for group in SIGNALS_BY_GROUP.values():
        out.extend(group)
    return sorted(out)


def get_signals_by_group() -> Dict[str, List[str]]:
    """Signals grouped by category (for CLI and docs)."""
    return SIGNALS_BY_GROUP.copy()
