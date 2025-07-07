const { ModificationType } = require('./modificationType');
const path = require('path');

/**
 * 前端细粒度变更分析器
 * 分析JavaScript/TypeScript/React/Vue代码的具体修改类型
 */
class FrontendGranularAnalyzer {
  
  /**
   * 分析文件变更，返回细粒度的修改详情列表
   */
  analyzeFileChanges(filePath, methods, diffContent, fileContent) {
    const modifications = [];
    const filePathStr = filePath.replace(/\\/g, '/');
    
    // 分析文件类型相关的变更
    modifications.push(...this.analyzeFileTypeChanges(filePathStr, fileContent));
    
    // 分析方法级别的变更
    if (methods && methods.length > 0) {
      for (const method of methods) {
        modifications.push(...this.analyzeMethodChanges(filePathStr, method, diffContent, fileContent));
      }
    }
    
    // 如果没有具体的方法变更，但有文件变更，进行整体分析
    if ((!methods || methods.length === 0) && diffContent) {
      modifications.push(...this.analyzeGeneralChanges(filePathStr, diffContent));
    }
    
    return modifications;
  }
  
  /**
   * 分析文件类型相关的变更
   */
  analyzeFileTypeChanges(filePath, fileContent) {
    const modifications = [];
    
    // CSS/样式文件变更
    if (this.isStyleFile(filePath)) {
      modifications.push(this.createModification(
        ModificationType.CSS_CHANGE,
        `样式文件变更: ${path.basename(filePath)}`,
        filePath
      ));
    }
    
    // 包依赖文件变更
    if (this.isDependencyFile(filePath)) {
      modifications.push(this.createModification(
        ModificationType.PACKAGE_DEPENDENCY_CHANGE,
        `依赖文件变更: ${path.basename(filePath)}`,
        filePath
      ));
    }
    
    // 测试文件变更
    if (this.isTestFile(filePath)) {
      const testType = this.getTestType(filePath);
      modifications.push(this.createModification(
        testType,
        `测试文件变更: ${path.basename(filePath)}`,
        filePath
      ));
    }
    
    // 构建配置文件变更
    if (this.isBuildConfigFile(filePath)) {
      modifications.push(this.createModification(
        ModificationType.BUILD_CONFIG_CHANGE,
        `构建配置变更: ${path.basename(filePath)}`,
        filePath
      ));
    }
    
    // 环境配置文件变更
    if (this.isEnvConfigFile(filePath)) {
      modifications.push(this.createModification(
        ModificationType.ENV_CONFIG_CHANGE,
        `环境配置变更: ${path.basename(filePath)}`,
        filePath
      ));
    }
    
    // TypeScript类型定义文件
    if (this.isTypeDefinitionFile(filePath)) {
      modifications.push(this.createModification(
        ModificationType.TYPE_DEFINITION_CHANGE,
        `类型定义变更: ${path.basename(filePath)}`,
        filePath
      ));
    }
    
    return modifications;
  }
  
  /**
   * 分析方法级别的变更
   */
  analyzeMethodChanges(filePath, method, diffContent, fileContent) {
    const modifications = [];
    const methodName = method.name || 'unknown';
    
    // React Hook变更检测
    if (this.isReactHook(methodName, fileContent)) {
      modifications.push(this.createModification(
        ModificationType.HOOK_CHANGE,
        `React Hook变更: ${methodName}`,
        filePath,
        methodName,
        0.9
      ));
    }
    
    // 生命周期方法变更
    if (this.isLifecycleMethod(methodName, fileContent)) {
      modifications.push(this.createModification(
        ModificationType.LIFECYCLE_CHANGE,
        `生命周期方法变更: ${methodName}`,
        filePath,
        methodName,
        0.95
      ));
    }
    
    // 事件处理函数变更
    if (this.isEventHandler(methodName, fileContent)) {
      modifications.push(this.createModification(
        ModificationType.EVENT_HANDLER_CHANGE,
        `事件处理变更: ${methodName}`,
        filePath,
        methodName,
        0.85
      ));
    }
    
    // API调用变更
    if (this.isApiCall(methodName, fileContent)) {
      modifications.push(this.createModification(
        ModificationType.API_CALL_CHANGE,
        `API调用变更: ${methodName}`,
        filePath,
        methodName,
        0.8
      ));
    }
    
    // 状态管理变更
    if (this.isStateManagement(methodName, fileContent)) {
      modifications.push(this.createModification(
        ModificationType.STATE_MANAGEMENT_CHANGE,
        `状态管理变更: ${methodName}`,
        filePath,
        methodName,
        0.85
      ));
    }
    
    // 组件逻辑变更（通用）
    if (this.isComponentLogic(filePath, methodName)) {
      modifications.push(this.createModification(
        ModificationType.COMPONENT_LOGIC_CHANGE,
        `组件逻辑变更: ${methodName}`,
        filePath,
        methodName,
        0.7
      ));
    }
    
    return modifications;
  }
  
  /**
   * 分析一般性变更（无具体方法信息时）
   */
  analyzeGeneralChanges(filePath, diffContent) {
    const modifications = [];
    
    // JSX结构变更
    if (this.containsJsxChanges(diffContent)) {
      modifications.push(this.createModification(
        ModificationType.JSX_STRUCTURE_CHANGE,
        'JSX结构变更',
        filePath
      ));
    }
    
    // Vue模板变更
    if (this.containsVueTemplateChanges(diffContent)) {
      modifications.push(this.createModification(
        ModificationType.TEMPLATE_CHANGE,
        'Vue模板变更',
        filePath
      ));
    }
    
    // 样式变更
    if (this.containsStyleChanges(diffContent)) {
      modifications.push(this.createModification(
        ModificationType.CSS_CHANGE,
        '样式变更',
        filePath
      ));
    }
    
    // 注释变更
    if (this.isCommentOnlyChange(diffContent)) {
      modifications.push(this.createModification(
        ModificationType.COMMENT_CHANGE,
        '仅修改了注释',
        filePath
      ));
    }
    
    // 格式变更
    if (this.isFormattingChange(diffContent)) {
      modifications.push(this.createModification(
        ModificationType.FORMATTING_CHANGE,
        '仅调整了代码格式',
        filePath
      ));
    }
    
    return modifications;
  }
  
  // ============ 检测方法 ============
  
  /**
   * 判断是否为样式文件
   */
  isStyleFile(filePath) {
    const styleExtensions = ['.css', '.scss', '.sass', '.less', '.styl', '.stylus'];
    return styleExtensions.some(ext => filePath.endsWith(ext));
  }
  
  /**
   * 判断是否为依赖文件
   */
  isDependencyFile(filePath) {
    const dependencyFiles = ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    const fileName = path.basename(filePath);
    return dependencyFiles.includes(fileName);
  }
  
  /**
   * 判断是否为测试文件
   */
  isTestFile(filePath) {
    const testPatterns = [
      /\.test\.(js|jsx|ts|tsx)$/,
      /\.spec\.(js|jsx|ts|tsx)$/,
      /\/__tests__\//,
      /\/test\//,
      /\/tests\//
    ];
    return testPatterns.some(pattern => pattern.test(filePath));
  }
  
  /**
   * 获取测试类型
   */
  getTestType(filePath) {
    if (filePath.includes('e2e') || filePath.includes('cypress') || filePath.includes('playwright')) {
      return ModificationType.E2E_TEST_CHANGE;
    }
    return ModificationType.UNIT_TEST_CHANGE;
  }
  
  /**
   * 判断是否为构建配置文件
   */
  isBuildConfigFile(filePath) {
    const buildFiles = [
      'webpack.config.js', 'vite.config.js', 'rollup.config.js',
      'babel.config.js', '.babelrc', 'tsconfig.json',
      'jest.config.js', 'vitest.config.js'
    ];
    const fileName = path.basename(filePath);
    return buildFiles.includes(fileName) || fileName.startsWith('webpack.') || fileName.startsWith('vite.');
  }
  
  /**
   * 判断是否为环境配置文件
   */
  isEnvConfigFile(filePath) {
    const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
    const fileName = path.basename(filePath);
    return envFiles.includes(fileName) || fileName.startsWith('.env.');
  }
  
  /**
   * 判断是否为TypeScript类型定义文件
   */
  isTypeDefinitionFile(filePath) {
    return filePath.endsWith('.d.ts');
  }
  
  /**
   * 判断是否为React Hook
   */
  isReactHook(methodName, content) {
    const hookPatterns = ['useState', 'useEffect', 'useCallback', 'useMemo', 'useReducer', 'useContext'];
    return hookPatterns.some(hook => methodName.includes(hook) || (content && content.includes(hook)));
  }
  
  /**
   * 判断是否为生命周期方法
   */
  isLifecycleMethod(methodName, content) {
    const lifecycleMethods = [
      // React
      'componentDidMount', 'componentDidUpdate', 'componentWillUnmount',
      // Vue
      'created', 'mounted', 'updated', 'destroyed', 'beforeDestroy'
    ];
    return lifecycleMethods.includes(methodName);
  }
  
  /**
   * 判断是否为事件处理函数
   */
  isEventHandler(methodName, content) {
    const eventPatterns = ['handle', 'on', 'click', 'submit', 'change', 'focus', 'blur'];
    return eventPatterns.some(pattern => 
      methodName.toLowerCase().includes(pattern) ||
      methodName.startsWith('on') ||
      methodName.startsWith('handle')
    );
  }
  
  /**
   * 判断是否为API调用
   */
  isApiCall(methodName, content) {
    const apiPatterns = ['fetch', 'get', 'post', 'put', 'delete', 'request', 'api', 'call'];
    return apiPatterns.some(pattern => 
      methodName.toLowerCase().includes(pattern) ||
      (content && (content.includes('fetch(') || content.includes('axios') || content.includes('api.')))
    );
  }
  
  /**
   * 判断是否为状态管理
   */
  isStateManagement(methodName, content) {
    const statePatterns = ['state', 'store', 'dispatch', 'commit', 'mutation', 'action'];
    return statePatterns.some(pattern => 
      methodName.toLowerCase().includes(pattern) ||
      (content && (content.includes('setState') || content.includes('dispatch') || content.includes('commit')))
    );
  }
  
  /**
   * 判断是否为组件逻辑
   */
  isComponentLogic(filePath, methodName) {
    const componentExtensions = ['.jsx', '.tsx', '.vue'];
    return componentExtensions.some(ext => filePath.endsWith(ext));
  }
  
  /**
   * 检查是否包含JSX变更
   */
  containsJsxChanges(diffContent) {
    const jsxPatterns = [/<[A-Z]/, /<[a-z]/, /className=/, /onClick=/, /onChange=/];
    return jsxPatterns.some(pattern => pattern.test(diffContent));
  }
  
  /**
   * 检查是否包含Vue模板变更
   */
  containsVueTemplateChanges(diffContent) {
    const vuePatterns = [/<template>/, /v-if=/, /v-for=/, /v-model=/, /@click=/];
    return vuePatterns.some(pattern => pattern.test(diffContent));
  }
  
  /**
   * 检查是否包含样式变更
   */
  containsStyleChanges(diffContent) {
    const stylePatterns = [/className=/, /style=/, /styled\./, /css`/, /\.css/, /\.scss/];
    return stylePatterns.some(pattern => pattern.test(diffContent));
  }
  
  /**
   * 检查是否仅为注释变更
   */
  isCommentOnlyChange(diffContent) {
    const lines = diffContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && 
          !trimmed.startsWith('*') && !trimmed.startsWith('*/') && !trimmed.startsWith('<!--')) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * 检查是否仅为格式变更
   */
  isFormattingChange(diffContent) {
    const normalized = diffContent.replace(/\s+/g, ' ').trim();
    return normalized.length < 10;
  }
  
  /**
   * 创建修改详情对象
   */
  createModification(type, description, file, method = null, confidence = 1.0) {
    return {
      type: type.code,
      typeName: type.displayName,
      description,
      file,
      method,
      confidence,
      indicators: []
    };
  }
}

module.exports = FrontendGranularAnalyzer; 