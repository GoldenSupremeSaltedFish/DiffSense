# 忽略配置（Ignore）

DiffSense 支持按「规则 + 文件」维度忽略部分检出，避免误报干扰。

## 配置文件约定

推荐在仓库根目录使用 **`diffsense-ignore.yaml`**（路线图规范名称）。以下名称按优先级只加载**一个**：

1. **diffsense-ignore.yaml**（推荐）
2. .diffsense.yaml
3. .diffsenseignore

若使用 **`.diffsense.yaml`**，可同时写入运行配置（profile、auto_tune 等），详见 [官方推荐配置与默认行为](recommended-config.md)。

## 格式示例

```yaml
ignore:
  # 某条规则在所有文件中忽略
  - rule: runtime.concurrency.lock_removed

  # 某条规则仅在指定文件模式中忽略
  - rule: runtime.stability.timeout_increased
    files:
      - "**/test/**"
      - "**/*_test.java"

  # 使用 id 等价于 rule
  - id: runtime.resource.retry_removed
    files: ["**/legacy/**"]
```

- **rule** / **id**：规则 ID，支持通配符（如 `runtime.*`）。
- **files**：可选，文件路径模式列表；省略则对该规则全局忽略。

## 全局跳过路径（skip_paths）

在 `rules.yaml` 中可以配置全局的文件跳过模式，作用于**所有规则**。这适用于需要统一排除的文件类型（如测试文件）。

```yaml
# config/rules.yaml
config:
  skip_paths:
    - "**/test/**"
    - "**/*Test*.java"
    - "**/spec/**"
    - "**/__tests__/**"
```

### 使用场景

| 场景 | 推荐方式 |
|------|----------|
| 单条规则排除特定文件 | 使用仓库级 `.diffsense.yaml` 的 `ignore` 配置 |
| 所有规则统一排除文件类型（如测试文件） | 使用 `rules.yaml` 的 `skip_paths` |
| 单行注释忽略 | 使用行内注释 `// diffsense-ignore: rule.id` |

### 开源贡献注意事项

- 修改 `skip_paths` 会影响所有用户，请确保修改是**通用且必要**的
- 修改单条规则的过滤逻辑（如 `rule.files`）仍然是推荐的贡献方式
- 详见 [贡献审计规则](contribute-rules.md)

## 行内忽略（Inline Ignore）

在源码中单行注释可忽略当前行/块对应的规则：

```java
// diffsense-ignore: runtime.concurrency.lock_removed
synchronized (lock) { ... }
```

仅对标注的规则生效，不影响其他规则。
