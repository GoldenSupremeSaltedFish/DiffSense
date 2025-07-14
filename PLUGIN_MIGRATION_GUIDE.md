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
├── plugin/                    # 插件源代码（保留）
├── ui/                       # 前端 UI 组件
├── src/main/java/           # Java 后端分析器
└── ...

产物仓库 (Diffsense-artifacts):
├── dist/                     # 编译后的 TypeScript 代码
├── ui/                      # 前端构建产物
├── analyzers/               # 分析器运行时文件
├── *.vsix                   # 打包的插件文件
├── runtime-config.json      # 运行时配置
└── package.json            # 插件元数据
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

### 第二步：创建产物仓库

1. **在 GitHub 上创建新仓库**
   - 仓库名：`Diffsense-artifacts`
   - 可见性：Public（或根据需要选择 Private）
   - 可以初始化空的 README

2. **配置产物仓库**
   ```bash
   # 克隆空的产物仓库
   git clone https://github.com/GoldenSupremeSaltedFish/Diffsense-artifacts.git
   cd Diffsense-artifacts
   
   # 添加基本说明
   echo "# DiffSense Plugin Artifacts" > README.md
   echo "This repository contains production-ready plugin artifacts." >> README.md
   git add README.md
   git commit -m "Initial commit"
   git push origin main
   ```

### 第三步：配置主仓库的 CI/CD

1. **更新插件的 CI 配置**
   - 使用已生成的 `plugin/.github/workflows/ci.yml` 文件
   - 该配置会自动构建产物并推送到 artifacts 仓库

2. **构建本地产物**
   ```bash
   cd DiffSense
   
   # 使用专门的产物构建脚本
   ./build-artifacts-only.bat
   
   # 验证产物结构
   ls plugin/artifacts-output/
   ```

### 第四步：首次部署产物

1. **手动推送首个产物**
   ```bash
   cd plugin/artifacts-output
   
   # 初始化为 git 仓库
   git init
   git remote add origin https://github.com/GoldenSupremeSaltedFish/Diffsense-artifacts.git
   
   # 推送产物
   git add .
   git commit -m "Initial plugin artifacts"
   git push -u origin main
   ```

2. **验证产物可用性**
   ```bash
   # 克隆产物仓库进行测试
   git clone https://github.com/GoldenSupremeSaltedFish/Diffsense-artifacts.git test-artifacts
   cd test-artifacts
   
   # 在 VS Code 中打开并按 F5 测试
   code .
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

### 开发和测试
```bash
# 1. 修改源代码后构建产物
./build-artifacts-only.bat

# 2. 本地测试产物
cd plugin/artifacts-output
code .  # 在 VS Code 中按 F5 调试

# 3. 安装 VSIX 测试
code --install-extension plugin/artifacts-output/*.vsix
```

### 部署到产物仓库
```bash
# 方法 1：通过 CI/CD 自动部署
git add .
git commit -m "Update plugin features"
git push  # 触发 CI/CD，自动推送产物

# 方法 2：手动推送产物
cd plugin/artifacts-output
git init
git remote add origin https://github.com/GoldenSupremeSaltedFish/Diffsense-artifacts.git
git add .
git commit -m "Manual artifacts update"
git push origin main --force
```

### 使用产物进行独立开发
```bash
# 克隆产物仓库
git clone https://github.com/GoldenSupremeSaltedFish/Diffsense-artifacts.git
cd Diffsense-artifacts

# 直接调试和测试
code .  # 按 F5 即可调试，无需编译
```

## 📊 CI/CD 流程

### 主仓库 CI/CD
- 构建 Java 分析器
- 构建前端 UI
- 构建 Node.js 和 Golang 分析器
- 编译插件 TypeScript 代码
- 打包 VSIX 文件
- 生成完整的可调试产物结构
- 自动推送产物到 artifacts 仓库

### 产物仓库特点
- 包含所有运行时依赖
- 保持与源码相同的目录结构
- 支持独立调试（按 F5 即可）
- 不含源码，只有编译产物
- 可直接安装 VSIX 进行测试

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