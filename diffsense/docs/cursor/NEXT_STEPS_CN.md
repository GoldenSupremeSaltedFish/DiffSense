# DiffSense 接下来做（执行清单）

> 基于 [ROADMAP_12_MONTHS_CN.md](./ROADMAP_12_MONTHS_CN.md) 与里程碑进度核对，本清单为**可执行任务**，按优先级排序。  
> 原则：每项须满足三选一 —— 提升 precision / 提升速度 / 提升采用率。  
> **阶段性汇报文档统一位于 docs/cursor/。**  
> **里程碑与实现逻辑的对照**见 ROADMAP 中的 **[里程碑与实现同步表](./ROADMAP_12_MONTHS_CN.md#里程碑与实现同步表)**；代码/文档变更后请同步更新该表。

---

## 当前阶段与里程碑剩余量

| 里程碑 | 状态 | 剩余内容摘要 |
|--------|------|----------------|
| **Q1 可信度** | ✅ 已完成 | 仅「团队敢默认开启 CI gate」为业务验收项，无开发剩余。 |
| **Q2 性能极限** | ✅ 已完成 | 冷/热启动与执行比例已文档化（[performance.md](../performance.md)）；工程化检验与 test.yml 已就绪。 |
| **Q3 规则生态** | 🟡 初始化完成 | 示例包 `examples/diffsense-rules-example`、[rule-quickstart.md](../rule-quickstart.md) 已就绪；后续：测试 harness、精选规则集、可选第二包（见 Q3 子任务）。 |
| **Q4 产品化** | 未开始 | Docker/模板/文档/case study。 |

---

## P0：Q1 收尾（必做）✅ 已全部完成

（任务 1～3 已勾选完成，详见验收标准；略。）

---

## P0：Q2 推进（必做）

（任务 4～5、Q2-S1～S3 已勾选完成；略。）

---

## Q3 初始化（已就绪，可继续扩展）

（任务 6～7 已勾选完成；Q3 子任务表见下。）

---

## Q3 子任务拆分（后续可执行）

| 子任务 | 说明 | 状态 |
|--------|------|------|
| Q3-S1 示例包可安装 | `pip install -e examples/diffsense-rules-example` 后 rules list 含 example 规则 | ✅ 已验证 |
| Q3-S2 测试 harness | 为插件规则提供单测示例（pytest + fixture diff） | 未做 |
| Q3-S3 官方精选规则集 | 明确 concurrency/reliability/regression 保留策略 | 未做 |
| Q3-S4 第二个外部包（可选） | 如 diffsense-rules-java | 未做 |

---

## 禁止项（本阶段勿做）

- 新规则 > 5 条（Q1/Q2 约束）
- 新分析器、新架构重构
- 规则数量翻倍、复杂 AST 深度分析（Q2 约束）
- 大而全规则市场、KPI/dashboard/评分体系（Q3 约束）

---

## 回归测试与本次修改的对应关系

- **test_cache_and_scheduling.py**：test_rule_stats_contains_total_and_executed、test_renderer_with_rule_stats、test_quality_report_from_metrics_skips_non_rules。
- **test_repo_ignore.py**：test_diffsense_ignore_yaml_loaded_when_present。
- **run_audit.py** / **core/rules.py**：_metrics 拷贝、quality_report_from_metrics 跳过 cache/rule_stats。

运行：`pytest tests/test_regression.py tests/test_cache_and_scheduling.py tests/test_repo_ignore.py -v`

---

## 工程化检验清单（时刻检验）

以下在**每次合入/发版前**或**里程碑收尾时**执行。  
→ 最近一次检查结果见 **[ENGINEERING_CHECK.md](./ENGINEERING_CHECK.md)**。

### 自动化（CI 可执行）

- 回归测试：`pytest tests/test_regression.py tests/test_cache_and_scheduling.py tests/test_repo_ignore.py -v`
- `.github/workflows/test.yml` 已在 push/PR 时运行上述用例。若仓库根为父目录，请设置 `defaults.run.working-directory: diffsense`。

### 文档与行为一致

| 项 | 说明 |
|----|------|
| 忽略配置 | [ignoring.md](../ignoring.md) 与 diffsense-ignore.yaml 行为一致 |
| CI 缓存 | [ci-cache.md](../ci-cache.md) 与 audit.yml / GitLab 示例一致 |
| 规则插件 | [rule-plugins.md](../rule-plugins.md) 与 entry_points 一致 |

### 里程碑完成时必做

- 更新 [ROADMAP_12_MONTHS_CN.md](./ROADMAP_12_MONTHS_CN.md) 中该里程碑状态与 DoD 勾选。
- 将下一里程碑在 NEXT_STEPS 中拆成**可勾选子任务**（含验收标准）。
- 跑一遍工程化检验清单，并记录结果。

---

## 变更时请同步

- 本清单与 [ROADMAP_12_MONTHS_CN.md](./ROADMAP_12_MONTHS_CN.md) 的「必做（P0）」和「完成标志」一致；若路线图有修订，请同步更新本清单。
- 架构边界见 [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md)，所有改动不得违反「Human-in-the-loop」与「只做变更语义风险」等红线。
