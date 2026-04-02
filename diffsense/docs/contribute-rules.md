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
   - 单规则执行 < 5ms；
   - 误报与命中率说明。
2. **架构约束**：复杂逻辑放在 Semantic 层（如 `core/ast_detector.py`），规则层只做「对 signal 的判定」；不满足的 PR 会被要求重构。
3. **修改位置**：YAML 规则加到 `config/rules.yaml`；若需新 **Signal**，需在 `core/ast_detector.py`（或 semantic 层）增加产出，并在 [signals.md](signals.md) 与 `core/signals_registry.py` 中登记。

---

## 新增 Signal 检测（高级）

如果现有 Signal 无法满足需求，需要添加新的检测逻辑，请按以下步骤：

### 步骤 1：在 `core/change.py` 中添加 ChangeKind（如需要）

```python
# diffsense/core/change.py
class ChangeKind(Enum):
    # ... 现有项 ...
    LITERAL_ADDED = "LITERAL_ADDED"
    LITERAL_REMOVED = "LITERAL_REMOVED"
```

### 步骤 2：在 `core/ast_detector.py` 中添加检测逻辑

在 `ASTDetector` 类的 `__init__` 中定义检测模式：

```python
# 定义敏感模式（如密码、密钥等）
self.secret_patterns = {
    "password", "passwd", "pwd", "secret", "token",
    "api_key", "apikey", "access_key", "private_key"
}
```

在 Token 分析循环中添加检测（约 `_analyze_snippet_for_changes` 方法）：

```python
# === Security Detection ===
# 示例：检测硬编码密钥
for i, token in enumerate(tokens):
    if hasattr(token, 'value') and isinstance(token.value, str):
        token_val = token.value.strip('"\'`')
        if any(secret in token_val.lower() for secret in self.secret_patterns):
            if len(token_val) > 3 and ("=" in token_val or ":" in token_val):
                changes.append(Change(
                    kind=ChangeKind.LITERAL_ADDED if is_added else ChangeKind.LITERAL_REMOVED,
                    file=filename,
                    symbol="hardcoded_secret",
                    meta={"type": "secret", "value_hint": token_val[:20]},
                    line_no=token.position.line
                ))
```

### 步骤 3：添加 Signal ID 映射

在 `_map_change_to_signal_id` 方法中映射：

```python
# 在 _map_change_to_signal_id 方法中
if change.symbol == "hardcoded_secret":
     if change.kind == ChangeKind.LITERAL_ADDED:
         return "security.hardcoded_secret"
     if change.kind == ChangeKind.LITERAL_REMOVED:
         return "security.hardcoded_secret_removed"
```

### 步骤 4：在 `config/rules.yaml` 中添加规则

```yaml
- id: security.hardcoded_secret
  signal: "security.hardcoded_secret"
  action: "added"
  file: "**"
  impact: security
  severity: critical
  rationale: "CRITICAL: Hardcoded password or secret detected."
  tags: ["security", "secret"]
  is_blocking: true
```

### 工作流程总结

```
1. 定义检测模式（__init__）
       ↓
2. Token 级别检测（_analyze_snippet_for_changes）
       ↓
3. 映射到 Signal ID（_map_change_to_signal_id）
       ↓
4. 编写 YAML 规则
```

**优势**：
- 新增检测只需改 Python（检测逻辑） + YAML（规则定义）
- 不需要编写复杂的 Python Rule 类
- Signal 可被多条规则复用

---

## 快速对照

| 场景 | 文档 | 命令 |
|------|------|------|
| 10 分钟写一条规则 | [rule-quickstart.md](rule-quickstart.md) | `diffsense signals`、`diffsense rules list` |
| 查所有可用的 signal | [signals.md](signals.md) | `diffsense signals` |
| 发自己的规则包 | [rule-plugins.md](rule-plugins.md) | `pip install -e .` 后 `diffsense replay` |
| 把规则贡献进主仓 | [CONTRIBUTING.md](../CONTRIBUTING.md) | 提 PR，满足 Checklist |
| 新增 Signal 检测 | 本文档「新增 Signal 检测」部分 | - |
| 编写跨语言规则 | [RULES_README.md](../rules/RULES_README.md) | 使用 LanguageAdapter |

---

## 附录：LanguageAdapter 跨语言支持

DiffSense 支持通过 `LanguageAdapter` 编写跨语言规则。详细信息请参考 [RULES_README.md](../rules/RULES_README.md)。

### 支持的语言

- **Java**: `sdk/java_adapter.py`
- **Go**: `sdk/go_adapter.py`
- **Python**: `sdk/python_adapter.py`

### 使用示例

```python
from sdk.rule import BaseRule
from sdk.language_adapter import AdapterFactory

class MyRule(BaseRule):
    def __init__(self, language: str = "java"):
        self._adapter = AdapterFactory.get_adapter(language)
    
    def evaluate(self, diff_data, signals):
        # 使用 adapter 获取语言特定的模式
        lock_patterns = self._adapter.get_lock_patterns()
        # ... 规则逻辑
```