#!/usr/bin/env node

/**
 * DiffSense前端代码分析器
 * 分析JavaScript/TypeScript代码的依赖关系、方法调用等
 */

const path = require('path');
const fs = require('fs');
const glob = require('glob');
const { Project } = require('ts-morph');
const { extractSnapshotsForFile } = require('./snapshotExtractors');

/**
 * 前端代码修改分类器 - 适用于 React / Vue / JS/TS
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

    // Tailwind CSS
    if (content.includes('tailwind') || content.match(/class.*=.*["'`][^"'`]*\b(bg-|text-|p-|m-|w-|h-)/)) {
      score += 25;
      indicators.push('检测到Tailwind CSS');
    }

    return Math.min(score, 100);
  }

  /**
   * F4: 计算交互事件修改分数
   */
  static calculateEventChangeScore(filePath, fileInfo, indicators) {
    let score = 0;
    const content = fileInfo.content || '';

    // React 事件处理
    const reactEvents = ['onClick', 'onChange', 'onSubmit', 'onBlur', 'onFocus', 'onMouseOver', 'onKeyPress'];
    reactEvents.forEach(event => {
      if (content.includes(event)) {
        score += 15;
        indicators.push(`检测到React事件: ${event}`);
      }
    });

    // Vue 事件处理
    const vueEvents = ['@click', '@change', '@submit', '@blur', '@focus', 'v-on:'];
    vueEvents.forEach(event => {
      if (content.includes(event)) {
        score += 15;
        indicators.push(`检测到Vue事件: ${event}`);
      }
    });

    // 事件处理方法
    const methods = fileInfo.methods || [];
    methods.forEach(method => {
      const methodName = method.name.toLowerCase();
      if (methodName.startsWith('on') || methodName.startsWith('handle') || 
          methodName.includes('click') || methodName.includes('change') ||
          methodName.includes('submit') || methodName.includes('toggle')) {
        score += 10;
        indicators.push(`事件处理方法: ${method.name}`);
      }
    });

    // 原生DOM事件
    if (content.includes('addEventListener') || content.includes('removeEventListener')) {
      score += 20;
      indicators.push('检测到原生DOM事件绑定');
    }

    // 表单处理
    if (content.includes('<form') || content.includes('<input') || content.includes('<button')) {
      score += 15;
      indicators.push('检测到表单交互元素');
    }

    return Math.min(score, 100);
  }

  /**
   * F5: 计算依赖/配置变动分数
   */
  static calculateDependencyChangeScore(filePath, fileInfo, indicators) {
    let score = 0;

    // 配置文件
    const configFiles = [
      'package.json', 'webpack.config.js', 'vite.config.js', 'vue.config.js',
      'babel.config.js', 'tsconfig.json', '.env', 'tailwind.config.js',
      'next.config.js', 'nuxt.config.js', 'angular.json'
    ];
    
    if (configFiles.some(config => filePath.includes(config))) {
      score += 50;
      indicators.push('配置文件修改');
    }

    // 路由配置
    if (filePath.includes('router') || filePath.includes('route') || filePath.includes('Routes')) {
      score += 40;
      indicators.push('路由配置文件');
    }

    // 状态管理配置
    if (filePath.includes('store') || filePath.includes('redux') || filePath.includes('vuex') || filePath.includes('pinia')) {
      score += 35;
      indicators.push('状态管理配置');
    }

    // 国际化配置
    if (filePath.includes('i18n') || filePath.includes('locale') || filePath.includes('lang')) {
      score += 30;
      indicators.push('国际化配置');
    }

    // 依赖导入变化
    const imports = fileInfo.imports || [];
    if (imports.length > 0) {
      score += Math.min(imports.length * 5, 25);
      indicators.push(`检测到${imports.length}个导入依赖`);
    }

    // 环境变量使用
    const content = fileInfo.content || '';
    if (content.includes('process.env') || content.includes('import.meta.env')) {
      score += 20;
      indicators.push('检测到环境变量使用');
    }

    return Math.min(score, 100);
  }

  /**
   * 构建分类原因说明
   */
  static buildReason(category, indicators) {
    const categoryName = this.CATEGORIES[category].name;
    if (indicators.length === 0) {
      return `分类为${categoryName}`;
    }
    return `分类为${categoryName}，主要依据: ${indicators.slice(0, 3).join(', ')}`;
  }

  /**
   * 批量分类文件
   */
  static classifyChanges(files) {
    const classifications = files.map(file => this.classifyFile(file.relativePath, file));
    const summary = this.generateSummary(classifications);
    
    return { classifications, summary };
  }

  /**
   * 生成分类摘要
   */
  static generateSummary(classifications) {
    const categoryStats = {};
    let totalConfidence = 0;
    const detailedClassifications = {};

    // 初始化统计
    Object.keys(this.CATEGORIES).forEach(category => {
      categoryStats[category] = 0;
      detailedClassifications[category] = [];
    });

    // 统计分类结果
    classifications.forEach(classification => {
      const category = classification.classification.category;
      categoryStats[category]++;
      totalConfidence += classification.classification.confidence;
      detailedClassifications[category].push(classification);
    });

    return {
      totalFiles: classifications.length,
      categoryStats,
      averageConfidence: classifications.length > 0 ? totalConfidence / classifications.length : 0,
      detailedClassifications
    };
  }

  getCategoryDisplayName(category) {
    const names = {
      // 后端分类
      'A1': '业务逻辑变更',
      'A2': '接口变更',
      'A3': '数据结构变更', 
      'A4': '中间件/框架调整',
      'A5': '非功能性修改',
      // 前端分类
      'F1': '组件行为变更',
      'F2': 'UI结构调整',
      'F3': '样式改动',
      'F4': '交互事件修改',
      'F5': '依赖/配置变动'
    };
    return names[category] || '未知类型';
  }
}

class FrontendAnalyzer {
  constructor(targetDir, options = {}) {
    this.targetDir = path.resolve(targetDir);
    this.options = {
      includeNodeModules: false,
      // 支持 .vue 文件以便提取组件快照
      filePattern: '**/*.{js,jsx,ts,tsx,vue}',
      // 扩展exclude模式，确保排除所有不需要的目录
      exclude: [
        '**/node_modules/**',      // 所有层级的node_modules
        '**/dist/**',               // 所有层级的dist
        '**/build/**',              // 所有层级的build
        '**/out/**',                // 所有层级的out
        '**/.git/**',               // Git目录
        '**/.vscode/**',            // VSCode配置
        '**/.idea/**',              // IntelliJ IDEA配置
        '**/.next/**',              // Next.js构建输出
        '**/.nuxt/**',              // Nuxt.js构建输出
        '**/coverage/**',           // 测试覆盖率报告
        '**/.cache/**',             // 缓存目录
        '**/.turbo/**',             // Turbo缓存
        '**/.parcel-cache/**',      // Parcel缓存
        '**/.vite/**',              // Vite缓存
        '**/node_modules',          // node_modules目录本身
        '**/dist',                  // dist目录本身
        '**/build',                 // build目录本身
        '**/out',                   // out目录本身
        '**/*.test.*',              // 测试文件
        '**/*.spec.*',              // 测试规范文件
        '**/test-results/**',       // 测试结果
        '**/playwright-report/**',  // Playwright报告
        '**/.nyc_output/**',        // NYC覆盖率输出
        '**/logs/**',               // 日志目录
        '**/tmp/**',                // 临时目录
        '**/temp/**'                // 临时目录
      ],
      maxDepth: options.maxDepth || 15, // 从选项或默认值
      enableMicroserviceDetection: options.enableMicroserviceDetection !== false,
      enableBuildToolDetection: options.enableBuildToolDetection !== false,
      enableFrameworkDetection: options.enableFrameworkDetection !== false,
      ...options
    };
    this.project = null;
    // 初始化快照容器
    this.componentSnapshots = [];
  }

  async analyze() {
    console.error(`🔍 开始分析目录: ${this.targetDir}`);
    
    try {
      const result = {
        timestamp: new Date().toISOString(),
        targetDir: this.targetDir,
        summary: {},
        methods: {},
        callGraph: { nodes: [], edges: [] },
        files: [],
        componentSnapshots: [],
        // 添加前端分类结果
        changeClassifications: [],
        classificationSummary: {},
        // 添加错误信息
        errors: []
      };

      // 前端项目不分析依赖关系，直接分析代码
      // 1. 分析TypeScript/JavaScript代码
      try {
        const codeAnalysis = await this.analyzeCode();
        result.methods = codeAnalysis.methods;
        result.callGraph = codeAnalysis.callGraph;
        result.files = codeAnalysis.files;
      } catch (error) {
        console.error('代码分析失败:', error.message);
        result.errors.push(`代码分析失败: ${error.message}`);
        // 即使失败也返回部分结果
        result.methods = result.methods || {};
        result.callGraph = result.callGraph || { nodes: [], edges: [] };
        result.files = result.files || [];
      }

      // 3. 应用前端代码分类
      if (result.files && result.files.length > 0) {
        try {
          const { classifications, summary } = FrontendChangeClassifier.classifyChanges(result.files);
          result.changeClassifications = classifications;
          result.classificationSummary = summary;
        } catch (error) {
          console.error('分类失败:', error.message);
          result.errors.push(`分类失败: ${error.message}`);
          result.changeClassifications = [];
          result.classificationSummary = {};
        }
      }

      // 4. 生成摘要信息
      try {
        result.summary = this.generateSummary(result);
        result.componentSnapshots = this.componentSnapshots;
      } catch (error) {
        console.error('摘要生成失败:', error.message);
        result.errors.push(`摘要生成失败: ${error.message}`);
        result.summary = { totalFiles: result.files.length || 0, totalMethods: 0, averageMethodsPerFile: 0, analysisDate: result.timestamp };
      }

      // 如果有错误但仍有部分结果，记录警告但不抛出异常
      if (result.errors.length > 0 && result.files.length === 0) {
        throw new Error(`分析失败: ${result.errors.join('; ')}`);
      }

      return result;

    } catch (error) {
      console.error('❌ 分析失败:', error.message);
      if (error.stack) {
        console.error('堆栈:', error.stack);
      }
      throw error;
    }
  }

  /**
   * 检查文件是否应该被排除
   * 严格排除所有依赖、构建产物和测试文件
   */
  shouldExcludeFile(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
    const relativePath = path.relative(this.targetDir, filePath).replace(/\\/g, '/').toLowerCase();
    
    // 严格排除模式 - 使用更精确的匹配
    const excludePatterns = [
      // 依赖目录（最严格）
      /[\/\\]node_modules[\/\\]/i,
      /^node_modules[\/\\]/i,
      /[\/\\]node_modules$/i,
      // 构建产物
      /[\/\\]dist[\/\\]/i,
      /[\/\\]build[\/\\]/i,
      /[\/\\]out[\/\\]/i,
      /[\/\\]\.next[\/\\]/i,
      /[\/\\]\.nuxt[\/\\]/i,
      // 工具和配置目录
      /[\/\\]\.git[\/\\]/i,
      /[\/\\]\.vscode[\/\\]/i,
      /[\/\\]\.idea[\/\\]/i,
      // 缓存目录
      /[\/\\]coverage[\/\\]/i,
      /[\/\\]\.cache[\/\\]/i,
      /[\/\\]\.turbo[\/\\]/i,
      /[\/\\]\.parcel-cache[\/\\]/i,
      /[\/\\]\.vite[\/\\]/i,
      // 测试相关
      /[\/\\]test-results[\/\\]/i,
      /[\/\\]playwright-report[\/\\]/i,
      /[\/\\]\.nyc_output[\/\\]/i,
      // 临时目录
      /[\/\\]logs[\/\\]/i,
      /[\/\\]tmp[\/\\]/i,
      /[\/\\]temp[\/\\]/i,
      // 测试文件
      /\.test\./i,
      /\.spec\./i,
      // package-lock.json 和 yarn.lock 等依赖锁定文件
      /package-lock\.json$/i,
      /yarn\.lock$/i,
      /pnpm-lock\.yaml$/i
    ];

    // 检查完整路径和相对路径
    return excludePatterns.some(pattern => 
      pattern.test(normalizedPath) || pattern.test(relativePath)
    );
  }

  async analyzeCode() {
    console.error('🔬 分析代码结构...');
    
    // 首先检查是否存在 node_modules，如果存在则明确排除
    const nodeModulesPath = path.join(this.targetDir, 'node_modules');
    const hasNodeModules = fs.existsSync(nodeModulesPath);
    
    if (hasNodeModules) {
      console.error('⚠️  检测到 node_modules 目录，将自动排除');
    }
    
    const files = glob.sync(this.options.filePattern, {
      cwd: this.targetDir,
      ignore: this.options.exclude,
      absolute: true,
      maxDepth: this.options.maxDepth, // 使用配置的深度
      // 添加 nodir 选项，只匹配文件
      nodir: true
    });

    // 严格的文件过滤，确保排除所有依赖和构建产物
    const filteredFiles = files.filter(filePath => {
      // 转换为统一路径格式
      const normalizedPath = path.normalize(filePath).replace(/\\/g, '/');
      const relativePath = path.relative(this.targetDir, filePath).replace(/\\/g, '/');
      
      // 严格检查：如果路径中包含 node_modules，直接排除
      if (normalizedPath.includes('node_modules') || relativePath.includes('node_modules')) {
        return false;
      }
      
      // 检查其他排除模式
      if (this.shouldExcludeFile(filePath)) {
        return false;
      }
      
      // 确保文件在目标目录内（防止符号链接等问题）
      if (!normalizedPath.startsWith(path.normalize(this.targetDir).replace(/\\/g, '/'))) {
        return false;
      }
      
      return true;
    });

    console.error(`📄 找到 ${files.length} 个文件（过滤前）`);
    console.error(`📄 过滤后剩余 ${filteredFiles.length} 个文件`);

    // 文件数量检查和处理限制
    const MAX_FILES_TO_PROCESS = 10000; // 限制最大处理文件数
    if (filteredFiles.length > MAX_FILES_TO_PROCESS) {
      console.error(`⚠️  警告: 文件数量过多 (${filteredFiles.length})，将限制处理前 ${MAX_FILES_TO_PROCESS} 个文件`);
      filteredFiles.splice(MAX_FILES_TO_PROCESS);
    } else if (filteredFiles.length > 5000) {
      console.error(`⚠️  警告: 文件数量过多 (${filteredFiles.length})，分析可能需要较长时间`);
    }

    const methods = {};
    const callGraphNodes = [];
    const callGraphEdges = [];
    const fileInfos = [];
    let processedCount = 0;
    const totalFiles = filteredFiles.length;

    // 初始化TypeScript项目
    this.project = new Project({
      tsConfigFilePath: this.findTsConfig(),
      skipAddingFilesFromTsConfig: true
    });

    // 文件大小限制（10MB）
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    for (const filePath of filteredFiles) {
      try {
        // 检查文件大小
        const stats = fs.statSync(filePath);
        if (stats.size > MAX_FILE_SIZE) {
          console.error(`⚠️  跳过过大文件: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
          continue;
        }

        const fileInfo = await this.analyzeFile(filePath);
        fileInfos.push(fileInfo);

        // 组件功能快照提取
        const snapshots = extractSnapshotsForFile(filePath, fileInfo.content);
        if (snapshots && snapshots.length > 0) {
          this.componentSnapshots.push(...snapshots);
        }

        // 收集方法信息
        if (fileInfo.methods && fileInfo.methods.length > 0) {
          methods[fileInfo.relativePath] = fileInfo.methods;

          // 为每个方法创建节点
          fileInfo.methods.forEach(method => {
            const nodeId = `${fileInfo.relativePath}:${method.name}`;
            callGraphNodes.push({
              data: {
                id: nodeId,
                label: method.name,
                signature: method.signature,
                file: fileInfo.relativePath,
                type: method.type || 'function'
              }
            });

            // 创建调用关系边
            if (method.calls && method.calls.length > 0) {
              method.calls.forEach(calledMethod => {
                const targetId = `${fileInfo.relativePath}:${calledMethod}`;
                callGraphEdges.push({
                  data: {
                    id: `${nodeId}->${targetId}`,
                    source: nodeId,
                    target: targetId,
                    type: 'calls'
                  }
                });
              });
            }
          });
        }

        processedCount++;
        // 每处理100个文件显示一次进度
        if (processedCount % 100 === 0) {
          console.error(`📊 进度: ${processedCount}/${totalFiles} (${Math.round(processedCount / totalFiles * 100)}%)`);
        }

      } catch (error) {
        console.error(`分析文件失败 ${filePath}:`, error.message);
      }
    }

    console.error(`✅ 完成分析: ${processedCount}/${totalFiles} 个文件`);

    return {
      methods,
      callGraph: { nodes: callGraphNodes, edges: callGraphEdges },
      files: fileInfos
    };
  }

  async analyzeFile(filePath) {
    const relativePath = path.relative(this.targetDir, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);

    const fileInfo = {
      path: filePath,
      relativePath: relativePath,
      extension: ext,
      size: content.length,
      lines: content.split('\n').length,
      methods: [],
      imports: [],
      exports: [],
      content: content
    };

    try {
      if (ext === '.ts' || ext === '.tsx') {
        // TypeScript分析
        const sourceFile = this.project.createSourceFile(filePath, content, { overwrite: true });
        this.analyzeTypeScriptFile(sourceFile, fileInfo);
      } else if (ext === '.js' || ext === '.jsx') {
        // JavaScript分析
        this.analyzeJavaScriptFile(content, fileInfo);
      }
    } catch (error) {
      console.error(`解析文件失败 ${relativePath}:`, error.message);
    }

    return fileInfo;
  }

  analyzeTypeScriptFile(sourceFile, fileInfo) {
    // 分析函数和方法
    const functions = sourceFile.getFunctions();
    const classes = sourceFile.getClasses();
    const arrowFunctions = sourceFile.getVariableStatements()
      .flatMap(stmt => stmt.getDeclarations())
      .filter(decl => decl.getInitializer()?.getKind() === 204); // ArrowFunction

    // 普通函数
    functions.forEach(func => {
      const name = func.getName() || 'anonymous';
      fileInfo.methods.push({
        name: name,
        signature: `${name}(${func.getParameters().map(p => p.getName()).join(', ')})`,
        type: 'function',
        line: func.getStartLineNumber(),
        calls: this.extractCallsFromNode(func)
      });
    });

    // 类方法
    classes.forEach(cls => {
      const className = cls.getName();
      cls.getMethods().forEach(method => {
        const methodName = method.getName();
        fileInfo.methods.push({
          name: `${className}.${methodName}`,
          signature: `${className}.${methodName}(${method.getParameters().map(p => p.getName()).join(', ')})`,
          type: 'method',
          line: method.getStartLineNumber(),
          calls: this.extractCallsFromNode(method)
        });
      });
    });

    // 分析导入导出
    sourceFile.getImportDeclarations().forEach(imp => {
      fileInfo.imports.push({
        module: imp.getModuleSpecifierValue(),
        imports: imp.getNamedImports().map(ni => ni.getName())
      });
    });

    sourceFile.getExportDeclarations().forEach(exp => {
      fileInfo.exports.push({
        module: exp.getModuleSpecifierValue(),
        exports: exp.getNamedExports().map(ne => ne.getName())
      });
    });
  }

  analyzeJavaScriptFile(content, fileInfo) {
    // 简单的正则匹配分析JavaScript
    const functionRegex = /function\s+(\w+)\s*\([^)]*\)/g;
    const arrowFunctionRegex = /(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g;
    const methodRegex = /(\w+)\s*:\s*function\s*\([^)]*\)/g;

    let match;

    // 普通函数
    while ((match = functionRegex.exec(content)) !== null) {
      fileInfo.methods.push({
        name: match[1],
        signature: match[0],
        type: 'function',
        line: content.substring(0, match.index).split('\n').length,
        calls: []
      });
    }

    // 箭头函数
    while ((match = arrowFunctionRegex.exec(content)) !== null) {
      fileInfo.methods.push({
        name: match[1],
        signature: match[0],
        type: 'arrow-function',
        line: content.substring(0, match.index).split('\n').length,
        calls: []
      });
    }

    // 对象方法
    while ((match = methodRegex.exec(content)) !== null) {
      fileInfo.methods.push({
        name: match[1],
        signature: match[0],
        type: 'method',
        line: content.substring(0, match.index).split('\n').length,
        calls: []
      });
    }
  }

  extractCallsFromNode(node) {
    // 简化的调用提取逻辑
    const calls = [];
    const text = node.getText();
    const callRegex = /(\w+)\s*\(/g;
    
    let match;
    while ((match = callRegex.exec(text)) !== null) {
      const functionName = match[1];
      if (functionName !== 'if' && functionName !== 'for' && functionName !== 'while') {
        calls.push(functionName);
      }
    }
    
    return [...new Set(calls)]; // 去重
  }

  findTsConfig() {
    const possiblePaths = [
      path.join(this.targetDir, 'tsconfig.json'),
      path.join(this.targetDir, '..', 'tsconfig.json'),
      path.join(this.targetDir, '..', '..', 'tsconfig.json')
    ];

    for (const tsConfigPath of possiblePaths) {
      if (fs.existsSync(tsConfigPath)) {
        console.error(`📋 找到 tsconfig.json: ${tsConfigPath}`);
        return tsConfigPath;
      }
    }

    console.error('⚠️  未找到 tsconfig.json，使用默认配置');
    return undefined;
  }

  generateSummary(result) {
    const fileCount = result.files.length;
    const methodCount = Object.values(result.methods).reduce((sum, methods) => sum + methods.length, 0);

    return {
      totalFiles: fileCount,
      totalMethods: methodCount,
      averageMethodsPerFile: fileCount > 0 ? Math.round(methodCount / fileCount * 100) / 100 : 0,
      analysisDate: result.timestamp
    };
  }
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    targetDir: process.cwd(),
    outputFormat: 'json',
    maxDepth: 15,
    enableMicroserviceDetection: true,
    enableBuildToolDetection: true,
    enableFrameworkDetection: true
  };

  // 第一个参数是目标目录（如果不是以--开头）
  if (args.length > 0 && !args[0].startsWith('--')) {
    options.targetDir = args[0];
  }

  // 第二个参数是输出格式（如果不是以--开头）
  if (args.length > 1 && !args[1].startsWith('--')) {
    options.outputFormat = args[1];
  }

  // 解析所有--参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--max-depth' && args[i + 1]) {
      options.maxDepth = parseInt(args[i + 1], 10) || 15;
      i++;
    } else if (arg === '--branch' && args[i + 1]) {
      options.branch = args[i + 1];
      i++;
    } else if (arg === '--commits' && args[i + 1]) {
      options.commits = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--since' && args[i + 1]) {
      options.since = args[i + 1];
      i++;
    } else if (arg === '--until' && args[i + 1]) {
      options.until = args[i + 1];
      i++;
    } else if (arg === '--start-commit' && args[i + 1]) {
      options.startCommit = args[i + 1];
      i++;
    } else if (arg === '--end-commit' && args[i + 1]) {
      options.endCommit = args[i + 1];
      i++;
    } else if (arg === '--enable-microservice-detection' && args[i + 1]) {
      options.enableMicroserviceDetection = args[i + 1] === 'true';
      i++;
    } else if (arg === '--enable-build-tool-detection' && args[i + 1]) {
      options.enableBuildToolDetection = args[i + 1] === 'true';
      i++;
    } else if (arg === '--enable-framework-detection' && args[i + 1]) {
      options.enableFrameworkDetection = args[i + 1] === 'true';
      i++;
    }
  }

  return options;
}

// 命令行调用
async function main() {
  const parsedOptions = parseArgs();
  const targetDir = parsedOptions.targetDir;
  const outputFormat = parsedOptions.outputFormat;

  try {
    // 构建分析器选项
    const analyzerOptions = {
      maxDepth: parsedOptions.maxDepth,
      enableMicroserviceDetection: parsedOptions.enableMicroserviceDetection,
      enableBuildToolDetection: parsedOptions.enableBuildToolDetection,
      enableFrameworkDetection: parsedOptions.enableFrameworkDetection
    };

    const analyzer = new FrontendAnalyzer(targetDir, analyzerOptions);
    const result = await analyzer.analyze();

    // 如果有错误但仍有部分结果，输出警告
    if (result.errors && result.errors.length > 0) {
      console.error('⚠️  分析过程中出现错误:', result.errors.join('; '));
    }

    if (outputFormat === 'json') {
      // 确保输出到 stdout，错误信息输出到 stderr
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('📊 分析完成!');
      console.log(`文件数: ${result.summary.totalFiles}`);
      console.log(`方法数: ${result.summary.totalMethods}`);
      if (result.errors && result.errors.length > 0) {
        console.log(`警告: ${result.errors.length} 个错误`);
      }
    }

  } catch (error) {
    console.error('分析失败:', error.message);
    if (error.stack) {
      console.error('堆栈:', error.stack);
    }
    // 即使失败也尝试输出错误信息作为 JSON
    if (outputFormat === 'json') {
      const errorResult = {
        timestamp: new Date().toISOString(),
        targetDir: targetDir,
        error: error.message,
        summary: { totalFiles: 0, totalMethods: 0, averageMethodsPerFile: 0 },
        methods: {},
        callGraph: { nodes: [], edges: [] },
        files: [],
        componentSnapshots: [],
        changeClassifications: [],
        classificationSummary: {},
        errors: [error.message]
      };
      console.log(JSON.stringify(errorResult, null, 2));
    }
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = FrontendAnalyzer; 