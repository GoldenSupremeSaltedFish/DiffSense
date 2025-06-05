# DiffSense 插件构建指南

## 🔧 开发环境设置

### 前提条件
- Node.js 18.x 或更高版本
- npm 或 yarn
- @vscode/vsce 工具（用于打包VSIX）

### 安装依赖
```bash
# 安装插件依赖
cd plugin
npm install

# 安装前端依赖
cd ../ui/diffsense-frontend
npm install
```

## 🏗️ 构建流程

### 1. 前端构建
首先需要构建前端项目：
```bash
cd ui/diffsense-frontend
npm run build
```

### 2. 插件编译
编译TypeScript代码：
```bash
cd plugin
npm run compile
```

### 3. VSIX打包

**自动打包（推荐）**：
```bash
cd plugin
npm run package
```

这个命令会自动：
1. 运行 `prepare-package` 脚本复制前端资源
2. 使用 `vsce package` 创建VSIX文件

**手动步骤**（如果需要）：
```bash
cd plugin
npm run prepare-package  # 准备前端资源
vsce package             # 创建VSIX包
npm run clean-package    # 清理临时资源（可选）
```

## 📁 文件结构说明

### 开发时的文件结构
```
DiffSense/
├── plugin/                    # 插件代码
│   ├── src/                  # TypeScript源码
│   ├── dist/                 # 编译后的JS代码
│   └── scripts/              # 构建脚本
└── ui/
    └── diffsense-frontend/   # 前端项目
        └── dist/             # 前端构建产物
```

### VSIX包内的文件结构
```
diffsense-0.1.0.vsix
└── extension/
    ├── dist/
    │   └── extension.js      # 编译后的插件代码
    ├── ui/
    │   └── diffsense-frontend/
    │       └── dist/         # 复制的前端资源
    │           ├── index.html
    │           ├── vite.svg
    │           └── assets/
    └── package.json
```

## 🔄 资源管理

### 前端资源处理
- **开发模式**：插件从 `../ui/diffsense-frontend/dist` 读取前端资源
- **VSIX包模式**：插件从 `./ui/diffsense-frontend/dist` 读取前端资源
- `prepare-package.js` 脚本自动检测环境并复制资源到正确位置

### 路径自动检测
插件代码会自动检测运行环境：
```typescript
const isVSIXPackage = !fs.existsSync(path.join(this._extensionUri.fsPath, '..', 'ui'));
```

## 🚀 发布流程

### 1. 版本更新
更新 `plugin/package.json` 中的版本号：
```json
{
  "version": "0.1.1"
}
```

### 2. 自动发布
```bash
cd plugin
npm run publish  # 自动准备资源并发布到VSCode市场
```

### 3. 手动发布
```bash
cd plugin
npm run package          # 创建VSIX包
vsce publish -p <token>  # 使用token发布
```

## 🧪 测试安装

### 本地测试
```bash
# 创建VSIX包
cd plugin
npm run package

# 安装到VSCode
code --install-extension diffsense-0.1.0.vsix
```

### 卸载测试包
```bash
code --uninstall-extension diffsense.diffsense
```

## 🛠️ 开发脚本说明

- `npm run compile` - 编译TypeScript代码
- `npm run prepare-package` - 准备VSIX包资源（复制前端文件）
- `npm run clean-package` - 清理临时复制的资源
- `npm run package` - 完整打包流程
- `npm run publish` - 发布到VSCode市场

## ⚠️ 注意事项

1. **前端构建必须先完成**：打包前确保前端项目已经构建
2. **资源同步**：修改前端代码后需要重新构建和打包
3. **清理资源**：开发时可以运行 `npm run clean-package` 清理插件内的临时资源
4. **文件大小**：VSIX包现在会更大，因为包含了前端构建产物

## 🐛 故障排除

### 前端资源加载失败
如果遇到"前端资源加载失败"错误：
1. 确认前端项目已构建：`cd ui/diffsense-frontend && npm run build`
2. 重新准备包：`cd plugin && npm run prepare-package`
3. 重新打包：`npm run package`

### 路径问题
插件会自动检测运行环境并使用正确的路径。如果仍有问题：
1. 检查VSCode开发者控制台的错误信息
2. 确认VSIX包中包含 `ui/diffsense-frontend/dist/` 目录
3. 验证前端构建产物是否完整 