# DiffSense Agent Surface 设计（第 1 批：接口面）

- 日期：2026-10-09
- 状态：已批准，待实施
- 适用范围：`diffsense/`（Python 包）+ `docs/`，不涉及 `vscode-extension/`

## 1. 背景与目标

DiffSense 已具备双产物布局（镜像线 + VS Code 插件线，PR #45/#46 已合入 main）。底层材料约 70% 就绪（CLI `audit/replay/rules list/health/sdk`、`--format json`、`--report-json/--comments-json`、baseline、precision 校准），但**面向 agent 的调用表面本身约 0%**：无 schema_version、无固定退出码、无 MCP、无 SARIF、无 agent 规约、README 已过期。

本批目标：给 DiffSense 补齐第一层"agent 可调用表面"——确定性规则引擎以机器可读契约对外暴露，使 LLM reviewer 与 CI 可将 DiffSense 作为**确定性 verifier** 集成。保持既有架构红线不变：只做 diff 回归风险、Human-in-the-loop、本地零成本、离续可复现。

## 2. 边界

### 2.1 本批包含

- JSON 输出显式版本化契约（`schema_version` + 固定退出码 + `cli-contract.md` + JSON Schema）
- SARIF 2.1.0 输出（`diffsense audit --format sarif`）
- MCP 薄壳（4 个只读工具，stdio 传输，`pip install diffsense[mcp]`）
- 测试与 CI：`tests/goldens/` fixtures + `contract-check` job

### 2.2 本批不包含（第 2 批：文档面）

- agent 规约（AGENTS.md / 集成指南）
- README 首屏重写
- `record_feedback` 工具（写入型，留待第 2 批评估）

### 2.3 本批不触碰

- 规则引擎内部逻辑、规则语义
- CLI 现有参数与输出语义（只增不改）
- 双产物流水线（`diffsense-image.yml` / `diffsense-vscode.yml`）

## 3. 决策记录

| # | 决策点 | 结论 |
|---|--------|------|
| D1 | 拆分方式 | 分两批：第 1 批接口面（JSON 契约+SARIF+MCP），第 2 批文档面（agent 规约+README 首屏）。每批一份 spec，各走独立 PR。 |
| D2 | JSON 契约强度 | 显式版本化契约：输出加 `schema_version`；固定退出码 0=通过 / 1=有风险 / 2=工具错误；写 `docs/cli-contract.md`（字段/类型/兼容规则）；预 1.0 breaking 须升版本号。 |
| D3 | MCP 交付方式 | 包内 extra：`pip install diffsense[mcp]`；官方 mcp Python SDK；stdio 传输；console entry `diffsense-mcp`；同仓同版本生命周期。 |
| D4 | MCP 工具集 | 4 个只读工具：`audit_diff` / `list_rules` / `explain_rule` / `audit_replay`。全只读零副作用；`record_feedback` 留到第 2 批。 |
| D5 | SARIF 内容 | 逐条 findings 映射 result（ruleId=`diffsense/<rule_id>`，high→error / medium→warning / low→note）；额外约定 rule `diffsense/review_level` 在 properties 携带 review_level / confidence / blocked 状态。单文件自带"有哪些风险 + 能不能合"。 |
| D6 | 质量门 | `tests/goldens/` 加 golden fixtures（JSON 契约样例 + SARIF 样例 + JSON Schema 校验）；CI 新增轻量 job `contract-check`（装 `diffsense[mcp]` extra 跑契约 smoke）。不动现有双产物流水线。 |

## 4. JSON 契约收口

### 4.1 `schema_version`

- 位置：`audit --format json` / `--report-json` 顶层对象新增 `"schema_version": "1.0"`（字符串，语义化主版本）。
- 内置常量：`diffsense/constants.py` 增加 `SCHEMA_VERSION = "1.0"`。
- 缺省策略：不写缺省，始终显式输出；解析方必须校验该字段。

### 4.2 固定退出码

| 码 | 含义 | 场景 |
|----|------|------|
| 0 | 通过 | 无 risk，或 blocked 状态为 false（review_level 未达阻断阈值） |
| 1 | 有风险 | 存在 findings，且 blocked=true（review_level 达阻断阈值） |
| 2 | 工具错误 | 参数错误、仓库不可读、内部异常等一切失败场景 |

- 实现点：CLI 入口统一映射，不散落在各分支。
- 兼容：现有脚本依赖非 0 即失败的行为，本变更仅细化 1/2 语义，不与现有行为冲突。

### 4.3 交付物

- `diffsense/docs/cli-contract.md`：字段/类型/兼容规则（RFC 2119 用词：MUST / SHOULD / MAY）。
- `diffsense/diffsense/schemas/audit-report.schema.json`：JSON Schema（draft 2020-12），供消费者校验与 IDE 补全。

## 5. SARIF 输出

- 命令形态：`diffsense audit --format sarif`（`--report-json` 语义下亦可通过 `--format sarif` 输出到文件）。
- 版本：SARIF 2.1.0，兼容 GitHub code scanning 上传。
- 映射规则：
  - 逐条 finding → `results[]`；`ruleId = "diffsense/<rule_id>"`。
  - severity → level：high→error / medium→warning / low→note。
  - 额外 rule `diffsense/review_level`：`properties` 中携带 `review_level` / `confidence` / `blocked`。
  - 单文件自带结论：`properties.review_level` 表示整体结论、"能不能合"以 `blocked` 表达。
- 交付物：`diffsense/diffsense/sarif.py` 输出层模块 + `docs/cli-contract.md` 中 SARIF 小节。

## 6. MCP 薄壳

- 模块：`diffsense/diffsense/mcp_server.py`。
- 交付方式：`pyproject.toml` 增加 `[project.optional-dependencies] mcp = ["mcp>=1.0"]`，`[project.scripts] diffsense-mcp = "diffsense.mcp_server:main"`。
- 传输：stdio。
- 工具集（D4）：`audit_diff` / `list_rules` / `explain_rule` / `audit_replay` 全部只读，薄壳只做参数翻译并复用现有 API，不复制业务逻辑。
- 生命周期：与包同版本发布，不单独版本化。

## 7. 测试与 CI

- `diffsense/tests/goldens/`：
  - `audit-report.schema.json` 对应样例（必含 schema_version 的合法/非法样例各一）；
  - SARIF 样例（覆盖 high/medium/low 映射与 review_level rule）；
  - JSON Schema 校验测试。
- CI：在现有双产物流水线之外，新增轻量 job `contract-check`：`pip install .[mcp]` → 跑 golden 校验 + `diffsense-mcp` 启动 smoke（list tools 验证 4 工具注册）。

## 8. 阶段与 PR 计划（"一个阶段一个 PR"）

| 阶段 | 内容 | 预计文件 | PR |
|------|------|----------|----|
| 1 | spec 落盘 | 本文档 | PR-A |
| 2 | JSON 契约收口 | constants.py、CLI 入口、cli-contract.md、audit-report.schema.json、契约测试 | PR-B |
| 3 | SARIF 输出 | sarif.py、CLI 路由、SARIF golden | PR-C |
| 4 | MCP 薄壳 | mcp_server.py、pyproject（extra+entry）、MCP 冒烟测试 | PR-D |
| 5 | 测试与 CI 收口 | goldens 全量、contract-check job | PR-E |

- 版本：2.2.6 → 2.3.0（minor，新增能力）。
- 每阶段 PR 独立从 main 拉分支，合并顺序即上表顺序；每完成一阶段通知用户一次。

## 9. 验收标准

1. `diffsense audit --format json` 输出首字节即 `schema_version` 字段，值为 `1.0`。
2. 退出码严格满足 0/1/2 三态：无风险返回 0；blocked 返回 1；任何工具错误返回 2。
3. `docs/cli-contract.md` 存在，字段/类型/兼容规则以 MUST/SHOULD/MAY 表述。
4. `audit-report.schema.json` 可通过 `jsonschema` 校验合法输出、拒绝非法样例。
5. `diffsense audit --format sarif` 输出为合法 SARIF 2.1.0，ruleId/level 映射符合 D5，且提供 sarif 语义样例。
6. `pip install .[mcp]` 后 `diffsense-mcp` 可启动，`list_tools` 恰含 4 个工具，名称与参数与设计一致。
7. `tests/goldens/` fixtures 与 `contract-check` job 在 CI 上全绿，且原双产物流水线不受影响。
8. `vscode-extension/` 零改动；规则引擎与 CLI 语义零改动。

## 10. 风险与红线

- 红线不变：只做 diff 回归风险定位；Human-in-the-loop 必须保留（blocked 语义只作建议输入，不自动阻断合入动作）。
- MCP 薄壳严格只读；绝不隐含写操作。
- SARIF/MCP 均为增量能力，禁止回改现有 `--format json` 输出字段；契约兼容规则见 cli-contract.md。