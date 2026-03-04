# DiffSense 文档索引

本目录为 DiffSense CLI 的用户文档与实现契约的集中入口。里程碑与路线图见 [cursor/](cursor/README.md)。

---

## 用户文档

| 文档 | 说明 |
|------|------|
| [quickstart.md](quickstart.md) | 快速开始：GitHub PR 审计与本地 diff 审计的步骤 |
| [recommended-config.md](recommended-config.md) | 官方推荐配置（`.diffsense.yaml`）与默认行为承诺 |
| [ignoring.md](ignoring.md) | 忽略规则与误报处理（行内与仓库级配置） |
| [ci-cache.md](ci-cache.md) | CI 缓存配置、TTL 与 prune |
| [performance.md](performance.md) | 性能目标、冷/热启动测量与执行比例 |
| [rule-plugins.md](rule-plugins.md) | 规则插件契约（entry point、包约定） |
| [rule-quickstart.md](rule-quickstart.md) | 自定义规则开发入门 |

---

## 契约与实现说明

| 文档 | 说明 |
|------|------|
| [parser_contract.md](parser_contract.md) | Diff 解析输出契约 |
| [ast_signal_contract.md](ast_signal_contract.md) | AST 信号 ID 与约定（规则开发参考） |
| [technical_sketch.md](technical_sketch.md) | 技术草图与设计说明 |

---

## 里程碑与工程文档（cursor/）

路线图、执行清单、架构原则、工程化检查等见 [cursor/README.md](cursor/README.md)。
