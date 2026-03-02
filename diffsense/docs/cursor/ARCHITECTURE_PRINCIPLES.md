# DiffSense 产品宗旨与架构原则：变更风险守门人

> **DiffSense 不是一个静态分析器。**
> **它是一个专注于由当前 Diff 引入的回归风险的变更风险守门人（Change Risk Gate）。**

---

# 一、项目的「唯一核心逻辑」（必须永远坚持）

### ✅ 正确定位
**PR 阶段的变更风险守门人（Change Risk Gate）**

再缩一句：
**只判断：这次改动有没有让系统更危险**

注意：
*   👉 不是找 bug
*   👉 不是代码质量平台
*   👉 不是安全扫描器
*   👉 不是技术债平台

只干一件事：
**阻断回归风险（regression risk）**
这是 DiffSense 的「北极星」。

---

# 二、坚决不能做的事（红线清单）

只要开始做以下事情，项目就会走向死亡。

## ❌ 1. 全仓扫描 / full scan 默认开启
*   **不能做**：每次 CI 扫整个 repo；每次 MR 跑全量 AST；每次 build 都跑全规则。
*   **原因**：慢 = 直接没人用。PR 工具的忍受上限是 10~30 秒，超过 5 分钟会被直接关掉。
*   **原则**：默认只看 diff。全量只能是手动 nightly 或 baseline。

## ❌ 2. 做“全面静态分析器”
*   **不能做**：数据流分析、全局 call graph、跨过程分析、污点传播、漏洞扫描（CWE 覆盖）。
*   **原因**：这是 Sonar/CodeQL 的赛道。复杂度提升会导致误报增加、速度下降、信任度崩塌。

## ❌ 3. 规则越多越好
*   **不能做**：堆数百条规则；检查代码规范。
*   **原因**：规则越多噪音越大。50 条高价值规则 > 500 条垃圾规则。追求“少而准”，而非“多而全”。

## ❌ 4. 自动替人做决策
*   **不能做**：自动合并 MR；自动拒绝 PR；自动修复代码补丁。
*   **原因**：责任必须在人。一次误判可能导致团队永久弃用。DiffSense 是风险提示系统，不是 IDE 助手。

## ❌ 5. 变成“质量管理平台”
*   **不能做**：大盘 dashboard、KPI 打分、个人排名、技术债统计。
*   **原因**：开发者会天然敌视盯着自己扣分的管理系统。DiffSense 的定位是“帮开发者少背锅”。

---

# 三、必须坚持做的事（长期护城河）

## ✅ 1. 只做「变更语义风险」
核心问题：**这次提交是否让系统更差？**
*   典型规则：锁移除、超时增大、线程池策略变化、null-check 删除、catch 变宽、配置降级。
*   这些只有 diff 能高效完成，是产品的核心竞争力。

## ✅ 2. 极致快
目标：**< 5s**
*   手段：缓存（Cache）、增量分析（Incremental）、规则调度（Rule Scheduling）。
*   速度是产品的生死线。

## ✅ 3. 极低误报
目标：**Precision > 90%**
*   手段：规则指标监控、自动降级/禁用机制。
*   没有信任就没有用户。

## ✅ 4. 可插拔规则生态
*   手段：Metadata、Profile、Entry Points。
*   规则不等于产品，引擎 + 生态才是产品。必须支持企业编写私有规则。

---

# 四、最终理想产品形态

### PR 中的反馈模型
```text
DiffSense Report
🔥 critical (1)  - concurrency.lock_removed ...
⚠️ elevated (2)  - timeout increased ...
Cache hit: 87% | saved: 18.4s
Rules executed: 12 / 64
```
**特点：少、准、快、可解释。**

### 运行模型
```text
Diff → Parser → Scheduler（language/scope） → Incremental AST → RuleEngine → DecisionComposer → Gate
```

---

# 五、架构原则：自动化边界（Human-in-the-loop）

1.  **机器负责**：速度、透明度、数据统计、等效优化。
2.  **人类负责**：定义风险、启用/禁用规则、设置严重程度、阻断 CI 决策。
3.  **禁止自动改变风险语义**：禁止自动禁用规则、自动降级、自动改变 CI 状态。

---

# 六、一句话产品哲学
> **DiffSense is not a static analyzer. It is a change risk gate that focuses only on regressions introduced by the current diff.**
