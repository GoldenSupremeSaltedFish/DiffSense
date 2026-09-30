# DiffSense 双产物并排布局与流水线改造设计

- 日期：2026-09-30
- 状态：已与用户逐条确认，待用户审阅本 spec
- 目标分支：`main`
- 关联历史：PR #44（`chore/ci/split-vscode-image`，合并为 `0d3a9bf`）

## 1. 背景与现状

DiffSense 现在需要同时交付两个产物：**Docker 镜像**（Java 分析器重构后改由镜像承载）与 **VS Code 插件包（VSIX）**。二者的源码此前被拆到了不同位置，导致 `main` 上的 CI 无法同时产出这两个产物。

### 1.1 main 的真实结构（`0d3a9bf`）

顶层：`.github`、`diffsense`、`docs`、`examples`、`scripts`、`technical_documentation`、`tests`、`website`、`website-app` 及若干根级文件。

- **没有 `vscode-extension/` 目录**
- **没有任何 `pom.xml`**（递归搜索为空）

### 1.2 插件源码的去向（关键事实）

`vscode-extension/` 不是"从未存在"，而是被 `main` 主动删除的：

```
40b3676 chore: remove vscode-extension from release branch (moved to branch vscode-extension)
```

全仓仅 4 个提交触及该路径：`313bc07`（初始化扩展项目结构）→ `eaa7b8b`（CI 适配新项目结构）→ `2a84423` / `40b3676`（在 release 线与 main 上删除）。

`origin/vscode-extension` 分支的 HEAD 为 `ad3369c`，**该提交已是 `main` 的祖先**（`main` 领先 142 个提交，该分支领先 0 个）。

> 由此可得：`git merge origin/vscode-extension` 是**空操作**（`Already up to date`），不会把目录带回 main。要复现"合并"的效果，实际动作是**从该分支恢复目录**。

恢复源 `ad3369c` 下 `vscode-extension/` 的结构：

```
vscode-extension/
├── pom.xml          # Java 分析器 Maven 根（mvn clean package）
├── plugin/          # VS Code 插件：package.json / src / ui / analyzers / cli-adapter.js / scripts
├── ui/              # diffsense-frontend（Vite，产出 dist）+ node/golang/regression analyzer
├── src/             # 前端源码：App.tsx / components / pages / hooks
└── scripts/
```

### 1.3 现存 4 条 workflow 的问题

| 文件 | 现状 | 问题 |
| --- | --- | --- |
| `build.yaml`（DiffSense CI） | 假设 `vscode-extension/` 存在，含 mvn + 前端 + VSIX + 同步子仓库 | `Set up JDK`（`setup-java@v3`, `cache: maven`）报 `No file ... matched to [**/pom.xml]`，job 在第一步即失败，后续 step 全部 0s 未执行 |
| `diffsense-vscode.yml` | PR #44 新增 | 触发分支为 `vscode-extension`；构建目录写成 `vscode`；`if: secrets.MARKETPLACE_PAT != ''` 属 GitHub 明文禁止的写法（`Unrecognized named-value: 'secrets'`），workflow 文件校验阶段即 Failure |
| `diffsense-image.yml` | PR #44 新增，push main/release/** → ghcr | 与 `docker-publish.yml` 发布职责重叠 |
| `docker-publish.yml` | tag `v*` → ghcr | 同上；另有 Node 20 弃用告警 |

`build.yaml` 中的 `test-diffsense` job（`Test DiffSense (Python)`）实测**成功**，可保留复用。

## 2. 已确认的决策

| 编号 | 决策 | 结论 |
| --- | --- | --- |
| D1 | 落位层次 | **A —— 源码/工作目录层面分置**：`main` 上并排保留 `diffsense/`（镜像侧）与 `vscode-extension/`（插件侧），各配一条独立 workflow |
| D2 | 插件源码落位 | 以 `origin/vscode-extension` 为源**恢复 `vscode-extension/` 目录**到 `main`（因 merge 为空操作）；只取该目录，不取其 `.github/` |
| D3 | 旧 `build.yaml` | **拆解后删除**：插件相关步骤归入 `diffsense-vscode.yml`，镜像相关归入 `diffsense-image.yml` |
| D4 | 插件线是否自建 Java | **是**：`vscode-extension/pom.xml` 仍执行 `mvn package` 产出 analyzer jar，随 VSIX 一起打包，插件线保留 JDK + Maven 环节（修正为在 `vscode-extension` 目录下执行） |
| D5 | 插件产物去向 | **仍推 `Diffsense-artifacts` 子仓库**（`dist/`、`ui/`、`analyzers/`、`*.vsix`），且同步步骤不得因缺 token 直接失败 |
| D6 | 发布闸门 | **对称**：两个产物都只在发版（tag `v*`）时发布；日常 push 只构建校验 |

## 3. 目标结构

```
main
├── diffsense/            # 镜像侧：Dockerfile、Dockerfile.ci、pyproject.toml、tests/ ...
├── vscode-extension/     # 插件侧：pom.xml、plugin/、ui/、src/、scripts/
├── .github/workflows/
│   ├── diffsense-image.yml     # 镜像线（唯一入口）
│   └── diffsense-vscode.yml    # 插件线（唯一入口）
└── docs/ ...             # 其余保持不动
```

`diffsense/` 内容在本设计中**不做任何改动**。

## 4. 流水线设计

### 4.1 文件布局：4 → 2

| 文件 | 处置 |
| --- | --- |
| `diffsense-image.yml` | 保留并重写为镜像线唯一入口，吸收 `docker-publish.yml` 的发版推送职责 |
| `diffsense-vscode.yml` | 保留并重写为插件线唯一入口，蓝本为 `ad3369c:.github/workflows/build.yaml`（该版本已适配 `vscode-extension/` 目录） |
| `build.yaml` | 拆解后删除 |
| `docker-publish.yml` | 删除 |

### 4.2 触发矩阵

| 事件 | 镜像线 `diffsense-image.yml` | 插件线 `diffsense-vscode.yml` |
| --- | --- | --- |
| push `main` / `release/**` | 构建校验，**不推** ghcr | 构建 + 上传 Actions artifact，**不推**子仓库 |
| tag `v*` | 构建 + 推 `ghcr.io/<owner>/diffsense:<version>` 与 `:latest` | 构建 + 推 `Diffsense-artifacts` |
| PR 目标 `main` / `release/**` | 构建校验 | 构建校验 |
| `workflow_dispatch` | 手动可用 | 手动可用 |

### 4.3 镜像线（`diffsense-image.yml`）

Job 划分：

1. `test-diffsense` —— 沿用 `build.yaml` 中已验证可用的配置
   - `actions/checkout@v4`、`actions/setup-python@v5`、Python `3.10`
   - `pip install -e "diffsense[dev]"` → `python -m pytest diffsense/tests/ -v`
2. `build-image` —— 构建镜像
   - context `./diffsense`，dockerfile `./diffsense/Dockerfile.ci`
   - `permissions: contents: read, packages: write`
   - 仅 tag `v*` 时执行 `docker push` 与 `ghcr.io` 登录；日常 push 仅构建
   - 标签：版本标签（自 tag 取得）+ `latest`
3. `publish-pypi` —— 仅在 tag `v*` 时运行
   - job 级 `if: startsWith(github.ref, 'refs/tags/v')`（仅使用 `github` 上下文，合法）
   - 首个 step 将 `secrets.PYPI_API_TOKEN` 读入 env 并判空，输出布尔标志
   - 发布 step 以 `if: steps.guard.outputs.ok == 'true'` 门控；**缺 token 时跳过并告警，不失败**

### 4.4 插件线（`diffsense-vscode.yml`）

Job `build-vscode`，步骤链直接沿用已被验证过的旧流水线（`ad3369c` 版 `build.yaml`）：

| 步骤 | 要点 |
| --- | --- |
| Checkout | `actions/checkout@v4` |
| Set up JDK | `actions/setup-java@v4`，Temurin 17，`cache: maven` |
| Build Java Analyzer | `working-directory: vscode-extension` → `mvn clean package -DskipTests` |
| Setup Node.js | `actions/setup-node@v4`，Node 18，`cache: npm`，`cache-dependency-path` 指向 `vscode-extension/ui/diffsense-frontend/package-lock.json` 与 `vscode-extension/plugin/package-lock.json` |
| Build Frontend | `working-directory: vscode-extension/ui/diffsense-frontend` → `npm install && npm run build`，产出 `dist/` |
| Build VSCode Extension | `working-directory: vscode-extension/plugin` → `npm install && npm run build` |
| Prepare Release Folder | `working-directory: vscode-extension/plugin` → `npm run prepare-release` |
| Package VSIX | `working-directory: vscode-extension/plugin/release` → `npx vsce package --no-yarn` |
| Get Version | 从 `vscode-extension/plugin/package.json` 读 `version` 写入 `$GITHUB_ENV` |
| Upload Build Artifacts | `actions/upload-artifact@v4`，**所有触发都执行**；路径为 `plugin/release/analyzers/`、`plugin/release/ui/`、`plugin/release/*.vsix` |
| Sync Artifacts to Sub Repository | **仅 tag `v*`** 且 token 可用时执行，推送到 `GoldenSupremeSaltedFish/Diffsense-artifacts` |

需要固定在 workflow 顶层的环境变量（沿用旧值，均指向恢复后的目录）：

```yaml
env:
  PLUGIN_DIR: ${{ github.workspace }}/vscode-extension/plugin
  UI_DIR: ${{ github.workspace }}/vscode-extension/ui
  FRONTEND_DIST: ${{ github.workspace }}/vscode-extension/ui/diffsense-frontend/dist
  FRONTEND_TARGET: ${{ github.workspace }}/vscode-extension/plugin/ui/diffsense-frontend
  VITE_OUT_DIR: dist
```

### 4.5 必须修复的三个问题

1. **非法 `if` 写法**：删除所有在 `if` 中引用 `secrets` 的条件（`diffsense-vscode.yml` 的 `if: secrets.MARKETPLACE_PAT != ''` 即刻删除，Marketplace 发布不在本次范围）。需要按凭据有无门控时，统一改为"step 内 shell 判空 → 写入 `$GITHUB_OUTPUT` → 后续 step 用 `if: steps.x.outputs.y`"。
2. **缺 token 硬失败**：旧脚本在 `ARTIFACTS_TOKEN` 为空时 `exit 1`。改为打印告警并 `exit 0` 跳过，保证缺凭据不阻断流水线。
3. **弃用告警**：`checkout@v3`、`setup-java@v3`、`setup-node@v3` 全部升级到 `v4`，消除 Node 20 运行时弃用告警。

### 4.6 涉及的外部凭据

| Secret | 用途 | 缺失时行为 |
| --- | --- | --- |
| `ARTIFACTS_TOKEN` | 推送 `Diffsense-artifacts` 子仓库 | 跳过该步骤 + 告警，job 不失败 |
| `PYPI_API_TOKEN` | 发布 PyPI 包 | 跳过该 job + 告警，流水线不失败 |

`GITHUB_TOKEN` 用于 ghcr 登录（`packages: write`），无需额外配置。

## 5. 提交计划

均在新分支上完成，通过 PR 合入 `main`（保持分支保护：Require PR、禁 force push、禁删除）。

1. `chore: restore vscode-extension/ into main alongside diffsense/`
   - 仅从 `origin/vscode-extension` 恢复 `vscode-extension/` 目录（约 172 个文件），不带回该分支的 `.github/`
2. `ci: split pipelines into image and vscode lines`
   - 重写 `diffsense-image.yml`、`diffsense-vscode.yml`
   - 删除 `build.yaml`、`docker-publish.yml`
3. `docs: update ci.md for dual-artifact layout`
   - 同步 `docs/ci.md` 说明

## 6. 风险与验证

- **源码陈旧**：恢复的插件源码停留在 142 个提交之前。它与 `main` 的 `diffsense/` 无路径耦合，但首跑大概率仍需一到两轮迭代才能全绿，属预期内。
- **验证顺序**：先本地校验 workflow YAML 语法与路径引用，再推分支观察两条线的运行结果，确认全绿后才合入 `main`。
- **分支保护**：全程走 PR，不直接 push `main`。

## 7. 非目标

- 不重构 `diffsense/` 的任何内容
- 不接入 VS Code Marketplace 发布
- 不调整 `Diffsense-artifacts` 子仓库自身的结构
- 不修改 `vscode-extension/` 内的业务代码（仅在其上运行 CI）

## 8. 验收标准

1. `main` 上同时存在 `diffsense/` 与 `vscode-extension/` 两个目录
2. `.github/workflows/` 下只剩 `diffsense-image.yml` 与 `diffsense-vscode.yml` 两条业务流水线
3. push `main` / `release/**` 时两条流水线均绿：镜像线构建通过、插件线构建通过并上传 artifact
4. tag `v*` 时镜像线推送 ghcr 成功、插件线同步 `Diffsense-artifacts` 成功
5. 任何一条流水线在缺 `ARTIFACTS_TOKEN` / `PYPI_API_TOKEN` 时不因凭据缺失而失败