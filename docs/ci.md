# CI & Branching for DiffSense

本文档说明 DiffSense 的流水线布局：`main` 上并排存在 `diffsense/`（镜像线）与 `vscode-extension/`（插件线），两条业务流水线各自独立构建与发布。

## 目录布局

| 路径 | 归属 | 主要产物 |
| --- | --- | --- |
| `diffsense/` | 镜像线 | Docker 镜像（GHCR）、PyPI 包 |
| `vscode-extension/` | 插件线 | VSIX 扩展包、子仓库产物同步 |

## 流水线

### 1. `.github/workflows/diffsense-image.yml` — 镜像线

| 事件 | 行为 |
| --- | --- |
| push `main` / `release/**` | 跑 Python 测试 → 构建镜像（不推送） |
| pull_request → `main` / `release/**` | 同上（构建验证） |
| push tag `v*` | 追加：推送镜像到 GHCR + 发布 PyPI |
| workflow_dispatch | 手动触发 |

job 链：`test-diffsense`（pytest）→ `build-image`（docker build；tag 时 push GHCR）→ `publish-pypi`（tag 时发布）。

镜像地址：`ghcr.io/<owner 小写>/diffsense:latest` 与 `ghcr.io/<owner 小写>/diffsense:<tag|sha>`。

### 2. `.github/workflows/diffsense-vscode.yml` — 插件线

| 事件 | 行为 |
| --- | --- |
| push `main` / `release/**` | 构建 Java 分析器 + 前端 + 插件，打包 VSIX（仅上传 artifact） |
| pull_request → `main` / `release/**` | 同上（构建验证） |
| push tag `v*` | 追加：同步产物到 `Diffsense-artifacts` 子仓库 |
| workflow_dispatch | 手动触发 |

步骤链：JDK 17（temurin，maven cache）→ `mvn -B clean package -DskipTests`（working-directory `vscode-extension`）→ Node 20 → 构建 `ui/diffsense-frontend` → 构建 `plugin` → `npm run prepare-release` → `npx vsce package --no-yarn` → 上传 VSIX artifact →（仅 tag）同步子仓库。

## 必需的仓库 Secrets

| Secret | 用途 | 缺失时行为 |
| --- | --- | --- |
| `PYPI_API_TOKEN` | 发布 PyPI 包 | 告警并跳过发布步骤，流水线不失败 |
| `ARTIFACTS_TOKEN` | 推送产物到 `Diffsense-artifacts` 子仓库 | 告警并跳过同步，流水线不失败 |

GHCR 推送使用内置 `GITHUB_TOKEN`，依赖 job 级 `packages: write` 权限，无需额外 secret。

## 发布约定

- 两条线均以 tag `v*` 作为唯一对外发布触发点（对称）。
- `main` / `release/**` 的 push 与 PR 只做构建验证，不产生对外发布。
- 不再有“main push 即同步产物”的旧行为。

## PR 修改 CI 时的检查清单

- [ ] workflow 文件可被 GitHub 解析（不使用 `if: secrets.*` 等非法写法）。
- [ ] 未配置可选 secret 时流水线仍能通过（告警跳过）。
- [ ] `vscode-extension/` 与 `diffsense/` 的路径引用与实际目录一致。
- [ ] 涉及发布的改动只在 tag `v*` 生效。