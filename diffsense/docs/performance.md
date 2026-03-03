# 性能与达标（Q2 DoD）

本文档对应路线图 Q2「性能极限」的完成标志：冷/热启动可测、规则执行比例可压到 30% 以下。

---

## 1. 中型 PR 口径

- **定义**：单次 MR/PR 变更 **5～15 个文件**，单文件 diff 行数 **&lt; 500 行**，以 Java/Kotlin 等需 AST 解析的语言为主。
- **目标**：此类 MR 下，DiffSense 单次 run（replay/audit）**&lt; 5s**（DoD：冷启动 &lt; 10s，热启动 &lt; 3s）。

---

## 2. 冷启动 / 热启动测量方法

### 冷启动（无 cache）

1. 清空缓存：删除 `~/.diffsense`（或 `DIFFSENSE_CACHE_DIR` 所指目录），或使用全新环境。
2. 执行一次 replay 或 audit（同一 diff 只跑一次）：
   ```bash
   # 示例：使用单 diff 测
   time python main.py tests/fixtures/ast_cases/p0_concurrency.diff --format json
   ```
3. 记录 **real** 时间（或 CI 中该 job 总耗时），即为冷启动耗时。
4. **当前典型值**：在 1 个 Java diff、约 40 条规则下，冷启动约 **2～6s**（视机器与规则数）。目标 &lt; 10s 已满足；若未满足可在 CI 中启用 cache（见 [ci-cache.md](ci-cache.md)）后复测。

### 热启动（有 cache）

1. 不删 cache，对**同一 diff** 再跑一次：
   ```bash
   time python main.py tests/fixtures/ast_cases/p0_concurrency.diff --format json
   ```
2. 记录 **real** 时间。Diff/AST 命中后应明显缩短。
3. **当前典型值**：热启动约 **&lt; 3s**。Performance Report 中「Diff Cache Hit / AST Cache Hit」接近 100% 即表示热路径生效。

### 达标结论

- **冷启动 &lt; 10s**：在「中型 PR」口径下，通过清空 cache 后单次 run 测量，当前实现可满足；若个别超大 diff 超 10s，建议在 CI 中启用 cache 或缩小 diff 范围。
- **热启动 &lt; 3s**：同一 diff 二次 run 在 cache 命中下可满足。

### 自动化断言（CI / 脚本）

使用 CLI 命令 **`diffsense benchmark-cold-hot`** 可自动跑冷/热两次并写出耗时与达标结果，便于 CI 或本地复现：

```bash
# 使用仓库内 fixture 或任意 .diff 文件
diffsense benchmark-cold-hot tests/fixtures/ast_cases/p0_concurrency.diff --output benchmark-cold-hot-result.json

# 若超过阈值则退出码 1（可用于 CI 门禁，建议先以 warning 观察）
diffsense benchmark-cold-hot tests/fixtures/ast_cases/p0_concurrency.diff --fail-if-over --cold-threshold 10 --hot-threshold 3
```

输出 JSON 含 `cold_s`、`hot_s`、`cold_ok`、`hot_ok` 及阈值，CI 可解析该文件做门禁或仅上报。在 **test.yml** 中可增加可选 job（如 `continue-on-error: true`）跑上述命令并上传 `benchmark-cold-hot-result.json` 作为制品。

---

## 3. 将规则执行比例压到 30% 以下（DoD：rule 执行数量 &lt; 30%）

输出中的「Rules executed: x / y (z%)」即执行比例。若 z &gt; 30%，可按下述方式压到 30% 以下。

### 3.1 使用 `--profile lightweight`（推荐）

- **lightweight**：仅启用 **severity = critical** 的规则，规则总数 y 显著减少，执行数 x 也减少，比例通常 **&lt; 30%**（且只跑关键规则，速度更快）。
- 示例：
  ```bash
  diffsense replay your.diff --profile lightweight
  # 或 audit 时
  diffsense audit --platform github ... --profile lightweight
  ```

### 3.2 使用 `--rules` 指定少量规则

- 仅加载某一条或少量 YAML 规则文件，减少总规则数，从而降低执行比例。
- 示例：`diffsense replay your.diff --rules config/critical-only.yaml`

### 3.3 仓库内忽略 + language/scope

- 在 `diffsense-ignore.yaml` 或 `.diffsense.yaml` 中按 **rule + files** 忽略非关键路径（见 [ignoring.md](ignoring.md)）。
- 规则侧通过 **language**、**scope** 只匹配部分文件，scheduler 会跳过不匹配的规则，从而减少 executed_count。

### 验收

- 使用 `--profile lightweight` 跑典型 Java MR 的 diff，查看 stderr 或 HTML 中「Rules executed: x / y (z%)」，z 应 &lt; 30%。
- 若仍 &gt; 30%，可再配合 `--rules` 或忽略文件缩小规则集。
