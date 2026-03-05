# 贡献审计规则

本文是「贡献一条 DiffSense 审计规则」的单一入口：两种路径、一份 Signal 列表、最小上手步骤。

---

## 核心概念

- **Signals** 由语义分析器（AST/Semantic 层）**产生**；**Rules** 只**消费** signal，不产生 signal。
- 写规则时，你的规则通过 `signal: "<id>"` 引用 [Signal Registry](signals.md) 中的 ID。可用 `diffsense signals` 在终端查看完整列表。

---

## 路径一：只在自己或团队使用（推荐先走这条）

**目标**：不改 DiffSense 主仓，快速写 YAML 规则或发一个插件包。

1. **10 分钟上手**：[rule-quickstart.md](rule-quickstart.md) — 最小 YAML 模板、5 步：进示例包 → `pip install -e .` → 改规则 → `diffsense replay your.diff` → `diffsense rules list`。
2. **可用 Signal 列表**：[signals.md](signals.md) 或终端运行 `diffsense signals`。
3. **发成独立包**：[rule-plugins.md](rule-plugins.md) — entry point `diffsense.rules`、包名约定、返回 YAML 目录或 `List[Rule]`。

无需 PR 到主仓，安装你的包后 `diffsense audit` / `diffsense replay` 会自动合并你的规则。

---

## 路径二：贡献回主仓（config/rules.yaml 或 core 规则）

**目标**：规则进入官方仓库，所有人默认可用。

1. **贡献清单**：见 [CONTRIBUTING.md](../CONTRIBUTING.md) 中「Rule Development Checklist」：
   - 提供真实场景的 `.diff` fixture；
   - Replay 验证；
   - 单规则执行 &lt; 5ms；
   - 误报与命中率说明。
2. **架构约束**：复杂逻辑放在 Semantic 层（如 `core/ast_detector.py`），规则层只做「对 signal 的判定」；不满足的 PR 会被要求重构。
3. **修改位置**：YAML 规则加到 `config/rules.yaml`；若需新 **Signal**，需在 `core/ast_detector.py`（或 semantic 层）增加产出，并在 [signals.md](signals.md) 与 `core/signals_registry.py` 中登记。

---

## 快速对照

| 你想… | 看哪份文档 | 命令 |
|--------|------------|------|
| 10 分钟写一条规则 | [rule-quickstart.md](rule-quickstart.md) | `diffsense signals`、`diffsense rules list` |
| 查所有可用的 signal | [signals.md](signals.md) | `diffsense signals` |
| 发自己的规则包 | [rule-plugins.md](rule-plugins.md) | `pip install -e .` 后 `diffsense replay` |
| 把规则贡献进主仓 | [CONTRIBUTING.md](../CONTRIBUTING.md) | 提 PR，满足 Checklist |
