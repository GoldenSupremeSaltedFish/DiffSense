# DiffSense 12个月成熟路线图（务实版）

## 接下来做（执行清单）

→ 具体任务、验收标准与建议顺序见 **[NEXT_STEPS_CN.md](./NEXT_STEPS_CN.md)**（Q1 收尾 + Q2 推进 + Q3 预备）。

---

## 当前判断

- 规则治理 + 增量调度 + cache + profile + 插件 已达 v0.8 架构级完成度
- 接下来进入：产品化 + 可信度 + 生态阶段
- 后续不做底层重构

## 约束与原则

- 每阶段只做能带来质变的事
- 功能增量必须满足三选一：提升 precision / 提升速度 / 提升采用率
- 不满足三选一的需求直接不做

## 里程碑总览与当前状态

| 季度 | 目标关键词 | 版本里程碑 | 状态 |
| --- | --- | --- | --- |
| Q1 | 可信度 | v1.0 | **已完成**（DoD 见下；「团队敢默认开启 CI gate」待业务验收） |
| Q2 | 性能极限 | v1.5 | **已完成**（冷/热启动与执行比例见 [performance.md](../performance.md)） |
| Q3 | 规则生态 | v2.0 | **初始化完成**（示例包 + rule-quickstart；后续见 NEXT_STEPS Q3 子任务） |
| Q4 | 产品化落地 | v2.5 | 未开始 |

---

## 里程碑与实现同步表

下表将路线图必做（P0）/ 完成标志（DoD）与**已实现的代码与文档**一一对应，便于核对与后续维护。实现逻辑变更时请同步更新本表。

### Q1 可信度 — 实现同步

| 项 | 状态 | 实现位置 | 实现逻辑摘要 |
| --- | --- | --- | --- |
| Rule 质量度量系统 | ✅ | `core/quality_manager.py`、`core/rules.py`、`cli.py` | 持久化 `rule_metrics.json`（hits/confirmed/false_positive/precision）；precision&lt;0.5 降级、&lt;0.3 在 auto_tune 下跳过（rules.py evaluate）；`diffsense rules health` 读 rule_metrics 输出；HTML/JSON 含 _rule_quality。 |
| 忽略机制完善 | ✅ | `core/ignore_manager.py`、`core/ast_detector.py`、`docs/ignoring.md` | 配置优先顺序：diffsense-ignore.yaml → .diffsense.yaml → .diffsenseignore；rule+files 维度；inline 解析 `// diffsense-ignore: rule_id`（ast_detector）；rules 执行前 is_ignored(rule_id, file)。 |
| PR 输出可读性 | ✅ | `main.py`、`run_audit.py`、`core/renderer.py`、`core/rules.py` | get_rule_stats() 返回 total_rules/executed_count；stderr 输出 Diff/AST Cache Hit、Rules executed x/y (z%)、Top slow、low quality 警告；HTML/Markdown summary 含 Rules executed；Markdown 按文件分组。 |
| DoD: precision 报表可见 | ✅ | 同上 + rule_metrics.json、rules health | |
| DoD: 自动降级生效 | ✅ | quality_manager.status()、rules.py evaluate 中 quality_status==disabled 跳过、degraded 降级 | |
| DoD: 误报可一键忽略 | ✅ | inline + ignore_manager 仓库忽略 | |
| DoD: 团队敢默认开启 CI gate | 待业务验收 | — | 无代码项，需实际团队使用反馈。 |

### Q2 性能极限 — 实现同步

**工程化程度**：已具备版本隔离、原子写入、可配置目录、可观测 metrics、单测与 CI 集成；冷/热 DoD 目前为文档+人工复测，无自动化断言；cache 无 TTL/容量淘汰。详见 **[Q2_ENGINEERING_ASSESSMENT.md](./Q2_ENGINEERING_ASSESSMENT.md)**。

| 项 | 状态 | 实现位置 | 实现逻辑摘要 |
| --- | --- | --- | --- |
| rule-level scheduler 强化 | ✅ | `core/rules.py` | evaluate 前按 language/scope 过滤（rule_lang、rule_scope 与 changed_files 匹配）；仅匹配到的规则执行；get_rule_stats() 含 total_rules/executed_count 供可视化。 |
| cache 持久化 + CI 共享 | ✅ | `core/parser.py`、`core/ast_detector.py`、`.github/workflows/audit.yml`、`gitlab-ci-example*.yml`、`docs/ci-cache.md` | 默认 ~/.diffsense/cache（可 DIFFSENSE_CACHE_DIR）；CACHE_VERSION 区分目录；原子写 tmp+replace；audit.yml 使用 actions/cache path ~/.diffsense；GitLab 示例 cache .diffsense-cache + DIFFSENSE_CACHE_DIR。 |
| profiling 报表 | ✅ | `main.py`、`core/rules.py` | get_rule_stats() 含 top_slow/top_noisy/top_triggered；stderr 输出 Top 3 Slow Rules；HTML Rule Metrics 表。 |
| DoD: 冷/热启动 &lt;10s / &lt;3s | ✅ 文档+人工 | `docs/performance.md` | 文档定义中型 PR、冷/热测量方法及当前典型值；无自动化断言，靠文档与人工复测。 |
| DoD: rule 执行数量 &lt;30% | ✅ | `main.py` stderr 比例与提示、`docs/performance.md` | 输出 Rules executed x/y (z%)；z&gt;30 时提示 profile/scheduler；performance.md 写 lightweight、--rules、忽略等达成方式。 |

### Q3 规则生态 — 实现同步

| 项 | 状态 | 实现位置 | 实现逻辑摘要 |
| --- | --- | --- | --- |
| entry_points 文档化 + 示例仓库 | ✅ 初始化 | `core/rules.py`（_load_entry_point_rules）、`docs/rule-plugins.md`、`examples/diffsense-rules-example/` | entry point 组 diffsense.rules；示例包 pyproject.toml + diffsense_rules_example/rules/example.yaml + get_rules() 返回路径；rule-plugins 末链示例与 quickstart。 |
| rule devkit / 10 分钟上手 | ✅ 初始化 | `docs/rule-quickstart.md` | 最小 YAML/Python 模板；5 步：进入示例包 → pip install -e . → 改规则 → replay → rules list。 |
| 官方精选规则集 / 测试 harness / 第二包 | 未做 | — | 见 NEXT_STEPS Q3-S2～S4。 |

### Q4 产品化 — 实现同步

| 项 | 状态 | 实现位置 | 实现逻辑摘要 |
| --- | --- | --- | --- |
| Docker / CI 模板 / 文档 / case study | 未开始 | 现有 Dockerfile、audit.yml、gitlab 示例 | 待按 Q4 P0 逐项补齐。 |

---

## Q1 — 可信度阶段（Trust First）✅ 已完成

### 核心目标

- Precision > 90%，误报可控且可解释

### 必做（P0）

1. Rule 质量度量系统
   - 输出 rule_metrics.json
   - 计算 hits / confirmed / false_positive / precision / quality_status
   - precision < 0.5 自动降级，< 0.3 自动跳过
   - CLI 输出 rule health
2. 忽略机制完善
   - inline ignore
   - repo ignore file
   - rule id + file 维度忽略
   - diffsense-ignore.yaml 规范化
3. PR 输出可读性重构
   - 分组结果与统计摘要
   - Cache 命中与规则执行数量展示

### 本阶段禁止做

- 新规则 > 5 条
- 新分析器
- 新架构重构

### 完成标志（Definition of Done）

- [x] precision 报表可见（rule_metrics.json、HTML/CLI、rules health）
- [x] 自动降级生效（&lt;0.5 降级、&lt;0.3 在 auto_tune 下跳过）
- [x] 误报可一键忽略（inline + diffsense-ignore.yaml / .diffsense.yaml）
- [ ] 团队敢默认开启 CI gate（需业务侧验收）

---

## Q2 — 性能极限阶段（Speed First）✅ 已完成

### 核心目标

- 中型 PR < 5s

### 必做（P0）

1. rule-level scheduler 强化
2. cache 持久化 + CI 共享
3. profiling 报表

### 完成标志（Definition of Done）

- [x] 冷启动 &lt; 10s（见 [performance.md](../performance.md) 测量方法与典型值）
- [x] 热启动 &lt; 3s（同上）
- [x] rule 执行数量 &lt; 30%（`--profile lightweight` 等，见 performance.md）

---

## Q3 — 规则生态阶段（Scale via Ecosystem）

### 核心目标

- 规则由社区或企业提供

### 必做（P0）

1. entry_points 文档化 + 示例仓库
2. rule devkit
3. 官方精选规则集

### 完成标志（Definition of Done）

- 至少 2 个外部规则包
- 用户 10 分钟内完成规则开发

---

## Q4 — 产品化阶段（Adoption First）

### 核心目标

- 安装即用，0 配置跑起来

### 必做（P0）

1. 官方 Docker 镜像优化
2. GitHub/GitLab 模板仓库
3. 文档重写
4. 真实场景 case study

### 完成标志（Definition of Done）

- 5+ 仓库使用
- CI 默认开启
- PR review 真实在看结果

---

## 功能取舍标准

- 新功能只要满足三选一即可：提升 precision / 提升速度 / 提升采用率
- 不满足三选一的需求直接不做
