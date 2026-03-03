# Q2 性能极限 — 工程化程度评估

> 针对「scheduler、cache+CI、profiling、冷/热启动与执行比例 DoD」的实现，从可测性、可观测性、配置化、CI、文档与可维护性等方面评估是否**足够工程化**，并列出缺口与改进建议。  
> **对照依据**：[ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md)（产品宗旨、红线、必须坚持、运行模型、自动化边界）。

---

## 0. 与架构原则的对齐情况

| 架构原则 | Q2 实现与评估的对应 | 是否符合 |
|----------|----------------------|----------|
| **极致快（目标 &lt;5s）** | 冷/热 DoD 为冷 &lt;10s、热 &lt;3s；原则中 PR 忍受上限 10~30s，&lt;5s 为理想。当前 DoD 在可接受范围内，热 3s 优于 5s。 | ✅ 方向一致；若需严格「&lt;5s」可把热启动目标收紧到 5s 或增加自动化断言。 |
| **只做 diff / 增量，禁止全仓扫描** | Parser/AST 均为「按 diff 变更」缓存与计算；scheduler 按 changed_files 过滤规则；无全量 repo 默认行为。 | ✅ 未触达红线。 |
| **运行模型：Diff → Parser → Scheduler → Incremental AST → RuleEngine** | cache 在 Parser + AST；scheduler 为 language/scope + lifecycle；规则按变更文件调度。 | ✅ 与文档运行模型一致。 |
| **理想形态：Cache hit、Rules executed、少准快可解释** | 可观测：hits/misses/saved、Rules executed x/y (z%)；执行比例 &lt;30% 引导「少而准」。 | ✅ 已具备。 |
| **机器负责：速度、透明度、数据统计、等效优化** | 机器做 cache、调度、metrics、性能报表；人类不做速度优化实现。 | ✅ 边界清晰。 |
| **人类负责：启用/禁用规则、CI 决策** | 无自动合并/拒绝 PR；执行比例与提示为「提示」非自动阻断；quality 的 auto_tune 为降级展示非自动改 CI 状态。 | ✅ 未触达「自动替人做决策」红线。 |
| **规则不堆量、少而准** | 执行比例 &gt;30% 时提示用 profile/scheduler/lightweight，引导控制规则数量与执行面。 | ✅ 与「50 条高价值 &gt; 500 条垃圾」一致。 |

**结论**：Q2 的设计与实现**符合** ARCHITECTURE_PRINCIPLES 中的红线、必须坚持项、运行模型与自动化边界；速度目标与原则中「极致快 &lt;5s」方向一致，DoD 数值在可接受范围内。

---

## 1. 已具备的工程化要素 ✅

| 维度 | 现状 | 位置 |
|------|------|------|
| **Cache 版本隔离** | 通过 `CACHE_VERSION` 区分目录，parser/AST 逻辑变更时改版本即可失效旧缓存 | `core/__init__.py`、parser/ast_detector 的 cache_dir |
| **原子写入** | 先写 `.tmp` 再 `os.replace`，避免写坏半成品 | parser._save_cache、ast_detector._save_cached_tree |
| **环境可配置** | `DIFFSENSE_CACHE_DIR` 覆盖默认缓存根目录，便于 CI 与多环境 | parser/ast_detector._resolve_cache_dir |
| **缓存可观测** | 每 run 有 hits/misses/saved_ms，并在 Performance Report 与 HTML 中展示 | parser.metrics、ast_detector.metrics、main.py stderr、renderer |
| **Scheduler 可测** | language/scope 过滤与「mostly new 跳过 regression」有单测 | test_incremental_scheduling、test_adaptive_scheduling |
| **Cache 行为可测** | 版本隔离、原子写、命中/未命中统计有单测 | test_cache_versioning_isolation、test_atomic_write_logic、test_cache_metrics_tracking |
| **CI 集成** | GitHub Actions 使用 `actions/cache` 缓存 `~/.diffsense`；GitLab 示例提供 cache + DIFFSENSE_CACHE_DIR | audit.yml、gitlab-ci-example*.yml |
| **执行比例可观测** | Rules executed x/y (z%) 与 z>30% 时的提示 | main.py、renderer、performance.md |
| **文档** | 冷/热测量方法、中型 PR 口径、执行比例 &lt;30% 的用法 | performance.md、ci-cache.md |

---

## 2. 缺口与改进建议（已完善 ✅）

| 维度 | 原缺口 | 已实现 |
|------|--------|--------|
| **冷/热启动自动化断言** | 冷 &lt;10s、热 &lt;3s 仅文档 + 人工测 | **`diffsense benchmark-cold-hot &lt;diff&gt; --output ... --fail-if-over`**：自动跑冷/热两次并写 JSON；**test.yml** 增加 job `benchmark-cold-hot`（continue-on-error）；[performance.md](../performance.md) 增加「自动化断言」小节。 |
| **Cache 容量与淘汰** | 无 TTL、无 eviction | **TTL**：环境变量 **`DIFFSENSE_CACHE_MAX_AGE_DAYS`**，parser/ast_detector 读缓存时超期则失效并删除；**`diffsense cache prune --max-age-days 7`**；[ci-cache.md](../ci-cache.md) 补充 TTL 与 prune。 |
| **性能指标结构化输出** | 仅人类可读 | Report JSON 增加 **`_performance`**：wall_clock_s、cache、cache_hit_rate_pct、rules_executed_pct 等，供 CI 解析。 |
| **Profiling 持久化** | Top slow 仅当次 run | 仍为增强项，可按需将 top_slow 写入 rule_metrics 或单独 profile 文件。 |
| **CI cache key 与版本** | key 未含 CACHE_VERSION | **audit.yml** key 增加 **`hashFiles('**/core/__init__.py')`**；[ci-cache.md](../ci-cache.md) 示例已更新。 |

---

## 3. 结论与建议

- **当前**：上述四项缺口已补齐：冷/热有 **benchmark-cold-hot** 与可选 CI job；cache 有 **TTL（DIFFSENSE_CACHE_MAX_AGE_DAYS）** 与 **cache prune**；report JSON 含 **`_performance`**；CI cache key 含 **core/__init__.py**。工程化程度满足「可测、可观测、可配置、CI 可解析、cache 可淘汰」。
- **可选后续**：profiling 持久化（top_slow 写入 rule_metrics 或单独 profile 文件）仍为增强项，可按需迭代。

---

**建议**：在 [ROADMAP 里程碑与实现同步表](./ROADMAP_12_MONTHS_CN.md#里程碑与实现同步表) 的 Q2 部分增加一列或附注「工程化程度：见 [Q2_ENGINEERING_ASSESSMENT.md](./Q2_ENGINEERING_ASSESSMENT.md)」，便于后续维护与评审时对齐标准。

**与架构原则的同步**：本评估的「工程化」标准与 [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md) 对齐；若原则文档有更新（红线、必须坚持、运行模型、自动化边界），应同步复核本文「0. 与架构原则的对齐情况」并更新。
