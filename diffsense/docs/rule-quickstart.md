# 规则开发：最小模板与 10 分钟上手

面向 Q3「用户 10 分钟内完成规则开发」的单一入口文档。

---

## 1. 最小 Rule 模板（YAML）

在 DiffSense 中，一条规则至少需要：**id**、**severity**、**impact**、**rationale**，以及用于匹配的 **signal** + **action**（或 Python 中实现 `evaluate`）。

### YAML 单条示例

```yaml
rules:
  - id: myteam.custom.risk          # 唯一 ID，建议 <scope>.<category>.<name>
    signal: "runtime.concurrency.lock"  # 依赖的 AST signal（见 ast_signal_contract）
    action: "removed"                   # added | removed | downgrade 等
    file: "**"                          # 文件匹配，** 表示全部
    impact: runtime                     # runtime | security | data | performance 等
    severity: high                      # critical | high | medium | low
    rationale: "移除锁会导致并发风险。"   # 给人看的说明
```

- **signal**：必须与 AST 检测器产出的 signal ID 一致（如 `runtime.concurrency.lock`）。
- **action**：与 signal 组合表示「何种变更」触发本条规则。
- 将上述内容保存为 `my_rules.yaml`，用 `diffsense replay your.diff --rules my_rules.yaml` 即可加载。

---

## 2. 最小 Rule 模板（Python）

需要更灵活逻辑时，可继承 `Rule` 并实现 `evaluate`：

```python
from diffsense.core.rule_base import Rule

class MyRule(Rule):
    @property
    def id(self):
        return "myteam.custom.python"

    @property
    def severity(self):
        return "high"

    @property
    def impact(self):
        return "runtime"

    @property
    def rationale(self):
        return "Custom logic: ..."

    def evaluate(self, diff_data, ast_signals):
        # diff_data: {"files": [...], "file_patches": [...], ...}
        # ast_signals: list of signal objects
        for s in ast_signals:
            if getattr(s, "id", None) == "runtime.concurrency.lock":
                return {"file": diff_data.get("files", ["unknown"])[0]}
        return None
```

通过 entry point 或 `--rules` 指向的模块加载（见 [rule-plugins.md](rule-plugins.md)）。

---

## 3. 10 分钟上手（5 步）

1. **Clone / 进入示例包**  
   `cd diffsense/examples/diffsense-rules-example`（或 clone 含该目录的仓库）。

2. **安装为可编辑包**  
   `pip install -e .`  
   确保已安装 diffsense：`pip install -e <path-to-diffsense>`。

3. **改一条规则**  
   编辑 `diffsense_rules_example/rules/example.yaml`：改 `id`、`rationale` 或增加一条新规则（复制一段 `- id: ...` 并改字段）。

4. **本地 replay 验证**  
   `diffsense replay tests/fixtures/ast_cases/concurrency/lock.diff --format json`  
   输出中应出现你改的规则 ID（若该 diff 触发了对应 signal）。

5. **看规则列表**  
   `diffsense rules list`  
   确认列表中包含 `example.custom.*`。

---

## 4. 参考

- [rule-plugins.md](rule-plugins.md)：entry point 契约、返回 `List[Rule]` 或路径、包命名。
- [ast_signal_contract.md](ast_signal_contract.md)：可用的 signal ID 与约定。
- 示例包：`examples/diffsense-rules-example/`（[README](../examples/diffsense-rules-example/README.md)）。
