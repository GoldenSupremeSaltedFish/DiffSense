# AST Signal Contract

This document defines the **stable engineering signals** that DiffSense must guarantee.
Any deviation from this contract is considered a regression.

## 1. Concurrency Signals

| Signal ID | Trigger Condition (AST) | Engineering Semantics |
| :--- | :--- | :--- |
| `runtime.concurrency.synchronized` | `SynchronizedStatement` node detected | Usage of intrinsic locks (synchronized block/method) |
| `runtime.concurrency.lock` | `MethodInvocation` matching `*.lock()` | Usage of explicit locking mechanisms (ReentrantLock, etc.) |
| `runtime.concurrency.volatile` | `FieldDeclaration` with `volatile` modifier | Usage of volatile memory visibility semantics |

## 2. Noise Signals (Negative Contract)

The following changes MUST NOT trigger any risk signals:

*   Import reordering / optimization.
*   Formatting / Whitespace changes.
*   Comment changes.
*   Renaming local variables (unless it changes semantic logic).
