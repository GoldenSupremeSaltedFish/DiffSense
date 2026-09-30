/**
 * 前端细粒度变更类型枚举
 * 适用于 React/Vue/JavaScript/TypeScript 项目
 */

const ModificationType = {
  // 组件行为类
  COMPONENT_LOGIC_CHANGE: {
    code: 'component-logic-change',
    displayName: '组件逻辑变更',
    description: '修改了组件的业务逻辑或状态处理'
  },
  HOOK_CHANGE: {
    code: 'hook-change', 
    displayName: 'Hook变更',
    description: '修改了React Hook或Vue Composition API'
  },
  LIFECYCLE_CHANGE: {
    code: 'lifecycle-change',
    displayName: '生命周期变更', 
    description: '修改了组件生命周期方法'
  },
  STATE_MANAGEMENT_CHANGE: {
    code: 'state-management-change',
    displayName: '状态管理变更',
    description: '修改了状态管理逻辑（Redux/Vuex/Pinia等）'
  },

  // UI结构类
  JSX_STRUCTURE_CHANGE: {
    code: 'jsx-structure-change',
    displayName: 'JSX结构变更',
    description: '修改了JSX或模板结构'
  },
  TEMPLATE_CHANGE: {
    code: 'template-change',
    displayName: '模板变更',
    description: '修改了Vue模板或Angular模板'
  },
  COMPONENT_PROPS_CHANGE: {
    code: 'component-props-change',
    displayName: '组件属性变更',
    description: '修改了组件的props或接口'
  },

  // 样式相关
  CSS_CHANGE: {
    code: 'css-change',
    displayName: 'CSS样式变更',
    description: '修改了CSS/SCSS/Less样式文件'
  },
  STYLE_IN_JS_CHANGE: {
    code: 'style-in-js-change',
    displayName: 'CSS-in-JS变更',
    description: '修改了styled-components或emotion等CSS-in-JS'
  },
  THEME_CHANGE: {
    code: 'theme-change',
    displayName: '主题变更',
    description: '修改了主题配置或设计系统'
  },

  // 交互事件类
  EVENT_HANDLER_CHANGE: {
    code: 'event-handler-change',
    displayName: '事件处理变更',
    description: '修改了事件处理函数或事件绑定'
  },
  FORM_HANDLING_CHANGE: {
    code: 'form-handling-change',
    displayName: '表单处理变更',
    description: '修改了表单验证或表单提交逻辑'
  },
  
  // 路由导航类
  ROUTING_CHANGE: {
    code: 'routing-change',
    displayName: '路由变更',
    description: '修改了路由配置或导航逻辑'
  },
  NAVIGATION_CHANGE: {
    code: 'navigation-change',
    displayName: '导航变更',
    description: '修改了导航组件或导航逻辑'
  },

  // API数据类
  API_CALL_CHANGE: {
    code: 'api-call-change',
    displayName: 'API调用变更',
    description: '修改了API调用逻辑或接口'
  },
  DATA_FETCHING_CHANGE: {
    code: 'data-fetching-change',
    displayName: '数据获取变更',
    description: '修改了数据获取或缓存逻辑'
  },

  // 配置依赖类
  BUILD_CONFIG_CHANGE: {
    code: 'build-config-change',
    displayName: '构建配置变更',
    description: '修改了webpack/vite/rollup等构建配置'
  },
  PACKAGE_DEPENDENCY_CHANGE: {
    code: 'package-dependency-change',
    displayName: '包依赖变更',
    description: '修改了package.json依赖项'
  },
  ENV_CONFIG_CHANGE: {
    code: 'env-config-change',
    displayName: '环境配置变更',
    description: '修改了环境变量或配置文件'
  },

  // 测试相关
  UNIT_TEST_CHANGE: {
    code: 'unit-test-change',
    displayName: '单元测试变更',
    description: '修改了单元测试文件'
  },
  E2E_TEST_CHANGE: {
    code: 'e2e-test-change',
    displayName: 'E2E测试变更',
    description: '修改了端到端测试'
  },
  
  // 工具类
  UTILITY_FUNCTION_CHANGE: {
    code: 'utility-function-change',
    displayName: '工具函数变更',
    description: '修改了工具函数或帮助方法'
  },
  TYPE_DEFINITION_CHANGE: {
    code: 'type-definition-change',
    displayName: '类型定义变更',
    description: '修改了TypeScript类型定义'
  },

  // 其他
  COMMENT_CHANGE: {
    code: 'comment-change',
    displayName: '注释变更',
    description: '仅修改了注释或文档'
  },
  FORMATTING_CHANGE: {
    code: 'formatting-change',
    displayName: '格式调整',
    description: '仅调整了代码格式，无逻辑变更'
  },
  UNKNOWN: {
    code: 'unknown',
    displayName: '未知类型',
    description: '无法识别的变更类型'
  }
};

/**
 * 根据代码获取修改类型
 */
function getModificationTypeByCode(code) {
  return Object.values(ModificationType).find(type => type.code === code) || ModificationType.UNKNOWN;
}

/**
 * 获取所有修改类型代码
 */
function getAllModificationTypeCodes() {
  return Object.values(ModificationType).map(type => type.code);
}

module.exports = {
  ModificationType,
  getModificationTypeByCode,
  getAllModificationTypeCodes
}; 