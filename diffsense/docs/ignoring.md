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

## 行内忽略（Inline Ignore）

在源码中单行注释可忽略当前行/块对应的规则：

```java
// diffsense-ignore: runtime.concurrency.lock_removed
synchronized (lock) { ... }
```

仅对标注的规则生效，不影响其他规则。
