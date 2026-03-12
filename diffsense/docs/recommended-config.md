# 官方推荐配置与默认行为

## 一、官方推荐配置

在仓库根目录创建 **`.diffsense.yaml`** 并写入以下内容。该配置适用于大多数团队，通常无需修改即可使用。

```yaml
# 官方推荐配置（Official Recommended Config）
profile: lightweight
auto_tune: true
ci_fail_level: elevated
cache: true
scheduler: true
```

- **profile: lightweight** — 只跑 severity 为 critical 的规则，执行快、噪音少，规则执行比例通常 < 30%。
- **auto_tune: true** — 启用规则质量自适应：precision 过低的规则会自动降级或跳过，减少误报干扰。
- **ci_fail_level: elevated** — CI 在「elevated」及以上（含 critical）时失败，需人工确认或审批后通过。
- **cache: true** — 启用 diff/AST 缓存，热启动通常 < 3s。
- **scheduler: true** — 按变更文件语言与 scope 调度规则，只跑相关规则，不跑全量。

若同时使用忽略规则，可与 `ignore` 写在同一文件：

```yaml
profile: lightweight
auto_tune: true
ci_fail_level: elevated
cache: true
scheduler: true

ignore:
  - rule: some.rule.id
    files: ["**/test/**"]
```

### CVE 精确匹配：配置依赖版本（可选）

当启用 pro-rules 中的 CVE 规则时，可在 `.diffsense.yaml` 中配置**当前仓库使用的依赖版本**，引擎仅当配置版本落在 CVE 的受影响区间（introduced ≤ 版本 < fixed）时才触发该条规则，避免“任何版本都报”的误报。

```yaml
# 上述 profile / auto_tune 等...

# 依赖版本：ecosystem -> 包名 -> 版本号。仅对带 package+versions 的 CVE 规则生效。
dependency_versions:
  npm:
    lodash: "4.17.21"
    express: "4.18.0"
  maven:
    "org.apache.tomcat:tomcat-catalina": "9.0.72"
```

- 若**未配置** `dependency_versions`，或某包未在配置中列出，则带版本区间的 CVE 规则**不会**对该包执行（需用户配置后才参与精确匹配）。
- 若 CVE 规则**未带** `versions.introduced` / `versions.fixed`，则不进行版本过滤，按原逻辑执行。

---

## 二、默认行为与产品承诺

DiffSense 向用户承诺以下行为，无需额外配置即可信赖：

| 承诺 | 说明 |
|------|------|
| **不扫描全量** | 默认只分析**本次 Diff 涉及的变更**，不做全仓库扫描；全量仅支持手动或 nightly/baseline 场景。 |
| **不拖慢 CI** | 设计目标为 PR 内冷启动 < 10s、热启动 < 3s；通过 cache、scheduler、lightweight profile 控制规则执行比例（通常 < 30%），避免拖慢流水线。 |
| **precision 过低自动降级** | 规则质量系统会统计每条规则的 precision；当 precision < 0.5 时该规则被**降级**（degraded），< 0.3 且在 `auto_tune: true` 时该规则被**跳过**执行，避免低质量规则制造噪音。 |
| **不自动阻断** | 不自动拒绝 PR、不自动修改 CI 状态；仅输出 **review_level** 与 **suggested_action**（如 manual_review / block_pr），是否阻断由人工或下游 CI 逻辑决定；误报可通过行内 ignore 或仓库级 ignore 配置排除。 |

上述行为与 [架构原则](cursor/ARCHITECTURE_PRINCIPLES.md) 一致：机器负责速度与透明度，人类负责启用/禁用规则与 CI 决策。
