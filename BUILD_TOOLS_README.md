# DiffSense 构建工具使用说明

本文档包含了为 DiffSense 项目创建的完整构建和验证工具，确保不遗漏任何构建产物。

## 📁 文件清单

### 📋 主要文档
- **`PACKAGING_CHECKLIST.md`** - 详细的打包流程文档和检查清单
- **`BUILD_TOOLS_README.md`** - 本文档，工具使用说明

### 🛠️ 构建脚本
- **`build-all.bat`** - 一键完整构建脚本（Windows批处理）
- **`check-build.bat`** - 构建产物验证脚本（Windows批处理）

## 🚀 快速开始

### 🔍 检查当前状态
```bash
# 运行验证脚本检查哪些产物缺失
.\check-build.bat
```

### 🏗️ 完整构建流程
```bash
# 一键完成所有构建步骤
.\build-all.bat
```

### 📦 手动构建步骤
如果需要分步构建，请按以下顺序执行：

```bash
# 1. 构建 Java 分析器
mvn clean package -DskipTests

# 2. 构建前端应用
cd ui\diffsense-frontend
npm run build
cd ..\..

# 3. 准备分析器依赖
cd ui\node-analyzer && npm install && cd ..\..
cd ui\golang-analyzer && npm install && cd ..\..

# 4. 同步产物到插件目录
cd plugin
npm run prepare-package

# 5. 编译插件代码
npm run compile

# 6. 打包 VSIX
npm run package
```

## ✅ 验证清单

运行 `check-build.bat` 后，确保以下项目都显示 ✅：

### Java 分析器
- [ ] Java JAR 源文件存在 (`target/gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar`)
- [ ] Java JAR 插件文件存在 (`plugin/analyzers/gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar`)

### 前端构建产物
- [ ] 前端源文件存在 (`ui/diffsense-frontend/dist/index.html`)
- [ ] 前端插件文件存在 (`plugin/dist/index.html`)

### 分析器
- [ ] Node.js 源分析器存在 (`ui/node-analyzer/analyze.js`)
- [ ] Node.js 插件分析器存在 (`plugin/ui/node-analyzer/analyze.js`)
- [ ] Golang 源分析器存在 (`ui/golang-analyzer/analyze.js`)
- [ ] Golang 插件分析器存在 (`plugin/ui/golang-analyzer/analyze.js`)

### 插件编译产物
- [ ] 插件编译产物存在 (`plugin/dist/extension.js`)

## 🎯 典型使用场景

### 场景1：开发调试
```bash
# 检查状态
.\check-build.bat

# 如果有缺失，运行完整构建
.\build-all.bat

# 在 VS Code 中按 F5 开始调试
```

### 场景2：发布准备
```bash
# 完整构建并验证
.\build-all.bat
.\check-build.bat

# 确认所有项目都是 ✅ 后继续发布流程
```

### 场景3：CI/CD 集成
```bash
# 在 CI 脚本中使用
.\build-all.bat
if errorlevel 1 exit /b 1

.\check-build.bat
if errorlevel 1 exit /b 1
```

## 🔧 故障排除

### 常见问题1：Java 构建失败
```bash
# 确保 Maven 已安装并配置
mvn -version

# 清理并重新构建
mvn clean package -DskipTests
```

### 常见问题2：前端构建失败
```bash
# 确保 Node.js 已安装
node -v
npm -v

# 重新安装依赖并构建
cd ui\diffsense-frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 常见问题3：产物同步失败
```bash
# 检查脚本权限和路径
cd plugin
npm run prepare-package
```

## 📝 维护说明

### 添加新的构建产物
如需添加新的构建产物检查，请编辑 `check-build.bat`：

```batch
echo 检查新产物...
if exist "新产物路径" (
    echo   ✅ 新产物存在
) else (
    echo   ❌ 新产物缺失
    set MISSING=1
)
```

### 修改构建流程
如需修改构建流程，请同时更新：
1. `build-all.bat` - 构建脚本
2. `PACKAGING_CHECKLIST.md` - 文档说明
3. `check-build.bat` - 验证脚本

## 🎉 总结

通过这套工具，您可以：
- ✅ 快速检查构建状态
- ✅ 一键完成完整构建
- ✅ 确保不遗漏任何产物
- ✅ 简化调试和发布流程

如果遇到问题，请先运行 `check-build.bat` 诊断具体缺失的文件，然后根据提示修复。 