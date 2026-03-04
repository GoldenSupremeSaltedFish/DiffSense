# diffsense-rules-example

DiffSense 示例规则包，通过 entry point `diffsense.rules` 加载，用于 Q3 生态与「10 分钟上手」。

## 安装

在**本目录**下（或从仓库根进入 `diffsense/examples/diffsense-rules-example`）：

```bash
pip install -e .
```

## 使用

安装后，`diffsense audit` 与 `diffsense replay` 会**自动合并**本包规则，无需 `--rules`：

```bash
diffsense replay /path/to/any.diff --format json
diffsense rules list   # 列表中应包含 example.custom.*
```

也可与主仓库规则一起使用；插件规则与内置/`--rules` 规则合并后统一按 profile 过滤。

## 结构

- `diffsense_rules_example/__init__.py`：`get_rules()` 返回本包内 `rules/` 目录路径。
- `diffsense_rules_example/rules/example.yaml`：1～2 条示例 YAML 规则（与 [rule-plugins.md](../../docs/rule-plugins.md) 契约一致）。

## 自定义

复制本目录，修改 `pyproject.toml` 中 `name` 与 entry point 名称，在 `rules/*.yaml` 中增删改规则，然后 `pip install -e .` 即可。
