# 前端细粒度分析系统

## 概述

前端细粒度分析系统为 JavaScript/TypeScript/React/Vue 项目提供详细的变更类型识别，实现从粗粒度分类到细粒度修改标签的能力提升。

## 功能特性

- **多维度分析**：支持 JavaScript、TypeScript、React、Vue 项目
- **细粒度分类**：提供 24 种具体的修改类型
- **智能识别**：基于文件路径、代码模式、方法名称等多种指标进行分析
- **灵活配置**：通过 `--include-type-tags` 参数控制启用
- **完整覆盖**：涵盖组件逻辑、UI结构、样式、事件、配置等各个方面

## 支持的修改类型

### 组件行为类
| 类型代码 | 显示名称 | 描述 |
|---------|---------|------|
| `component-logic-change` | 组件逻辑变更 | 修改了组件的业务逻辑或状态处理 |
| `hook-change` | Hook变更 | 修改了React Hook或Vue Composition API |
| `lifecycle-change` | 生命周期变更 | 修改了组件生命周期方法 |
| `state-management-change` | 状态管理变更 | 修改了状态管理逻辑（Redux/Vuex/Pinia等） |

### UI结构类
| 类型代码 | 显示名称 | 描述 |
|---------|---------|------|
| `jsx-structure-change` | JSX结构变更 | 修改了JSX或模板结构 |
| `template-change` | 模板变更 | 修改了Vue模板或Angular模板 |
| `component-props-change` | 组件属性变更 | 修改了组件的props或接口 |

### 样式相关
| 类型代码 | 显示名称 | 描述 |
|---------|---------|------|
| `css-change` | CSS样式变更 | 修改了CSS/SCSS/Less样式文件 |
| `style-in-js-change` | CSS-in-JS变更 | 修改了styled-components或emotion等CSS-in-JS |
| `theme-change` | 主题变更 | 修改了主题配置或设计系统 |

### 交互事件类
| 类型代码 | 显示名称 | 描述 |
|---------|---------|------|
| `event-handler-change` | 事件处理变更 | 修改了事件处理函数或事件绑定 |
| `form-handling-change` | 表单处理变更 | 修改了表单验证或表单提交逻辑 |

### 路由导航类
| 类型代码 | 显示名称 | 描述 |
|---------|---------|------|
| `routing-change` | 路由变更 | 修改了路由配置或导航逻辑 |
| `navigation-change` | 导航变更 | 修改了导航组件或导航逻辑 |

### API数据类
| 类型代码 | 显示名称 | 描述 |
|---------|---------|------|
| `api-call-change` | API调用变更 | 修改了API调用逻辑或接口 |
| `data-fetching-change` | 数据获取变更 | 修改了数据获取或缓存逻辑 |

### 配置依赖类
| 类型代码 | 显示名称 | 描述 |
|---------|---------|------|
| `build-config-change` | 构建配置变更 | 修改了webpack/vite/rollup等构建配置 |
| `package-dependency-change` | 包依赖变更 | 修改了package.json依赖项 |
| `env-config-change` | 环境配置变更 | 修改了环境变量或配置文件 |

### 测试相关
| 类型代码 | 显示名称 | 描述 |
|---------|---------|------|
| `unit-test-change` | 单元测试变更 | 修改了单元测试文件 |
| `e2e-test-change` | E2E测试变更 | 修改了端到端测试 |

### 工具类
| 类型代码 | 显示名称 | 描述 |
|---------|---------|------|
| `utility-function-change` | 工具函数变更 | 修改了工具函数或帮助方法 |
| `type-definition-change` | 类型定义变更 | 修改了TypeScript类型定义 |

### 其他
| 类型代码 | 显示名称 | 描述 |
|---------|---------|------|
| `comment-change` | 注释变更 | 仅修改了注释或文档 |
| `formatting-change` | 格式调整 | 仅调整了代码格式，无逻辑变更 |
| `unknown` | 未知类型 | 无法识别的变更类型 |

## 使用方法

### 命令行使用

```bash
# 启用细粒度分析
node ui/cli-adapter.js analyze --lang ts --include-type-tags --repo ./my-frontend-project

# 分析指定提交范围
node ui/cli-adapter.js analyze --lang js --include-type-tags --from HEAD~3 --to HEAD

# 输出到文件
node ui/cli-adapter.js analyze --lang ts --include-type-tags --output analysis-result.json
```

### 编程接口使用

```javascript
const FrontendAnalyzer = require('./ui/node-analyzer/analyze.js');

const analyzer = new FrontendAnalyzer('./project-path', {
  includeTypeTags: true
});

const result = await analyzer.analyze();
console.log('细粒度修改:', result.modifications);
```

## 输出格式

### JSON结构

```json
{
  "modifications": [
    {
      "type": "component-logic-change",
      "typeName": "组件逻辑变更",
      "description": "组件逻辑变更: handleSubmit",
      "file": "src/components/LoginForm.tsx",
      "method": "handleSubmit",
      "confidence": 0.85,
      "indicators": []
    },
    {
      "type": "css-change",
      "typeName": "CSS样式变更",
      "description": "样式文件变更: LoginForm.module.css",
      "file": "src/components/LoginForm.module.css",
      "method": null,
      "confidence": 1.0,
      "indicators": []
    }
  ]
}
```

### 前端UI显示

在VSCode插件UI中，细粒度修改会显示在：

1. **概览Tab**：汇总统计
2. **提交Tab**：每个提交的细粒度标签
3. **细粒度修改Tab**：详细的修改列表，按类型分组

## 检测规则

### 文件类型检测

- **样式文件**：`.css`, `.scss`, `.sass`, `.less`, `.styl`, `.stylus`
- **依赖文件**：`package.json`, `package-lock.json`, `yarn.lock`
- **测试文件**：`.test.js`, `.spec.ts`, `__tests__/` 目录
- **构建配置**：`webpack.config.js`, `vite.config.ts`, `tsconfig.json`
- **环境配置**：`.env`, `.env.local`, `.env.production`

### 方法检测模式

- **React Hook**：`useState`, `useEffect`, `useCallback`, `useMemo`
- **生命周期方法**：`componentDidMount`, `created`, `mounted`
- **事件处理**：以 `handle`, `on` 开头的方法名
- **API调用**：包含 `fetch`, `get`, `post`, `api` 的方法
- **状态管理**：包含 `state`, `dispatch`, `commit` 的方法

### 代码模式识别

- **JSX变更**：检测 `<Component>`, `className=`, `onClick=`
- **Vue模板**：检测 `<template>`, `v-if`, `v-for`, `@click`
- **样式变更**：检测 `styled.`, `css``, `.module.css`

## 应用场景

### 1. 回归测试建议

```bash
# 分析提交获得细粒度标签
node ui/cli-adapter.js analyze --lang ts --include-type-tags

# 根据修改类型推荐测试策略：
# - component-logic-change + api-call-change → 建议进行集成测试
# - css-change + jsx-structure-change → 建议进行视觉回归测试
# - event-handler-change → 建议进行交互测试
```

### 2. 风险评估

```javascript
// 高风险修改类型
const highRiskTypes = [
  'component-logic-change',
  'api-call-change', 
  'state-management-change',
  'routing-change'
];

// 统计高风险修改
const highRiskMods = modifications.filter(mod => 
  highRiskTypes.includes(mod.type)
);
```

### 3. 代码审查

- 按修改类型分组审查
- 关注置信度较低的修改
- 重点审查复合修改（一个提交包含多种类型）

## 扩展开发

### 添加新的修改类型

1. 在 `ui/node-analyzer/modificationType.js` 中添加新类型：

```javascript
NEW_MODIFICATION_TYPE: {
  code: 'new-modification-type',
  displayName: '新修改类型',
  description: '描述新的修改类型'
}
```

2. 在 `ui/node-analyzer/granularAnalyzer.js` 中添加检测逻辑：

```javascript
isNewModificationType(filePath, method, content) {
  // 实现检测逻辑
  return conditions;
}
```

3. 更新颜色配置（UI组件中）：

```javascript
const colors = {
  'new-modification-type': '#custom-color'
};
```

### 自定义检测规则

```javascript
class CustomGranularAnalyzer extends FrontendGranularAnalyzer {
  analyzeFileChanges(filePath, methods, diffContent, fileContent) {
    const modifications = super.analyzeFileChanges(filePath, methods, diffContent, fileContent);
    
    // 添加自定义检测逻辑
    if (this.isCustomPattern(filePath, fileContent)) {
      modifications.push(this.createModification(
        ModificationType.CUSTOM_TYPE,
        '自定义修改类型',
        filePath
      ));
    }
    
    return modifications;
  }
}
```

## 性能考虑

- 细粒度分析默认关闭，需要明确启用
- 仅在需要时执行额外的分析逻辑
- 大型项目建议配合文件过滤使用
- 缓存分析结果避免重复计算

## 注意事项

1. **准确性**：置信度表示检测的确定性，建议关注置信度较高的结果
2. **完整性**：某些复杂修改可能被归类为多种类型，这是正常现象
3. **扩展性**：系统设计为可扩展，可根据项目需要添加特定的修改类型
4. **兼容性**：与现有的粗粒度分类系统完全兼容，可同时使用

## 配置示例

```json
{
  "includeTypeTags": true,
  "targetDir": "./src",
  "maxDepth": 10,
  "filePattern": "**/*.{js,jsx,ts,tsx,vue}",
  "exclude": ["node_modules/**", "dist/**"]
}
``` 