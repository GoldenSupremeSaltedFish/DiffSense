# DiffSense Plugin 独立调试指南

## 概述

Plugin模块设计为可以完全独立于主项目进行自主调试的模块。本文档说明如何在不依赖外部资源的情况下进行插件开发和调试。

## 独立调试要求

### ✅ 当前已满足的要求

1. **完整的项目结构**
   - 独立的`package.json`配置
   - 完整的TypeScript配置(`tsconfig.json`)
   - 独立的依赖管理(`node_modules`)

2. **调试配置完备**
   - `.vscode/launch.json` - 配置了插件调试启动
   - `.vscode/tasks.json` - 配置了编译任务
   - 支持F5直接调试插件

3. **构建脚本完整**
   - `npm run compile` - TypeScript编译
   - `npm run watch` - 监听模式编译
   - `npm run prepare-package` - 准备打包资源

4. **资源自包含**
   - `analyzers/`目录包含所有分析器
   - `dist/`目录包含前端资源
   - JAR文件已复制到本地

### ⚠️ 需要改进的方面

1. **依赖外部资源**
   - `prepare-package.js`脚本依赖外部路径
   - 前端资源需要从外部复制

## 完全独立调试步骤

### 1. 环境准备

```bash
# 进入plugin目录
cd plugin

# 安装依赖
npm install

# 编译TypeScript
npm run compile
```

### 2. 资源准备

#### 方案A: 使用环境变量（推荐）
```bash
# 设置前端资源路径
set FRONTEND_DIST=C:\path\to\frontend\dist

# 准备打包资源
npm run prepare-package
```

#### 方案B: 复制资源到本地
```bash
# 创建本地资源目录
mkdir ui\diffsense-frontend\dist
mkdir ui\node-analyzer
mkdir ui\golang-analyzer
mkdir target

# 复制资源文件到对应目录
# 然后运行准备脚本
npm run prepare-package
```

### 3. 调试启动

#### 方法1: 使用VSCode调试
1. 在VSCode中打开plugin目录
2. 按F5启动调试
3. 新窗口会自动加载插件

#### 方法2: 命令行调试
```bash
# 监听模式编译
npm run watch

# 在另一个终端启动VSCode
code --extensionDevelopmentPath=.
```

### 4. 独立开发流程

```bash
# 1. 修改代码
# 2. 自动编译（watch模式）
# 3. 重新加载插件窗口
# 4. 测试功能
```

## 环境变量配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `FRONTEND_DIST` | 前端构建产物路径 | `../ui/diffsense-frontend/dist` |
| `NODE_ANALYZER_PATH` | Node.js分析器路径 | `../ui/node-analyzer` |
| `GOLANG_ANALYZER_PATH` | Golang分析器路径 | `../ui/golang-analyzer` |
| `JAVA_TARGET_PATH` | Java JAR文件路径 | `../target` |

## 常见问题

### Q: 前端资源不存在
**A:** 确保前端已构建，或设置`FRONTEND_DIST`环境变量指向正确的构建产物目录

### Q: 分析器文件缺失
**A:** 检查`analyzers/`目录是否包含所需的分析器文件，或从外部复制

### Q: 调试时插件不加载
**A:** 确保TypeScript编译成功，检查`dist/extension.js`是否存在

### Q: 打包失败
**A:** 运行`npm run prepare-package`确保所有资源都已准备就绪

## 最佳实践

1. **开发时使用watch模式**
   ```bash
   npm run watch
   ```

2. **调试前确保资源完整**
   ```bash
   npm run prepare-package
   ```

3. **使用环境变量管理资源路径**
   ```bash
   set FRONTEND_DIST=your\frontend\path
   ```

4. **定期清理和重建**
   ```bash
   npm run clean
   npm run build
   ```

## 验证独立性的检查清单

- [ ] 插件目录包含完整的`package.json`
- [ ] 所有依赖都在`node_modules`中
- [ ] TypeScript配置独立完整
- [ ] 调试配置正确设置
- [ ] 分析器文件在`analyzers/`目录中
- [ ] 前端资源在`dist/`目录中
- [ ] 可以通过F5直接调试
- [ ] 不依赖外部路径即可运行

## 总结

Plugin模块基本符合独立调试的要求，通过合理使用环境变量和本地资源复制，可以实现完全独立的开发和调试。建议在开发过程中优先使用环境变量方式，这样既保持了独立性，又保持了灵活性。 