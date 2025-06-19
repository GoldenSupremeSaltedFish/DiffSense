# DiffSense 项目打包流程文档

## 📋 打包前检查清单

### 🔨 1. Java 分析器构建

**构建命令：**
```bash
# 在项目根目录执行
mvn clean package -DskipTests
```

**验证产物：**
- [ ] `target/gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar` (约24MB)
- [ ] `target/gitimpact-1.0-SNAPSHOT.jar` (约121KB)

### 🎨 2. 前端构建

**构建命令：**
```bash
# 进入前端目录
cd ui/diffsense-frontend

# 安装依赖（如果需要）
npm install

# 构建前端应用
npm run build
```

**验证产物：**
- [ ] `ui/diffsense-frontend/dist/index.html`
- [ ] `ui/diffsense-frontend/dist/assets/` 目录
- [ ] `ui/diffsense-frontend/dist/vite.svg`

### 📦 3. Node.js 分析器

**准备命令：**
```bash
# 进入 Node.js 分析器目录
cd ui/node-analyzer

# 确保依赖完整
npm install
```

**验证产物：**
- [ ] `ui/node-analyzer/analyze.js`
- [ ] `ui/node-analyzer/utils.js`
- [ ] `ui/node-analyzer/package.json`
- [ ] `ui/node-analyzer/node_modules/` 目录

### 🐹 4. Golang 分析器

**准备命令：**
```bash
# 进入 Golang 分析器目录
cd ui/golang-analyzer

# 确保依赖完整
npm install
```

**验证产物：**
- [ ] `ui/golang-analyzer/analyze.js`
- [ ] `ui/golang-analyzer/package.json`
- [ ] `ui/golang-analyzer/node_modules/` 目录

## 🚀 完整打包流程

### 步骤 1: 清理并构建所有组件

```bash
# 1. 清理之前的构建产物
cd plugin
npm run clean

# 2. 构建 Java 分析器
cd ..
mvn clean package -DskipTests

# 3. 构建前端应用
cd ui/diffsense-frontend
npm run build

# 4. 确保 Node.js 分析器依赖完整
cd ../node-analyzer
npm install

# 5. 确保 Golang 分析器依赖完整
cd ../golang-analyzer
npm install

# 6. 回到插件目录
cd ../../plugin
```

### 步骤 2: 同步产物到插件目录

```bash
# 在 plugin 目录下执行
npm run prepare-package
```

### 步骤 3: 验证同步结果

**检查 Java 分析器同步：**
- [ ] `plugin/analyzers/gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar`
- [ ] `plugin/analyzers/gitimpact-1.0-SNAPSHOT.jar`

**检查前端资源同步：**
- [ ] `plugin/dist/index.html`
- [ ] `plugin/dist/assets/`
- [ ] `plugin/diffsense-frontend/index.html`
- [ ] `plugin/diffsense-frontend/assets/`

**检查分析器同步：**
- [ ] `plugin/ui/node-analyzer/analyze.js`
- [ ] `plugin/ui/node-analyzer/node_modules/`
- [ ] `plugin/ui/golang-analyzer/analyze.js`
- [ ] `plugin/ui/golang-analyzer/node_modules/`

### 步骤 4: 编译插件代码

```bash
# 编译 TypeScript
npm run compile
```

**验证产物：**
- [ ] `plugin/dist/extension.js`

### 步骤 5: 打包 VSIX

```bash
# 打包为 VSIX 文件
npm run package
```

**验证产物：**
- [ ] `plugin/diffsense-*.vsix` 文件

## 🔍 质量检查命令

### 快速验证脚本

```bash
#!/bin/bash
# 检查所有必要文件是否存在

echo "🔍 检查 Java 分析器..."
ls -la target/*.jar 2>/dev/null || echo "❌ Java JAR 文件缺失"
ls -la plugin/analyzers/*.jar 2>/dev/null || echo "❌ 插件中 Java JAR 文件缺失"

echo "🔍 检查前端构建产物..."
ls -la ui/diffsense-frontend/dist/index.html 2>/dev/null || echo "❌ 前端构建产物缺失"
ls -la plugin/dist/index.html 2>/dev/null || echo "❌ 插件中前端产物缺失"

echo "🔍 检查 Node.js 分析器..."
ls -la ui/node-analyzer/analyze.js 2>/dev/null || echo "❌ Node.js 分析器缺失"
ls -la plugin/ui/node-analyzer/analyze.js 2>/dev/null || echo "❌ 插件中 Node.js 分析器缺失"

echo "🔍 检查 Golang 分析器..."
ls -la ui/golang-analyzer/analyze.js 2>/dev/null || echo "❌ Golang 分析器缺失"
ls -la plugin/ui/golang-analyzer/analyze.js 2>/dev/null || echo "❌ 插件中 Golang 分析器缺失"

echo "✅ 检查完成"
```

## 📁 关键目录结构

打包完成后，plugin 目录应包含：

```
plugin/
├── dist/
│   ├── extension.js          # 编译后的插件主文件
│   ├── index.html           # 前端入口文件
│   ├── assets/              # 前端资源文件
│   └── vite.svg
├── analyzers/
│   ├── gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar
│   └── gitimpact-1.0-SNAPSHOT.jar
├── ui/
│   ├── node-analyzer/
│   │   ├── analyze.js
│   │   ├── utils.js
│   │   ├── package.json
│   │   └── node_modules/
│   └── golang-analyzer/
│       ├── analyze.js
│       ├── package.json
│       └── node_modules/
├── diffsense-frontend/
│   ├── index.html
│   ├── assets/
│   └── vite.svg
├── package.json
├── icon.png
└── README.md
```

## ⚠️ 常见问题排查

### 问题 1: JAR 文件未同步
**原因：** Maven 构建失败或目标目录清理
**解决：** 
```bash
mvn clean package -DskipTests
ls -la target/*.jar  # 验证 JAR 文件存在
```

### 问题 2: 前端构建产物缺失
**原因：** 前端构建失败或环境变量配置错误
**解决：**
```bash
cd ui/diffsense-frontend
npm install
npm run build
ls -la dist/  # 验证构建产物
```

### 问题 3: 分析器 node_modules 缺失
**原因：** npm install 未执行或依赖安装失败
**解决：**
```bash
cd ui/node-analyzer && npm install
cd ../golang-analyzer && npm install
```

### 问题 4: 插件编译失败
**原因：** TypeScript 编译错误
**解决：**
```bash
cd plugin
npm install
npm run compile
```

## 🎯 完整的一键构建脚本

创建 `build-all.sh` 脚本：

```bash
#!/bin/bash
set -e

echo "🚀 开始完整构建流程..."

# 1. 构建 Java 分析器
echo "📦 构建 Java 分析器..."
mvn clean package -DskipTests

# 2. 构建前端
echo "🎨 构建前端应用..."
cd ui/diffsense-frontend
npm install
npm run build
cd ../..

# 3. 准备分析器
echo "📋 准备分析器..."
cd ui/node-analyzer && npm install && cd ../..
cd ui/golang-analyzer && npm install && cd ../..

# 4. 同步到插件目录
echo "🔄 同步产物到插件目录..."
cd plugin
npm run prepare-package

# 5. 编译插件
echo "🔨 编译插件代码..."
npm run compile

# 6. 打包 VSIX
echo "📦 打包 VSIX..."
npm run package

echo "✅ 构建完成！"
echo "📁 VSIX 文件位置: $(find . -name '*.vsix' | head -1)"
```

## 📝 版本发布检查清单

发布前最终检查：
- [ ] 所有测试通过
- [ ] 版本号已更新 (`plugin/package.json`)
- [ ] CHANGELOG 已更新
- [ ] 所有产物已同步
- [ ] VSIX 文件可正常安装
- [ ] 功能测试通过

---

**⚡ 快速命令参考：**
```bash
# 完整构建流程
mvn clean package -DskipTests && cd ui/diffsense-frontend && npm run build && cd ../../plugin && npm run prepare-package && npm run compile && npm run package

# 仅重新打包（假设所有产物已构建）
cd plugin && npm run prepare-package && npm run package
``` 