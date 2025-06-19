#!/usr/bin/env node

/**
 * DiffSense前端代码分析器
 * 分析JavaScript/TypeScript代码的依赖关系、方法调用等
 */

const madge = require('madge');
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
      exclude: ['node_modules/**', 'dist/**', 'build/**', '**/*.test.*', '**/*.spec.*'],
      maxDepth: 15, // 增加递归深度以支持微服务项目
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
        dependencies: {},
        methods: {},
        callGraph: { nodes: [], edges: [] },
        files: [],
        componentSnapshots: [],
        // 添加前端分类结果
        changeClassifications: [],
        classificationSummary: {}
      };

      // 1. 使用madge分析模块依赖关系
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

// 命令行调用
async function main() {
  const targetDir = process.argv[2] || process.cwd();
  const outputFormat = process.argv[3] || 'json';

  try {
    const analyzer = new FrontendAnalyzer(targetDir);
    const result = await analyzer.analyze();

    if (outputFormat === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('📊 分析完成!');
      console.log(`文件数: ${result.summary.totalFiles}`);
      console.log(`方法数: ${result.summary.totalMethods}`);
      console.log(`依赖数: ${result.summary.totalDependencies}`);
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

module.exports = FrontendAnalyzer; 