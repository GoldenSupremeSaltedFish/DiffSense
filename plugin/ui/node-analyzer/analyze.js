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
      // Git变更分析选项
      enableGitAnalysis: options.enableGitAnalysis || false,
      branch: options.branch || 'master',
      commits: options.commits || null,
      since: options.since || null,
      until: options.until || null,
      startCommit: options.startCommit || null,
      endCommit: options.endCommit || null,
      ...options
    };
    this.project = null;
    // 初始化快照容器
    this.componentSnapshots = [];
    // Git变更信息
    this.gitChanges = null;
  }

  async analyze() {
    console.error(`🔍 开始分析目录: ${this.targetDir}`);
    console.error(`🔍 分析器选项: enableGitAnalysis=${this.options.enableGitAnalysis}, branch=${this.options.branch}, commits=${this.options.commits}`);
    
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
        // 添加错误信息
        errors: []
      };

      // 2. Git变更分析（如果启用）
      if (this.options.enableGitAnalysis) {
        console.error(`📝 执行Git变更分析...`);
        console.error(`📝 Git分析选项: branch=${this.options.branch}, commits=${this.options.commits}`);
        try {
          this.gitChanges = await this.analyzeGitChanges();
          result.gitChanges = this.gitChanges;
          console.error(`📝 Git分析完成，找到 ${this.gitChanges.commits ? this.gitChanges.commits.length : 0} 个提交`);
          
          // 如果有多个提交，为每个提交分别分析变更的文件
          if (this.gitChanges.commits && this.gitChanges.commits.length > 0) {
            console.error(`📝 开始分析 ${this.gitChanges.commits.length} 个提交的变更文件...`);
            const commitResults = [];
            for (const commitInfo of this.gitChanges.commits) {
              console.error(`📝 分析提交 ${commitInfo.commitHash}: ${commitInfo.changedFilesCount} 个文件`);
              if (commitInfo.changedFiles && commitInfo.changedFiles.length > 0) {
                // 分析该提交的变更文件
                const commitFiles = await this.analyzeChangedFilesForCommit(commitInfo.changedFiles, commitInfo.commitId);
                console.error(`📝 提交 ${commitInfo.commitHash} 分析完成: ${commitFiles.length} 个文件`);
                
                // 应用前端代码分类
                const { classifications, summary } = FrontendChangeClassifier.classifyChanges(commitFiles);
                
                commitResults.push({
                  ...commitInfo,
                  files: commitFiles,
                  changeClassifications: classifications,
                  classificationSummary: summary
                });
              } else {
                // 没有变更文件，仍然添加提交信息
                commitResults.push({
                  ...commitInfo,
                  files: [],
                  changeClassifications: [],
                  classificationSummary: { totalFiles: 0, categoryStats: {}, averageConfidence: 0 }
                });
              }
            }
            result.commits = commitResults;
            console.error(`📝 所有提交分析完成，共 ${commitResults.length} 个提交结果`);
          } else {
            console.error(`⚠️  Git分析未找到提交`);
          }
        } catch (error) {
          console.error('Git变更分析失败:', error.message);
          if (error.stack) {
            console.error('堆栈:', error.stack);
          }
          result.errors.push(`Git变更分析失败: ${error.message}`);
          result.gitChanges = { commits: [], error: error.message };
        }
      } else {
        console.error(`⚠️  Git分析未启用 (enableGitAnalysis=${this.options.enableGitAnalysis})`);
      }

      // 1. 使用madge分析模块依赖关系（如果没有Git分析或Git分析没有文件）
      if (!this.options.enableGitAnalysis || !result.commits || result.commits.length === 0) {
        const dependencyGraph = await this.analyzeDependencies();
        result.dependencies = dependencyGraph;

        // 2. 分析TypeScript/JavaScript代码
        const codeAnalysis = await this.analyzeCode();
        result.methods = codeAnalysis.methods;
        result.callGraph = codeAnalysis.callGraph;
        result.files = codeAnalysis.files;

        // 3. 应用前端代码分类
        if (result.files && result.files.length > 0) {
          const { classifications, summary } = FrontendChangeClassifier.classifyChanges(result.files);
          result.changeClassifications = classifications;
          result.classificationSummary = summary;
        }
      }

      // 4. 生成摘要信息
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

      } catch (error) {
        console.error(`分析文件失败 ${filePath}:`, error.message);
      }
    }

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
    const dependencyCount = result.dependencies ? result.dependencies.stats.totalDependencies : 0;

    return {
      totalFiles: fileCount,
      totalMethods: methodCount,
      totalDependencies: dependencyCount,
      circularDependencies: result.dependencies ? result.dependencies.stats.circularCount : 0,
      averageMethodsPerFile: fileCount > 0 ? Math.round(methodCount / fileCount * 100) / 100 : 0,
      analysisDate: result.timestamp
    };
  }

  /**
   * 分析Git变更
   */
  async analyzeGitChanges() {
    try {
      // 如果指定了提交数量，分别分析每个提交
      if (this.options.commits) {
        return await this.analyzeCommitsIndividually();
      } else if (this.options.since) {
        return await this.analyzeCommitsByDate();
      } else if (this.options.startCommit && this.options.endCommit) {
        return await this.analyzeCommitsByRange();
      } else {
        // 默认分析工作区变更
        return await this.analyzeWorkingTreeChanges();
      }
    } catch (error) {
      console.error(`❌ Git变更分析失败:`, error.message);
      return {
        commits: [],
        error: error.message
      };
    }
  }

  /**
   * 分别分析每个提交
   */
  async analyzeCommitsIndividually() {
    const commits = [];
    const numCommits = parseInt(this.options.commits, 10);
    
    // 获取仓库根目录（向上查找.git目录）
    let repoRoot = this.targetDir;
    let foundGit = false;
    while (repoRoot !== path.dirname(repoRoot)) {
      if (fs.existsSync(path.join(repoRoot, '.git'))) {
        foundGit = true;
        break;
      }
      repoRoot = path.dirname(repoRoot);
    }
    
    if (!foundGit) {
      console.error(`❌ 未找到Git仓库（从 ${this.targetDir} 向上查找）`);
      throw new Error(`未找到Git仓库，请确保在Git仓库目录中运行分析`);
    }
    
    console.error(`📁 Git仓库根目录: ${repoRoot}`);
    console.error(`📁 分析目标目录: ${this.targetDir}`);
    
    // 获取最近N个提交的信息
    const branch = this.options.branch || 'HEAD';
    const logCmd = `git log --format="%H|%s|%an|%ae|%ai" -n ${numCommits} ${branch}`;
    console.error(`📝 执行Git命令: ${logCmd}`);
    
    try {
      const logOutput = execSync(logCmd, { cwd: repoRoot, encoding: 'utf-8' });
      const commitLines = logOutput.trim().split('\n').filter(line => line.length > 0);
      
      console.error(`📝 找到 ${commitLines.length} 个提交，开始分别分析...`);
      
      for (let i = 0; i < commitLines.length; i++) {
        const [commitHash, message, authorName, authorEmail, authorDate] = commitLines[i].split('|');
        
        try {
          // 获取该提交的变更文件
          let changedFiles = [];
          if (i === 0) {
            // 第一个提交（最新的），与它的父提交比较
            try {
              const parentCmd = `git rev-parse ${commitHash}^`;
              const parentHash = execSync(parentCmd, { 
                cwd: repoRoot, 
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'ignore']
              }).trim();
              if (parentHash) {
                const diffCmd = `git diff --name-only ${parentHash} ${commitHash}`;
                const diffOutput = execSync(diffCmd, { cwd: repoRoot, encoding: 'utf-8' });
                changedFiles = diffOutput.trim().split('\n').filter(file => file.length > 0);
              }
            } catch (e) {
              // 如果没有父提交（初始提交），获取该提交的所有文件
              try {
                const showCmd = `git show --name-only --format="" ${commitHash}`;
                const showOutput = execSync(showCmd, { cwd: repoRoot, encoding: 'utf-8' });
                changedFiles = showOutput.trim().split('\n').filter(file => file.length > 0);
              } catch (showError) {
                // 如果获取文件列表也失败，使用空数组
                changedFiles = [];
              }
            }
          } else {
            // 其他提交，与它的父提交比较
            const parentHash = commitLines[i + 1] ? commitLines[i + 1].split('|')[0] : null;
            if (parentHash) {
              try {
                const diffCmd = `git diff --name-only ${parentHash} ${commitHash}`;
                const diffOutput = execSync(diffCmd, { cwd: repoRoot, encoding: 'utf-8' });
                changedFiles = diffOutput.trim().split('\n').filter(file => file.length > 0);
              } catch (e) {
                // diff失败，使用空数组
                changedFiles = [];
              }
            }
          }
          
          // 过滤前端相关文件，并转换为相对于targetDir的路径
          const frontendFiles = changedFiles
            .filter(file => {
              const ext = path.extname(file).toLowerCase();
              return ['.js', '.jsx', '.ts', '.tsx', '.vue', '.css', '.scss', '.sass', '.less'].includes(ext);
            })
            .map(file => {
              // 如果文件路径是相对于仓库根目录的，需要检查是否在targetDir内
              const fullPath = path.join(repoRoot, file);
              const relativePath = path.relative(this.targetDir, fullPath);
              // 如果文件不在targetDir内，返回null（会被过滤掉）
              if (relativePath.startsWith('..')) {
                return null;
              }
              return relativePath.replace(/\\/g, '/');
            })
            .filter(file => file !== null);
          
          commits.push({
            commitId: commitHash,
            commitHash: commitHash.substring(0, 7),
            message: message,
            author: {
              name: authorName,
              email: authorEmail
            },
            timestamp: new Date(authorDate).toISOString(),
            changedFilesCount: frontendFiles.length,
            changedFiles: frontendFiles
          });
          
          console.error(`✅ 分析提交 ${commitHash.substring(0, 7)}: ${frontendFiles.length}个文件`);
        } catch (error) {
          console.error(`❌ 分析提交 ${commitHash.substring(0, 7)} 失败:`, error.message);
          // 即使分析失败，也添加一个空结果
          commits.push({
            commitId: commitHash,
            commitHash: commitHash.substring(0, 7),
            message: message,
            author: {
              name: authorName || 'Unknown',
              email: authorEmail || 'unknown@example.com'
            },
            timestamp: new Date(authorDate).toISOString(),
            changedFilesCount: 0,
            changedFiles: [],
            error: error.message
          });
        }
      }
      
      console.error(`📝 Git变更分析完成: 共分析 ${commits.length} 个提交`);
      
      return {
        commits: commits,
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
      console.error(`❌ Git命令执行失败: ${error.message}`);
      if (error.stdout) {
        console.error(`stdout: ${error.stdout}`);
      }
      if (error.stderr) {
        console.error(`stderr: ${error.stderr}`);
      }
      throw error;
    }
  }

  /**
   * 按日期分析提交
   */
  async analyzeCommitsByDate() {
    // 获取仓库根目录
    let repoRoot = this.targetDir;
    while (repoRoot !== path.dirname(repoRoot)) {
      if (fs.existsSync(path.join(repoRoot, '.git'))) {
        break;
      }
      repoRoot = path.dirname(repoRoot);
    }
    
    let cmd = `git diff --name-only --since="${this.options.since}"`;
    if (this.options.until) {
      cmd += ` --until="${this.options.until}"`;
    }
    const output = execSync(cmd, { cwd: repoRoot, encoding: 'utf-8' });
    const changedFiles = output.trim().split('\n').filter(file => file.length > 0);
    
    const frontendFiles = changedFiles
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.js', '.jsx', '.ts', '.tsx', '.vue', '.css', '.scss', '.sass', '.less'].includes(ext);
      })
      .map(file => {
        const fullPath = path.join(repoRoot, file);
        const relativePath = path.relative(this.targetDir, fullPath);
        if (relativePath.startsWith('..')) {
          return null;
        }
        return relativePath.replace(/\\/g, '/');
      })
      .filter(file => file !== null);
    
    return {
      commits: [{
        commitId: 'date-range',
        changedFilesCount: frontendFiles.length,
        changedFiles: frontendFiles
      }],
      gitOptions: {
        branch: this.options.branch,
        since: this.options.since,
        until: this.options.until
      }
    };
  }

  /**
   * 按提交范围分析
   */
  async analyzeCommitsByRange() {
    // 获取仓库根目录
    let repoRoot = this.targetDir;
    while (repoRoot !== path.dirname(repoRoot)) {
      if (fs.existsSync(path.join(repoRoot, '.git'))) {
        break;
      }
      repoRoot = path.dirname(repoRoot);
    }
    
    const cmd = `git diff --name-only ${this.options.startCommit}..${this.options.endCommit}`;
    const output = execSync(cmd, { cwd: repoRoot, encoding: 'utf-8' });
    const changedFiles = output.trim().split('\n').filter(file => file.length > 0);
    
    const frontendFiles = changedFiles
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.js', '.jsx', '.ts', '.tsx', '.vue', '.css', '.scss', '.sass', '.less'].includes(ext);
      })
      .map(file => {
        const fullPath = path.join(repoRoot, file);
        const relativePath = path.relative(this.targetDir, fullPath);
        if (relativePath.startsWith('..')) {
          return null;
        }
        return relativePath.replace(/\\/g, '/');
      })
      .filter(file => file !== null);
    
    return {
      commits: [{
        commitId: `${this.options.startCommit}..${this.options.endCommit}`,
        changedFilesCount: frontendFiles.length,
        changedFiles: frontendFiles
      }],
      gitOptions: {
        startCommit: this.options.startCommit,
        endCommit: this.options.endCommit
      }
    };
  }

  /**
   * 分析工作区变更
   */
  async analyzeWorkingTreeChanges() {
    // 获取仓库根目录
    let repoRoot = this.targetDir;
    while (repoRoot !== path.dirname(repoRoot)) {
      if (fs.existsSync(path.join(repoRoot, '.git'))) {
        break;
      }
      repoRoot = path.dirname(repoRoot);
    }
    
    const cmd = `git diff --name-only`;
    const output = execSync(cmd, { cwd: repoRoot, encoding: 'utf-8' });
    const changedFiles = output.trim().split('\n').filter(file => file.length > 0);
    
    const frontendFiles = changedFiles
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.js', '.jsx', '.ts', '.tsx', '.vue', '.css', '.scss', '.sass', '.less'].includes(ext);
      })
      .map(file => {
        const fullPath = path.join(repoRoot, file);
        const relativePath = path.relative(this.targetDir, fullPath);
        if (relativePath.startsWith('..')) {
          return null;
        }
        return relativePath.replace(/\\/g, '/');
      })
      .filter(file => file !== null);
    
    return {
      commits: [{
        commitId: 'working-tree',
        changedFilesCount: frontendFiles.length,
        changedFiles: frontendFiles
      }],
      gitOptions: {}
    };
  }

  /**
   * 分析特定提交的变更文件，返回完整的文件信息
   */
  async analyzeChangedFilesForCommit(changedFiles, commitHash) {
    const fileInfos = [];
    
    // 获取仓库根目录
    let repoRoot = this.targetDir;
    while (repoRoot !== path.dirname(repoRoot)) {
      if (fs.existsSync(path.join(repoRoot, '.git'))) {
        break;
      }
      repoRoot = path.dirname(repoRoot);
    }
    
    for (const file of changedFiles) {
      try {
        // 构建文件在仓库中的完整路径
        const fullRepoPath = path.join(this.targetDir, file).replace(/\\/g, '/');
        const repoRelativePath = path.relative(repoRoot, fullRepoPath).replace(/\\/g, '/');
        
        // 获取该提交中该文件的内容
        let fileContent = '';
        try {
          const showCmd = `git show ${commitHash}:${repoRelativePath}`;
          fileContent = execSync(showCmd, { 
            cwd: repoRoot, 
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore']
          });
        } catch (e) {
          // 文件可能被删除，跳过
          continue;
        }
        
        if (!fileContent || fileContent.trim().length === 0) {
          continue;
        }
        
        // 分析文件内容
        const fileInfo = await this.analyzeFileContent(fileContent, file);
        fileInfos.push(fileInfo);
      } catch (error) {
        console.error(`❌ 分析文件失败: ${file}`, error.message);
      }
    }
    
    return fileInfos;
  }

  /**
   * 分析文件内容（不依赖文件系统）
   */
  async analyzeFileContent(content, relativePath) {
    const ext = path.extname(relativePath);
    const fileInfo = {
      path: relativePath,
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
        if (!this.project) {
          this.project = new Project({
            tsConfigFilePath: this.findTsConfig(),
            skipAddingFilesFromTsConfig: true
          });
        }
        const sourceFile = this.project.createSourceFile(relativePath, content, { overwrite: true });
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
  console.error(`🔍 解析命令行参数，共 ${args.length} 个参数`);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--max-depth' && args[i + 1]) {
      options.maxDepth = parseInt(args[i + 1], 10) || 15;
      i++;
    } else if (arg === '--branch' && args[i + 1]) {
      options.branch = args[i + 1];
      console.error(`✅ 解析到 --branch: ${args[i + 1]}`);
      i++;
    } else if (arg === '--commits' && args[i + 1]) {
      options.commits = parseInt(args[i + 1], 10);
      console.error(`✅ 解析到 --commits: ${args[i + 1]} (解析为: ${options.commits})`);
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

  console.error(`🔍 参数解析完成: branch=${options.branch}, commits=${options.commits}, since=${options.since}, until=${options.until}`);
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

    // 如果提供了Git相关参数，启用Git分析
    if (parsedOptions.branch || parsedOptions.commits || parsedOptions.since || 
        parsedOptions.until || parsedOptions.startCommit || parsedOptions.endCommit) {
      analyzerOptions.enableGitAnalysis = true;
      analyzerOptions.branch = parsedOptions.branch;
      analyzerOptions.commits = parsedOptions.commits;
      analyzerOptions.since = parsedOptions.since;
      analyzerOptions.until = parsedOptions.until;
      analyzerOptions.startCommit = parsedOptions.startCommit;
      analyzerOptions.endCommit = parsedOptions.endCommit;
      console.error(`🔧 启用Git分析: branch=${parsedOptions.branch}, commits=${parsedOptions.commits}`);
    } else {
      console.error(`⚠️  未检测到Git参数，跳过Git分析`);
    }

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
      if (result.summary.totalDependencies !== undefined) {
        console.log(`依赖数: ${result.summary.totalDependencies}`);
      }
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