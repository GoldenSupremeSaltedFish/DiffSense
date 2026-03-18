# DiffSense CLI

**定位**：PR 阶段的变更风险守门人（Change Risk Gate），针对当前 diff 判断是否引入回归风险。设计目标：少告警、高精度、低延迟、结果可解释。

---

## 快速开始

| 场景 | 操作 |
|------|------|
| **GitHub PR 审计** | 将 [quickstart 中的 GitHub workflow](docs/quickstart.md#方式一github-pull-request-审计) 复制到目标仓库的 `.github/workflows/diffsense.yml`，提交并创建/更新 PR 即可触发审计。 |
| **本地 diff 审计** | 执行 `pip install -e .` 后，运行 `diffsense replay <path-to-diff>`。 |

完整步骤与可选配置见 **[docs/quickstart.md](docs/quickstart.md)**。所有用户文档与契约索引见 **[docs/README.md](docs/README.md)**。

---

## 推荐配置（可选）

在仓库根目录添加 **`.diffsense.yaml`** 可启用 [官方推荐配置](docs/recommended-config.md)，适用于大多数团队，无需逐项调参。

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [docs/README.md](docs/README.md) | **文档总索引**（用户文档与契约列表） |
| [quickstart.md](docs/quickstart.md) | 快速开始：GitHub workflow 与本地审计步骤 |
| [recommended-config.md](docs/recommended-config.md) | 官方推荐配置与默认行为承诺 |
| [ignoring.md](docs/ignoring.md) | 忽略规则与误报处理 |
| [ci-cache.md](docs/ci-cache.md) | CI 缓存配置与使用 |
| [rule-quickstart.md](docs/rule-quickstart.md) | 自定义规则开发入门（10 分钟上手） |
| [signals.md](docs/signals.md) | Signal 列表（规则只消费，不产生） |
| [contribute-rules.md](docs/contribute-rules.md) | 贡献审计规则（上游 vs 插件） |

**10 分钟写一条规则：** [rule-quickstart.md](docs/rule-quickstart.md) · `diffsense signals`

---

## 开发与贡献

```bash
pip install -e ".[dev]"
pytest tests/ -v
```

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。
