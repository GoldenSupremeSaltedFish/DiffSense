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
