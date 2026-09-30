# DiffSense 智能回归分析器

## 🎯 功能特性

### 📊 智能回归分析
- **变更识别**: Git diff + AST 分析，精确提取代码变更
- **风险识别**: 6大维度风险检测（覆盖率、耦合度、复杂度等）
- **风险评分**: 智能算法评估回退影响范围和风险等级
- **趋势分析**: 历史提交风险趋势可视化

### 🚨 **功能回滚检测** (NEW!)
- **精准定位**: 检测特定方法/组件是否被意外删除或回滚
- **Git历史分析**: 基于 `git log -S` 和 `git blame` 的深度分析
- **AST对比**: 结构化代码比较，提升检测准确性
- **恢复建议**: 自动生成恢复命令和操作指南

### 📄 多格式报告
- **HTML报告**: 交互式可视化报告，包含回滚检测结果
- **Markdown报告**: 轻量级文档格式
- **JSON报告**: 机器可读的结构化数据

## 🚀 快速开始

### 安装
```bash
cd ui/regression-analyzer
npm install
```

### 基础使用

#### 1. 完整回归分析
```bash
# 分析最近一次提交
npm run analyze

# 分析最近3次提交
node index.js analyze --commits 3

# 生成Markdown格式报告
node index.js analyze --format markdown
```

#### 2. 🚨 功能回滚检测

**单个目标检测**:
```bash
# 检测特定方法是否被回滚
node index.js detect-rollback --file "src/pages/order.tsx" --method "submitOrder"
```

**批量检测**:
```bash
# 使用配置文件批量检测多个重要功能
node index.js detect-rollback --config ./rollback-targets.json
```

**同时执行回归分析和回滚检测**:
```bash
node index.js analyze --detect-rollback --rollback-config ./rollback-targets.json
```

#### 3. 快速检查
```bash
# 轻量级风险检查
node index.js quick
```

#### 4. 趋势分析
```bash
# 分析最近10次提交的风险趋势
node index.js trend --number 10
```

## 📋 配置文件

### 回滚检测配置 (`rollback-targets.json`)

定义需要监控的重要功能：

```json
[
  {
    "filePath": "src/components/Button.tsx",
    "methodName": "handleClick",
    "description": "按钮点击处理函数"
  },
  {
    "filePath": "src/pages/order.tsx", 
    "methodName": "submitOrder",
    "description": "订单提交功能"
  },
  {
    "filePath": "src/utils/api.ts",
    "methodName": "fetchUserData", 
    "description": "用户数据获取API"
  }
]
```

### 风险检测配置 (`regression-config.yaml`)

自定义风险检测规则：

```yaml
dependency:
  highCouplingThreshold: 5
  crossModuleThreshold: 2

controlFlow:
  maxComplexity: 10
  maxNestingDepth: 4

sensitiveAPIs:
  categories:
    IO_OPERATIONS: ['File', 'Stream', 'Socket']
    NETWORK_CALLS: ['HTTP', 'API', 'Rest']
    THREAD_OPERATIONS: ['Thread', 'Executor', 'Concurrent']
    DATABASE_ACCESS: ['SQL', 'Query', 'Transaction']
    SECURITY_OPERATIONS: ['Auth', 'Crypto', 'Security']
```

## 🔧 VSCode 集成

### 插件集成示例

```typescript
// VSCode 扩展中的使用示例
commands.registerCommand("diffsense.detectRollback", async () => {
  const activeEditor = vscode.window.activeTextEditor;
  const selection = activeEditor?.selection;
  const selectedText = activeEditor?.document.getText(selection);
  
  if (activeEditor && selectedText) {
    const result = await exec(
      `node regression-analyzer/index.js vscode-rollback --file "${activeEditor.document.uri.fsPath}" --selection "${selectedText}"`
    );
    
    // 在WebviewPanel中显示检测结果
    showRollbackResults(JSON.parse(result.stdout));
  }
});
```

## 📊 报告示例

### 回滚检测报告

当检测到功能回滚时，报告会显示：

```
🚨 功能回滚检测

⚠️ 检测到 1 个功能回滚

🔴 submitOrder
- 文件: src/pages/order.tsx
- 删除提交: e21f9c1 by 张三
- 删除时间: 2025-01-20 14:30:15
- 提交信息: "重构 checkout 流程，合并表单逻辑"
- 删除原因: 代码重构

恢复命令:
git show e21f9c1:src/pages/order.tsx > recovered_order.tsx
git checkout e21f9c1~1 -- src/pages/order.tsx
```

### HTML 报告特性

- 🎨 现代化UI设计，响应式布局
- 📊 交互式图表和统计信息
- 🚨 突出显示回滚检测结果
- 💡 智能修复建议
- 🔧 一键复制恢复命令

## 🛠️ 技术实现

### 功能回滚检测算法

1. **Git Log -S 搜索**: 快速查找包含目标字符串的提交历史
2. **提交类型分析**: 区分添加、删除、修改类型的提交
3. **Git Blame 分析**: 追踪代码行的最后修改者
4. **AST Diff 对比**: 结构化比较方法签名和实现
5. **智能建议生成**: 基于删除原因提供恢复策略

### 检测精度优化

- **字符串匹配**: 基础但高效的方法名检测
- **正则表达式**: 支持函数声明模式匹配
- **AST 解析**: 精确的语法树结构对比
- **上下文分析**: 考虑代码片段和调用关系

## 📈 性能优化

- **增量分析**: 只分析变更的文件和方法
- **并行处理**: 多个目标同时检测
- **缓存机制**: Git操作结果缓存
- **智能跳过**: 自动跳过二进制文件和无关目录

## 🔍 使用场景

### 1. CI/CD 集成
```bash
# 在发布前检查关键功能是否被意外删除
node index.js detect-rollback --config critical-features.json
if [ $? -ne 0 ]; then
  echo "❌ 检测到关键功能回滚，阻止发布"
  exit 1
fi
```

### 2. 代码Review
- 自动检测PR中是否删除了重要方法
- 生成回滚风险评估报告
- 提供具体的恢复建议

### 3. 生产环境监控
- 定期检查核心功能完整性
- 历史趋势分析和预警
- 快速定位问题根因

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发环境setup
```bash
git clone <repository>
cd ui/regression-analyzer
npm install
npm test
```

### 添加新的语言支持
1. 在 `modules/analyzers/` 下创建语言分析器
2. 更新 `detectLanguage()` 方法
3. 添加相应的测试用例

## 📜 许可证

MIT License

---

**DiffSense 团队** - 让代码变更更安全 🛡️ 