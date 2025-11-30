#!/usr/bin/env node

/**
 * DiffSense前端代码分析器
 * 分析JavaScript/TypeScript代码的依赖关系、方法调用等
 */

const madge = require('madge');
const path = require('path');
const fs = require('fs');
const glob = require('glob');
const { execSync } = require('child_process');
const { Project } = require('ts-morph');
const { extractSnapshotsForFile } = require('./snapshotExtractors');
const FrontendGranularAnalyzer = require('./granularAnalyzer');

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
      exclude: ['node_modules/**', 'dist/**', 'build/**', '**/*.test.*', '**/*.spec.*'],
      maxDepth: 15, // 增加递归深度以支持微服务项目
      enableMicroserviceDetection: true, // 启用微服务检测
      enableBuildToolDetection: true, // 启用构建工具检测
      enableFrameworkDetection: true, // 启用框架检测
      includeTypeTags: options.includeTypeTags || false, // 添加细粒度分析选项
      // Git变更分析选项
      enableGitAnalysis: false,
      branch: 'master',
      commits: null,
      since: null,
      until: null,
      startCommit: null,
      endCommit: null,
      // 调用图生成配置
      enableCallGraph: options.enableCallGraph !== false, // 默认启用
      callGraphTimeout: options.callGraphTimeout || 60000, // 默认60秒整体超时
      maxFilesToAnalyze: options.maxFilesToAnalyze || 1000, // 最大分析文件数
      enableSampling: options.enableSampling !== false, // 默认启用采样
      samplingRatio: options.samplingRatio || 0.5, // 采样比例（大项目时）
      ...options
    };
    this.project = null;
    // 初始化快照容器
    this.componentSnapshots = [];
    // 微服务检测结果
    this.microserviceDetection = null;
    // 新增：Git变更信息
    this.gitChanges = null;
    
    // 初始化细粒度分析器
    if (this.options.includeTypeTags) {
      this.granularAnalyzer = new FrontendGranularAnalyzer();
    }
  }

  async analyze() {
    console.error(`🔍 开始分析目录: ${this.targetDir}`);
    
    try {
      const result = {
        timestamp: new Date().toISOString(),
        targetDir: this.targetDir,
        summary: {},
        dependencies: {},
        methods: {},
        callGraph: { nodes: [], edges: [] },
        files: [],
        componentSnapshots: [],
        // 添加前端分类结果
        changeClassifications: [],
        classificationSummary: {},
        // 添加细粒度修改详情
        modifications: [],
        // 添加微服务检测结果
        microserviceDetection: null,
        // 新增：Git变更信息
        gitChanges: null
      };

      // 1. 执行微服务项目检测
      if (this.options.enableMicroserviceDetection) {
        console.error(`🏗️ 开始微服务项目检测...`);
        this.microserviceDetection = await this.detectMicroserviceFeatures();
        result.microserviceDetection = this.microserviceDetection;
        
        if (this.microserviceDetection.isMicroservice) {
          console.error(`✅ 检测到微服务项目: ${this.microserviceDetection.framework}, 构建工具: ${this.microserviceDetection.buildTool}`);
          // 根据微服务特征调整分析策略
          this.adjustAnalysisStrategy();
        } else {
          console.error(`📦 检测到单体应用项目`);
        }
      }

      // 2. Git变更分析
      if (this.options.enableGitAnalysis) {
        console.error(`📝 执行Git变更分析...`);
        this.gitChanges = await this.analyzeGitChanges();
        result.gitChanges = this.gitChanges;
      }

      // 3. 使用madge分析模块依赖关系
      const dependencyGraph = await this.analyzeDependencies();
      result.dependencies = dependencyGraph;

      // 4. 分析TypeScript/JavaScript代码（带超时控制）
      const codeAnalysis = await this.analyzeCodeWithTimeout();
      result.methods = codeAnalysis.methods;
      result.callGraph = codeAnalysis.callGraph;
      result.files = codeAnalysis.files;

      // 5. 应用前端代码分类
      if (result.files && result.files.length > 0) {
        const { classifications, summary } = FrontendChangeClassifier.classifyChanges(result.files);
        result.changeClassifications = classifications;
        result.classificationSummary = summary;
        
        // 6. 执行细粒度分析（如果启用）
        if (this.options.includeTypeTags && this.granularAnalyzer) {
          const allModifications = [];
          for (const fileInfo of result.files) {
            // 获取真实的diff内容
            const diffContent = await this.getFileDiff(fileInfo.relativePath, fileInfo.content);
            
            const modifications = this.granularAnalyzer.analyzeFileChanges(
              fileInfo.relativePath,
              fileInfo.methods,
              diffContent || '', // 使用真实diff，如果无法获取则使用空字符串
              fileInfo.content
            );
            allModifications.push(...modifications);
          }
          result.modifications = allModifications;
        }
      }

      // 7. 生成摘要信息
      result.summary = this.generateSummary(result);
      result.componentSnapshots = this.componentSnapshots;

      return result;

    } catch (error) {
      console.error('❌ 分析失败:', error.message);
      throw error;
    }
  }

  async analyzeDependencies() {
    console.error('📦 分析模块依赖关系...');
    
    try {
      const res = await madge(this.targetDir, {
        fileExtensions: ['js', 'jsx', 'ts', 'tsx'],
        excludeRegExp: this.options.exclude.map(pattern => {
          // 修复正则表达式构建
          const regexPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
          return new RegExp(regexPattern);
        }),
        includeNpm: this.options.includeNodeModules
      });

      const dependencies = res.obj();
      const circular = res.circular();
      
      console.error(`📊 发现 ${Object.keys(dependencies).length} 个模块`);
      if (circular.length > 0) {
        console.error(`⚠️  发现 ${circular.length} 个循环依赖`);
      }

      return {
        graph: dependencies,
        circular: circular,
        stats: {
          totalFiles: Object.keys(dependencies).length,
          totalDependencies: Object.values(dependencies).reduce((sum, deps) => sum + deps.length, 0),
          circularCount: circular.length
        }
      };

    } catch (error) {
      console.error('依赖分析失败:', error.message);
      return { graph: {}, circular: [], stats: { totalFiles: 0, totalDependencies: 0, circularCount: 0 } };
    }
  }

  async analyzeCodeWithTimeout() {
    // 检查是否启用调用图生成
    if (!this.options.enableCallGraph) {
      console.error('⚠️  调用图生成已禁用，返回空调用图');
      return {
        methods: {},
        callGraph: { nodes: [], edges: [] },
        files: []
      };
    }

    // 使用Promise.race实现整体超时控制
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`调用图生成超时 (${this.options.callGraphTimeout}ms)，启用熔断机制`));
      }, this.options.callGraphTimeout);
    });

    try {
      const result = await Promise.race([
        this.analyzeCode(),
        timeoutPromise
      ]);
      return result;
    } catch (error) {
      if (error.message.includes('超时') || error.message.includes('timeout')) {
        console.error('⏱️  调用图生成超时，使用快速fallback模式');
        // 超时后返回部分结果
        return {
          methods: {},
          callGraph: { nodes: [], edges: [] },
          files: [],
          timeout: true,
          message: '调用图生成超时，已启用熔断机制'
        };
      }
      throw error;
    }
  }

  async analyzeCode() {
    console.error('🔬 分析代码结构...');
    
    const files = glob.sync(this.options.filePattern, {
      cwd: this.targetDir,
      ignore: this.options.exclude,
      absolute: true,
      maxDepth: this.options.maxDepth // 使用配置的深度
    });

    console.error(`�� 找到 ${files.length} 个文件`);

    const methods = {};
    const callGraphNodes = [];
    const callGraphEdges = [];
    const fileInfos = [];

    // 初始化TypeScript项目
    this.project = new Project({
      tsConfigFilePath: this.findTsConfig(),
      skipAddingFilesFromTsConfig: true
    });

    for (const filePath of files) {
      try {
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
        // 每处理50个文件输出一次进度
        if (processedCount % 50 === 0) {
          console.error(`📊 调用图分析进度: ${processedCount}/${filesToAnalyze.length} (已用 ${Math.round(elapsed / 1000)}s)`);
        }

      } catch (error) {
        if (error.message.includes('超时') || error.message.includes('timeout')) {
          console.error(`⏱️  文件分析超时 ${filePath}`);
        } else {
          console.error(`分析文件失败 ${filePath}:`, error.message);
        }
        skippedCount++;
      }
    }

    if (skippedCount > 0) {
      console.error(`⚠️  跳过了 ${skippedCount} 个文件的分析（超时或错误）`);
    }

    console.error(`✅ 调用图分析完成: ${processedCount} 个文件，${callGraphNodes.length} 节点，${callGraphEdges.length} 边`);

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

  /**
   * 检测微服务特征
   */
  async detectMicroserviceFeatures() {
    try {
      console.error(`🔍 开始微服务特征检测...`);
      
      const result = {
        isMicroservice: false,
        buildTool: 'unknown',
        framework: 'unknown',
        architectureFeatures: [],
        serviceTypes: [],
        deploymentConfig: {}
      };
      
      // 检测构建工具
      if (this.options.enableBuildToolDetection) {
        result.buildTool = await this.detectBuildTool();
      }
      
      // 检测微服务架构特征
      result.architectureFeatures = await this.detectArchitectureFeatures();
      
      // 检测服务类型
      result.serviceTypes = await this.detectServiceTypes();
      
      // 检测微服务框架
      if (this.options.enableFrameworkDetection) {
        result.framework = await this.detectFramework();
      }
      
      // 检测部署配置
      result.deploymentConfig = await this.detectDeploymentConfig();
      
      // 判断是否为微服务项目
      result.isMicroservice = this.determineIfMicroservice(result);
      
      console.error(`🏗️ 微服务检测结果: ${result.isMicroservice ? '✅ 微服务项目' : '❌ 单体应用'}`);
      return result;
      
    } catch (error) {
      console.error(`❌ 微服务特征检测失败:`, error.message);
      return {
        isMicroservice: false,
        buildTool: 'unknown',
        framework: 'unknown',
        architectureFeatures: [],
        serviceTypes: [],
        deploymentConfig: {}
      };
    }
  }
  
  /**
   * 检测构建工具
   */
  async detectBuildTool() {
    const buildTools = [
      'package.json', 'package-lock.json', 'yarn.lock',
      'vite.config.js', 'vite.config.ts', 'webpack.config.js', 'webpack.config.ts',
      'rollup.config.js', 'rollup.config.ts', 'parcel.config.js',
      'angular.json', 'next.config.js', 'nuxt.config.js',
      'vue.config.js', 'svelte.config.js', 'astro.config.mjs'
    ];
    
    for (const buildTool of buildTools) {
      const buildFilePath = path.join(this.targetDir, buildTool);
      if (fs.existsSync(buildFilePath)) {
        const tool = this.mapBuildFileToTool(buildTool);
        console.error(`🔧 检测到构建工具: ${tool} (${buildTool})`);
        return tool;
      }
    }
    
    console.error(`⚠️ 未检测到构建工具`);
    return 'unknown';
  }
  
  /**
   * 将构建文件名映射到工具名
   */
  mapBuildFileToTool(fileName) {
    switch (fileName) {
      case 'package.json':
      case 'package-lock.json':
      case 'yarn.lock':
        return 'npm';
      case 'vite.config.js':
      case 'vite.config.ts':
        return 'vite';
      case 'webpack.config.js':
      case 'webpack.config.ts':
        return 'webpack';
      case 'rollup.config.js':
      case 'rollup.config.ts':
        return 'rollup';
      case 'parcel.config.js':
        return 'parcel';
      case 'angular.json':
        return 'angular';
      case 'next.config.js':
        return 'next';
      case 'nuxt.config.js':
        return 'nuxt';
      case 'vue.config.js':
        return 'vue-cli';
      case 'svelte.config.js':
        return 'svelte';
      case 'astro.config.mjs':
        return 'astro';
      default:
        return 'unknown';
    }
  }
  
  /**
   * 检测微服务架构特征
   */
  async detectArchitectureFeatures() {
    const features = [];
    const microservicePatterns = [
      '*_service', 'service_*', '*-service', 'service-*',
      '*_api', 'api_*', '*-api', 'api-*',
      '*_gateway', 'gateway_*', '*-gateway', 'gateway-*',
      '*_config', 'config_*', '*-config', 'config-*',
      '*_registry', 'registry_*', '*-registry', 'registry-*',
      'packages', 'apps', 'services', 'modules'
    ];
    
    try {
      const files = glob.sync('**/*', {
        cwd: this.targetDir,
        ignore: this.options.exclude,
        maxDepth: this.options.maxDepth,
        nodir: true
      });
      
      for (const pattern of microservicePatterns) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
        const matches = files.filter(file => regex.test(file));
        if (matches.length > 0) {
          features.push(pattern);
          console.error(`🏛️ 检测到微服务架构特征: ${pattern} (${matches.length}个匹配)`);
        }
      }
    } catch (error) {
      console.error(`❌ 架构特征检测失败:`, error.message);
    }
    
    return features;
  }
  
  /**
   * 检测服务类型
   */
  async detectServiceTypes() {
    const serviceTypes = [];
    const servicePatterns = [
      'user', 'order', 'product', 'payment', 'auth', 'config', 
      'registry', 'discovery', 'notification', 'file', 'search',
      'admin', 'dashboard', 'portal', 'api', 'gateway'
    ];
    
    try {
      const files = glob.sync('**/*', {
        cwd: this.targetDir,
        ignore: this.options.exclude,
        maxDepth: this.options.maxDepth,
        nodir: true
      });
      
      for (const serviceType of servicePatterns) {
        const regex = new RegExp(serviceType, 'i');
        const matches = files.filter(file => regex.test(file));
        if (matches.length > 0) {
          serviceTypes.push(`${serviceType}-service`);
          console.error(`🔧 检测到服务类型: ${serviceType}-service (${matches.length}个匹配)`);
        }
      }
    } catch (error) {
      console.error(`❌ 服务类型检测失败:`, error.message);
    }
    
    return serviceTypes;
  }
  
  /**
   * 检测微服务框架
   */
  async detectFramework() {
    const frameworkIndicators = {
      'next-micro': ['next.config.js', 'pages/api', 'app/api'],
      'nuxt-micro': ['nuxt.config.js', 'server/api'],
      'vue-micro': ['vue.config.js', 'src/services'],
      'react-micro': ['src/services', 'src/api'],
      'angular-micro': ['angular.json', 'src/app/services'],
      'svelte-micro': ['svelte.config.js', 'src/lib/services'],
      'express-micro': ['express', 'app.js', 'server.js'],
      'fastify-micro': ['fastify', 'server.js'],
      'koa-micro': ['koa', 'app.js'],
      'nest-micro': ['nest', 'main.ts', 'app.module.ts']
    };
    
    try {
      const files = glob.sync('**/*', {
        cwd: this.targetDir,
        ignore: this.options.exclude,
        maxDepth: this.options.maxDepth,
        nodir: true
      });
      
      for (const [framework, indicators] of Object.entries(frameworkIndicators)) {
        for (const indicator of indicators) {
          const matches = files.filter(file => file.includes(indicator));
          if (matches.length > 0) {
            console.error(`🏗️ 检测到微服务框架: ${framework}`);
            return framework;
          }
        }
      }
    } catch (error) {
      console.error(`❌ 框架检测失败:`, error.message);
    }
    
    return 'unknown';
  }
  
  /**
   * 检测部署配置
   */
  async detectDeploymentConfig() {
    const deployment = {};
    
    try {
      const files = glob.sync('**/*', {
        cwd: this.targetDir,
        ignore: this.options.exclude,
        maxDepth: 3,
        nodir: true
      });
      
      // 检查Docker配置
      const dockerFiles = files.filter(file => 
        file.includes('Dockerfile') || file.includes('docker-compose')
      );
      if (dockerFiles.length > 0) {
        deployment.containerization = 'docker';
        console.error(`🚀 检测到Docker配置: ${dockerFiles.length}个文件`);
      }
      
      // 检查Kubernetes配置
      const k8sFiles = files.filter(file => 
        file.includes('.yaml') || file.includes('.yml') || 
        file.includes('k8s') || file.includes('kubernetes')
      );
      if (k8sFiles.length > 0) {
        deployment.orchestration = 'kubernetes';
        console.error(`☸️ 检测到Kubernetes配置: ${k8sFiles.length}个文件`);
      }
      
      // 检查云平台配置
      const cloudFiles = files.filter(file => 
        file.includes('aws') || file.includes('azure') || file.includes('gcp') ||
        file.includes('vercel') || file.includes('netlify') || file.includes('railway')
      );
      if (cloudFiles.length > 0) {
        deployment.cloudPlatform = 'detected';
        console.error(`☁️ 检测到云平台配置: ${cloudFiles.length}个文件`);
      }
      
    } catch (error) {
      console.error(`❌ 部署配置检测失败:`, error.message);
    }
    
    return deployment;
  }
  
  /**
   * 判断是否为微服务项目
   */
  determineIfMicroservice(detectionResult) {
    // 如果有微服务架构特征，认为是微服务项目
    if (detectionResult.architectureFeatures.length > 0) {
      return true;
    }
    
    // 如果检测到多个服务类型，认为是微服务项目
    if (detectionResult.serviceTypes.length > 1) {
      return true;
    }
    
    // 如果使用微服务框架，认为是微服务项目
    if (detectionResult.framework !== 'unknown' && detectionResult.framework.includes('-micro')) {
      return true;
    }
    
    // 检查是否有monorepo特征
    const hasMonorepoFeatures = detectionResult.architectureFeatures.some(feature => 
      ['packages', 'apps', 'services', 'modules'].includes(feature)
    );
    
    if (hasMonorepoFeatures) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 分析Git变更
   */
  async analyzeGitChanges() {
    try {
      
      let changedFiles = [];
      
      // 根据不同的Git参数获取变更文件
      if (this.options.commits) {
        // 分析最近N个提交
        const cmd = `git diff --name-only HEAD~${this.options.commits} HEAD`;
        const output = execSync(cmd, { cwd: this.targetDir, encoding: 'utf-8' });
        changedFiles = output.trim().split('\n').filter(file => file.length > 0);
      } else if (this.options.since) {
        // 分析指定日期以来的变更
        let cmd = `git diff --name-only --since="${this.options.since}"`;
        if (this.options.until) {
          cmd += ` --until="${this.options.until}"`;
        }
        const output = execSync(cmd, { cwd: this.targetDir, encoding: 'utf-8' });
        changedFiles = output.trim().split('\n').filter(file => file.length > 0);
      } else if (this.options.startCommit && this.options.endCommit) {
        // 分析两个提交之间的变更
        const cmd = `git diff --name-only ${this.options.startCommit}..${this.options.endCommit}`;
        const output = execSync(cmd, { cwd: this.targetDir, encoding: 'utf-8' });
        changedFiles = output.trim().split('\n').filter(file => file.length > 0);
      } else {
        // 默认分析工作区变更
        const cmd = `git diff --name-only`;
        const output = execSync(cmd, { cwd: this.targetDir, encoding: 'utf-8' });
        changedFiles = output.trim().split('\n').filter(file => file.length > 0);
      }
      
      // 过滤前端相关文件
      const frontendFiles = changedFiles.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.js', '.jsx', '.ts', '.tsx', '.vue', '.css', '.scss', '.sass', '.less'].includes(ext);
      });
      
      // 分析变更的方法
      const changedMethods = await this.analyzeChangedMethods(frontendFiles);
      
      console.error(`📝 Git变更分析完成: ${frontendFiles.length}个文件, ${changedMethods.length}个方法`);
      
      return {
        changedFilesCount: frontendFiles.length,
        changedMethodsCount: changedMethods.length,
        changedFiles: frontendFiles,
        changedMethods: changedMethods,
        gitOptions: {
          branch: this.options.branch,
          commits: this.options.commits,
          since: this.options.since,
          until: this.options.until,
          startCommit: this.options.startCommit,
          endCommit: this.options.endCommit
        }
      };
      
    } catch (error) {
      console.error(`❌ Git变更分析失败:`, error.message);
      return {
        changedFilesCount: 0,
        changedMethodsCount: 0,
        changedFiles: [],
        changedMethods: [],
        error: error.message
      };
    }
  }

  /**
   * 分析变更文件中的方法
   */
  async analyzeChangedMethods(changedFiles) {
    const changedMethods = [];
    
    for (const file of changedFiles) {
      const fullPath = path.join(this.targetDir, file);
      
      // 检查文件是否存在
      if (!fs.existsSync(fullPath)) {
        continue;
      }
      
      try {
        // 分析文件中的方法
        const methods = await this.extractMethodsFromFile(fullPath, file);
        changedMethods.push(...methods);
      } catch (error) {
        console.error(`❌ 分析文件方法失败: ${file}`, error.message);
      }
    }
    
    return changedMethods;
  }

  /**
   * 从文件中提取方法信息
   */
  async extractMethodsFromFile(fullPath, relativePath) {
    const methods = [];
    const content = fs.readFileSync(fullPath, 'utf-8');
    const ext = path.extname(fullPath).toLowerCase();
    
    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      // 使用TypeScript编译器分析
      try {
        const project = new Project();
        const sourceFile = project.createSourceFile(fullPath, content);
        
        // 提取函数和方法
        sourceFile.getFunctions().forEach(func => {
          methods.push({
            name: func.getName() || 'anonymous',
            type: 'function',
            signature: func.getText().split('{')[0].trim(),
            file: relativePath,
            line: func.getStartLineNumber()
          });
        });
        
        // 提取类方法
        sourceFile.getClasses().forEach(cls => {
          cls.getMethods().forEach(method => {
            methods.push({
              name: method.getName(),
              type: 'method',
              signature: method.getText().split('{')[0].trim(),
              file: relativePath,
              line: method.getStartLineNumber(),
              className: cls.getName()
            });
          });
        });
        
      } catch (error) {
        console.error(`❌ TypeScript分析失败: ${relativePath}`, error.message);
      }
    }
    
    return methods;
  }

  /**
   * 根据微服务特征调整分析策略
   */
  adjustAnalysisStrategy() {
    if (!this.microserviceDetection || !this.microserviceDetection.isMicroservice) {
      return;
    }
    
    console.error(`🔧 根据微服务特征调整分析策略...`);
    
    // 增加分析深度
    this.options.maxDepth = Math.max(this.options.maxDepth, 20);
    console.error(`📏 调整分析深度: ${this.options.maxDepth}`);
    
    // 扩展文件模式以包含更多微服务相关文件
    const additionalPatterns = [
      '**/*.config.js', '**/*.config.ts', '**/*.config.json',
      '**/Dockerfile*', '**/docker-compose*', '**/*.yaml', '**/*.yml',
      '**/package.json', '**/tsconfig.json', '**/vite.config.*'
    ];
    
    this.options.filePattern = `{${this.options.filePattern},${additionalPatterns.join(',')}}`;
    console.error(`📁 扩展文件模式: ${this.options.filePattern}`);
    
    // 根据框架调整排除模式
    if (this.microserviceDetection.framework.includes('next')) {
      this.options.exclude.push('**/.next/**', '**/out/**');
    } else if (this.microserviceDetection.framework.includes('nuxt')) {
      this.options.exclude.push('**/.nuxt/**', '**/dist/**');
    }
    
    console.error(`✅ 分析策略调整完成`);
  }

  /**
   * 获取文件的diff内容
   * 优先使用git diff，如果无法获取则使用computeDiff（需要oldContent/newContent）
   */
  async getFileDiff(relativePath, newContent) {
    try {
      // 如果启用了Git分析，尝试使用git diff获取真实diff
      if (this.options.enableGitAnalysis && this.gitChanges) {
        const gitOptions = this.gitChanges.gitOptions;
        let oldCommit = null;
        let newCommit = 'HEAD';
        
        // 根据Git选项确定要比较的commit
        if (gitOptions.commits) {
          oldCommit = `HEAD~${gitOptions.commits}`;
          newCommit = 'HEAD';
        } else if (gitOptions.startCommit && gitOptions.endCommit) {
          oldCommit = gitOptions.startCommit;
          newCommit = gitOptions.endCommit;
        } else {
          // 工作区变更，比较HEAD和工作区
          oldCommit = 'HEAD';
          newCommit = 'WORKTREE';
        }
        
        // 尝试使用git diff获取unified diff
        try {
          const diffCmd = newCommit === 'WORKTREE' 
            ? `git diff HEAD -- ${relativePath}`
            : `git diff ${oldCommit} ${newCommit} -- ${relativePath}`;
          
          const gitDiff = execSync(diffCmd, { 
            cwd: this.targetDir, 
            encoding: 'utf-8', 
            stdio: ['pipe', 'pipe', 'ignore'] 
          });
          
          if (gitDiff && gitDiff.trim()) {
            // 将git diff格式转换为简单格式（只保留+和-行）
            const lines = gitDiff.split('\n');
            const simpleDiff = lines
              .filter(line => line.startsWith('+') || line.startsWith('-'))
              .filter(line => !line.startsWith('+++') && !line.startsWith('---'))
              .join('\n');
            return simpleDiff || '';
          }
        } catch (err) {
          // git diff失败，fallback到computeDiff
        }
        
        // Fallback: 获取oldContent并计算diff
        const oldContent = getFileContentAtCommit(oldCommit, relativePath, this.targetDir);
        if (oldContent !== null && newContent) {
          return computeDiff(oldContent, newContent);
        }
      }
      
      // 如果没有Git分析或无法获取，返回空字符串（granularAnalyzer会处理）
      return '';
    } catch (error) {
      console.error(`获取diff失败 ${relativePath}:`, error.message);
      return '';
    }
  }

  generateSummary(result) {
    const fileCount = result.files.length;
    const methodCount = Object.values(result.methods).reduce((sum, methods) => sum + methods.length, 0);
    const dependencyCount = result.dependencies.stats.totalDependencies;

    return {
      totalFiles: fileCount,
      totalMethods: methodCount,
      totalDependencies: dependencyCount,
      circularDependencies: result.dependencies.stats.circularCount,
      averageMethodsPerFile: fileCount > 0 ? Math.round(methodCount / fileCount * 100) / 100 : 0,
      analysisDate: result.timestamp
    };
  }
}

/**
 * 分析文件变更
 * @param {Object} options 分析选项
 * @param {string} options.oldContent 旧文件内容
 * @param {string} options.newContent 新文件内容
 * @param {string} options.filePath 文件路径
 * @param {boolean} options.includeTypeTags 是否包含类型标签
 * @returns {Promise<Object>} 分析结果
 */
async function analyze(options) {
  const { oldContent, newContent, filePath, includeTypeTags } = options;
  const analyzer = new FrontendGranularAnalyzer();
  
  // 计算文件差异
  const diffContent = computeDiff(oldContent, newContent);
  
  // 分析变更
  const changes = analyzer.analyzeFileChanges(filePath, [], diffContent, newContent);
  
  return {
    filePath,
    changes,
    includeTypeTags
  };
}

/**
 * 计算两个文本之间的差异（unified diff格式）
 */
function computeDiff(oldContent, newContent) {
  if (!oldContent && !newContent) return '';
  if (!oldContent) {
    // 新文件，所有行都是新增
    return newContent.split('\n').map(line => `+${line}`).join('\n');
  }
  if (!newContent) {
    // 删除的文件，所有行都是删除
    return oldContent.split('\n').map(line => `-${line}`).join('\n');
  }
  
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  // 使用简单的行对比算法生成unified diff
  let diff = '';
  let i = 0, j = 0;
  
  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      // 只有新行
      diff += `+${newLines[j]}\n`;
      j++;
    } else if (j >= newLines.length) {
      // 只有旧行
      diff += `-${oldLines[i]}\n`;
      i++;
    } else if (oldLines[i] === newLines[j]) {
      // 相同行，跳过（不输出）
      i++;
      j++;
    } else {
      // 检查是否是连续的变化
      let oldMatch = false, newMatch = false;
      
      // 检查旧行是否在后面的新行中出现
      for (let k = j + 1; k < Math.min(j + 5, newLines.length); k++) {
        if (oldLines[i] === newLines[k]) {
          newMatch = true;
          break;
        }
      }
      
      // 检查新行是否在后面的旧行中出现
      for (let k = i + 1; k < Math.min(i + 5, oldLines.length); k++) {
        if (newLines[j] === oldLines[k]) {
          oldMatch = true;
          break;
        }
      }
      
      if (newMatch && !oldMatch) {
        // 新行插入
        diff += `+${newLines[j]}\n`;
        j++;
      } else if (oldMatch && !newMatch) {
        // 旧行删除
        diff += `-${oldLines[i]}\n`;
        i++;
      } else {
        // 修改：删除旧行，添加新行
        diff += `-${oldLines[i]}\n`;
        diff += `+${newLines[j]}\n`;
        i++;
        j++;
      }
    }
  }
  
  return diff;
}

/**
 * 获取文件在指定commit的内容
 */
function getFileContentAtCommit(commit, filePath, targetDir) {
  if (commit === 'WORKTREE' || !commit) {
    // 读取工作区文件
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(targetDir, filePath);
      return fs.readFileSync(fullPath, 'utf-8');
    } catch (err) {
      return null;
    }
  }
  try {
    const output = execSync(`git show ${commit}:${filePath}`, { 
      cwd: targetDir, 
      encoding: 'utf-8', 
      stdio: ['pipe', 'pipe', 'ignore'] 
    });
    return output;
  } catch (err) {
    return null; // 文件在该 commit 不存在
  }
}

module.exports = {
  analyze,
  FrontendAnalyzer,
  FrontendChangeClassifier
};

// 命令行调用
async function main() {
  const targetDir = process.argv[2] || process.cwd();
  const outputFormat = process.argv[3] || 'json';
  
  // 解析命令行选项
  const options = {
    // Git变更分析选项
    branch: 'master',
    commits: null,
    since: null,
    until: null,
    startCommit: null,
    endCommit: null,
    enableGitAnalysis: false
  };
  
  for (let i = 4; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--enable-microservice-detection') {
      options.enableMicroserviceDetection = process.argv[i + 1] === 'true';
      i++;
    } else if (arg === '--enable-build-tool-detection') {
      options.enableBuildToolDetection = process.argv[i + 1] === 'true';
      i++;
    } else if (arg === '--enable-framework-detection') {
      options.enableFrameworkDetection = process.argv[i + 1] === 'true';
      i++;
    } else if (arg === '--max-depth') {
      options.maxDepth = parseInt(process.argv[i + 1]);
      i++;
    } else if (arg === '--branch') {
      options.branch = process.argv[i + 1];
      options.enableGitAnalysis = true;
      i++;
    } else if (arg === '--commits') {
      options.commits = parseInt(process.argv[i + 1]);
      options.enableGitAnalysis = true;
      i++;
    } else if (arg === '--since') {
      options.since = process.argv[i + 1];
      options.enableGitAnalysis = true;
      i++;
    } else if (arg === '--until') {
      options.until = process.argv[i + 1];
      options.enableGitAnalysis = true;
      i++;
    } else if (arg === '--start-commit') {
      options.startCommit = process.argv[i + 1];
      options.enableGitAnalysis = true;
      i++;
    } else if (arg === '--end-commit') {
      options.endCommit = process.argv[i + 1];
      options.enableGitAnalysis = true;
      i++;
    }
  }

  try {
    const analyzer = new FrontendAnalyzer(targetDir, options);
    const result = await analyzer.analyze();

    if (outputFormat === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('📊 分析完成!');
      console.log(`文件数: ${result.summary.totalFiles}`);
      console.log(`方法数: ${result.summary.totalMethods}`);
      console.log(`依赖数: ${result.summary.totalDependencies}`);
      
      // 显示Git变更信息
      if (result.gitChanges) {
        console.log('\n📝 Git变更分析:');
        console.log(`  变更文件数: ${result.gitChanges.changedFilesCount}`);
        console.log(`  变更方法数: ${result.gitChanges.changedMethodsCount}`);
      }
      
      // 显示微服务检测结果
      if (result.microserviceDetection) {
        console.log('\n🏗️ 微服务检测结果:');
        console.log(`  项目类型: ${result.microserviceDetection.isMicroservice ? '微服务项目' : '单体应用'}`);
        console.log(`  构建工具: ${result.microserviceDetection.buildTool}`);
        console.log(`  框架: ${result.microserviceDetection.framework}`);
        console.log(`  架构特征: ${result.microserviceDetection.architectureFeatures.join(', ')}`);
        console.log(`  服务类型: ${result.microserviceDetection.serviceTypes.join(', ')}`);
      }
    }

  } catch (error) {
    console.error('分析失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}