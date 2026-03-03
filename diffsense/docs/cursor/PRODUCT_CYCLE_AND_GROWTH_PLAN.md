# DiffSense 产品周期分析、下一步与推广计划

> 基于 [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md)、[ROADMAP_12_MONTHS_CN.md](./ROADMAP_12_MONTHS_CN.md)、[NEXT_STEPS_CN.md](./NEXT_STEPS_CN.md)，结合产品经理与推广技能要点，制定本计划。  
> **原则**：所有动作须满足三选一 —— 提升 precision / 提升速度 / **提升采用率**；不触达架构红线。

---

# 一、当前产品周期分析

## 1.1 阶段定位

| 维度 | 判断 |
|------|------|
| **生命周期** | 已过「验证期」，进入「产品化 + 生态 + 采用」期 |
| **架构成熟度** | 规则治理、增量调度、cache、profile、插件入口已达 v0.8+，后续不做底层重构 |
| **北极星** | **只做一件事**：阻断本次 Diff 引入的回归风险（Change Risk Gate），不做全量分析、不做质量管理平台 |

## 1.2 里程碑完成情况

| 季度 | 关键词 | 状态 | 与架构原则对齐 |
|------|--------|------|----------------|
| Q1 可信度 | precision、忽略、可读输出 | ✅ 已完成 | 极低误报、可解释、Human-in-the-loop ✅ |
| Q2 性能极限 | 冷/热、cache、scheduler | ✅ 已完成 | 极致快、只做 diff、机器负责速度 ✅ |
| Q3 规则生态 | entry_points、devkit、精选规则集 | 🟡 初始化完成 | 可插拔规则生态（护城河）✅ |
| Q4 产品化 | Docker、模板、文档、case study | 未开始 | 安装即用、0 配置 → **采用率** |

## 1.3 当前主要缺口（影响「下一步」与「推广」）

- **采用率证据不足**：尚无「5+ 仓库使用」「CI 默认开启」「PR review 真实在看」的成文 case。
- **对外可发现性弱**：README/文档未按「对谁、解决什么、带来什么结果」系统包装；SEO 与关键词未规划。
- **生态尚未闭环**：Q3 尚有测试 harness、官方精选规则集、可选第二包；缺少「10 分钟上手」的端到端验证。
- **开源优秀化要素不完整**：CONTRIBUTING、Governance、社区触点、发布节奏、可衡量指标未成体系。

---

# 二、下一步如何做（执行优先级）

## 2.1 与现有路线图一致

以下与 [NEXT_STEPS_CN.md](./NEXT_STEPS_CN.md) 及 ROADMAP 的 P0 对齐，按**采用率**优先排序。

## 2.2 Q3 收尾（规则生态闭环）

| 序号 | 任务 | 说明 | 验收标准 | 优先级 |
|------|------|------|----------|--------|
| Q3-1 | 测试 harness | 为插件规则提供 pytest + fixture diff 示例 | 示例包内可运行单测并文档化 | P0 |
| Q3-2 | 官方精选规则集 | 明确 concurrency/reliability/regression 保留策略 | 文档 + 可选 `diffsense-rules-curated` 或内建集 | P0 |
| Q3-3 | rule-quickstart 端到端验证 | 新用户 10 分钟完成「改规则 → replay → rules list」 | 文档/视频或 checklist 可复现 | P1 |
| Q3-4 | 第二个外部包（可选） | 如 diffsense-rules-java | 至少 2 个外部规则包（DoD） | P2 |

## 2.3 Q4 启动（产品化落地）

| 序号 | 任务 | 说明 | 验收标准 | 优先级 |
|------|------|------|----------|--------|
| Q4-1 | 一页纸产品说明 | 对谁、解决什么、带来什么结果；≤3 步快速开始 | 放入 README 或 docs 首页 | P0 |
| Q4-2 | 官方 Docker 镜像优化 | 版本标签、文档、CI 示例使用 | 文档 + audit.yml 可选用镜像 | P0 |
| Q4-3 | GitHub/GitLab 模板仓库 | 一键用 DiffSense 的 repo 模板 | 模板 README 含「为何用 DiffSense」+ 3 步 | P0 |
| Q4-4 | 文档重写（用户视角） | 安装 → 首次运行 → CI 集成 → 忽略/规则 | 新用户路径清晰，无歧义 | P0 |
| Q4-5 | 真实场景 case study | 1～2 个团队/仓库的使用故事（可脱敏） | 成文：场景、结果、引用 | P1 |

## 2.4 禁止项（本阶段勿做）

- 新规则 > 5 条（除非属于「精选规则集」且满足 precision 标准）
- 全仓扫描、全面静态分析、自动替人做决策、质量管理平台（见 [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md) 红线）

---

# 三、推广计划（分阶段、可执行）

## 3.1 目标与目标用户

- **目标**（本周期）：从「冷启动」到「验证」—— 可衡量的采用信号（如 GitHub Star/Usage、5+ 仓库使用、文档 UV/反馈）。
- **目标用户**：做 Code Review 的开发者、Tech Lead、CI 维护者；关注「这次 MR 是否引入回归」的团队。
- **一句话**：DiffSense 是 PR 阶段的变更风险守门人，只判断「这次改动有没有让系统更危险」，少、准、快、可解释。

## 3.2 阶段一：冷启动（0→100）

| 手段 | 动作 | 谁来做 | 验收/指标 | 优先级 |
|------|------|--------|-----------|--------|
| **内容** | 一篇「为什么需要 Change Risk Gate」+ DiffSense 定位 | 主维护者/PM | 发布在 1 个主渠道（见下） | P0 |
| **README/SEO** | 一页纸产品说明入 README；核心关键词（change risk, regression, PR gate, diff analysis） | 主维护者 | README 首屏含价值+场景+3 步 | P0 |
| **社区** | GitHub Release 说明规范化（版本、亮点、升级指引） | 主维护者 | 每个 release 有清晰 Release Notes | P0 |
| **生态** | 申请/入驻 1 个「Awesome-xxx」类列表（如 Awesome Python、Code Quality） | 贡献者 | 被收录或提交 PR | P1 |

## 3.3 阶段二：验证（100→500）

| 手段 | 动作 | 谁来做 | 验收/指标 | 优先级 |
|------|------|--------|-----------|--------|
| **Case study** | 1～2 篇成文使用案例（可脱敏） | 主维护者/用户 | 文档或博客可引用 | P0 |
| **开发者社区** | 技术论坛/掘金/V2EX/Reddit 发 1 篇「上手+对比」短文，带 CTA（Repo/文档） | 主维护者 | 1 篇发布 + 链接可追踪 | P1 |
| **合作** | 与互补工具（如 pre-commit、CI 模板）集成或文档互相引用 | 主维护者 | 至少 1 处互相引用或模板 | P1 |
| **产品内增长** | 首次运行/文档：3 步内出第一次结果；文档首页路径清晰 | 主维护者 | 新用户 checklist 可复现 | P0 |

## 3.4 阶段三：放大（500+）

| 手段 | 动作 | 谁来做 | 验收/指标 | 优先级 |
|------|------|--------|-----------|--------|
| **内容节奏** | 每 1～2 月 1 篇：教程/案例/性能数据/规则开发 | 主维护者/社区 | 内容日历或 backlog | P1 |
| **社区** | GitHub Discussion 或 Discord/Slack 作为反馈与问答入口 | 主维护者 | 入口在 README，有人响应 | P1 |
| **指标** | 定义并观测：Star 数、Usage（可选）、文档 UV、Issue/PR 健康度 | 主维护者 | 有基线并定期看 | P1 |

## 3.5 关键指标（建议）

| 指标 | 说明 | 当前建议 |
|------|------|----------|
| 采用 | 使用 DiffSense 的仓库/团队数 | 目标：5+（与 Q4 DoD 一致） |
| 发现 | GitHub Star、文档/官网 UV | 待测量，先定义基线 |
| 信任 | Issue 响应时间、Release 节奏、precision 报表可见 | 已有 precision/rule health，保持发布节奏 |

---

# 四、如何成为优秀的开源项目

## 4.1 优秀开源项目的共性（与本项目对齐）

| 维度 | 优秀开源特征 | DiffSense 当前 | 建议动作 |
|------|--------------|----------------|----------|
| **定位清晰** | 一句话说清是什么、为谁、解决什么 | 架构原则已明确「Change Risk Gate」 | 将一句话下沉到 README、文档首页、所有对外材料 |
| **上手极快** | 5～10 分钟出第一次结果 | 有 rule-quickstart；整体「安装→CI」路径待收口 | Q4 文档重写 + 一页纸 + 模板仓库 |
| **信任** | 行为可预期、误报可控、不自动替人决策 | 已有 precision、忽略、Human-in-the-loop | 保持；对外强调「少而准、可解释」 |
| **参与门槛** | CONTRIBUTING、Code of Conduct、清晰 Issue/PR 范围 | 待完善 | 见 4.2 |
| **可持续** | 发布节奏、兼容性、维护者可见 | 有 release；维护者可见度可加强 | 发布节奏文档化；Governance 轻量说明 |

## 4.2 建议补齐的开源「基础设施」

| 项 | 说明 | 优先级 |
|----|------|--------|
| **CONTRIBUTING.md** | 如何提 Issue/PR、分支策略、代码/测试要求、与架构原则的链接 | P0 |
| **Governance 简述** | 谁维护、如何决策、与架构原则一致（如「不增加红线外的分析器」） | P1 |
| **Code of Conduct** | 社区行为准则（可选用 Contributor Covenant 等标准） | P1 |
| **发布节奏** | 语义化版本、changelog 约定、breaking change 说明 | P1 |
| **社区触点** | README 中「讨论/问答」链接（GitHub Discussion 或外部） | P0 |

## 4.3 与架构原则的协同

- **推广与开源叙事**必须反复强调：  
  「DiffSense 不是静态分析器，而是 PR 阶段的变更风险守门人；只做 diff 引入的回归风险，少、准、快、可解释。」  
- **不承诺**：全量扫描、漏洞扫描、代码规范、KPI/评分、自动合并/拒绝。  
- **强调**：帮开发者少背锅、阻断回归、可插拔规则、Human-in-the-loop。

---

# 五、计划执行清单（按周/月可拆）

## 5.1 近期（1～2 周）

- [ ] 将「一页纸产品说明」写入 README 或 `docs/` 首页（与 Q4-1 一致）
- [ ] 完成 Q3-1 测试 harness 示例并文档化
- [ ] 起草 CONTRIBUTING.md，链接 ARCHITECTURE_PRINCIPLES

## 5.2 短期（1 个月内）

- [ ] 完成 Q3-2 官方精选规则集策略与文档/包
- [ ] 发布一次带清晰 Release Notes 的版本
- [ ] 撰写一篇对外「为什么需要 Change Risk Gate」+ DiffSense 介绍（冷启动内容）

## 5.3 中期（Q4）

- [ ] 完成 Q4-1～Q4-4：一页纸、Docker、模板仓库、文档重写
- [ ] 争取 1 个 case study 成文
- [ ] 在 1 个开发者社区或 Awesome 列表触达（验证阶段）

## 5.4 持续

- [ ] 每个 Release 更新 Release Notes 与 changelog
- [ ] 定期核对 ROADMAP/NEXT_STEPS/本计划，同步状态与 DoD
- [ ] 观测采用与发现类指标，按阶段调整推广重心

---

# 六、总结

| 主题 | 要点 |
|------|------|
| **产品周期** | 已过验证期，处于产品化+生态+采用期；Q1/Q2 已完成，Q3 初始化完成待闭环，Q4 未开始。 |
| **下一步** | 优先 Q3 收尾（harness、精选规则集、quickstart 验证），随即启动 Q4（一页纸、Docker、模板、文档、case study）。 |
| **推广** | 分三阶段：冷启动（README/内容/Release/生态列表）→ 验证（case study、社区发文、合作、产品内路径）→ 放大（内容节奏、社区触点、指标）。 |
| **优秀开源** | 定位清晰、上手快、信任（少而准、Human-in-the-loop）、CONTRIBUTING/Governance/发布节奏/社区触点系统补齐，对外叙事与架构原则一致。 |

本文档与 [ROADMAP_12_MONTHS_CN.md](./ROADMAP_12_MONTHS_CN.md)、[NEXT_STEPS_CN.md](./NEXT_STEPS_CN.md)、[ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md) 对齐；若路线图或架构原则有更新，请同步修订本计划。
