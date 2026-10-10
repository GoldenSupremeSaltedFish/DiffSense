# DiffSense 版本信息输出说明

## 概述

从 v2.2.5 开始，DiffSense 在 CICD 日志中会显示详细的版本信息和构建信息，便于：
- 确认正在运行的 DiffSense 版本
- 追踪代码提交记录
- 诊断版本相关问题

## 输出格式

### 完整的 Banner 输出

当 DiffSense 在 CICD 中运行时，会在日志开头显示：

```

  ____  _     _ _____ _____ ____ _____
 |  _ \(_) __| |  ___|  _|  ___| ____|
 | | | | |/ _` | |_  | |_  \___ \  _|
 | |_| | | (_| |  _| |  _|  ___) | |___
 |____/|_|\__,_|_|   |_|   |____/|_____|

 :: DiffSense - MR/PR Risk Audit for CI/CD ::
 :: Version: v2.2.5
 :: Commit:  f3d933f
 :: Built:   2026-03-23 15:30:45

============================================================
🚀 DIFFSENSE AUDIT STARTING
============================================================
📋 Platform: GitLabAdapter
📋 Profile: strict
📋 Rules path: config/rules.yaml
📋 Pro rules: config/pro-rules
============================================================

Fetching diff...
```

### 输出字段说明

#### Banner 部分

- **Version**: DiffSense 的版本号（例如：`v2.2.5`）
  - 来源：`pyproject.toml` 中的 `project.version`
  - 用于确认安装的 DiffSense 版本

- **Commit**: Git 提交的短 hash（例如：`f3d933f`）
  - 来源：`git rev-parse --short HEAD`
  - 用于追踪具体的代码提交
  - 如果无法获取 git 信息，显示 `unknown`

- **Built**: 构建日期时间（例如：`2026-03-23 15:30:45`）
  - 来源：运行时的系统时间
  - 格式：`YYYY-MM-DD HH:MM:SS`
  - 用于确认构建时间

#### 审计启动信息部分

- **Platform**: 使用的平台适配器
  - 可能值：`GitHubAdapter`, `GitLabAdapter`
  - 用于确认运行环境

- **Profile**: 使用的规则配置文件
  - 可能值：`default`, `strict`, `lightweight` 等
  - 用于确认规则配置

- **Rules path**: 规则配置文件路径
  - 用于诊断规则加载问题

- **Pro rules**: 超级规则路径（如果配置了）
  - 用于确认是否加载了额外的规则

## 版本信息用途

### 1. 确认 CICD 使用的版本

在 GitLab CI 或 GitHub Actions 日志中，检查第一行输出：

```
:: Version: v2.2.5
```

如果显示的版本不是预期的，可能需要：
- 更新 Docker 镜像标签
- 重新安装 Python 包
- 检查 CI/CD 配置

### 2. 追踪代码提交

使用 Commit hash 可以在 GitHub 上查看具体的代码变更：

```bash
# 查看提交详情
git show f3d933f

# 或在 GitHub 上访问
https://github.com/GoldenSupremeSaltedFish/DiffSense/commit/f3d933f
```

### 3. 诊断版本问题

如果遇到问题，提供以下信息给支持团队：
- Version: `v2.2.5`
- Commit: `f3d933f`
- Built: `2026-03-23 15:30:45`

这样可以精确定位代码版本。

## 实际 CICD 输出示例

### GitHub Actions

```yaml
Run DiffSense Audit
  Starting...
  
  ____  _     _ _____ _____ ____ _____
 |  _ \(_) __| |  ___|  _|  ___| ____|
 | | | | |/ _` | |_  | |_  \___ \  _|
 | |_| | | (_| |  _| |  _|  ___) | |___
 |____/|_|\__,_|_|   |_|   |____/|_____|

 :: DiffSense - MR/PR Risk Audit for CI/CD ::
 :: Version: v2.2.5
 :: Commit:  f3d933f
 :: Built:   2026-03-23 15:30:45

============================================================
🚀 DIFFSENSE AUDIT STARTING
============================================================
📋 Platform: GitHubAdapter
📋 Profile: strict
📋 Rules path: config/rules.yaml
============================================================

Fetching diff...
✅ Diff fetched successfully
...
```

### GitLab CI

```bash
Running with gitlab-runner 18.6.1
...
$ diffsense audit --platform gitlab ...

  ____  _     _ _____ _____ ____ _____
 |  _ \(_) __| |  ___|  _|  ___| ____|
 | | | | |/ _` | |_  | |_  \___ \  _|
 | |_| | | (_| |  _| |  _|  ___) | |___
 |____/|_|\__,_|_|   |_|   |____/|_____|

 :: DiffSense - MR/PR Risk Audit for CI/CD ::
 :: Version: v2.2.5
 :: Commit:  f3d933f
 :: Built:   2026-03-23 15:30:45

============================================================
🚀 DIFFSENSE AUDIT STARTING
============================================================
📋 Platform: GitLabAdapter
📋 Profile: strict
📋 Rules path: config/rules.yaml
============================================================

Fetching diff...
✅ Diff fetched successfully
...
```

## 版本历史

### v2.2.5 (当前版本)
- ✅ 增强 Banner 输出，显示详细版本信息
- ✅ 添加 Commit hash 显示
- ✅ 添加构建时间显示
- ✅ 添加审计启动信息（平台、配置等）

### v2.2.4 及之前
- 仅显示简单的版本号
- 无 Commit 信息
- 无构建时间

## 配置说明

### Docker 镜像

Docker 镜像会自动包含版本信息。确保使用正确的标签：

```yaml
# GitLab CI 示例
diffsense_check:
  image: ghcr.io/goldensupremesaltedfish/diffsense:v2.2.5
  # ...
```

### Python 包安装

如果通过 pip 安装，版本信息来自 `pyproject.toml`：

```bash
pip install diffsense==2.2.5
```

### 开发环境

在开发环境中，版本号可能显示为安装时的版本。确保 `pyproject.toml` 中的版本正确：

```toml
[project]
name = "diffsense"
version = "2.2.5"
```

## 故障排查

### 问题 1：版本号显示为 unknown 或 1.0.0

**原因**: 包未正确安装或版本未更新

**解决方法**:
```bash
# 重新安装
pip uninstall diffsense
pip install -e .

# 验证版本
diffsense --version
```

### 问题 2：Commit hash 显示为 unknown

**原因**: 
- 不在 git 仓库中运行
- git 命令不可用
- 权限问题

**解决方法**: 这是正常的，版本信息仍然有效。

### 问题 3：Docker 镜像中版本不对

**原因**: Docker 镜像构建时使用了旧的代码

**解决方法**:
1. 等待 Docker 镜像重新构建
2. 使用特定的版本标签而不是 `latest`
3. 检查 GitHub Actions 构建日志

## 验证版本

### 本地验证

```bash
# 方法 1: 查看 banner
diffsense --help

# 方法 2: 查看安装的版本
pip show diffsense

# 方法 3: Python 代码
python -c "from importlib.metadata import version; print(version('diffsense'))"
```

### CICD 验证

在 CI/CD 日志中查找：
```
:: Version: v2.2.5
```

## 相关文档

- [CICD 输出增强文档](CICD_OUTPUT_ENHANCEMENTS.md)
- [Release Notes v2.2.5](RELEASE_NOTES_v2.2.5.md)
- [GitLab CI 更新指南](GITLAB_CI_UPDATE.md)

---

*Last updated: 2026-03-23*
