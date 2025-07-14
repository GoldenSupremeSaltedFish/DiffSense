# DiffSense Plugin 子仓库迁移指南

## 📋 概述

本指南将帮助您将 DiffSense 项目的 `plugin/` 目录拆分为独立的子仓库，实现更好的代码组织和 CI/CD 管理。

## 🎯 拆分目标

### 拆分前的结构
```
DiffSense/
├── plugin/                    # VSCode 插件 (将要拆分)
├── ui/                       # 前端 UI 组件
├── src/main/java/           # Java 后端分析器
└── ...                      # 其他文件
```

### 拆分后的结构
```
主仓库 (DiffSense):
├── plugin/                    # 作为 subtree 引用子仓库
├── ui/                       # 前端 UI 组件
├── src/main/java/           # Java 后端分析器
└── ...

子仓库 (DiffSense-Plugin):
├── analyzers/                # 各语言分析器
├── ui/                      # 插件内嵌 UI
├── src/                     # 插件源代码
├── .github/workflows/       # 独立的 CI/CD
└── ...
```

## 🚀 迁移步骤

### 第一步：准备工作

1. **确保所有更改已提交**
   ```bash
   git status
   git add .
   git commit -m "Prepare for plugin subtree migration"
   ```

2. **备份当前项目**
   ```bash
   git clone https://github.com/GoldenSupremeSaltedFish/DiffSense.git DiffSense-backup
   ```

### 第二步：创建 Plugin 子仓库

1. **在 GitHub 上创建新仓库**
   - 仓库名：`DiffSense-Plugin`
   - 可见性：Public（或根据需要选择 Private）
   - 不要初始化 README、.gitignore 或 License

2. **提取 plugin 目录的历史**
   ```bash
   cd DiffSense
   
   # 创建包含 plugin 历史的新分支
   git subtree split --prefix=plugin -b plugin-split
   
   # 推送到新的子仓库
   git push https://github.com/GoldenSupremeSaltedFish/DiffSense-Plugin.git plugin-split:main
   ```

### 第三步：配置子仓库

1. **克隆并配置子仓库**
   ```bash
   git clone https://github.com/GoldenSupremeSaltedFish/DiffSense-Plugin.git
   cd DiffSense-Plugin
   
   # 验证文件结构
   ls -la
   ```

2. **添加 GitHub Actions 配置**
   - 使用已生成的 `.github/workflows/ci.yml` 文件
   - 确保所有路径正确（相对于子仓库根目录）

### 第四步：配置主仓库使用 Subtree

1. **删除原有 plugin 目录**
   ```bash
   cd DiffSense
   git rm -r plugin
   git commit -m "Remove plugin directory for subtree conversion"
   ```

2. **添加 plugin 作为 subtree**
   ```bash
   git subtree add --prefix=plugin https://github.com/GoldenSupremeSaltedFish/DiffSense-Plugin.git main --squash
   ```

3. **验证 subtree 配置**
   ```bash
   git log --oneline -5  # 应该看到 subtree 相关的提交
   ls plugin/            # 验证文件是否正确
   ```

### 第五步：配置 CI/CD

1. **在主仓库中配置 ARTIFACTS_TOKEN**
   - 进入主仓库设置: Settings → Secrets and variables → Actions
   - 添加名为 `ARTIFACTS_TOKEN` 的 repository secret
   - 值为之前生成的 Fine-grained Token

2. **在子仓库中配置相同的 Token**
   - 进入子仓库设置: Settings → Secrets and variables → Actions
   - 添加名为 `ARTIFACTS_TOKEN` 的 repository secret
   - 使用相同的 Token 值

## 🛠️ 日常使用工作流

### 更新 Plugin（从子仓库拉取）
```bash
# 方法 1：使用管理脚本
./scripts/subtree-management.bat
# 选择选项 2

# 方法 2：手动命令
git subtree pull --prefix=plugin https://github.com/GoldenSupremeSaltedFish/DiffSense-Plugin.git main --squash
```

### 推送 Plugin 更改（到子仓库）
```bash
# 方法 1：使用管理脚本
./scripts/subtree-management.bat
# 选择选项 3

# 方法 2：手动命令
git subtree push --prefix=plugin https://github.com/GoldenSupremeSaltedFish/DiffSense-Plugin.git main
```

### 构建完整项目
```bash
# 使用新的构建脚本
./build-all-subtree.bat
```

## 📊 CI/CD 流程

### 主仓库 CI/CD
- 构建 Java 分析器
- 构建前端 UI
- 集成测试
- 推送 Plugin 更改到子仓库（如果有变化）

### 子仓库 CI/CD
- 测试插件代码
- 构建 VSIX 包
- 部署前端到 artifacts 仓库
- 自动发布到 VSCode Marketplace（可选）

## 🔧 故障排除

### 常见问题

1. **Subtree pull 失败**
   ```bash
   # 原因：本地有未提交的更改
   # 解决：先提交本地更改
   git add .
   git commit -m "Save local changes"
   git subtree pull --prefix=plugin https://github.com/GoldenSupremeSaltedFish/DiffSense-Plugin.git main --squash
   ```

2. **Subtree push 失败**
   ```bash
   # 原因：子仓库有新的提交
   # 解决：先拉取子仓库更新
   git subtree pull --prefix=plugin https://github.com/GoldenSupremeSaltedFish/DiffSense-Plugin.git main --squash
   git subtree push --prefix=plugin https://github.com/GoldenSupremeSaltedFish/DiffSense-Plugin.git main
   ```

3. **构建路径错误**
   ```bash
   # 检查 package.json 中的路径配置
   # 确保相对路径正确
   ```

### 紧急恢复

如果迁移过程中出现问题：

1. **恢复到备份**
   ```bash
   cd ..
   rm -rf DiffSense
   cp -r DiffSense-backup DiffSense
   cd DiffSense
   ```

2. **重置 subtree**
   ```bash
   # 使用管理脚本的强制重置功能
   ./scripts/subtree-management.bat
   # 选择选项 5
   ```

## 📚 参考命令

### Git Subtree 命令参考
```bash
# 添加 subtree
git subtree add --prefix=<本地路径> <仓库URL> <分支> --squash

# 拉取 subtree 更新
git subtree pull --prefix=<本地路径> <仓库URL> <分支> --squash

# 推送 subtree 更改
git subtree push --prefix=<本地路径> <仓库URL> <分支>

# 分离 subtree 历史
git subtree split --prefix=<本地路径> -b <新分支名>
```

### 工具脚本
- `build-all-subtree.bat` - 完整构建脚本（支持 subtree）
- `scripts/subtree-management.bat` - Subtree 管理工具
- `check-build.bat` - 构建验证脚本

## ✅ 迁移完成检查清单

- [ ] 子仓库创建成功并包含完整的 plugin 代码
- [ ] 主仓库成功配置 subtree 引用
- [ ] CI/CD 配置正确，Token 已配置
- [ ] 构建脚本运行正常
- [ ] Plugin 可以正常打包为 VSIX
- [ ] 前端可以部署到 artifacts 仓库
- [ ] Subtree 拉取和推送功能正常
- [ ] 团队成员了解新的工作流程

## 🎉 迁移后的优势

1. **CI/CD 简化**：插件和主项目的 CI/CD 独立运行
2. **开发效率**：插件开发者可以专注于插件代码
3. **版本管理**：插件可以独立版本控制和发布
4. **资源优化**：避免不必要的构建和测试
5. **团队协作**：不同团队可以独立维护不同组件

---

**注意**：完成迁移后，建议团队成员重新克隆项目或更新本地仓库，以确保使用新的 subtree 结构。 