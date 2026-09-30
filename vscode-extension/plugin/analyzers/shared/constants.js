/**
 * DiffSense 配置常量模块
 * 提取魔法数字和硬编码值，提供统一的配置管理
 */

/**
 * 分析阈值常量
 */
const AnalysisThresholds = {
  // 文件大小限制 (字节)
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_ANALYSIS_FILES: 1000,
  
  // 依赖分析深度
  MAX_DEPENDENCY_DEPTH: 15,
  MAX_CALL_GRAPH_DEPTH: 20,
  
  // 分类分数阈值
  HIGH_CONFIDENCE_THRESHOLD: 0.8,
  MEDIUM_CONFIDENCE_THRESHOLD: 0.5,
  LOW_CONFIDENCE_THRESHOLD: 0.3,
  
  // 风险评分阈值
  HIGH_RISK_THRESHOLD: 0.8,
  MEDIUM_RISK_THRESHOLD: 0.5,
  LOW_RISK_THRESHOLD: 0.3,
  
  // 性能阈值
  ANALYSIS_TIMEOUT_MS: 300000, // 5分钟
  MEMORY_LIMIT_MB: 2048,
  PARALLEL_THREADS: 4,
  
  // 缓存设置
  CACHE_EXPIRY_DAYS: 7,
  MAX_CACHE_SIZE_MB: 100
};

/**
 * 文件类型常量
 */
const FileTypes = {
  // 前端文件类型
  FRONTEND: {
    JAVASCRIPT: ['.js', '.jsx'],
    TYPESCRIPT: ['.ts', '.tsx'],
    VUE: ['.vue'],
    CSS: ['.css', '.scss', '.sass', '.less'],
    HTML: ['.html', '.htm']
  },
  
  // 后端文件类型
  BACKEND: {
    JAVA: ['.java'],
    KOTLIN: ['.kt'],
    GO: ['.go'],
    PYTHON: ['.py'],
    CPP: ['.cpp', '.cc', '.cxx', '.h', '.hpp']
  },
  
  // 配置文件类型
  CONFIG: {
    PACKAGE: ['package.json', 'yarn.lock', 'package-lock.json'],
    BUILD: ['webpack.config.js', 'vite.config.js', 'rollup.config.js', 'babel.config.js'],
    ENV: ['.env', '.env.local', '.env.production'],
    TYPESCRIPT: ['tsconfig.json'],
    ESLINT: ['.eslintrc.js', '.eslintrc.json'],
    PRETTIER: ['.prettierrc', '.prettierrc.js']
  },
  
  // 测试文件类型
  TEST: {
    JAVASCRIPT: ['.test.js', '.test.jsx', '.spec.js', '.spec.jsx'],
    TYPESCRIPT: ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'],
    JAVA: ['Test.java', 'Tests.java'],
    GO: ['_test.go']
  }
};

/**
 * 分类权重常量
 */
const ClassificationWeights = {
  // React Hooks权重
  REACT_HOOKS_WEIGHT: 30,
  VUE_LIFECYCLE_WEIGHT: 30,
  STATE_MANAGEMENT_WEIGHT: 25,
  BUSINESS_LOGIC_WEIGHT: 15,
  ASYNC_PROCESSING_WEIGHT: 20,
  
  // UI结构权重
  JSX_ELEMENTS_WEIGHT: 35,
  VUE_TEMPLATE_WEIGHT: 35,
  COMPONENT_FILE_WEIGHT: 20,
  LAYOUT_ELEMENT_WEIGHT: 5,
  CONDITIONAL_RENDERING_WEIGHT: 15,
  
  // 样式权重
  STYLE_FILE_WEIGHT: 40,
  STYLE_IMPORT_WEIGHT: 25,
  INLINE_STYLE_WEIGHT: 30,
  CLASSNAME_WEIGHT: 20,
  CSS_MODULE_WEIGHT: 25,
  
  // 事件权重
  REACT_EVENT_WEIGHT: 10,
  VUE_EVENT_WEIGHT: 10,
  EVENT_HANDLER_WEIGHT: 15,
  FORM_ELEMENT_WEIGHT: 20,
  
  // 依赖权重
  PACKAGE_FILE_WEIGHT: 50,
  ROUTER_CONFIG_WEIGHT: 30,
  STATE_STORE_WEIGHT: 30,
  I18N_CONFIG_WEIGHT: 25,
  ENV_CONFIG_WEIGHT: 20,
  BUILD_CONFIG_WEIGHT: 35
};

/**
 * 正则表达式常量
 */
const RegexPatterns = {
  // JSX元素匹配
  JSX_ELEMENTS: /<[A-Z][A-Za-z0-9]*|<[a-z][a-z0-9-]*/g,
  
  // className匹配
  CLASSNAME_PATTERN: /className=["|'`][^"'`]*["|'`]/g,
  
  // 导入语句匹配
  IMPORT_PATTERN: /import\s+.*from\s+['"`][^'"`]+['"`]/g,
  
  // 函数定义匹配
  FUNCTION_PATTERN: /(?:function\s+)?(\w+)\s*\([^)]*\)\s*{/g,
  
  // 类定义匹配
  CLASS_PATTERN: /class\s+(\w+)/g,
  
  // 注释匹配
  COMMENT_PATTERN: /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
  
  // 字符串匹配
  STRING_PATTERN: /["'`]([^"'`]*)["'`]/g,
  
  // 数字匹配
  NUMBER_PATTERN: /\b\d+(?:\.\d+)?\b/g,
  
  // 变量名匹配
  VARIABLE_PATTERN: /\b(?:const|let|var)\s+(\w+)/g
};

/**
 * 错误消息常量
 */
const ErrorMessages = {
  FILE_NOT_FOUND: '文件未找到',
  FILE_READ_ERROR: '文件读取失败',
  PARSE_ERROR: '解析错误',
  INVALID_CONFIG: '配置无效',
  ANALYSIS_FAILED: '分析失败',
  TIMEOUT_ERROR: '分析超时',
  MEMORY_ERROR: '内存不足',
  UNSUPPORTED_LANGUAGE: '不支持的语言',
  INVALID_INPUT: '输入参数无效'
};

/**
 * 分析模式常量
 */
const AnalysisModes = {
  DIFF: 'diff',
  FULL: 'full',
  INCREMENTAL: 'incremental',
  GRANULAR: 'granular'
};

/**
 * 输出格式常量
 */
const OutputFormats = {
  JSON: 'json',
  HTML: 'html',
  MARKDOWN: 'markdown',
  CSV: 'csv',
  XML: 'xml'
};

/**
 * 语言支持常量
 */
const SupportedLanguages = {
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript',
  JAVA: 'java',
  KOTLIN: 'kotlin',
  GO: 'go',
  PYTHON: 'python',
  CPP: 'cpp',
  VUE: 'vue',
  REACT: 'react'
};

/**
 * 修改类型常量
 */
const ModificationTypes = {
  // 前端修改类型
  HOOK_CHANGE: 'hook_change',
  LIFECYCLE_CHANGE: 'lifecycle_change',
  EVENT_HANDLER_CHANGE: 'event_handler_change',
  API_CALL_CHANGE: 'api_call_change',
  STATE_MANAGEMENT_CHANGE: 'state_management_change',
  COMPONENT_LOGIC_CHANGE: 'component_logic_change',
  CSS_CHANGE: 'css_change',
  UI_STRUCTURE_CHANGE: 'ui_structure_change',
  
  // 后端修改类型
  METHOD_CHANGE: 'method_change',
  CLASS_CHANGE: 'class_change',
  INTERFACE_CHANGE: 'interface_change',
  ANNOTATION_CHANGE: 'annotation_change',
  DEPENDENCY_CHANGE: 'dependency_change',
  
  // 通用修改类型
  PACKAGE_DEPENDENCY_CHANGE: 'package_dependency_change',
  BUILD_CONFIG_CHANGE: 'build_config_change',
  ENV_CONFIG_CHANGE: 'env_config_change',
  TYPE_DEFINITION_CHANGE: 'type_definition_change',
  TEST_CHANGE: 'test_change',
  DOCUMENTATION_CHANGE: 'documentation_change',
  FORMATTING_CHANGE: 'formatting_change',
  COMMENT_CHANGE: 'comment_change'
};

/**
 * 风险级别常量
 */
const RiskLevels = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  NONE: 'none'
};

/**
 * 性能指标常量
 */
const PerformanceMetrics = {
  // 时间阈值 (毫秒)
  FAST_ANALYSIS: 1000,
  NORMAL_ANALYSIS: 5000,
  SLOW_ANALYSIS: 30000,
  
  // 内存阈值 (MB)
  LOW_MEMORY: 100,
  NORMAL_MEMORY: 500,
  HIGH_MEMORY: 2048,
  
  // 文件数量阈值
  SMALL_PROJECT: 100,
  MEDIUM_PROJECT: 1000,
  LARGE_PROJECT: 10000
};

/**
 * 缓存键前缀
 */
const CacheKeys = {
  ANALYSIS_RESULT: 'analysis_result',
  DEPENDENCY_GRAPH: 'dependency_graph',
  CALL_GRAPH: 'call_graph',
  CLASSIFICATION: 'classification',
  RISK_ASSESSMENT: 'risk_assessment'
};

module.exports = {
  AnalysisThresholds,
  FileTypes,
  ClassificationWeights,
  RegexPatterns,
  ErrorMessages,
  AnalysisModes,
  OutputFormats,
  SupportedLanguages,
  ModificationTypes,
  RiskLevels,
  PerformanceMetrics,
  CacheKeys
}; 