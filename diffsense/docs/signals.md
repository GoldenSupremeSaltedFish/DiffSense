# DiffSense Signal Registry

**Signals are emitted by semantic analyzers. Rules only consume signals.**

Contributors: use this list as the single source of truth when writing rules. In YAML, set `signal: "<id>"` to one of the IDs below. Run `diffsense signals` to print the same list from the CLI.

---

## runtime.concurrency

- runtime.concurrency.synchronized
- runtime.concurrency.lock
- runtime.concurrency.lock_removed
- runtime.concurrency.volatile
- runtime.concurrency.volatile_removed
- runtime.concurrency.final_removed
- runtime.concurrency.concurrent_map
- runtime.concurrency.thread_safety_downgrade
- runtime.concurrency.static_unsafe_collection
- runtime.concurrency.atomic_to_non_atomic_write
- runtime.concurrency.threadpool_param_change
- runtime.concurrency.threadpool_creation
- runtime.concurrency.threadpool_unbounded_queue
- runtime.concurrency.executors_factory_risk
- runtime.concurrency.future_get_without_timeout
- runtime.concurrency.busy_wait_added

## runtime.performance

- runtime.performance.sleep_added

## runtime.resource

- runtime.resource.try_with_resource_removed
- runtime.resource.cache_eviction_removed

## runtime.network

- runtime.network.timeout_removed

## runtime.data

- runtime.data.null_check_removed
- runtime.data.equals_to_reference_compare

## runtime (other)

- runtime.input_normalization_removed
- runtime.collection_mutation_inside_loop

## data

- data.pagination_semantic_change

---

See [rule-quickstart.md](rule-quickstart.md) to write a rule in 10 minutes; [contribute-rules.md](contribute-rules.md) for contribution paths.
