/**
 * DiffSense 共享分类器模块
 * 提供统一的前端代码分类逻辑，减少代码重复
 */

const { defaultErrorHandler, ErrorCodes, ErrorSeverity } = require('../node-analyzer/errorHandler');

/**
 * 前端代码修改分类器 - 适用于 React / Vue / JS/TS
 * 提取自重复的analyze.js文件
 */
class FrontendChangeClassifier {
  
  static get CATEGORIES() {
    return {
      F1: { code: 'F1', name: '组件行为变更', description: 'useEffect / methods 中的逻辑变化' },
      F2: { code: 'F2', name: 'UI结构调整', description: 'JSX/Template 中的标签结构调整' },
      F3: { code: 'F3', name: '样式改动', description: '类名变化、内联样式/模块CSS/SCSS调整' },
      F4: { code: 'F4', name: '交互事件修改', description: 'onClick / @click 等事件绑定/方法重写' },
      F5: { code: 'F5', name: '依赖/配置变动', description: 'router/store/i18n 配置、env、构建工具配置' }
    };
  }

  /**
   * 对文件进行前端代码分类
   */
  static classifyFile(filePath, fileInfo) {
    try {
      // 输入验证
      defaultErrorHandler.validateInput(filePath, 'string', 'filePath');
      defaultErrorHandler.validateInput(fileInfo, 'object', 'fileInfo');

      const indicators = [];
      const categoryScores = {
        F1: 0, F2: 0, F3: 0, F4: 0, F5: 0
      };

      // F1: 组件行为变更检测
      categoryScores.F1 = this.calculateBehaviorChangeScore(filePath, fileInfo, indicators);
      
      // F2: UI结构调整检测
      categoryScores.F2 = this.calculateUIStructureScore(filePath, fileInfo, indicators);
      
      // F3: 样式改动检测
      categoryScores.F3 = this.calculateStyleChangeScore(filePath, fileInfo, indicators);
      
      // F4: 交互事件修改检测
      categoryScores.F4 = this.calculateEventChangeScore(filePath, fileInfo, indicators);
      
      // F5: 依赖/配置变动检测
      categoryScores.F5 = this.calculateDependencyChangeScore(filePath, fileInfo, indicators);

      // 选择得分最高的类别
      const bestCategory = Object.keys(categoryScores).reduce((a, b) => 
        categoryScores[a] > categoryScores[b] ? a : b
      );

      const confidence = Math.min(categoryScores[bestCategory], 100) / 100;
      const category = this.CATEGORIES[bestCategory];

      return {
        filePath: fileInfo.relativePath,
        classification: {
          category: bestCategory,
          categoryName: category.name,
          description: category.description,
          reason: this.buildReason(bestCategory, indicators),
          confidence: confidence,
          indicators: indicators
        },
        changedMethods: fileInfo.methods ? fileInfo.methods.map(m => m.name) : []
      };
    } catch (error) {
      return defaultErrorHandler.handleError(error, {
        operation: 'classifyFile',
        filePath,
        fileInfo: { relativePath: fileInfo?.relativePath }
      });
    }
  }

  /**
   * F1: 计算组件行为变更分数
   */
  static calculateBehaviorChangeScore(filePath, fileInfo, indicators) {
    let score = 0;
    const content = fileInfo.content || '';

    // React Hooks 相关
    if (content.includes('useEffect') || content.includes('useState') || content.includes('useCallback')) {
      score += 30;
      indicators.push('检测到React Hooks使用');
    }

    // Vue生命周期方法
    if (content.includes('mounted') || content.includes('created') || content.includes('beforeDestroy')) {
      score += 30;
      indicators.push('检测到Vue生命周期方法');
    }

    // 状态管理相关
    if (content.includes('setState') || content.includes('this.state') || content.includes('reactive') || content.includes('ref(')) {
      score += 25;
      indicators.push('检测到状态管理逻辑');
    }

    // 业务逻辑方法名
    const methods = fileInfo.methods || [];
    methods.forEach(method => {
      const methodName = method.name.toLowerCase();
      if (methodName.includes('handle') || methodName.includes('process') || 
          methodName.includes('fetch') || methodName.includes('submit') ||
          methodName.includes('validate') || methodName.includes('calculate')) {
        score += 15;
        indicators.push(`业务逻辑方法: ${method.name}`);
      }
    });

    // 异步处理
    if (content.includes('async') || content.includes('await') || content.includes('.then(') || content.includes('Promise')) {
      score += 20;
      indicators.push('检测到异步处理逻辑');
    }

    return Math.min(score, 100);
  }

  /**
   * F2: 计算UI结构调整分数
   */
  static calculateUIStructureScore(filePath, fileInfo, indicators) {
    let score = 0;
    const content = fileInfo.content || '';

    // JSX 结构变化
    const jsxElements = content.match(/<[A-Z][A-Za-z0-9]*|<[a-z][a-z0-9-]*/g) || [];
    if (jsxElements.length > 5) {
      score += 35;
      indicators.push(`检测到${jsxElements.length}个JSX元素`);
    }

    // Vue template 结构
    if (content.includes('<template>') || content.includes('v-if') || content.includes('v-for')) {
      score += 35;
      indicators.push('检测到Vue模板结构');
    }

    // 组件文件类型
    if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx') || filePath.endsWith('.vue')) {
      score += 20;
      indicators.push('组件文件类型');
    }

    // 布局相关组件
    const layoutElements = ['div', 'section', 'article', 'header', 'footer', 'nav', 'main'];
    layoutElements.forEach(element => {
      if (content.includes(`<${element}`) || content.includes(`<${element.toUpperCase()}`)) {
        score += 5;
        indicators.push(`布局元素: ${element}`);
      }
    });

    // 条件渲染
    if (content.includes('v-if') || content.includes('v-show') || content.includes('{') && content.includes('?')) {
      score += 15;
      indicators.push('检测到条件渲染');
    }

    return Math.min(score, 100);
  }

  /**
   * F3: 计算样式改动分数
   */
  static calculateStyleChangeScore(filePath, fileInfo, indicators) {
    let score = 0;
    const content = fileInfo.content || '';

    // CSS/SCSS文件
    if (filePath.endsWith('.css') || filePath.endsWith('.scss') || filePath.endsWith('.sass') || filePath.endsWith('.less')) {
      score += 40;
      indicators.push('样式文件');
    }

    // 样式相关导入
    if (content.includes("import") && (content.includes(".css") || content.includes(".scss") || content.includes(".sass"))) {
      score += 25;
      indicators.push('检测到样式文件导入');
    }

    // 内联样式
    if (content.includes('style=') || content.includes('styled-components') || content.includes('emotion')) {
      score += 30;
      indicators.push('检测到内联样式或CSS-in-JS');
    }

    // className 变化
    const classNameMatches = content.match(/className=["|'`][^"'`]*["|'`]/g) || [];
    if (classNameMatches.length > 0) {
      score += 20;
      indicators.push(`检测到${classNameMatches.length}个className`);
    }

    // CSS模块
    if (content.includes('.module.css') || content.includes('styles.') || content.includes('classes.')) {
      score += 25;
      indicators.push('检测到CSS模块使用');
    }

    return Math.min(score, 100);
  }

  /**
   * F4: 计算交互事件修改分数
   */
  static calculateEventChangeScore(filePath, fileInfo, indicators) {
    let score = 0;
    const content = fileInfo.content || '';

    // React事件处理
    const reactEvents = ['onClick', 'onChange', 'onSubmit', 'onBlur', 'onFocus', 'onKeyDown', 'onKeyUp'];
    reactEvents.forEach(event => {
      if (content.includes(event)) {
        score += 10;
        indicators.push(`React事件: ${event}`);
      }
    });

    // Vue事件处理
    const vueEvents = ['@click', '@change', '@submit', '@blur', '@focus', '@keydown', '@keyup'];
    vueEvents.forEach(event => {
      if (content.includes(event)) {
        score += 10;
        indicators.push(`Vue事件: ${event}`);
      }
    });

    // 事件处理函数
    const methods = fileInfo.methods || [];
    methods.forEach(method => {
      const methodName = method.name.toLowerCase();
      if (methodName.includes('handle') || methodName.includes('on') || methodName.includes('click')) {
        score += 15;
        indicators.push(`事件处理函数: ${method.name}`);
      }
    });

    // 表单处理
    if (content.includes('form') || content.includes('Form') || content.includes('input') || content.includes('button')) {
      score += 20;
      indicators.push('检测到表单元素');
    }

    return Math.min(score, 100);
  }

  /**
   * F5: 计算依赖/配置变动分数
   */
  static calculateDependencyChangeScore(filePath, fileInfo, indicators) {
    let score = 0;
    const content = fileInfo.content || '';

    // 包依赖文件
    if (filePath.includes('package.json') || filePath.includes('yarn.lock') || filePath.includes('package-lock.json')) {
      score += 50;
      indicators.push('依赖管理文件');
    }

    // 路由配置
    if (content.includes('router') || content.includes('Route') || content.includes('useRouter') || content.includes('useNavigate')) {
      score += 30;
      indicators.push('检测到路由配置');
    }

    // 状态管理
    if (content.includes('store') || content.includes('redux') || content.includes('mobx') || content.includes('zustand')) {
      score += 30;
      indicators.push('检测到状态管理');
    }

    // 国际化
    if (content.includes('i18n') || content.includes('useTranslation') || content.includes('t(')) {
      score += 25;
      indicators.push('检测到国际化配置');
    }

    // 环境配置
    if (content.includes('process.env') || content.includes('import.meta.env') || content.includes('.env')) {
      score += 20;
      indicators.push('检测到环境配置');
    }

    // 构建工具配置
    if (filePath.includes('webpack') || filePath.includes('vite') || filePath.includes('rollup') || filePath.includes('babel')) {
      score += 35;
      indicators.push('构建工具配置文件');
    }

    return Math.min(score, 100);
  }

  /**
   * 构建分类原因说明
   */
  static buildReason(category, indicators) {
    if (!indicators || indicators.length === 0) {
      return '基于文件类型和内容的一般性分类';
    }
    
    const topIndicators = indicators.slice(0, 3); // 取前3个最重要的指标
    return `主要指标: ${topIndicators.join(', ')}`;
  }

  /**
   * 批量分类文件变更
   */
  static classifyChanges(files) {
    try {
      defaultErrorHandler.validateInput(files, 'array', 'files');
      
      return files.map(file => this.classifyFile(file.path, file));
    } catch (error) {
      return defaultErrorHandler.handleError(error, {
        operation: 'classifyChanges',
        fileCount: files?.length
      });
    }
  }

  /**
   * 生成分类摘要
   */
  static generateSummary(classifications) {
    try {
      defaultErrorHandler.validateInput(classifications, 'array', 'classifications');
      
      const summary = {
        totalFiles: classifications.length,
        byCategory: {},
        confidenceStats: {
          high: 0,    // > 0.8
          medium: 0,  // 0.5-0.8
          low: 0      // < 0.5
        }
      };

      classifications.forEach(classification => {
        const category = classification.classification.category;
        const confidence = classification.classification.confidence;

        // 统计分类
        summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;

        // 统计置信度
        if (confidence > 0.8) {
          summary.confidenceStats.high++;
        } else if (confidence > 0.5) {
          summary.confidenceStats.medium++;
        } else {
          summary.confidenceStats.low++;
        }
      });

      return summary;
    } catch (error) {
      return defaultErrorHandler.handleError(error, {
        operation: 'generateSummary',
        classificationCount: classifications?.length
      });
    }
  }

  /**
   * 获取分类显示名称
   */
  getCategoryDisplayName(category) {
    return this.CATEGORIES[category]?.name || category;
  }
}

module.exports = {
  FrontendChangeClassifier
}; 