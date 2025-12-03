import * as vscode from 'vscode';
import * as path from 'path';
import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as glob from 'glob';

// 新增：变更分类接口定义
interface FileClassification {
  filePath: string;
  classification: {
    category: string;
    categoryName: string;
    description: string;
    reason: string;
    confidence: number;
    indicators: string[];
  };
  changedMethods: string[];
}

interface ClassificationSummary {
  totalFiles: number;
  categoryStats: Record<string, number>;
  averageConfidence: number;
  detailedClassifications: Record<string, any[]>;
}

// 新增：前端变更分类器
class FrontendChangeClassifier {
  
  private static readonly CATEGORIES = {
    F1: { code: 'F1', name: '组件行为变更', description: 'useEffect / methods 中的逻辑变化' },
    F2: { code: 'F2', name: 'UI结构调整', description: 'JSX/Template 中的标签结构调整' },
    F3: { code: 'F3', name: '样式改动', description: '类名变化、内联样式/模块CSS/SCSS调整' },
    F4: { code: 'F4', name: '交互事件修改', description: 'onClick / @click 等事件绑定/方法重写' },
    F5: { code: 'F5', name: '依赖/配置变动', description: 'router/store/i18n 配置、env、构建工具配置' }
  };

  private static classifyFile(filePath: string, fileInfo: any): FileClassification {
    const indicators: string[] = [];
    const categoryScores: Record<string, number> = {
      'F1': 0, 'F2': 0, 'F3': 0, 'F4': 0, 'F5': 0
    };

    const content = fileInfo.content || '';
    const methods = fileInfo.methods || [];

    // F1: 组件行为变更检测
    categoryScores.F1 = this.calculateBehaviorChangeScore(filePath, content, methods, indicators);
    
    // F2: UI结构调整检测
    categoryScores.F2 = this.calculateUIStructureScore(filePath, content, indicators);
    
    // F3: 样式改动检测
    categoryScores.F3 = this.calculateStyleChangeScore(filePath, content, indicators);
    
    // F4: 交互事件修改检测
    categoryScores.F4 = this.calculateEventChangeScore(filePath, content, methods, indicators);
    
    // F5: 依赖/配置变动检测
    categoryScores.F5 = this.calculateDependencyChangeScore(filePath, content, fileInfo, indicators);

    // 选择得分最高的类别
    const bestCategory = Object.keys(categoryScores).reduce((a, b) => 
      categoryScores[a] > categoryScores[b] ? a : b
    ) as keyof typeof this.CATEGORIES;

    const confidence = Math.min(categoryScores[bestCategory], 100) / 100;
    const category = this.CATEGORIES[bestCategory];

    return {
      filePath,
      classification: {
        category: bestCategory,
        categoryName: category.name,
        description: category.description,
        reason: this.buildReason(bestCategory, indicators),
        confidence,
        indicators
      },
      changedMethods: methods.map((m: any) => m.name || 'unknown')
    };
  }

  private static calculateBehaviorChangeScore(filePath: string, content: string, methods: any[], indicators: string[]): number {
    let score = 0;

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
    methods.forEach(method => {
      const methodName = (method.name || '').toLowerCase();
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

  private static calculateUIStructureScore(filePath: string, content: string, indicators: string[]): number {
    let score = 0;

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
    if (content.includes('v-if') || content.includes('v-show') || (content.includes('{') && content.includes('?'))) {
      score += 15;
      indicators.push('检测到条件渲染');
    }

    return Math.min(score, 100);
  }

  private static calculateStyleChangeScore(filePath: string, content: string, indicators: string[]): number {
    let score = 0;

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

  private static calculateEventChangeScore(filePath: string, content: string, methods: any[], indicators: string[]): number {
    let score = 0;

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
    methods.forEach(method => {
      const methodName = (method.name || '').toLowerCase();
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

  private static calculateDependencyChangeScore(filePath: string, content: string, fileInfo: any, indicators: string[]): number {
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
    if (content.includes('process.env') || content.includes('import.meta.env')) {
      score += 20;
      indicators.push('检测到环境变量使用');
    }

    return Math.min(score, 100);
  }

  private static buildReason(category: string, indicators: string[]): string {
    const categoryName = this.CATEGORIES[category as keyof typeof this.CATEGORIES].name;
    if (indicators.length === 0) {
      return `分类为${categoryName}`;
    }
    return `分类为${categoryName}，主要依据: ${indicators.slice(0, 3).join(', ')}`;
  }

  public static classifyChanges(files: any[]): { classifications: FileClassification[], summary: ClassificationSummary } {
    const classifications = files.map(file => 
      this.classifyFile(file.relativePath || file.path, file)
    );
    const summary = this.generateSummary(classifications);
    return { classifications, summary };
  }

  private static generateSummary(classifications: FileClassification[]): ClassificationSummary {
    const categoryStats: Record<string, number> = {};
    let totalConfidence = 0;
    const detailedClassifications: Record<string, any[]> = {};

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
}

// 新增：Golang变更分类器
class GolangChangeClassifier {
  private static classifyFile(filePath: string, functions: any[]): FileClassification {
    const indicators: string[] = [];
    let category = 'A5'; // 默认为非功能性修改
    let categoryName = '非功能性修改';
    let description = '注释、日志优化、格式整理、性能提升（无行为变化）';
    let confidence = 20.0;
    
    // A2: 接口变更检测
    if (filePath.includes('/api/') || filePath.includes('/handler/') || 
        filePath.includes('/controller/') || filePath.includes('/router/') ||
        filePath.includes('/server/') || filePath.includes('/http/')) {
      category = 'A2';
      categoryName = '接口变更';
      description = 'HTTP API、路由处理器等接口层变更';
      confidence += 35.0;
      indicators.push('位于API接口目录');
    }
    
    // A1: 业务逻辑变更检测
    if (filePath.includes('/service/') || filePath.includes('/business/') || 
        filePath.includes('/logic/') || filePath.includes('/core/')) {
      category = 'A1';
      categoryName = '业务逻辑变更';
      description = '核心业务逻辑处理变更';
      confidence += 30.0;
      indicators.push('位于业务逻辑目录');
    }
    
    // A3: 数据结构变更检测
    if (filePath.includes('/model/') || filePath.includes('/entity/') || 
        filePath.includes('/struct/') || filePath.includes('/types/') ||
        filePath.includes('/schema/') || filePath.includes('/proto/')) {
      category = 'A3';
      categoryName = '数据结构变更';
      description = 'Go结构体、接口定义等数据模型变更';
      confidence += 40.0;
      indicators.push('位于数据模型目录');
    }
    
    // A4: 中间件/框架调整检测
    if (filePath.includes('/config/') || filePath.includes('/middleware/') || 
        filePath.includes('/plugin/') || filePath.includes('/framework/') ||
        filePath.includes('main.go') || filePath.includes('/cmd/') ||
        filePath.endsWith('.mod') || filePath.endsWith('.sum')) {
      category = 'A4';
      categoryName = '中间件/框架调整';
      description = 'Go模块、配置、中间件等框架层面调整';
      confidence += 45.0;
      indicators.push('框架配置相关');
    }
    
    // A5: 非功能性修改检测
    if (filePath.includes('/util/') || filePath.includes('/utils/') ||
        filePath.includes('/helper/') || filePath.includes('/tools/') ||
        filePath.includes('_test.go') || filePath.includes('/test/')) {
      category = 'A5';
      categoryName = '非功能性修改';
      description = '工具函数、测试文件等非功能性变更';
      confidence += 25.0;
      indicators.push('工具/测试文件');
    }
    
    // 函数名称模式检测
    functions.forEach(func => {
      if (func.name && typeof func.name === 'string') {
        if (func.name.includes('Handler') || func.name.includes('Router') || 
            func.name.includes('Controller') || func.name.includes('Api')) {
          if (category === 'A5') {
            category = 'A2';
            categoryName = '接口变更';
            confidence += 20.0;
            indicators.push(`API处理函数: ${func.name}`);
          }
        }
        
        if (func.name.includes('Process') || func.name.includes('Handle') ||
            func.name.includes('Execute') || func.name.includes('Calculate') ||
            func.name.includes('Validate') || func.name.includes('Transform')) {
          if (category === 'A5' || category === 'A2') {
            category = 'A1';
            categoryName = '业务逻辑变更';
            confidence += 15.0;
            indicators.push(`业务处理函数: ${func.name}`);
          }
        }
        
        if (func.name.startsWith('New') || func.name.includes('Create') ||
            func.name.includes('Build') || func.name.includes('Make')) {
          if (category === 'A5') {
            category = 'A3';
            categoryName = '数据结构变更';
            confidence += 15.0;
            indicators.push(`构造函数: ${func.name}`);
          }
        }
      }
      
      // 检查导出状态
      if (func.isExported) {
        confidence += 10.0;
        indicators.push('包含导出函数');
      }
    });
    
    const reason = `分类为 ${categoryName}：${indicators.join('、') || '基于默认规则判断'}`;
    
    return {
      filePath,
      classification: {
        category,
        categoryName,
        description,
        reason,
        confidence: Math.min(confidence, 100.0),
        indicators
      },
      changedMethods: functions.map(f => f.name || 'unknown')
    };
  }
  
  public static classifyChanges(files: any[]): { classifications: FileClassification[], summary: ClassificationSummary } {
    const classifications = files.map(file => 
      this.classifyFile(file.relativePath || file.path, file.functions || [])
    );
    
    const summary = this.generateSummary(classifications);
    return { classifications, summary };
  }
  
  private static generateSummary(classifications: FileClassification[]): ClassificationSummary {
    const categoryStats: Record<string, number> = {};
    let totalConfidence = 0;
    
    classifications.forEach(fc => {
      const category = fc.classification.category;
      categoryStats[category] = (categoryStats[category] || 0) + 1;
      totalConfidence += fc.classification.confidence;
    });
    
    const averageConfidence = classifications.length > 0 ? totalConfidence / classifications.length : 0;
    
    const detailedClassifications: Record<string, any[]> = {};
    ['A1', 'A2', 'A3', 'A4', 'A5'].forEach(category => {
      detailedClassifications[category] = classifications
        .filter(fc => fc.classification.category === category)
        .map(fc => fc);
    });
    
    return {
      totalFiles: classifications.length,
      categoryStats,
      averageConfidence,
      detailedClassifications
    };
  }
}

export function activate(context: vscode.ExtensionContext) {
  // 注册侧栏Webview Provider
  const provider = new DiffSenseViewProvider(context.extensionUri);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DiffSenseViewProvider.viewType, provider)
  );

  // 注册命令：运行分析
  const analysisCommand = vscode.commands.registerCommand('diffsense.runAnalysis', () => {
    provider.triggerAnalysis();
  });

  // 注册命令：刷新
  const refreshCommand = vscode.commands.registerCommand('diffsense.refresh', () => {
    provider.refresh();
  });

  // 注册命令：显示输出面板
  const showOutputCommand = vscode.commands.registerCommand('diffsense.showOutput', () => {
    provider.showOutput();
  });

  context.subscriptions.push(analysisCommand, refreshCommand, showOutputCommand);
}

class DiffSenseViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'diffsense.analysisView';

  private _view?: vscode.WebviewView;
  private _lastReportPath?: string; // 保存最后生成的报告路径
  private _lastAnalysisResult?: any[]; // 保存最后的分析结果
  private _themeDisposable?: vscode.Disposable; // 主题变化监听器
  private _outputChannel?: vscode.OutputChannel; // 输出通道

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) {
    // 创建输出通道
    this._outputChannel = vscode.window.createOutputChannel('DiffSense');
  }

  /**
   * 统一的日志输出方法
   * 同时输出到控制台和OutputChannel
   */
  private log(message: string, type: 'log' | 'error' | 'warn' = 'log') {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    
    // 确保输出通道存在
    if (!this._outputChannel) {
      this._outputChannel = vscode.window.createOutputChannel('DiffSense');
    }
    
    // 输出到OutputChannel
    if (this._outputChannel) {
      if (type === 'error') {
        this._outputChannel.appendLine(`❌ ${logMessage}`);
      } else if (type === 'warn') {
        this._outputChannel.appendLine(`⚠️ ${logMessage}`);
      } else {
        this._outputChannel.appendLine(logMessage);
      }
    }
    
    // 同时输出到控制台（用于开发者工具）
    if (type === 'error') {
      console.error(message);
    } else if (type === 'warn') {
      console.warn(message);
    } else {
      console.log(message);
    }
  }

  /**
   * 显示输出面板
   */
  public showOutput() {
    if (this._outputChannel) {
      this._outputChannel.show(true);
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // 允许脚本在webview中运行
      enableScripts: true,

      // 限制webview只能加载本地资源
      localResourceRoots: [
        this._extensionUri,
        vscode.Uri.file(path.join(this._extensionUri.fsPath, 'dist'))
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // 监听主题变化
    this._themeDisposable = vscode.window.onDidChangeActiveColorTheme(() => {
      if (this._view) {
        // 通知前端主题已变化
        this._view.webview.postMessage({ type: 'vscode-theme-changed' });
        // 重新生成HTML以应用新主题
        this._view.webview.html = this._getHtmlForWebview(this._view.webview);
      }
    });

    // 当webview被销毁时，清理主题监听器
    webviewView.onDidDispose(() => {
      if (this._themeDisposable) {
        this._themeDisposable.dispose();
        this._themeDisposable = undefined;
      }
    });

    // 处理来自webview的消息
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case 'analyze':
          await this.handleAnalysisRequest(data.data);
          break;
        case 'getBranches':
          await this.handleGetBranches();
          break;
        case 'validateCommitIds':
          await this.handleCommitValidation(data.data);
          break;
        case 'openReport':
          await this.openReportFile(data.reportPath);
          break;
        case 'openReportInBrowser':
          await this.openReportInBrowser(data.reportPath);
          break;
        case 'exportResults':
          await this.handleExportResults(data.format || 'json', data.language || 'zh-CN');
          break;
        case 'restoreAnalysisResults':
          await this.handleRestoreAnalysisResults();
          break;
        case 'detectProjectType':
          await this.handleDetectProjectType();
          break;
        case 'reportBug':
          await this.handleReportBug(data.data);
          break;
        case 'detectRevert':
          await this.handleDetectRevert(data.data);
          break;
      }
    });

    // 页面加载完成后获取分支列表
    setTimeout(() => {
      this.handleGetBranches();
    }, 1000);
  }

  public triggerAnalysis() {
    if (this._view) {
      this._view.show?.(true); // `show` 方法是否存在取决于API版本
      this._view.webview.postMessage({ command: 'triggerAnalysis' });
    }
  }

  public refresh() {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview);
      // 重新获取分支列表
      setTimeout(() => {
        this.handleGetBranches();
      }, 1000);
    }
  }

  private async handleAnalysisRequest(data: any) {
    try {
      // 显示输出通道
      this._outputChannel?.show(true);
      this.log('=== 开始分析请求 ===');
      this.log('请求数据: ' + JSON.stringify(data, null, 2));
      
      // 发送开始分析消息
      this._view?.webview.postMessage({
        command: 'analysisStarted'
      });

      // 获取工作区路径
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('未找到工作区文件夹');
      }

      const repoPath = workspaceFolder.uri.fsPath;
      
      // 检查分析类型（更新为支持新的参数结构）
      const analysisType = data.analysisType || 'backend';
      const analysisOptions = data.analysisOptions || [];
      
      let analysisResult: any[];

      if (analysisType === 'frontend') {
        // 前端代码分析
        this.log('🔍 执行前端代码分析...');
        this.log('分析选项: ' + JSON.stringify(analysisOptions, null, 2));
        analysisResult = await this.executeFrontendAnalysis(repoPath, data);
      } else if (analysisType === 'mixed') {
        // 混合项目分析
        this.log('🔍 执行混合项目分析...');
        analysisResult = await this.executeMixedAnalysis(repoPath, data);
      } else {
        // 后端代码分析 (原有逻辑)
        this.log('🔍 执行后端代码分析...');
        this.log('分析选项: ' + JSON.stringify(analysisOptions, null, 2));
        
        // 检测后端语言
        const repoUri = vscode.Uri.file(repoPath);
        const backendLanguage = await this.detectBackendLanguage(repoUri);
        this.log('🔍 检测到的后端语言: ' + backendLanguage);

        if (backendLanguage === 'java') {
          // Java分析
          this.log('☕ 使用Java分析器...');
          
          // 构建JAR文件路径 - 支持多种环境
          const jarPath = this.getJavaAnalyzerPath();
          
          // 检查JAR文件是否存在
          if (!fs.existsSync(jarPath)) {
            throw new Error(`JAR文件不存在: ${jarPath}`);
          }

          this.log(`正在分析Java仓库: ${repoPath}`);
          this.log(`使用JAR: ${jarPath}`);

          // 调用JAR进行分析
          const result = await this.executeJarAnalysis(jarPath, repoPath, data);
          
          // 解析结果并发送给前端
          this.log('=== 开始解析JAR结果 ===');
          analysisResult = this.parseAnalysisResult(result.stdout);
          
        } else if (backendLanguage === 'golang') {
          // Golang分析
          this.log('🐹 使用Golang分析器...');
          analysisResult = await this.executeGolangAnalysis(repoPath, data);
          
        } else {
          throw new Error(`不支持的后端语言: ${backendLanguage}。目前支持Java和Golang。`);
        }
      }
      
      this.log('解析后的结果数量: ' + (Array.isArray(analysisResult) ? analysisResult.length : '非数组'));
      if (Array.isArray(analysisResult) && analysisResult.length > 0) {
        this.log(`✅ 分析完成！共找到 ${analysisResult.length} 个提交的分析结果`);
      }
      
      // 保存分析结果用于导出
      this._lastAnalysisResult = analysisResult;
      
      // 发送分析完成消息到侧栏
      this._view?.webview.postMessage({
        command: 'analysisResult',
        data: analysisResult,
        analysisType: analysisType,
        analysisOptions: analysisOptions
      });

    } catch (error) {
      this.log('分析失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
      
      // 记录错误到日志
      this.addErrorToLog(
        error instanceof Error ? error.message : String(error),
        `分析请求失败 - 类型: ${data.analysisType || 'unknown'}, 分支: ${data.branch}`
      );
      
      // 发送错误消息给前端
      this._view?.webview.postMessage({
        command: 'analysisError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleDetectProjectType() {
    try {
      // 发送项目分析开始消息
      this._view?.webview.postMessage({
        command: 'projectAnalysisStarted'
      });

      // 获取工作区文件夹
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('未找到工作区文件夹');
      }

      const repoUri = workspaceFolder.uri;
      const projectType = await this.detectProjectType(repoUri);
      const frontendPaths = await this.findFrontendPaths(repoUri);
      
      // 获取具体的后端语言信息
      let backendLanguage = 'unknown';
      if (projectType === 'backend' || projectType === 'mixed') {
        backendLanguage = await this.detectBackendLanguage(repoUri);
      }

      console.log('🔍 项目类型检测结果:', projectType);
      console.log('🔍 后端语言:', backendLanguage);
      console.log('📁 前端路径检测结果:', frontendPaths);

      // 发送项目分析完成消息
      this._view?.webview.postMessage({
        command: 'projectAnalysisCompleted'
      });

      // 发送检测结果给前端
      this._view?.webview.postMessage({
        command: 'projectTypeDetected',
        projectType: projectType,
        backendLanguage: backendLanguage,
        frontendPaths: frontendPaths
      });

    } catch (error) {
      console.error('项目类型检测失败:', error);
      
      // 发送项目分析完成消息（即使失败也算完成）
      this._view?.webview.postMessage({
        command: 'projectAnalysisCompleted'
      });
      
      // 发送错误消息给前端
      this._view?.webview.postMessage({
        command: 'projectTypeDetected',
        projectType: 'unknown',
        backendLanguage: 'unknown',
        frontendPaths: []
      });
    }
  }

  private async detectProjectType(repoUri: vscode.Uri): Promise<'backend' | 'frontend' | 'mixed' | 'unknown'> {
    try {
      // === 第一步：环境诊断 ===
      console.log(`🚀 [DiffSense] 开始深度项目类型检测 (VSCode文件API版)`);
      console.log(`📍 [环境] 工作区URI: ${repoUri.toString()}`);
      console.log(`📍 [环境] URI方案: ${repoUri.scheme}`);
      console.log(`📍 [环境] Node.js版本: ${process.version}`);
      console.log(`📍 [环境] 平台: ${process.platform}`);
      console.log(`📍 [环境] 架构: ${process.arch}`);
      console.log(`📍 [环境] VSCode版本: ${vscode.version}`);
      console.log(`📍 [环境] 是否为远程环境: ${vscode.env.remoteName ? '是 (' + vscode.env.remoteName + ')' : '否'}`);
      
      // === 第二步：路径和权限检查 ===
      try {
        // 使用VSCode文件系统API检查目录是否存在
        const stat = await vscode.workspace.fs.stat(repoUri);
        if (stat.type !== vscode.FileType.Directory) {
          console.error(`❌ [路径] 项目路径不是目录: ${repoUri.toString()}`);
          return 'unknown';
        }
        console.log(`✅ [权限] 工作区目录访问正常`);
      } catch (error: any) {
        console.error(`❌ [权限] 无法访问工作区目录:`, error.message);
        console.log(`💡 [建议] 请检查工作区设置和权限`);
        return 'unknown';
      }

      // === 第三步：目录内容分析 ===
      try {
        const dirContents = await vscode.workspace.fs.readDirectory(repoUri);
        const fileNames = dirContents.map(([name, type]) => name);
        console.log(`📁 [目录] 根目录包含 ${dirContents.length} 个项目`);
        console.log(`📁 [目录] 内容预览 (前20个):`, fileNames.slice(0, 20));
        
        // 检查是否有常见的项目结构指示器
        const commonIndicators = {
          maven: fileNames.includes('pom.xml'),
          gradle: fileNames.some((f: string) => f.startsWith('build.gradle')),
          npm: fileNames.includes('package.json'),
          go: fileNames.includes('go.mod'),
          git: fileNames.includes('.git'),
          src: fileNames.includes('src'),
          'file_service': fileNames.includes('file_service'),
          'user_service': fileNames.includes('user_service'),
          'common': fileNames.includes('common')
        };
        console.log(`📋 [指示器] 项目结构指示器:`, commonIndicators);
        
      } catch (dirError: any) {
        console.warn(`⚠️ [目录] 无法读取目录内容:`, dirError.message);
      }

      // === 第四步：VSCode文件搜索API检查 ===
      try {
        console.log(`🔧 [依赖] 检查VSCode文件搜索API...`);
        
        // 测试文件搜索功能
        const testFiles = await vscode.workspace.findFiles('*', '**/node_modules/**', 10);
        console.log(`🧪 [测试] VSCode文件搜索找到 ${testFiles.length} 个文件`);
        
      } catch (searchError: any) {
        console.error(`❌ [依赖] VSCode文件搜索失败:`, searchError.message);
        console.log(`💡 [建议] 检查VSCode工作区设置`);
        return 'unknown';
      }

      // === 第五步：增强的语言特征检测 ===
      console.log(`🔍 [检测] 开始多层次语言特征检测...`);
      
      const javaFeatures = await this.findJavaFeatures(repoUri);
      const goFeatures = await this.findGoFeatures(repoUri);
      const frontendFeatures = await this.findFrontendFeatures(repoUri);

      // === 第六步：结果分析和推荐 ===
      const detectedLanguages = [];
      if (javaFeatures.detected) {
        detectedLanguages.push(`Java (${javaFeatures.paths.length}个特征)`);
        console.log('☕ [Java] 检测结果:', javaFeatures.paths);
      }
      if (goFeatures.detected) {
        detectedLanguages.push(`Golang (${goFeatures.paths.length}个特征)`);
        console.log('🐹 [Go] 检测结果:', goFeatures.paths);
      }
      if (frontendFeatures.detected) {
        detectedLanguages.push(`Frontend (${frontendFeatures.paths.length}个特征)`);
        console.log('🌐 [Frontend] 检测结果:', frontendFeatures.paths);
      }
      
      console.log(`📊 [汇总] 检测到的语言: ${detectedLanguages.join(', ') || '未检测到任何支持的语言'}`);

      // === 第七步：项目类型判定 ===
      const isBackend = javaFeatures.detected || goFeatures.detected;
      const isFrontend = frontendFeatures.detected;

      let projectType: 'backend' | 'frontend' | 'mixed' | 'unknown';
      if (isBackend && isFrontend) {
        projectType = 'mixed';
      } else if (isBackend) {
        projectType = 'backend';
      } else if (isFrontend) {
        projectType = 'frontend';
      } else {
        projectType = 'unknown';
        
        // 提供详细的故障排除建议
        console.log(`❌ [故障排除] 未能检测到项目类型，可能原因:`);
        console.log(`   1. 项目结构过深，超出搜索深度限制`);
        console.log(`   2. 文件被gitignore或类似规则忽略`);
        console.log(`   3. 文件权限问题或符号链接`);
        console.log(`   4. 远程文件系统延迟或不稳定`);
        console.log(`   5. 项目使用了不支持的语言或框架`);
        console.log(`💡 [建议] 请在VSCode开发者控制台查看详细日志`);
        console.log(`💡 [建议] 检查工作区URI: ${repoUri.toString()}`);
      }

      console.log(`🎯 [最终] 项目类型判定: ${projectType}`);
      return projectType;

    } catch (error: any) {
      console.error('💥 [错误] 项目类型检测发生严重错误:', error);
      console.error('💥 [栈] 错误堆栈:', error.stack);
      return 'unknown';
    }
  }

  private async findJavaFeatures(repoUri: vscode.Uri): Promise<{detected: boolean, paths: string[]}> {
    try {
      const result = { detected: false, paths: [] as string[] };

      console.log(`☕ [Java] 开始增强Java特征检测，项目URI: ${repoUri.toString()}`);

      // 使用VSCode文件搜索API进行Java特征检测
      try {
        // 搜索Java文件
        const javaFiles = await vscode.workspace.findFiles(
          '**/*.java',
          '**/node_modules/**,**/target/**,**/dist/**,**/build/**,**/.git/**'
        );
        console.log(`☕ [Java] 找到 ${javaFiles.length} 个Java文件`);
        
        if (javaFiles.length > 0) {
          result.detected = true;
          result.paths.push(`Java源文件: ${javaFiles.length}个`);
          
          // 显示前10个Java文件
          const filePathStrings = javaFiles.slice(0, 10).map(uri => vscode.workspace.asRelativePath(uri));
          console.log(`☕ [Java] Java文件样例 (前10个):`, filePathStrings);
          
          // 特别检查用户提到的file_service
          const fileServiceFiles = javaFiles.filter(uri => vscode.workspace.asRelativePath(uri).includes('file_service'));
          if (fileServiceFiles.length > 0) {
            console.log(`☕ [Java] 在file_service中找到 ${fileServiceFiles.length} 个Java文件`);
            result.paths.push(`file_service Java文件: ${fileServiceFiles.length}个`);
          }
          
          // 分析微服务目录结构
          const servicePatterns = ['*_service', 'service_*', '*-service', 'service-*'];
          for (const pattern of servicePatterns) {
            const serviceFiles = javaFiles.filter(uri => {
              const relativePath = vscode.workspace.asRelativePath(uri);
              return new RegExp(pattern.replace('*', '\\w+')).test(relativePath);
            });
            if (serviceFiles.length > 0) {
              console.log(`☕ [Java] 微服务模式 "${pattern}" 匹配到 ${serviceFiles.length} 个文件`);
            }
          }
        }

        // 搜索Maven文件
        const pomFiles = await vscode.workspace.findFiles(
          '**/pom.xml',
          '**/node_modules/**,**/target/**,**/dist/**,**/build/**'
        );
        console.log(`☕ [Java] 找到 ${pomFiles.length} 个Maven文件`);

        if (pomFiles.length > 0) {
          result.detected = true;
          const pomPaths = pomFiles.map(uri => vscode.workspace.asRelativePath(uri));
          result.paths.push(...pomPaths.map(p => `Maven: ${p}`));
        }

        // 搜索Gradle文件
        const gradleFiles = await vscode.workspace.findFiles(
          '**/build.gradle*',
          '**/node_modules/**,**/target/**,**/dist/**,**/build/**'
        );
        console.log(`☕ [Java] 找到 ${gradleFiles.length} 个Gradle文件`);

        if (gradleFiles.length > 0) {
          result.detected = true;
          const gradlePaths = gradleFiles.map(uri => vscode.workspace.asRelativePath(uri));
          result.paths.push(...gradlePaths.map(p => `Gradle: ${p}`));
        }

      } catch (searchError: any) {
        console.warn(`☕ [Java] VSCode文件搜索失败:`, searchError.message);
      }

      console.log(`☕ [Java] 最终检测结果: ${result.detected ? '✅ 检测到Java项目' : '❌ 未检测到Java项目'}`);
      console.log(`☕ [Java] 检测到的特征:`, result.paths);

      // 如果仍然检测失败，提供VSCode环境的故障排除建议
      if (!result.detected) {
        console.log(`☕ [Java] VSCode环境故障排除建议:`);
        console.log(`   1. 检查工作区设置和文件权限`);
        console.log(`   2. 确认项目已在VSCode中正确打开`);
        console.log(`   3. 检查文件搜索排除模式是否过于严格`);
        console.log(`   4. 工作区URI: ${repoUri.toString()}`);
      }

      return result;
    } catch (error: any) {
      console.error('☕ [Java] 检测发生严重错误:', error);
      console.error('☕ [Java] 错误堆栈:', error.stack);
      return { detected: false, paths: [] };
    }
  }

  private async findGoFeatures(repoUri: vscode.Uri): Promise<{detected: boolean, paths: string[]}> {
    try {
      const result = { detected: false, paths: [] as string[] };

      console.log(`🐹 [Go] 开始增强Go特征检测，项目URI: ${repoUri.toString()}`);

      try {
        // 搜索 Go module 文件
        const goModFiles = await vscode.workspace.findFiles(
          '**/go.mod',
          '**/node_modules/**,**/vendor/**,**/target/**,**/dist/**,**/.git/**'
        );
        console.log(`🐹 [Go] 找到 ${goModFiles.length} 个go.mod文件`);

        // 搜索 Go 源文件
        const goFiles = await vscode.workspace.findFiles(
          '**/*.go',
          '**/node_modules/**,**/vendor/**,**/target/**,**/dist/**,**/.git/**'
        );
        console.log(`🐹 [Go] 找到 ${goFiles.length} 个Go源文件`);
        
        if (goFiles.length > 0) {
          const filePathStrings = goFiles.slice(0, 10).map(uri => vscode.workspace.asRelativePath(uri));
          console.log(`🐹 [Go] Go文件样例 (前10个):`, filePathStrings);
        }

        if (goModFiles.length > 0) {
          result.detected = true;
          const modPaths = goModFiles.map(uri => vscode.workspace.asRelativePath(uri));
          result.paths.push(...modPaths.map(p => `Go Module: ${p}`));
        }

        if (goFiles.length > 0) {
          result.detected = true;
          const firstFile = vscode.workspace.asRelativePath(goFiles[0]);
          result.paths.push(`Go源文件: ${goFiles.length}个文件 (如: ${firstFile})`);
        }

      } catch (searchError: any) {
        console.warn(`🐹 [Go] VSCode文件搜索失败:`, searchError.message);
      }

      console.log(`🐹 [Go] 检测结果: ${result.detected ? '✅ 检测到Go项目' : '❌ 未检测到Go项目'}`);
      return result;
    } catch (error: any) {
      console.error('🐹 [Go] 检测失败:', error);
      return { detected: false, paths: [] };
    }
  }

  private async findFrontendFeatures(repoUri: vscode.Uri): Promise<{detected: boolean, paths: string[]}> {
    try {
      const result = { detected: false, paths: [] as string[] };

      console.log(`🌐 [Frontend] 开始增强前端特征检测，项目URI: ${repoUri.toString()}`);

      try {
        // 搜索 package.json 文件
        const packageJsonFiles = await vscode.workspace.findFiles(
          '**/package.json',
          '**/node_modules/**,**/target/**,**/dist/**,**/.git/**'
        );
        console.log(`🌐 [Frontend] 找到 ${packageJsonFiles.length} 个package.json文件`);

        // 搜索 TypeScript 配置文件
        const tsConfigFiles = await vscode.workspace.findFiles(
          '**/tsconfig.json',
          '**/node_modules/**,**/target/**,**/dist/**,**/.git/**'
        );
        console.log(`🌐 [Frontend] 找到 ${tsConfigFiles.length} 个tsconfig.json文件`);

        // 搜索常见前端文件
        const frontendFiles = await vscode.workspace.findFiles(
          '**/*.{ts,tsx,js,jsx,vue}',
          '**/node_modules/**,**/target/**,**/dist/**,**/.git/**,**/*.test.*,**/*.spec.*,**/build/**'
        );
        console.log(`🌐 [Frontend] 找到 ${frontendFiles.length} 个前端源文件`);

        if (frontendFiles.length > 0) {
          const filePathStrings = frontendFiles.slice(0, 10).map(uri => vscode.workspace.asRelativePath(uri));
          console.log(`🌐 [Frontend] 前端文件样例 (前10个):`, filePathStrings);
        }

        // 分析 package.json 内容
        for (const packageFileUri of packageJsonFiles) {
          try {
            const packageContent = await vscode.workspace.fs.readFile(packageFileUri);
            const packageText = new TextDecoder().decode(packageContent);
            const packageData = JSON.parse(packageText);
            const dependencies = { ...packageData.dependencies, ...packageData.devDependencies };
            
            const frameworks = [];
            if ('react' in dependencies) frameworks.push('React');
            if ('vue' in dependencies) frameworks.push('Vue');
            if ('@angular/core' in dependencies) frameworks.push('Angular');
            if ('svelte' in dependencies) frameworks.push('Svelte');
            if ('next' in dependencies) frameworks.push('Next.js');
            if ('nuxt' in dependencies) frameworks.push('Nuxt.js');
            
            if (frameworks.length > 0 || 'typescript' in dependencies) {
              result.detected = true;
              const frameworkInfo = frameworks.length > 0 ? ` (${frameworks.join(', ')})` : '';
              const relativePath = vscode.workspace.asRelativePath(packageFileUri);
              result.paths.push(`package.json: ${relativePath}${frameworkInfo}`);
              console.log(`🌐 [Frontend] 检测到前端项目: ${relativePath} - ${frameworkInfo}`);
            }
          } catch (parseError: any) {
            const relativePath = vscode.workspace.asRelativePath(packageFileUri);
            console.warn(`🌐 [Frontend] 解析package.json失败: ${relativePath}`, parseError.message);
          }
        }

        if (tsConfigFiles.length > 0) {
          result.detected = true;
          const tsPaths = tsConfigFiles.map(uri => vscode.workspace.asRelativePath(uri));
          result.paths.push(...tsPaths.map(p => `TypeScript: ${p}`));
        }

        if (frontendFiles.length > 0 && frontendFiles.length > 10) { // 确保有足够的前端文件
          result.detected = true;
          const firstFile = vscode.workspace.asRelativePath(frontendFiles[0]);
          result.paths.push(`前端源文件: ${frontendFiles.length}个文件 (如: ${firstFile})`);
        }

      } catch (searchError: any) {
        console.warn(`🌐 [Frontend] VSCode文件搜索失败:`, searchError.message);
      }

      console.log(`🌐 [Frontend] 检测结果: ${result.detected ? '✅ 检测到前端项目' : '❌ 未检测到前端项目'}`);
      return result;
    } catch (error: any) {
      console.error('🌐 [Frontend] 检测失败:', error);
      return { detected: false, paths: [] };
    }
  }

  private hasGoFiles(repoPath: string): boolean {
    try {
      // 查找Go文件，排除vendor目录 - 增加深度限制配置
      const { globSync } = require('glob');
      const goFiles = globSync('**/*.go', {
        cwd: repoPath,
        ignore: ['vendor/**', '**/vendor/**', '**/node_modules/**'],
        maxDepth: 15  // 增加递归深度以支持微服务项目
      });
      return goFiles.length > 0;
    } catch (error) {
      console.warn('检查Go文件失败:', error);
      return false;
    }
  }

  private async detectBackendLanguage(repoUri: vscode.Uri): Promise<'java' | 'golang' | 'unknown'> {
    try {
      console.log(`🔍 开始后端语言检测，URI: ${repoUri.toString()}`);
      
      const javaFeatures = await this.findJavaFeatures(repoUri);
      const goFeatures = await this.findGoFeatures(repoUri);

      console.log(`🔍 后端语言检测结果:`);
      console.log(`   Java: ${javaFeatures.detected ? '✅' : '❌'} (${javaFeatures.paths.length} 个特征)`);
      console.log(`   Go: ${goFeatures.detected ? '✅' : '❌'} (${goFeatures.paths.length} 个特征)`);

      // 优先级：如果两种语言都存在，Java优先（通常是主要后端语言）
      let backendLanguage: 'java' | 'golang' | 'unknown';
      if (javaFeatures.detected) {
        backendLanguage = 'java';
        
        // 增强微服务检测
        const microserviceInfo = await this.detectMicroserviceFeatures(repoUri);
        if (microserviceInfo.isMicroservice) {
          console.log(`🏗️ 检测到微服务架构: ${microserviceInfo.framework}, 构建工具: ${microserviceInfo.buildTool}`);
        }
      } else if (goFeatures.detected) {
        backendLanguage = 'golang';
        
        // 增强微服务检测
        const microserviceInfo = await this.detectMicroserviceFeatures(repoUri);
        if (microserviceInfo.isMicroservice) {
          console.log(`🏗️ 检测到微服务架构: ${microserviceInfo.framework}, 构建工具: ${microserviceInfo.buildTool}`);
        }
      } else {
        backendLanguage = 'unknown';
      }

      console.log(`🎯 最终后端语言判定: ${backendLanguage}`);
      return backendLanguage;
    } catch (error) {
      console.error('后端语言检测错误:', error);
      return 'unknown';
    }
  }

  private async detectMicroserviceFeatures(repoUri: vscode.Uri): Promise<{
    isMicroservice: boolean;
    buildTool: string;
    framework: string;
    architectureFeatures: string[];
    serviceTypes: string[];
  }> {
    try {
      console.log(`🏗️ 开始微服务特征检测，URI: ${repoUri.toString()}`);
      
      const result = {
        isMicroservice: false,
        buildTool: 'unknown',
        framework: 'unknown',
        architectureFeatures: [] as string[],
        serviceTypes: [] as string[]
      };
      
      // 检测构建工具
      const buildTools = ['pom.xml', 'build.gradle', 'build.gradle.kts', 'build.xml', 'BUILD', 'BUILD.bazel', 'package.json', 'Cargo.toml', 'go.mod', 'requirements.txt', 'Dockerfile'];
      
      for (const buildTool of buildTools) {
        const buildFiles = await vscode.workspace.findFiles(
          `**/${buildTool}`,
          '**/node_modules/**,**/target/**,**/dist/**,**/build/**'
        );
        
        if (buildFiles.length > 0) {
          result.buildTool = this.mapBuildFileToTool(buildTool);
          console.log(`🔧 检测到构建工具: ${result.buildTool} (${buildTool})`);
          break;
        }
      }
      
      // 检测微服务架构特征
      const microservicePatterns = ['*_service', 'service_*', '*-service', 'service-*', '*_api', 'api_*', '*-api', 'api-*', '*_gateway', 'gateway_*', '*-gateway', 'gateway-*'];
      
      for (const pattern of microservicePatterns) {
        const serviceFiles = await vscode.workspace.findFiles(
          `**/${pattern}/**`,
          '**/node_modules/**,**/target/**,**/dist/**,**/build/**'
        );
        
        if (serviceFiles.length > 0) {
          result.architectureFeatures.push(pattern);
          console.log(`🏛️ 检测到微服务架构特征: ${pattern}`);
        }
      }
      
      // 检测服务类型
      const serviceTypes = ['user', 'order', 'product', 'payment', 'auth', 'config', 'registry', 'discovery'];
      
      for (const serviceType of serviceTypes) {
        const serviceFiles = await vscode.workspace.findFiles(
          `**/*${serviceType}*/**`,
          '**/node_modules/**,**/target/**,**/dist/**,**/build/**'
        );
        
        if (serviceFiles.length > 0) {
          result.serviceTypes.push(`${serviceType}-service`);
          console.log(`🔧 检测到服务类型: ${serviceType}-service`);
        }
      }
      
      // 检测微服务框架
      const frameworkIndicators = {
        'spring-boot': ['spring-boot-starter', '@SpringBootApplication', 'application.yml', 'application.properties'],
        'spring-cloud': ['spring-cloud-starter', '@EnableEurekaServer', '@EnableDiscoveryClient', '@EnableConfigServer'],
        'micronaut': ['micronaut', '@MicronautApplication'],
        'quarkus': ['quarkus', '@QuarkusMain'],
        'go-micro': ['github.com/micro/go-micro', 'micro.NewService'],
        'node-micro': ['express', 'fastify', 'microservice']
      };
      
      for (const [framework, indicators] of Object.entries(frameworkIndicators)) {
        for (const indicator of indicators) {
          const frameworkFiles = await vscode.workspace.findFiles(
            `**/*${indicator}*`,
            '**/node_modules/**,**/target/**,**/dist/**,**/build/**'
          );
          
          if (frameworkFiles.length > 0) {
            result.framework = framework;
            console.log(`🏗️ 检测到微服务框架: ${framework}`);
            break;
          }
        }
        if (result.framework !== 'unknown') break;
      }
      
      // 判断是否为微服务项目
      result.isMicroservice = result.architectureFeatures.length > 0 || 
                             result.serviceTypes.length > 1 || 
                             result.framework === 'spring-cloud';
      
      console.log(`🏗️ 微服务检测结果: ${result.isMicroservice ? '✅ 微服务项目' : '❌ 单体应用'}`);
      return result;
      
    } catch (error: any) {
      console.error('🏗️ 微服务特征检测失败:', error);
      return {
        isMicroservice: false,
        buildTool: 'unknown',
        framework: 'unknown',
        architectureFeatures: [],
        serviceTypes: []
      };
    }
  }
  
  private mapBuildFileToTool(fileName: string): string {
    switch (fileName) {
      case 'pom.xml':
        return 'maven';
      case 'build.gradle':
      case 'build.gradle.kts':
        return 'gradle';
      case 'build.xml':
        return 'ant';
      case 'BUILD':
      case 'BUILD.bazel':
        return 'bazel';
      case 'package.json':
        return 'npm';
      case 'Cargo.toml':
        return 'cargo';
      case 'go.mod':
        return 'go';
      case 'requirements.txt':
        return 'python';
      case 'Dockerfile':
        return 'docker';
      default:
        return 'unknown';
    }
  }

  private async findFrontendPaths(repoUri: vscode.Uri): Promise<string[]> {
    try {
      const frontendFeatures = await this.findFrontendFeatures(repoUri);
      const frontendPaths: string[] = [];
      
      if (frontendFeatures.detected) {
        try {
          // 使用VSCode API搜索package.json文件
          const packageJsonFiles = await vscode.workspace.findFiles(
            '**/package.json',
            '**/node_modules/**,**/target/**,**/dist/**'
          );

          for (const packageFileUri of packageJsonFiles) {
            try {
              const packageContent = await vscode.workspace.fs.readFile(packageFileUri);
              const packageText = new TextDecoder().decode(packageContent);
              const packageData = JSON.parse(packageText);
              const dependencies = { ...packageData.dependencies, ...packageData.devDependencies };
              
              // 检查是否是前端项目
              const hasFrontendDeps = ['react', 'vue', '@angular/core', 'svelte', 'next', 'nuxt', 'typescript'].some(dep => dep in dependencies);
              
              if (hasFrontendDeps) {
                const relativePath = vscode.workspace.asRelativePath(packageFileUri);
                const dirPath = path.dirname(relativePath);
                frontendPaths.push(dirPath === '.' ? '' : dirPath);
              }
            } catch (parseError) {
              const relativePath = vscode.workspace.asRelativePath(packageFileUri);
              console.warn(`解析package.json失败: ${relativePath}`, parseError);
            }
          }
        } catch (searchError) {
          console.warn('前端路径搜索失败:', searchError);
        }
      }

      // 去重并返回
      return [...new Set(frontendPaths)];
    } catch (error) {
      console.error('前端路径检测错误:', error);
      return [];
    }
  }

  private async executeMixedAnalysis(repoPath: string, analysisData: any): Promise<any[]> {
    // 混合项目分析：同时进行前后端分析并合并结果
    const results: any[] = [];

    try {
      // 执行后端分析（支持Java和Golang）
      try {
        const repoUri = vscode.Uri.file(repoPath);
        const backendLanguage = await this.detectBackendLanguage(repoUri);
        console.log('🔍 混合项目检测到的后端语言:', backendLanguage);

        if (backendLanguage === 'java') {
          const jarPath = this.getJavaAnalyzerPath();
          if (fs.existsSync(jarPath)) {
            console.log('☕ 执行Java后端分析...');
            const backendResult = await this.executeJarAnalysis(jarPath, repoPath, analysisData);
            const backendParsed = this.parseAnalysisResult(backendResult.stdout);
            results.push(...backendParsed.map(item => ({ ...item, analysisSource: 'backend', language: 'java' })));
          }
        } else if (backendLanguage === 'golang') {
          console.log('🐹 执行Golang后端分析...');
          const backendResult = await this.executeGolangAnalysis(repoPath, analysisData);
          results.push(...backendResult.map(item => ({ ...item, analysisSource: 'backend', language: 'golang' })));
        }
      } catch (error) {
        this.log('后端分析失败: ' + (error instanceof Error ? error.message : String(error)), 'warn');
      }

      // 执行前端分析
      try {
        console.log('🌐 执行前端分析...');
        const frontendResult = await this.executeFrontendAnalysis(repoPath, analysisData);
        results.push(...frontendResult.map(item => ({ ...item, analysisSource: 'frontend' })));
      } catch (error) {
        this.log('前端分析失败: ' + (error instanceof Error ? error.message : String(error)), 'warn');
      }

      // 如果没有任何结果，抛出错误而不是创建虚假提交
      if (results.length === 0) {
        throw new Error('混合项目分析失败：未能成功分析前端或后端代码，请检查项目结构和分析器配置');
      }

      return results;

    } catch (error) {
      this.log('混合项目分析失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
      throw error;
    }
  }

  private async executeFrontendAnalysis(repoPath: string, analysisData: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // 前端分析器脚本路径 - 修复远程开发环境路径问题
      const analyzerPath = this.getNodeAnalyzerPath();
      
      // 确定要分析的目录
      let targetDir = repoPath;
      if (analysisData.frontendPath) {
        targetDir = path.join(repoPath, analysisData.frontendPath);
      }
      
      this.log('执行前端分析命令: node ' + analyzerPath + ' ' + targetDir);
      this.log('分析目录: ' + targetDir);

      // 检查分析器文件是否存在
      if (!fs.existsSync(analyzerPath)) {
        reject(new Error(`前端分析器文件不存在: ${analyzerPath}`));
        return;
      }

      // 构建分析命令参数 - 添加Git变更参数
      const analyzerArgs = [analyzerPath, targetDir, 'json'];
      
      // 添加Git变更分析参数（与Java分析器保持一致）
      const branch = analysisData.branch || 'master';
      analyzerArgs.push('--branch', branch);
      
      // 处理范围参数
      if (analysisData.range) {
        const range = analysisData.range;
        
        if (range === 'Last 3 commits') {
          analyzerArgs.push('--commits', '3');
        } else if (range === 'Last 5 commits') {
          analyzerArgs.push('--commits', '5');
        } else if (range === 'Last 10 commits') {
          analyzerArgs.push('--commits', '10');
        } else if (range === 'Today') {
          const today = new Date().toISOString().split('T')[0];
          analyzerArgs.push('--since', today);
        } else if (range === 'This week') {
          const now = new Date();
          const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
          const weekStart = startOfWeek.toISOString().split('T')[0];
          analyzerArgs.push('--since', weekStart);
        } else if (range === 'Custom Date Range') {
          if (analysisData.dateFrom) {
            analyzerArgs.push('--since', analysisData.dateFrom);
            if (analysisData.dateTo) {
              analyzerArgs.push('--until', analysisData.dateTo);
            }
          }
        } else if (range === 'Commit ID Range') {
          if (analysisData.startCommit && analysisData.endCommit) {
            analyzerArgs.push('--start-commit', analysisData.startCommit);
            analyzerArgs.push('--end-commit', analysisData.endCommit);
          }
        }
      } else {
        // 默认分析最近3个提交
        analyzerArgs.push('--commits', '3');
      }
      
      // 添加微服务检测选项
      analyzerArgs.push(
        '--enable-microservice-detection', 'true',
        '--enable-build-tool-detection', 'true',
        '--enable-framework-detection', 'true',
        '--max-depth', '20'
      );
      
      this.log('执行前端分析命令: node ' + analyzerArgs.join(' '));
      
      // 确保输出通道可见
      if (this._outputChannel) {
        this._outputChannel.show(true);
      }
      
      // 使用 spawn 实时捕获输出
      const child = spawn('node', analyzerArgs, {
        cwd: repoPath,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      // 实时捕获 stdout（JSON结果）
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      // 实时捕获 stderr（日志输出）并显示到VSCode输出面板
      child.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        stderr += output;
        
        // 将前端分析器的日志实时输出到VSCode输出面板
        // 注意：data可能包含多行，需要逐行处理
        const lines = output.split(/\r?\n/);
        lines.forEach((line, index) => {
          // 跳过空行（除了最后一行可能是部分数据）
          if (line.trim().length > 0 || (index === lines.length - 1 && output.endsWith('\n'))) {
            if (this._outputChannel) {
              // 直接显示原始日志，保持前端分析器的格式
              this._outputChannel.appendLine(line);
            }
            // 同时输出到控制台（用于调试）
            console.error(line);
          }
        });
      });

      // 监听进程退出
      child.on('exit', (code) => {
        this.log(`前端分析器进程退出，代码: ${code}`);
        
        if (code !== 0) {
          this.log('前端分析器执行错误，退出代码: ' + code, 'error');
          if (stderr) {
            this.log('stderr: ' + stderr, 'error');
          }
          reject(new Error(`前端分析失败: 进程退出代码 ${code}\n${stderr}`));
          return;
        }

        // 进程成功退出，解析结果
        try {
          const result = JSON.parse(stdout);
          this.log('前端分析结果解析成功');
          
          // 添加调试日志，检查返回的数据结构
          this.log(`前端分析结果结构检查: result.commits=${result.commits?.length || 0}, result.gitChanges.commits=${result.gitChanges?.commits?.length || 0}`);
          if (result.commits && result.commits.length > 0) {
            this.log(`找到 ${result.commits.length} 个提交结果`);
          } else if (result.gitChanges && result.gitChanges.commits && result.gitChanges.commits.length > 0) {
            this.log(`找到 ${result.gitChanges.commits.length} 个Git变更提交`);
          }
          
          // 转换为与后端分析结果兼容的格式
          // 从analysisData中获取分析模式，默认为'quick'
          const analysisMode = analysisData.analysisMode || 'quick';
          const convertedResult = this.convertFrontendResult(result, targetDir, analysisMode);
          this.log(`转换后的结果数量: ${convertedResult.length}`);
          resolve(convertedResult);
          
        } catch (parseError) {
          this.log('前端分析结果JSON解析失败: ' + (parseError instanceof Error ? parseError.message : String(parseError)), 'error');
          this.log('输出前500字符: ' + stdout.substring(0, 500), 'error');
          reject(new Error(`前端分析结果解析失败: ${parseError}`));
        }
      });

      // 监听进程错误
      child.on('error', (error) => {
        this.log('前端分析器进程错误: ' + (error instanceof Error ? error.message : String(error)), 'error');
        reject(new Error(`前端分析失败: ${error.message}`));
      });

      // 设置超时
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('前端分析超时（10分钟）'));
      }, 600000); // 10分钟

      child.on('exit', () => {
        clearTimeout(timeout);
      });
    });
  }

  private convertFrontendResult(frontendResult: any, targetDir: string, analysisMode: string = 'quick'): any[] {
    // 将前端分析结果转换为与后端分析结果兼容的格式
    const commits = [];
    
    // 检查是否有多个提交的分析结果（新格式）
    // 优先检查 result.commits（处理后的提交结果），如果没有则检查 result.gitChanges.commits
    const hasCommits = (frontendResult.commits && frontendResult.commits.length > 0) || 
                       (frontendResult.gitChanges && frontendResult.gitChanges.commits && frontendResult.gitChanges.commits.length > 0);
    
    // 添加详细的调试日志
    this.log(`前端分析结果检查: hasCommits=${hasCommits}, result.commits=${frontendResult.commits?.length || 0}, result.gitChanges.commits=${frontendResult.gitChanges?.commits?.length || 0}`);
    
    if (hasCommits) {
      // 处理多个提交的情况
      // 优先使用处理后的提交结果（result.commits），如果为空或不存在则使用原始提交信息（result.gitChanges.commits）
      const commitResults = (frontendResult.commits && frontendResult.commits.length > 0) 
        ? frontendResult.commits 
        : (frontendResult.gitChanges?.commits || []);
      
      // 添加调试日志
      this.log(`前端分析结果转换: 找到 ${commitResults.length} 个提交 (result.commits: ${frontendResult.commits?.length || 0}, gitChanges.commits: ${frontendResult.gitChanges?.commits?.length || 0})`);
      
      if (commitResults.length === 0) {
        this.log('警告: commitResults为空，可能前端分析器没有正确返回提交数据');
      }
      
      for (const commitInfo of commitResults) {
        // 处理微服务检测结果
        let microserviceInfo = '';
        if (frontendResult.microserviceDetection) {
          const detection = frontendResult.microserviceDetection;
          if (detection.isMicroservice) {
            microserviceInfo = `🏗️ 微服务项目 (${detection.framework}, ${detection.buildTool})`;
          } else {
            microserviceInfo = `📦 单体应用 (${detection.buildTool})`;
          }
        }
        
        // 获取该提交的文件和分类信息
        const commitFiles = commitInfo.files || [];
        const classifications = commitInfo.changeClassifications || [];
        const summary = commitInfo.classificationSummary || { totalFiles: 0, categoryStats: {}, averageConfidence: 0 };
        const modifications = commitInfo.modifications || [];
        
        // 根据分析模式筛选文件
        let limitedFiles: any[] = [];
        
        if (analysisMode === 'deep') {
          // Deep模式：显示所有文件
          limitedFiles = commitFiles;
        } else {
          // 快速模式（quick）：根据文件数量决定
          const totalFiles = commitFiles.length;
          const QUICK_MODE_THRESHOLD = 100;
          
          if (totalFiles < QUICK_MODE_THRESHOLD) {
            // 文件数 < 100，全量显示
            limitedFiles = commitFiles;
          } else {
            // 文件数 >= 100，只显示FFIS评分最高的100个文件
            if (commitInfo.ffis !== undefined || (commitFiles.length > 0 && commitFiles[0].ffis !== undefined)) {
              // 使用FFIS评分排序，取前100个
              const sortedByFFIS = [...commitFiles].sort((a: any, b: any) => (b.ffis || 0) - (a.ffis || 0));
              limitedFiles = sortedByFFIS.slice(0, QUICK_MODE_THRESHOLD);
            } else {
              // 如果没有FFIS评分，使用旧的启发式方法筛选
              const importantFiles = commitFiles.filter((file: any) => {
                const classification = classifications.find((c: any) => c.filePath === file.relativePath);
                return (
                  (file.methods && file.methods.length > 0) ||
                  (classification && classification.classification && classification.classification.confidence > 50) ||
                  file.relativePath.includes('/src/') ||
                  file.relativePath.includes('/components/') ||
                  file.relativePath.includes('/pages/') ||
                  file.relativePath.includes('/utils/')
                );
              });
              
              // 如果筛选后的文件数超过100，只取前100个
              limitedFiles = importantFiles.length > QUICK_MODE_THRESHOLD 
                ? importantFiles.slice(0, QUICK_MODE_THRESHOLD)
                : importantFiles;
              
              // 如果筛选结果为空，至少显示前100个
              if (limitedFiles.length === 0 && commitFiles.length > 0) {
                limitedFiles = commitFiles.slice(0, QUICK_MODE_THRESHOLD);
              }
            }
          }
        }
        
        // 收集方法和文件路径
        const allMethods: string[] = [];
        const allFiles: any[] = [];
        const allFilePaths: string[] = [];
        
        limitedFiles.forEach((file: any) => {
          allFilePaths.push(file.relativePath);
          allFiles.push({
            path: file.relativePath,
            filePath: file.relativePath,
            methods: file.methods || [],
            impactedMethods: file.methods ? file.methods.map((m: any) => ({
              methodName: m.name,
              signature: m.signature,
              type: m.type,
              calls: m.calls || [],
              calledBy: []
            })) : []
          });
          
          if (file.methods) {
            file.methods.forEach((method: any) => {
              allMethods.push(`${file.relativePath}:${method.name}`);
            });
          }
        });
        
        // 创建提交记录
        commits.push({
          commitId: commitInfo.commitId || commitInfo.commitHash || 'unknown',
          message: commitInfo.message || '前端代码变更',
          author: commitInfo.author || { name: '前端分析器', email: 'frontend@diffsense.com' },
          timestamp: commitInfo.timestamp || frontendResult.timestamp || new Date().toISOString(),
          changedFilesCount: commitInfo.changedFilesCount || 0,
          changedMethodsCount: commitInfo.changedMethodsCount || 0,
          impactedMethods: allMethods,
          impactedFiles: allFilePaths,
          files: allFiles,
          impactedTests: {},
          changeClassifications: classifications.filter((c: any) => limitedFiles.some((f: any) => f.relativePath === c.filePath)),
          classificationSummary: summary,
          language: 'frontend',
          analysisSource: 'frontend',
          frontendSummary: frontendResult.summary,
          frontendDependencies: null,
          microserviceDetection: frontendResult.microserviceDetection || null,
          totalFilesScanned: commitFiles.length,
          importantFilesShown: limitedFiles.length,
          gitChanges: commitInfo,
          granularModifications: modifications
        });
      }
      
      return commits;
    }
    
    // 原有的单一结果处理逻辑（向后兼容）
    if (frontendResult && frontendResult.files && frontendResult.files.length > 0) {
      // 使用前端变更分类器（已更新为F1-F5分类系统）
      const { classifications, summary } = FrontendChangeClassifier.classifyChanges(frontendResult.files);
      
      // 如果启用了Git分析，使用Git变更数据
      let changedFilesCount = frontendResult.files.length;
      let changedMethodsCount = 0;
      let analysisMessage = '前端代码分析结果';
      
      if (frontendResult.gitChanges) {
        changedFilesCount = frontendResult.gitChanges.changedFilesCount || frontendResult.files.length;
        changedMethodsCount = frontendResult.gitChanges.changedMethodsCount || 0;
        analysisMessage = `前端Git变更分析结果 (${changedFilesCount}个变更文件)`;
      } else {
        // 静态分析模式
        const allMethods: string[] = [];
        frontendResult.files.forEach((file: any) => {
          if (file.methods) {
            file.methods.forEach((method: any) => {
              allMethods.push(`${file.relativePath}:${method.name}`);
            });
          }
        });
        changedMethodsCount = allMethods.length;
        analysisMessage = `前端静态代码分析结果 (扫描${changedFilesCount}个文件)`;
      }
      
      // 根据分析模式筛选文件
      let limitedFiles: any[] = [];
      const totalFiles = frontendResult.files.length;
      const QUICK_MODE_THRESHOLD = 100;
      
      // 从convertFrontendResult的参数中获取analysisMode，默认为'quick'
      // analysisMode应该已经在调用convertFrontendResult时传入
      
      if (analysisMode === 'deep') {
        // Deep模式：显示所有文件
        limitedFiles = frontendResult.files;
      } else {
        // 快速模式（quick）：根据文件数量决定
        if (totalFiles < QUICK_MODE_THRESHOLD) {
          // 文件数 < 100，全量显示
          limitedFiles = frontendResult.files;
        } else {
          // 文件数 >= 100，只显示FFIS评分最高的100个文件
          if (frontendResult.ffisEnabled && frontendResult.files && frontendResult.files.length > 0) {
            // 使用FFIS评分排序，取前100个
            const sortedByFFIS = [...frontendResult.files].sort((a: any, b: any) => (b.ffis || 0) - (a.ffis || 0));
            limitedFiles = sortedByFFIS.slice(0, QUICK_MODE_THRESHOLD);
          } else {
            // 如果没有FFIS评分，使用旧的启发式方法筛选
            const importantFiles = frontendResult.files.filter((file: any) => {
              const classification = classifications.find(c => c.filePath === file.relativePath);
              return (
                (file.methods && file.methods.length > 0) || // 有方法的文件
                (classification && classification.classification.confidence > 50) || // 高置信度分类
                file.relativePath.includes('/src/') || // 主要源码目录
                file.relativePath.includes('/components/') || // 组件目录
                file.relativePath.includes('/pages/') || // 页面目录
                file.relativePath.includes('/utils/') // 工具目录
              );
            });
            
            // 如果筛选后的文件数超过100，只取前100个
            limitedFiles = importantFiles.length > QUICK_MODE_THRESHOLD 
              ? importantFiles.slice(0, QUICK_MODE_THRESHOLD)
              : importantFiles;
            
            // 如果筛选结果为空，至少显示前100个
            if (limitedFiles.length === 0 && frontendResult.files.length > 0) {
              limitedFiles = frontendResult.files.slice(0, QUICK_MODE_THRESHOLD);
            }
          }
        }
      }
      
      // 创建单一的前端分析结果，包含重要文件
      const allMethods: string[] = [];
      const allFiles: any[] = [];
      const allFilePaths: string[] = []; // 新增：用于存储文件路径字符串
      
      // 处理微服务检测结果
      let microserviceInfo = '';
      if (frontendResult.microserviceDetection) {
        const detection = frontendResult.microserviceDetection;
        if (detection.isMicroservice) {
          microserviceInfo = `🏗️ 微服务项目 (${detection.framework}, ${detection.buildTool})`;
          console.log(`🌐 前端微服务检测: ${microserviceInfo}`);
        } else {
          microserviceInfo = `📦 单体应用 (${detection.buildTool})`;
          console.log(`🌐 前端项目类型: ${microserviceInfo}`);
        }
      }
      
      limitedFiles.forEach((file: any) => {
          // 收集文件路径字符串
          allFilePaths.push(file.relativePath);
          
          // 收集所有文件信息
          allFiles.push({
            path: file.relativePath,
            filePath: file.relativePath,
            methods: file.methods || [],
            impactedMethods: file.methods ? file.methods.map((m: any) => ({
              methodName: m.name,
              signature: m.signature,
              type: m.type,
              calls: m.calls || [],
              calledBy: []
            })) : []
          });
        
        // 收集所有方法名
          if (file.methods) {
            file.methods.forEach((method: any) => {
              allMethods.push(`${file.relativePath}:${method.name}`);
            });
          }
        });
      
      // 创建单一的前端分析提交记录
      commits.push({
        commitId: frontendResult.gitChanges ? 'git-changes' : 'static-analysis',
        message: `${analysisMessage}${microserviceInfo ? ` - ${microserviceInfo}` : ''} (显示${limitedFiles.length}/${frontendResult.files.length}个重要文件${frontendResult.ffisEnabled ? ' [FFIS评分]' : ''})`,
        author: { name: '前端分析器', email: 'frontend@diffsense.com' },
        timestamp: frontendResult.timestamp || new Date().toISOString(),
        changedFilesCount: changedFilesCount,
        changedMethodsCount: changedMethodsCount,
        impactedMethods: allMethods,
        impactedFiles: allFilePaths, // 修复：使用文件路径字符串数组
        files: allFiles, // 保留详细文件信息用于其他用途
        impactedTests: {},
        changeClassifications: classifications.filter(c => limitedFiles.some((f: any) => f.relativePath === c.filePath)),
        classificationSummary: summary,
        language: 'frontend',
        analysisSource: 'frontend',
        frontendSummary: frontendResult.summary,
        frontendDependencies: null, // 前端项目不分析依赖
        microserviceDetection: frontendResult.microserviceDetection || null,
        totalFilesScanned: frontendResult.files.length,
        importantFilesShown: limitedFiles.length,
        gitChanges: frontendResult.gitChanges || null,
        granularModifications: frontendResult.modifications || [] // 添加granular modifications
      });
    } else {
      // 如果没有文件数据，创建一个说明性的提交
      commits.push({
        commitId: 'frontend_no_data',
        message: '前端代码分析 - 未检测到代码文件',
        author: { name: '前端分析器', email: 'frontend@diffsense.com' },
        timestamp: frontendResult.timestamp || new Date().toISOString(),
        changedFilesCount: 0,
        changedMethodsCount: 0,
        impactedMethods: [],
        impactedFiles: [],
        files: [],
        impactedTests: {},
        changeClassifications: [],
        classificationSummary: {
          totalFiles: 0,
          categoryStats: {},
          averageConfidence: 0,
          detailedClassifications: {}
        },
        language: 'frontend',
        analysisSource: 'frontend',
        frontendSummary: frontendResult.summary,
        frontendDependencies: null, // 前端项目不分析依赖
        totalFilesScanned: 0,
        importantFilesShown: 0,
        gitChanges: frontendResult.gitChanges || null,
        granularModifications: frontendResult.modifications || [] // 添加granular modifications
      });
    }
    
    return commits;
  }

  private async executeGolangAnalysis(repoPath: string, analysisData: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // Golang分析器脚本路径 - 修复远程开发环境路径问题
      const analyzerPath = this.getGolangAnalyzerPath();
      
      console.log('执行Golang分析命令:', 'node', analyzerPath, repoPath);
      console.log('分析目录:', repoPath);

      // 检查分析器文件是否存在
      if (!fs.existsSync(analyzerPath)) {
        reject(new Error(`Golang分析器文件不存在: ${analyzerPath}`));
        return;
      }

      // 执行Golang分析器
      const child = execFile('node', [analyzerPath, repoPath, 'json'], {
        cwd: repoPath,
        timeout: 60000, // 60秒超时
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('Golang分析器执行错误:', error);
          console.error('stderr:', stderr);
          reject(new Error(`Golang分析失败: ${error.message}\n${stderr}`));
        } else {
          console.log('Golang分析器执行成功');
          console.log('stderr信息:', stderr); // 显示调试信息
          
          try {
            const result = JSON.parse(stdout);
            console.log('Golang分析结果:', result);
            
            // 转换为与后端分析结果兼容的格式
            const convertedResult = this.convertGolangResult(result, repoPath);
            resolve(convertedResult);
            
          } catch (parseError) {
            console.error('Golang分析结果JSON解析失败:', parseError);
            console.log('输出前500字符:', stdout.substring(0, 500));
            reject(new Error(`Golang分析结果解析失败: ${parseError}`));
          }
        }
      });

      // 监听进程退出
      child.on('exit', (code) => {
        console.log(`Golang分析器进程退出，代码: ${code}`);
      });
    });
  }

  private convertGolangResult(golangResult: any, targetDir: string): any[] {
    // 将Golang分析结果转换为与后端分析结果兼容的格式
    // 不再按包分组，而是生成一个统一的分析结果
    const commits = [];
    
    if (golangResult && golangResult.files && golangResult.files.length > 0) {
      // 使用Golang变更分类器
      const { classifications, summary } = GolangChangeClassifier.classifyChanges(golangResult.files);
      
      // 过滤重要文件：只包含有函数的文件或高置信度分类的文件
      let importantFiles = golangResult.files.filter((file: any) => {
        const classification = classifications.find(c => c.filePath === file.relativePath);
        return (
          (file.functions && file.functions.length > 0) || // 有函数的文件
          (classification && classification.classification.confidence > 50) || // 高置信度分类
          file.relativePath.includes('/cmd/') || // 主程序目录
          file.relativePath.includes('/pkg/') || // 包目录
          file.relativePath.includes('/internal/') || // 内部包目录
          file.relativePath.includes('/api/') || // API目录
          file.relativePath.includes('/service/') || // 服务目录
          !file.relativePath.includes('_test.go') // 排除测试文件
        );
      });
      
      // 如果没有重要文件，至少显示前20%或前20个文件（取较小值）
      if (importantFiles.length === 0 && golangResult.files.length > 0) {
        const topPercentCount = Math.ceil(golangResult.files.length * 0.2);
        importantFiles = golangResult.files.slice(0, Math.min(20, topPercentCount));
      }
      
      const limitedFiles = importantFiles;
      
      // 创建单一的Golang分析结果，包含重要文件和包
      const allMethods: string[] = [];
      const allFiles: any[] = [];
      const packages = new Set<string>();
      
      limitedFiles.forEach((file: any) => {
        // 收集包信息
        if (file.packageName) {
          packages.add(file.packageName);
        }
        
        // 收集所有文件信息
        allFiles.push({
          path: file.relativePath,
          filePath: file.relativePath,
          packageName: file.packageName,
          functions: file.functions || [],
          types: file.types || [],
          methods: file.methods || [],
          imports: file.imports || [],
          impactedMethods: file.functions ? file.functions.map((f: any) => ({
            methodName: f.name,
            signature: f.signature,
            type: f.type,
            receiver: f.receiver,
            calls: f.calls || [],
            calledBy: [],
            isExported: f.isExported
          })) : []
        });
        
        // 收集所有函数名
        if (file.functions) {
          file.functions.forEach((func: any) => {
            allMethods.push(`${file.packageName || 'main'}.${func.name}`);
          });
        }
      });
      
      // 创建单一的Golang分析提交记录
      commits.push({
        commitId: 'golang_analysis',
        message: `Golang代码分析结果 (包含${packages.size}个包: ${Array.from(packages).join(', ')}) (显示${limitedFiles.length}/${golangResult.files.length}个重要文件)`,
        author: { name: 'Golang分析器', email: 'golang@diffsense.com' },
        timestamp: golangResult.timestamp || new Date().toISOString(),
        changedFilesCount: limitedFiles.length,
        changedMethodsCount: allMethods.length,
        impactedMethods: allMethods,
        impactedFiles: allFiles,
        impactedTests: {},
        changeClassifications: classifications.filter(c => limitedFiles.some((f: any) => f.relativePath === c.filePath)),
        classificationSummary: summary,
        language: 'golang',
        analysisSource: 'golang',
        packages: Array.from(packages),
        golangSummary: golangResult.summary,
        golangModules: golangResult.modules,
        totalFilesScanned: golangResult.files.length,
        importantFilesShown: limitedFiles.length
      });
    } else {
      // 如果没有文件数据，创建一个说明性的提交
      commits.push({
        commitId: 'golang_no_data',
        message: 'Golang代码分析 - 未检测到代码文件',
        author: { name: 'Golang分析器', email: 'golang@diffsense.com' },
        timestamp: golangResult.timestamp || new Date().toISOString(),
        changedFilesCount: 0,
        changedMethodsCount: 0,
        impactedMethods: [],
        impactedFiles: [],
        impactedTests: {},
        changeClassifications: [],
        classificationSummary: {
          totalFiles: 0,
          categoryStats: {},
          averageConfidence: 0,
          detailedClassifications: {}
        },
        language: 'golang',
        analysisSource: 'golang',
        packages: [],
        golangSummary: golangResult.summary,
        golangModules: golangResult.modules,
        totalFilesScanned: 0,
        importantFilesShown: 0
      });
    }
    
    return commits;
  }

  private async handleGetBranches() {
    try {
      // 获取工作区路径
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('未找到工作区文件夹');
      }

      const repoPath = workspaceFolder.uri.fsPath;
      
      // 执行git branch命令获取分支列表
      const branches = await this.getGitBranches(repoPath);
      
      // 发送分支列表给前端
      this._view?.webview.postMessage({
        command: 'branchesLoaded',
        branches: branches
      });

    } catch (error) {
      console.error('获取分支失败:', error);
      
      // 发送错误消息给前端
      this._view?.webview.postMessage({
        command: 'branchLoadError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleCommitValidation(data: any) {
    try {
      // 获取工作区路径
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('未找到工作区文件夹');
      }

      const repoPath = workspaceFolder.uri.fsPath;
      const { branch, startCommit, endCommit } = data;
      
      // 验证Commit ID是否存在于指定分支
      const isValid = await this.validateCommitIdsInBranch(repoPath, branch, startCommit, endCommit);
      
      // 发送验证结果给前端
      this._view?.webview.postMessage({
        command: 'commitValidationResult',
        valid: isValid.valid,
        error: isValid.error
      });

    } catch (error) {
      console.error('验证Commit ID失败:', error);
      
      // 发送错误消息给前端
      this._view?.webview.postMessage({
        command: 'commitValidationResult',
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private getGitBranches(repoPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      // 增加.git目录检查
      const gitPath = path.join(repoPath, '.git');
      if (!fs.existsSync(gitPath)) {
        // 如果.git目录不存在，提供更明确的错误信息
        const errorMsg = `指定的路径不是一个Git仓库: ${repoPath}。请确保在VSCode中打开了正确的项目根目录。`;
        console.error(errorMsg);
        reject(new Error(errorMsg));
        return;
      }

      // 执行git branch命令
      const child = execFile('git', ['branch', '-a'], {
        cwd: repoPath,
        timeout: 10000 // 10秒超时
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('Git branch命令失败:', error);
          console.error('stderr:', stderr);
          reject(new Error(`获取分支失败: ${error.message}`));
        } else {
          // 解析分支列表
          const branches = stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('*')) // 移除当前分支标记和空行
            .map(line => line.replace(/^\*\s*/, '')) // 移除当前分支的*标记
            .map(line => {
              // 处理远程分支，提取分支名
              if (line.startsWith('remotes/origin/')) {
                return line.replace('remotes/origin/', '');
              }
              return line;
            })
            .filter(line => line !== 'HEAD' && !line.includes('->')) // 移除HEAD引用
            .filter((branch, index, self) => self.indexOf(branch) === index); // 去重

          console.log('找到分支:', branches);
          resolve(branches.length > 0 ? branches : ['master', 'main']);
        }
      });
    });
  }

  private executeJarAnalysis(jarPath: string, repoPath: string, analysisData: any): Promise<{stdout: string, reportPath?: string}> {
    return new Promise((resolve, reject) => {
      // 构建命令参数 - 使用CLI应用期望的参数格式
      const args = ['-jar', jarPath];
      
      // 必需参数：分支名称
      const branch = analysisData.branch || 'master';
      args.push('--branch', branch);
      
      // 输出格式设置为JSON
      args.push('--output', 'json');
      
      // 处理不同的范围类型参数
      let hasRequiredParam = false;
      
      if (analysisData.range) {
        const range = analysisData.range;
        
        if (range === 'Last 3 commits') {
          args.push('--commits', '3');
          hasRequiredParam = true;
        } else if (range === 'Last 5 commits') {
          args.push('--commits', '5');
          hasRequiredParam = true;
        } else if (range === 'Last 10 commits') {
          args.push('--commits', '10');
          hasRequiredParam = true;
        } else if (range === 'Today') {
          // 使用since参数指定今天
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD格式
          args.push('--since', today);
          hasRequiredParam = true;
        } else if (range === 'This week') {
          // 计算本周开始日期
          const now = new Date();
          const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
          const weekStart = startOfWeek.toISOString().split('T')[0];
          args.push('--since', weekStart);
          hasRequiredParam = true;
        } else if (range === 'Custom Date Range') {
          // 自定义日期范围
          if (analysisData.dateFrom) {
            args.push('--since', analysisData.dateFrom);
            hasRequiredParam = true;
            // 注意：Java CLI可能需要扩展来支持结束日期
            if (analysisData.dateTo) {
              // 暂时记录，可能需要后续扩展JAR来支持until参数
              console.log('结束日期:', analysisData.dateTo, '(暂不支持，需要扩展JAR)');
            }
          }
        } else if (range === 'Commit ID Range') {
          // Commit ID范围 - 这需要JAR支持新的参数
          if (analysisData.startCommit && analysisData.endCommit) {
            // 使用commits范围，计算两个commit之间的提交数
            // 先用git rev-list计算提交数作为fallback
            console.log('Commit范围:', analysisData.startCommit, '到', analysisData.endCommit);
            // 暂时使用since参数，可能需要扩展JAR
            args.push('--commits', '20'); // 临时方案，给一个较大的数字
            hasRequiredParam = true;
            
            // TODO: 需要扩展JAR来直接支持commit范围
            console.warn('Commit ID范围暂时使用commits=20作为workaround');
          }
        }
      }
      
      // 如果没有设置任何范围参数，使用默认值
      if (!hasRequiredParam) {
        console.log('没有指定范围参数，使用默认值：最近3个提交');
        args.push('--commits', '3');
      }

      console.log('执行命令:', 'java', args.join(' '));
      console.log('工作目录:', repoPath);
      console.log('完整参数列表:', args);

      // 执行Java JAR，设置工作目录为要分析的仓库路径
      const child = execFile('java', args, {
        cwd: repoPath, // 设置工作目录为目标仓库
        timeout: 60000, // 60秒超时
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      }, (error, stdout, stderr) => {
        if (error) {
          this.log('JAR执行错误: ' + (error instanceof Error ? error.message : String(error)), 'error');
          if (stderr) {
            this.log('stderr: ' + stderr, 'error');
          }
          reject(new Error(`JAR执行失败: ${error.message}\n${stderr}`));
        } else {
          this.log('JAR执行成功');
          if (stderr) {
            this.log('stderr信息: ' + stderr);
          }
          this.log('JSON输出长度: ' + stdout.length);
          this.log('=== JAR原始输出开始 ===');
          this.log(stdout);
          this.log('=== JAR原始输出结束 ===');
          
          // 尝试解析JSON以验证格式
          try {
            const parsed = JSON.parse(stdout);
            this.log('JSON解析成功，数据类型: ' + typeof parsed);
            this.log('是否为数组: ' + Array.isArray(parsed));
            if (Array.isArray(parsed)) {
              console.log('数组长度:', parsed.length);
              console.log('第一个元素:', parsed[0]);
            } else {
              console.log('JSON对象结构:', Object.keys(parsed));
            }
          } catch (parseError) {
            console.error('JSON解析失败:', parseError);
            console.log('输出前500字符:', stdout.substring(0, 500));
          }
          
          // 不再保存报告路径，直接返回JSON输出
          resolve({ stdout });
        }
      });

      // 监听进程退出
      child.on('exit', (code) => {
        console.log(`JAR进程退出，代码: ${code}`);
      });
    });
  }

  private parseAnalysisResult(rawOutput: string): any[] {
    try {
      // 尝试解析为JSON
      const jsonResult = JSON.parse(rawOutput);
      if (Array.isArray(jsonResult)) {
        return jsonResult;
      }
      
      // 如果是对象，尝试提取commits字段
      if (jsonResult.commits && Array.isArray(jsonResult.commits)) {
        return jsonResult.commits;
      }
      
      return [jsonResult];
    } catch (jsonError) {
      // 如果不是JSON，说明Java分析器输出格式不正确，应该返回错误而不是虚假数据
      console.error('Java分析器输出不是有效的JSON格式:', jsonError);
      console.log('原始输出:', rawOutput.substring(0, 500));
      
      // 抛出错误，让上层处理，而不是创建虚假的提交记录
      const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
      throw new Error(`Java分析器输出格式错误: ${errorMessage}\n原始输出: ${rawOutput.substring(0, 200)}`);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // 使用extensionUri作为基准点
    const distPath = path.join(this._extensionUri.fsPath, 'dist');
    const htmlPath = path.join(distPath, 'index.html');
    const resourceRoot = vscode.Uri.file(distPath);

    try {
      // 检查文件是否存在
      if (!fs.existsSync(htmlPath)) {
        throw new Error(`HTML文件不存在: ${htmlPath}`);
      }

      // 读取HTML文件
      let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      
      // 获取资源URI基础路径
      const resourceUri = webview.asWebviewUri(resourceRoot);
      
      // 替换所有的资源路径为VSCode webview URI
      htmlContent = htmlContent.replace(
        /(src|href)="[./]*assets\//g,
        `$1="${resourceUri}/assets/`
      );
      
      htmlContent = htmlContent.replace(
        /href="[./]*vite\.svg"/g,
        `href="${resourceUri}/vite.svg"`
      );

      // 添加VSCode主题支持
      const vscodeStyles = `
        <style>
          /* VSCode 主题适配重置样式 */
          * {
            box-sizing: border-box;
          }
          
          html, body {
            margin: 0;
            padding: 0;
            width: 100% !important;
            height: 100% !important;
            overflow-y: auto;
            overflow-x: hidden;
            font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
            color: var(--vscode-foreground) !important;
            background-color: var(--vscode-editor-background) !important;
            font-size: 12px;
          }
          
          #root {
            width: 100% !important;
            min-height: 100% !important;
            padding: 8px;
            overflow: visible;
            position: relative;
            color: var(--vscode-foreground) !important;
            background-color: var(--vscode-editor-background) !important;
          }
          
          /* 强制所有文本元素使用VSCode主题颜色 */
          *, *::before, *::after {
            color: var(--vscode-foreground) !important;
          }
          
          /* 确保按钮和输入框也使用正确的颜色 */
          button {
            background-color: var(--vscode-button-background) !important;
            color: var(--vscode-button-foreground) !important;
            border: 1px solid var(--vscode-button-border, transparent) !important;
          }
          
          button:hover {
            background-color: var(--vscode-button-hoverBackground) !important;
          }
          
          select, input {
            background-color: var(--vscode-dropdown-background, var(--vscode-input-background)) !important;
            color: var(--vscode-dropdown-foreground, var(--vscode-input-foreground)) !important;
            border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border)) !important;
          }
          
          /* 确保链接颜色正确 */
          a {
            color: var(--vscode-textLink-foreground) !important;
          }
          
          a:hover {
            color: var(--vscode-textLink-activeForeground) !important;
          }
        </style>
        <script>
          // 检测并应用VSCode主题
          function detectAndApplyTheme() {
            const body = document.body;
            const computedStyle = getComputedStyle(document.documentElement);
            const foregroundColor = computedStyle.getPropertyValue('--vscode-foreground');
            const backgroundColor = computedStyle.getPropertyValue('--vscode-editor-background');
            
            // 如果VSCode变量不可用，尝试手动检测
            if (!foregroundColor && !backgroundColor) {
              console.warn('⚠️ VSCode主题变量不可用，使用fallback');
            }
          }
          
          // 页面加载完成后检测主题
          window.addEventListener('load', detectAndApplyTheme);
          
          // 监听主题变化
          window.addEventListener('message', (event) => {
            if (event.data.type === 'vscode-theme-changed') {
              detectAndApplyTheme();
            }
          });
        </script>
      `;

      // 在</head>标签前插入VSCode主题支持
      htmlContent = htmlContent.replace('</head>', `${vscodeStyles}</head>`);

      return htmlContent;
    } catch (error: any) {
      console.error('获取HTML内容失败:', error);
      return `
        <html>
          <head>
            <style>
              body { 
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 1em;
                font-family: var(--vscode-font-family);
              }
            </style>
          </head>
          <body>
            <h1>加载失败</h1>
            <p>无法加载DiffSense界面。请检查插件安装是否完整。</p>
            <pre>${error.message}</pre>
          </body>
        </html>
      `;
    }
  }

  private async openReportFile(reportPath: string) {
    try {
      if (reportPath && fs.existsSync(reportPath)) {
        // 在VSCode中打开HTML文件作为文本文件
        const document = await vscode.workspace.openTextDocument(reportPath);
        await vscode.window.showTextDocument(document);
      } else {
        vscode.window.showErrorMessage('报告文件不存在');
      }
    } catch (error) {
      console.error('打开报告文件失败:', error);
      vscode.window.showErrorMessage(`打开报告文件失败: ${error}`);
    }
  }

  private async openReportInBrowser(reportPath: string) {
    try {
      if (reportPath && fs.existsSync(reportPath)) {
        // 使用系统默认浏览器打开HTML文件
        const uri = vscode.Uri.file(reportPath);
        await vscode.env.openExternal(uri);
      } else {
        vscode.window.showErrorMessage('报告文件不存在');
      }
    } catch (error) {
      console.error('在浏览器中打开报告失败:', error);
      vscode.window.showErrorMessage(`在浏览器中打开报告失败: ${error}`);
    }
  }

  private validateCommitIdsInBranch(repoPath: string, branch: string, startCommit: string, endCommit: string): Promise<{valid: boolean, error?: string}> {
    return new Promise((resolve) => {
      // 增加.git目录检查
      const gitPath = path.join(repoPath, '.git');
      if (!fs.existsSync(gitPath)) {
        const errorMsg = `指定的路径不是一个Git仓库: ${repoPath}。`;
        console.error(errorMsg);
        resolve({ valid: false, error: errorMsg });
        return;
      }
      
      // 验证两个commit是否存在且在同一分支
      const child = execFile('git', [
        'merge-base', 
        '--is-ancestor', 
        startCommit, 
        endCommit
      ], {
        cwd: repoPath,
        timeout: 10000
      }, (error, stdout, stderr) => {
        if (error) {
          // 检查是否是因为commits不存在
          if (stderr.includes('bad revision') || stderr.includes('unknown revision')) {
            resolve({ valid: false, error: 'Commit ID不存在' });
          } else {
            resolve({ valid: false, error: `Commit顺序错误：${startCommit}不是${endCommit}的祖先` });
          }
        } else {
          // merge-base成功，说明startCommit是endCommit的祖先
          // 再验证两个commit是否都在指定分支上
          this.verifyCommitsInBranch(repoPath, branch, startCommit, endCommit)
            .then(resolve)
            .catch((err) => {
              resolve({ valid: false, error: err.message });
            });
        }
      });
    });
  }

  private verifyCommitsInBranch(repoPath: string, branch: string, startCommit: string, endCommit: string): Promise<{valid: boolean, error?: string}> {
    return new Promise((resolve, reject) => {
      // 增加.git目录检查
      const gitPath = path.join(repoPath, '.git');
      if (!fs.existsSync(gitPath)) {
        const errorMsg = `指定的路径不是一个Git仓库: ${repoPath}。`;
        console.error(errorMsg);
        reject(new Error(errorMsg));
        return;
      }
      
      // 检查commits是否在分支历史中
      const child = execFile('git', [
        'log', 
        '--oneline',
        `${startCommit}..${endCommit}`,
        branch
      ], {
        cwd: repoPath,
        timeout: 10000
      }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`验证分支历史失败: ${stderr}`));
        } else {
          // 如果有输出，说明commits在分支历史中
          resolve({ 
            valid: true, 
            error: `验证成功：发现${stdout.split('\n').filter(line => line.trim()).length}个提交` 
          });
        }
      });
    });
  }

  private async handleRestoreAnalysisResults() {
    try {
      // 如果有保存的分析结果，发送给前端
      if (this._lastAnalysisResult && this._lastAnalysisResult.length > 0) {
        console.log('🔄 恢复分析结果:', this._lastAnalysisResult.length, '个提交');
        
        this._view?.webview.postMessage({
          command: 'restoredAnalysisResults',
          data: this._lastAnalysisResult
        });
      } else {
        console.log('📭 没有可恢复的分析结果');
      }
    } catch (error) {
      console.error('恢复分析结果失败:', error);
    }
  }

  private async handleReportBug(reportData: any) {
    try {
      console.log('📩 处理bug汇报请求:', reportData);
      
      // 获取工作区信息
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const workspacePath = workspaceFolder?.uri.fsPath || '未知路径';
      const workspaceName = workspaceFolder?.name || '未知项目';
      
      // 收集系统信息
      const systemInfo = {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        vscodeVersion: vscode.version,
        extensionVersion: vscode.extensions.getExtension('diffsense.analysis')?.packageJSON?.version || '未知版本'
      };
      
      // 收集Git信息（如果可用）
      let gitInfo: any = {};
      try {
        gitInfo = await this.collectGitInfo(workspacePath);
      } catch (error) {
        gitInfo = { error: 'Git信息收集失败' };
      }
      
      // 收集最近的错误日志（如果有的话）
      const recentErrors = this.getRecentErrors();
      
      // 构建GitHub Issue内容
      const issueTitle = this.generateIssueTitle(reportData, systemInfo);
      const issueBody = this.generateIssueBody({
        reportData,
        systemInfo,
        gitInfo,
        workspacePath,
        workspaceName,
        recentErrors,
        timestamp: new Date().toISOString()
      });
      
      // 构建GitHub Issue URL
      const githubRepoUrl = 'https://github.com/GoldenSupremeSaltedFish/DiffSense'; // 更新为实际的GitHub仓库地址
      const issueUrl = this.buildGitHubIssueUrl(githubRepoUrl, issueTitle, issueBody);
      
      console.log('🔗 生成的GitHub Issue URL长度:', issueUrl.length);
      
      // 使用VSCode API打开GitHub Issue页面
      await vscode.env.openExternal(vscode.Uri.parse(issueUrl));
      
      // 显示成功消息
      const action = await vscode.window.showInformationMessage(
        '📩 感谢您的反馈！已为您打开GitHub Issue页面，请检查并提交问题报告。',
        '🔗 重新打开链接',
        '📋 复制到剪贴板'
      );
      
      if (action === '🔗 重新打开链接') {
        await vscode.env.openExternal(vscode.Uri.parse(issueUrl));
      } else if (action === '📋 复制到剪贴板') {
        await vscode.env.clipboard.writeText(issueUrl);
        vscode.window.showInformationMessage('📋 GitHub Issue URL已复制到剪贴板');
      }
      
    } catch (error) {
      console.error('Bug汇报处理失败:', error);
      
      // 显示错误消息
      const action = await vscode.window.showErrorMessage(
        `Bug汇报功能暂时不可用: ${error instanceof Error ? error.message : String(error)}`,
        '🔧 手动报告',
        '📋 复制错误信息'
      );
      
      if (action === '🔧 手动报告') {
        // 打开GitHub仓库的Issues页面
        await vscode.env.openExternal(vscode.Uri.parse('https://github.com/GoldenSupremeSaltedFish/DiffSense/issues/new'));
      } else if (action === '📋 复制错误信息') {
        const errorInfo = JSON.stringify({ reportData, error: error instanceof Error ? error.message : String(error) }, null, 2);
        await vscode.env.clipboard.writeText(errorInfo);
        vscode.window.showInformationMessage('📋 错误信息已复制到剪贴板');
      }
    }
  }

  private async handleExportResults(format: string, language: string = 'zh-CN') {
    try {
      if (!this._lastAnalysisResult || this._lastAnalysisResult.length === 0) {
        const message = language === 'en-US' ? 
          'No analysis results to export, please run analysis first' :
          '没有可导出的分析结果，请先进行分析';
        vscode.window.showWarningMessage(message);
        return;
      }

      // 获取工作区路径
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('未找到工作区文件夹');
      }

      // 生成导出文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `diffsense-analysis-${timestamp}.${format}`;
      
      // 让用户选择保存位置
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, fileName)),
        filters: {
          'JSON文件': ['json'],
          'CSV文件': ['csv'],
          'HTML文件': ['html']
        }
      });

      if (!saveUri) {
        return; // 用户取消了保存
      }

      // 创建导出数据
      const exportData = {
        exportInfo: {
          timestamp: new Date().toISOString(),
          repository: workspaceFolder.uri.fsPath,
          totalCommits: this._lastAnalysisResult.length,
          exportedBy: 'DiffSense VSCode Extension',
          language: language
        },
        analysisResults: this._lastAnalysisResult
      };

      // 根据格式生成内容
      let content: string;
      
      if (format === 'html') {
        content = this.generateHTMLReport(exportData, language);
      } else {
        // 默认JSON格式
        content = JSON.stringify(exportData, null, 2);
      }

      // 写入文件
      await fs.promises.writeFile(saveUri.fsPath, content, 'utf-8');

      // 显示成功消息
      const successMessage = language === 'en-US' ? 
        `Analysis results exported to: ${path.basename(saveUri.fsPath)}` :
        `分析结果已导出到: ${path.basename(saveUri.fsPath)}`;
      
      const openFileText = language === 'en-US' ? 'Open File' : '打开文件';
      const showInExplorerText = language === 'en-US' ? 'Show in Explorer' : '在资源管理器中显示';
      
      const action = await vscode.window.showInformationMessage(
        successMessage, 
        openFileText, 
        showInExplorerText
      );

      if (action === openFileText) {
        const document = await vscode.workspace.openTextDocument(saveUri);
        await vscode.window.showTextDocument(document);
      } else if (action === showInExplorerText) {
        await vscode.commands.executeCommand('revealFileInOS', saveUri);
      }

    } catch (error) {
      console.error('导出结果失败:', error);
      const errorMessage = language === 'en-US' ? 
        `Export failed: ${error instanceof Error ? error.message : String(error)}` :
        `导出失败: ${error instanceof Error ? error.message : String(error)}`;
      vscode.window.showErrorMessage(errorMessage);
    }
  }

  private getCategoryDisplayName(category: string): string {
    const names: Record<string, string> = {
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

  private generateHTMLReport(exportData: any, language: string): string {
    const { exportInfo, analysisResults } = exportData;
    
    // 语言配置
    const isEnglish = language === 'en-US';
    const text = {
      title: isEnglish ? 'DiffSense Analysis Report' : 'DiffSense 分析报告',
      subtitle: isEnglish ? 'Git Code Impact Analysis' : 'Git 代码影响分析',
      generatedTime: isEnglish ? 'Generated Time' : '生成时间',
      repositoryPath: isEnglish ? 'Repository Path' : '仓库路径',
      analysisEngine: isEnglish ? 'Analysis Engine' : '分析引擎',
      analysisOverview: isEnglish ? '📊 Analysis Overview' : '📊 分析概览',
      overview: isEnglish ? '📊 Analysis Overview' : '📊 分析概览',
      testCoverageOverview: isEnglish ? '🔍 Test Coverage Overview' : '🔍 测试覆盖概览',
      totalCommits: isEnglish ? 'Total Commits' : '总提交数',
      totalFiles: isEnglish ? 'Total Files' : '总文件数',
      totalMethods: isEnglish ? 'Total Methods' : '总方法数',
      totalClassifiedFiles: isEnglish ? 'Total Classified Files' : '分类文件总数',
      averageConfidence: isEnglish ? 'Average Confidence' : '平均置信度',
      testCoverage: isEnglish ? 'Test Coverage Analysis' : '测试覆盖分析',
      testGaps: isEnglish ? 'Test Coverage Gaps' : '测试覆盖漏洞',
      totalGaps: isEnglish ? 'Total Gaps' : '总漏洞数',
      highRiskGaps: isEnglish ? 'High Risk Gaps' : '高风险漏洞',
      mediumRiskGaps: isEnglish ? 'Medium Risk Gaps' : '中风险漏洞',
      lowRiskGaps: isEnglish ? 'Low Risk Gaps' : '低风险漏洞',
      analysisDetails: isEnglish ? '📝 Commit Analysis Details' : '📝 提交分析详情',
      highRisk: isEnglish ? 'High Risk' : '高风险',
      mediumRisk: isEnglish ? 'Medium Risk' : '中风险',
      lowRisk: isEnglish ? 'Low Risk' : '低风险',
      author: isEnglish ? 'Author' : '作者',
      date: isEnglish ? 'Date' : '日期',
      impactedFiles: isEnglish ? '📁 Affected Files' : '📁 影响文件',
      impactedMethods: isEnglish ? '⚙️ Affected Methods' : '⚙️ 影响方法',
      testCoverageGaps: isEnglish ? '🔍 Test Coverage Gaps' : '🔍 测试覆盖漏洞',
      callRelationships: isEnglish ? '🔗 Call Relationship Graph' : '🔗 调用关系图',
      noDetailedData: isEnglish ? 'No detailed data available' : '暂无详细数据',
      reportGenerated: isEnglish ? '📋 Report generated by DiffSense VSCode Extension' : '📋 报告由 DiffSense VSCode 扩展生成',
      filesUnit: isEnglish ? 'files' : '个文件',
      methodsUnit: isEnglish ? 'methods' : '个方法',
      noData: isEnglish ? 'No analysis data available' : '暂无分析数据',
      runAnalysisFirst: isEnglish ? 'Please run code analysis to generate report' : '请先进行代码分析以生成报告',
      nodes: isEnglish ? 'nodes' : '节点',
      relationships: isEnglish ? 'relationships' : '关系',
      modifiedMethods: isEnglish ? 'Modified methods' : '修改的方法',
      newMethods: isEnglish ? 'New methods' : '新增的方法',
      affectedMethods: isEnglish ? 'Affected methods' : '受影响的方法',
      unknownMethods: isEnglish ? 'External/Unknown methods' : '外部/未知方法',
      noCallGraphData: isEnglish ? 'No call graph data available' : '暂无调用关系数据',
      methodChanges: isEnglish ? 'No method changes' : '无方法变更',
      riskReason: isEnglish ? 'Risk Reason' : '风险原因',
      impactedCallersCount: isEnglish ? 'Impacted Callers' : '受影响调用者',
      noTestCoverageGaps: isEnglish ? 'No test coverage gaps found' : '未发现测试覆盖漏洞',
      viewImpactedCallers: isEnglish ? 'View Impacted Callers' : '查看受影响的调用者',
      andMore: isEnglish ? 'and' : '以及',
      moreFiles: isEnglish ? 'more files' : '个更多文件',
      moreMethods: isEnglish ? 'more methods' : '个更多方法',
      moreTestGaps: isEnglish ? 'more test gaps' : '个更多测试漏洞',
      toggleGraph: isEnglish ? 'Show/Hide Graph' : '显示/隐藏图表'
    };
    
    // 计算统计信息
    const totalCommits = analysisResults.length;
    const totalFiles = analysisResults.reduce((sum: number, commit: any) => 
      sum + (commit.impactedFiles?.length || commit.files?.length || 0), 0);
    const totalMethods = analysisResults.reduce((sum: number, commit: any) => 
      sum + (commit.impactedMethods?.length || 
           (commit.files?.reduce((fileSum: number, file: any) => 
             fileSum + (file.methods?.length || 0), 0)) || 0), 0);
    
    // 计算分类统计信息
    const totalClassifiedFiles = analysisResults.reduce((sum: number, commit: any) => 
      sum + (commit.classificationSummary?.totalFiles || 0), 0);
    const averageConfidence = totalClassifiedFiles > 0 ? 
      analysisResults.reduce((sum: number, commit: any) => 
        sum + (commit.classificationSummary?.averageConfidence || 0), 0) / analysisResults.length : 0;

    // 计算测试覆盖统计信息
    const allTestCoverageGaps = analysisResults.reduce((gaps: any[], commit: any) => {
      if (commit.testCoverageGaps && Array.isArray(commit.testCoverageGaps)) {
        return gaps.concat(commit.testCoverageGaps);
      }
      return gaps;
    }, []);

    const testCoverageStats = {
      totalGaps: allTestCoverageGaps.length,
      highRisk: allTestCoverageGaps.filter((gap: any) => gap.riskLevel === 'HIGH').length,
      mediumRisk: allTestCoverageGaps.filter((gap: any) => gap.riskLevel === 'MEDIUM').length,
      lowRisk: allTestCoverageGaps.filter((gap: any) => gap.riskLevel === 'LOW').length
    };

    return `<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${text.title}</title>
    <script src="https://unpkg.com/cytoscape@3.23.0/dist/cytoscape.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .header h1 {
            color: #4a5568;
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header .subtitle {
            color: #718096;
            font-size: 1.1em;
            margin-bottom: 20px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        
        .info-card {
            background: #f7fafc;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        
        .info-card .label {
            font-size: 0.9em;
            color: #718096;
            margin-bottom: 5px;
        }
        
        .info-card .value {
            font-size: 1.1em;
            font-weight: 600;
            color: #2d3748;
        }
        
        .stats-section {
            background: white;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        
        .stats-title {
            font-size: 1.5em;
            color: #4a5568;
            margin-bottom: 20px;
            font-weight: 600;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
        }
        
        .stat-card {
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        
        .stat-number {
            font-size: 2.5em;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        
        .test-coverage-section {
            background: white;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        
        .test-gap-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 15px;
            overflow: hidden;
            transition: transform 0.2s ease;
        }
        
        .test-gap-card:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .test-gap-header {
            padding: 12px 15px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .risk-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 600;
            color: white;
        }
        
        .risk-high {
            background: #e53e3e;
        }
        
        .risk-medium {
            background: #dd6b20;
        }
        
        .risk-low {
            background: #38a169;
        }
        
        .classification-info {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        
        .category-tag {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 600;
            color: white;
        }
        
        /* 后端分类样式 (A1-A5) */
        .category-A1 {
            background: #e53e3e;
        }
        
        .category-A2 {
            background: #dd6b20;
        }
        
        .category-A3 {
            background: #3182ce;
        }
        
        .category-A4 {
            background: #805ad5;
        }
        
        .category-A5 {
            background: #38a169;
        }
        
        /* 前端分类样式 (F1-F5) */
        .category-F1 {
            background: #e91e63;
        }
        
        .category-F2 {
            background: #2196f3;
        }
        
        .category-F3 {
            background: #ff5722;
        }
        
        .category-F4 {
            background: #795548;
        }
        
        .category-F5 {
            background: #607d8b;
        }
        
        .confidence-score {
            font-size: 0.9em;
            color: #718096;
            font-weight: 600;
        }
        
        .test-gap-content {
            padding: 15px;
            background: #f9f9f9;
        }
        
        .method-signature {
            font-family: 'Courier New', monospace;
            background: #f1f5f9;
            padding: 8px;
            border-radius: 4px;
            border-left: 3px solid #667eea;
            margin-bottom: 10px;
            font-size: 0.9em;
        }
        
        .commits-section {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        
        .commit-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 20px;
            overflow: hidden;
            transition: transform 0.2s ease;
        }
        
        .commit-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .commit-header {
            background: #f7fafc;
            padding: 15px 20px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .commit-id {
            font-family: 'Courier New', monospace;
            background: #667eea;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9em;
            margin-right: 10px;
        }
        
        .commit-message {
            font-weight: 600;
            color: #2d3748;
            margin: 8px 0;
        }
        
        .commit-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #718096;
            font-size: 0.9em;
        }
        
        .risk-score {
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            color: white;
        }
        
        .risk-high { background: #e53e3e; }
        .risk-medium { background: #dd6b20; }
        .risk-low { background: #38a169; }
        
        .commit-content {
            padding: 20px;
        }
        
        .section {
            margin-bottom: 20px;
        }
        
        .section-title {
            font-size: 1.1em;
            font-weight: 600;
            color: #4a5568;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
        }
        
        .section-title::before {
            content: '';
            width: 4px;
            height: 20px;
            background: #667eea;
            margin-right: 10px;
            border-radius: 2px;
        }
        
        .file-list, .method-list {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 15px;
            border-left: 4px solid #667eea;
        }
        
        .file-item, .method-item {
            margin-bottom: 5px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            color: #2d3748;
        }
        
        .file-item:last-child, .method-item:last-child {
            margin-bottom: 0;
        }
        
        .call-graph-container {
            width: 100%;
            height: 400px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: white;
            position: relative;
        }
        
        .no-data {
            text-align: center;
            color: #718096;
            font-style: italic;
            padding: 20px;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: white;
            font-size: 0.9em;
            opacity: 0.8;
        }
        
        .toggle-details {
            background: none;
            border: none;
            color: #667eea;
            cursor: pointer;
            font-size: 0.9em;
            text-decoration: underline;
            margin-left: 10px;
        }
        
        .details-content {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
        }
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>${text.title}</h1>
            <div class="subtitle">${text.subtitle}</div>
            <div class="info-grid">
                <div class="info-card">
                    <div class="label">${text.generatedTime}</div>
                    <div class="value">${exportInfo.timestamp}</div>
                </div>
                <div class="info-card">
                    <div class="label">${text.repositoryPath}</div>
                    <div class="value">${exportInfo.projectPath || 'Unknown'}</div>
                </div>
                <div class="info-card">
                    <div class="label">${text.analysisEngine}</div>
                    <div class="value">DiffSense v${exportInfo.version || '1.0'}</div>
                </div>
            </div>
        </div>

        <!-- Statistics Overview -->
        <div class="stats-section">
            <div class="stats-title">${text.analysisOverview}</div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${totalCommits}</div>
                    <div class="stat-label">${text.totalCommits}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalFiles}</div>
                    <div class="stat-label">${text.totalFiles}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalMethods}</div>
                    <div class="stat-label">${text.totalMethods}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalClassifiedFiles}</div>
                    <div class="stat-label">${text.totalClassifiedFiles}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${Math.round(averageConfidence)}%</div>
                    <div class="stat-label">${text.averageConfidence}</div>
                </div>
            </div>
        </div>

        <!-- Commit Details -->
        <div class="commits-section">
            <div class="stats-title">${text.analysisDetails}</div>
            ${analysisResults.length === 0 ? `
                <div class="no-data">
                    ${text.noData}<br>
                    <small>${text.runAnalysisFirst}</small>
                </div>
            ` : analysisResults.map((commit: any, index: number) => {
                const callGraphData = this.generateCallGraphData(commit, commit.files || []);
                const classificationStats = commit.classificationSummary || { categoryStats: {}, averageConfidence: 0 };
                const topCategory = Object.entries(classificationStats.categoryStats).reduce((max: any, curr: any) => 
                  curr[1] > (max[1] || 0) ? curr : max, ['A5', 0]);
                
                return `
                <div class="commit-card">
                    <div class="commit-header">
                        <div>
                            <span class="commit-id">${(commit.id || commit.commitId || 'unknown').substring(0, 8)}</span>
                            <div class="commit-message">${commit.message || text.noDetailedData}</div>
                        </div>
                        <div class="commit-meta">
                            <div>
                                ${commit.author ? `<strong>${text.author}:</strong> ${commit.author.name || commit.author} | ` : ''}
                                ${commit.timestamp ? `<strong>${text.date}:</strong> ${new Date(commit.timestamp).toLocaleString()}` : ''}
                            </div>
                            <div class="classification-info">
                                <span class="category-tag category-${topCategory[0]}">${this.getCategoryDisplayName(topCategory[0])}</span>
                                <span class="confidence-score">${Math.round(classificationStats.averageConfidence || 0)}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="commit-content">
                        <!-- 提交统计信息 -->
                        <div class="section">
                            <div class="section-title">📊 提交统计</div>
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px;">
                                <div style="text-align: center; padding: 10px; background: #f7fafc; border-radius: 6px;">
                                    <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${commit.changedFilesCount || commit.impactedFiles?.length || commit.files?.length || 0}</div>
                                    <div style="font-size: 0.9em; color: #718096;">${text.totalFiles}</div>
                                </div>
                                <div style="text-align: center; padding: 10px; background: #f7fafc; border-radius: 6px;">
                                    <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${commit.changedMethodsCount || commit.impactedMethods?.length || 0}</div>
                                    <div style="font-size: 0.9em; color: #718096;">${text.totalMethods}</div>
                                </div>
                                <div style="text-align: center; padding: 10px; background: #f7fafc; border-radius: 6px;">
                                    <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${commit.impactedMethods?.length || 0}</div>
                                    <div style="font-size: 0.9em; color: #718096;">影响方法</div>
                                </div>
                                <div style="text-align: center; padding: 10px; background: #f7fafc; border-radius: 6px;">
                                    <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${Object.keys(commit.impactedTests || {}).length}</div>
                                    <div style="font-size: 0.9em; color: #718096;">影响测试</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 分类统计 -->
                        ${classificationStats.categoryStats && Object.keys(classificationStats.categoryStats).length > 0 ? `
                            <div class="section">
                                <div class="section-title">🏷️ 修改类型摘要</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;">
                                    ${Object.entries(classificationStats.categoryStats).map(([category, count]: [string, any]) => `
                                        <span class="category-tag category-${category}" style="padding: 6px 12px; border-radius: 4px; font-size: 0.9em;">
                                            ${this.getCategoryDisplayName(category)}: ${count} ${text.filesUnit}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${commit.impactedFiles && commit.impactedFiles.length > 0 ? `
                            <div class="section">
                                <div class="section-title">${text.impactedFiles}</div>
                                <div class="file-list">
                                    ${commit.impactedFiles.map((file: string) => `
                                        <div class="file-item">${file}</div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : commit.files && commit.files.length > 0 ? `
                            <div class="section">
                                <div class="section-title">${text.impactedFiles}</div>
                                <div class="file-list">
                                    ${commit.files.map((file: any) => `
                                        <div class="file-item">${file.path || file.filePath || file}</div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${commit.impactedMethods && Array.isArray(commit.impactedMethods) && commit.impactedMethods.length > 0 ? `
                            <div class="section">
                                <div class="section-title">${text.impactedMethods}</div>
                                <div class="method-list">
                                    ${commit.impactedMethods.map((method: string) => `
                                        <div class="method-item">${method}</div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <!-- 细粒度修改标签 -->
                        ${commit.granularModifications && commit.granularModifications.length > 0 ? `
                            <div class="section">
                                <div class="section-title">🔍 细粒度修改标签</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                    ${(() => {
                                        const modStats = commit.granularModifications.reduce((acc: any, mod: any) => {
                                            if (!acc[mod.type]) {
                                                acc[mod.type] = { count: 0, typeName: mod.typeName || mod.type };
                                            }
                                            acc[mod.type].count++;
                                            return acc;
                                        }, {});
                                        return Object.entries(modStats).map(([type, stats]: [string, any]) => `
                                            <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.85em; background: #f7fafc; border: 1px solid #e2e8f0;">
                                                ${stats.typeName}: ${stats.count}
                                            </span>
                                        `).join('');
                                    })()}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="section">
                            <div class="section-title">
                                ${text.callRelationships}
                                <button class="toggle-details" onclick="toggleCallGraph('graph-${index}')">
                                    ${text.toggleGraph}
                                </button>
                            </div>
                            <div id="graph-${index}" class="details-content hidden">
                                ${callGraphData.nodes.length > 0 ? `
                                    <div style="margin-bottom: 10px; color: #718096; font-size: 0.9em;">
                                        ${callGraphData.nodes.length} ${text.nodes}, ${callGraphData.edges.length} ${text.relationships}
                                    </div>
                                    <div class="call-graph-container" id="cy-${index}"></div>
                                ` : `
                                    <div class="no-data">${text.noCallGraphData}</div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }).join('')}
        </div>

        <!-- Test Coverage Section -->
        ${testCoverageStats.totalGaps > 0 ? `
        <div class="test-coverage-section">
            <div class="stats-title">${text.testCoverageOverview}</div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${testCoverageStats.totalGaps}</div>
                    <div class="stat-label">${text.totalGaps}</div>
                </div>
                <div class="stat-card risk-high">
                    <div class="stat-number">${testCoverageStats.highRisk}</div>
                    <div class="stat-label">${text.highRiskGaps}</div>
                </div>
                <div class="stat-card risk-medium">
                    <div class="stat-number">${testCoverageStats.mediumRisk}</div>
                    <div class="stat-label">${text.mediumRiskGaps}</div>
                </div>
                <div class="stat-card risk-low">
                    <div class="stat-number">${testCoverageStats.lowRisk}</div>
                    <div class="stat-label">${text.lowRiskGaps}</div>
                </div>
            </div>
            
            <!-- Test Coverage Gaps Details -->
            <div style="margin-top: 25px;">
                <h3 style="margin-bottom: 15px; color: #4a5568;">${text.testCoverageGaps}</h3>
                ${allTestCoverageGaps.map((gap: any) => `
                    <div class="test-gap-card">
                        <div class="test-gap-header">
                            <div>
                                <span class="risk-badge risk-${gap.riskLevel.toLowerCase()}">${gap.riskDisplayName}</span>
                                <span style="margin-left: 10px; color: #718096;">${gap.className}</span>
                            </div>
                            <div style="color: #718096; font-size: 0.9em;">
                                ${text.impactedCallersCount}: ${gap.impactedCallersCount}
                            </div>
                        </div>
                        <div class="test-gap-content">
                            <div class="method-signature">${gap.methodName}</div>
                            <div style="color: #718096; margin-bottom: 10px;">
                                <strong>${text.riskReason}:</strong> ${gap.reason}
                            </div>
                            ${gap.impactedCallers && gap.impactedCallers.length > 0 ? `
                                <details>
                                    <summary style="cursor: pointer; color: #667eea; margin-bottom: 8px;">
                                        ${text.viewImpactedCallers} (${gap.impactedCallers.length})
                                    </summary>
                                    <div style="background: #f1f5f9; padding: 8px; border-radius: 4px; margin-top: 8px;">
                                        ${gap.impactedCallers.map((caller: string) => `
                                            <div style="font-family: 'Courier New', monospace; font-size: 0.85em; margin: 2px 0;">${caller}</div>
                                        `).join('')}
                                    </div>
                                </details>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <div class="footer">
            ${text.reportGenerated}
        </div>
    </div>

    <script>
        // 切换详细信息显示
        function toggleCallGraph(graphId) {
            const element = document.getElementById(graphId);
            if (element.classList.contains('hidden')) {
                element.classList.remove('hidden');
                // 如果是调用图，初始化Cytoscape
                if (graphId.startsWith('graph-')) {
                    const index = graphId.split('-')[1];
                    setTimeout(() => initCallGraph(index), 100);
                }
            } else {
                element.classList.add('hidden');
            }
        }

        // 初始化调用关系图
        function initCallGraph(index) {
            const container = document.getElementById('cy-' + index);
            if (!container || container.hasAttribute('data-initialized')) return;
            
            const callGraphData = ${JSON.stringify(analysisResults.map((commit: any) => 
                this.generateCallGraphData(commit, commit.files || [])))};
            
            if (index >= callGraphData.length || !callGraphData[index] || callGraphData[index].nodes.length === 0) {
                container.innerHTML = '<div class="no-data">${text.noCallGraphData}</div>';
                return;
            }
            
            const data = callGraphData[index];
            
            try {
                const cy = cytoscape({
                    container: container,
                    elements: [
                        ...data.nodes.map(node => ({
                            data: { 
                                id: node.id, 
                                label: node.label,
                                type: node.type
                            }
                        })),
                        ...data.edges.map(edge => ({
                            data: { 
                                source: edge.source, 
                                target: edge.target,
                                type: edge.type
                            }
                        }))
                    ],
                    style: [
                        {
                            selector: 'node',
                            style: {
                                'background-color': 'data(type)',
                                'label': 'data(label)',
                                'width': 60,
                                'height': 60,
                                'text-valign': 'center',
                                'text-halign': 'center',
                                'font-size': '10px',
                                'text-wrap': 'wrap',
                                'text-max-width': '80px'
                            }
                        },
                        {
                            selector: 'node[type = "#e53e3e"]',
                            style: {
                                'background-color': '#e53e3e',
                                'color': 'white'
                            }
                        },
                        {
                            selector: 'node[type = "#38a169"]',
                            style: {
                                'background-color': '#38a169',
                                'color': 'white'
                            }
                        },
                        {
                            selector: 'node[type = "#667eea"]',
                            style: {
                                'background-color': '#667eea',
                                'color': 'white'
                            }
                        },
                        {
                            selector: 'node[type = "#718096"]',
                            style: {
                                'background-color': '#718096',
                                'color': 'white'
                            }
                        },
                        {
                            selector: 'edge',
                            style: {
                                'width': 2,
                                'line-color': '#ccc',
                                'target-arrow-color': '#ccc',
                                'target-arrow-shape': 'triangle',
                                'arrow-scale': 1.2
                            }
                        }
                    ],
                    layout: {
                        name: 'breadthfirst',
                        directed: true,
                        spacingFactor: 1.5,
                        animate: true,
                        animationDuration: 500
                    }
                });
                
                container.setAttribute('data-initialized', 'true');
            } catch (error) {
                console.error('Failed to initialize call graph:', error);
                container.innerHTML = '<div class="no-data">${text.noCallGraphData}</div>';
            }
        }
    </script>
</body>
</html>`;
  }

  private generateCallGraphData(commit: any, files: any[]): { nodes: any[], edges: any[] } {
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeIds = new Set<string>();

    // 从提交和文件中提取方法信息，构建调用关系图数据
    files.forEach((file: any) => {
      const filePath = file.path || file.filePath || '未知文件';
      const methods = file.methods || file.impactedMethods || [];

      methods.forEach((method: any) => {
        const methodName = typeof method === 'string' ? method : method.methodName || method.name || '未知方法';
        const nodeId = `${filePath}:${methodName}`;
        
        if (!nodeIds.has(nodeId)) {
          nodes.push({
            data: {
              id: nodeId,
              label: methodName,
              signature: typeof method === 'string' ? `${methodName}()` : method.signature || `${methodName}()`,
              file: filePath,
              type: (typeof method === 'object' && method.type) || 'affected'
            }
          });
          nodeIds.add(nodeId);
        }

        // 处理调用关系（如果数据中有的话）
        if (typeof method === 'object' && method.calls) {
          method.calls.forEach((calledMethod: string) => {
            const targetId = `${filePath}:${calledMethod}`;
            
            // 如果目标方法不存在，创建占位符节点
            if (!nodeIds.has(targetId)) {
              nodes.push({
                data: {
                  id: targetId,
                  label: calledMethod,
                  signature: `${calledMethod}()`,
                  file: filePath,
                  type: 'unknown'
                }
              });
              nodeIds.add(targetId);
            }
            
            edges.push({
              data: {
                id: `${nodeId}->${targetId}`,
                source: nodeId,
                target: targetId,
                type: 'calls'
              }
            });
          });
        }

        if (typeof method === 'object' && method.calledBy) {
          method.calledBy.forEach((callerMethod: string) => {
            const sourceId = `${filePath}:${callerMethod}`;
            
            // 如果源方法不存在，创建占位符节点
            if (!nodeIds.has(sourceId)) {
              nodes.push({
                data: {
                  id: sourceId,
                  label: callerMethod,
                  signature: `${callerMethod}()`,
                  file: filePath,
                  type: 'unknown'
                }
              });
              nodeIds.add(sourceId);
            }
            
            edges.push({
              data: {
                id: `${sourceId}->${nodeId}`,
                source: sourceId,
                target: nodeId,
                type: 'calledBy'
              }
            });
          });
        }
      });
    });



    return { nodes, edges };
  }

  /**
   * 获取分析器脚本的正确路径
   * 处理远程开发环境和本地开发环境的路径差异
   */
  private getAnalyzerPath(analyzerType: string): string {
    // 首先尝试从analyzers目录获取
    const analyzersPath = path.join(this._extensionUri.fsPath, 'analyzers', analyzerType);
    
    // 回退路径：ui目录（兼容旧版本）
    const uiPath = path.join(this._extensionUri.fsPath, 'ui', analyzerType);
    
    try {
      // 检查analyzers目录中的文件是否存在
      if (fs.existsSync(analyzersPath)) {
        console.log(`✅ [路径] 在analyzers目录找到分析器: ${analyzersPath}`);
        return analyzersPath;
      }
      
      // 检查ui目录中的文件是否存在
      if (fs.existsSync(uiPath)) {
        console.log(`✅ [路径] 在ui目录找到分析器: ${uiPath}`);
        return uiPath;
      }

      // 都不存在时，输出诊断信息
      console.warn(`⚠️ [路径] 分析器文件不存在:`);
      console.warn(`  - analyzers路径: ${analyzersPath}`);
      console.warn(`  - ui路径: ${uiPath}`);
      
      // 诊断扩展目录内容
      const extensionDir = this._extensionUri.fsPath;
      if (fs.existsSync(extensionDir)) {
        console.warn(`📁 [诊断] 扩展目录内容:`, fs.readdirSync(extensionDir));
        
        const analyzersDir = path.join(extensionDir, 'analyzers');
        if (fs.existsSync(analyzersDir)) {
          console.warn(`📁 [诊断] analyzers目录内容:`, fs.readdirSync(analyzersDir));
        }
        
        const uiDir = path.join(extensionDir, 'ui');
        if (fs.existsSync(uiDir)) {
          console.warn(`📁 [诊断] ui目录内容:`, fs.readdirSync(uiDir));
        }
      }

      // 返回analyzers路径作为默认值
      return analyzersPath;
    } catch (error: any) {
      console.error('❌ [路径] 获取分析器路径失败:', error);
      return analyzersPath;
    }
  }

  private getNodeAnalyzerPath(): string {
    return this.getAnalyzerPath('node-analyzer/analyze.js');
  }

  private getGolangAnalyzerPath(): string {
    return this.getAnalyzerPath('golang-analyzer/analyze.js');
  }

  private getJavaAnalyzerPath(): string {
    return this.getAnalyzerPath('gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar');
  }

  private diagnoseJarEnvironment(): void {
    console.log(`🔧 [诊断] 开始JAR环境诊断...`);
    
    try {
      // 诊断扩展目录
      const extensionDir = this._extensionUri.fsPath;
      console.log(`📁 [诊断] 扩展目录: ${extensionDir}`);
      
      if (fs.existsSync(extensionDir)) {
        const extensionContents = fs.readdirSync(extensionDir);
        console.log(`📁 [诊断] 扩展目录内容:`, extensionContents);
        
        // 检查analyzers目录
        const analyzersPath = path.join(extensionDir, 'analyzers');
        if (fs.existsSync(analyzersPath)) {
          const analyzersContents = fs.readdirSync(analyzersPath);
          console.log(`📁 [诊断] Analyzers目录内容:`, analyzersContents);
          
          // 检查每个文件的详细信息
          analyzersContents.forEach(file => {
            try {
              const filePath = path.join(analyzersPath, file);
              const stats = fs.statSync(filePath);
              const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
              console.log(`📄 [诊断] 文件: ${file}, 大小: ${fileSizeMB}MB, 修改时间: ${stats.mtime}`);
            } catch (err) {
              console.log(`❌ [诊断] 无法读取文件信息: ${file}, 错误: ${err}`);
            }
          });
        } else {
          console.error(`❌ [诊断] Analyzers目录不存在: ${analyzersPath}`);
        }
      } else {
        console.error(`❌ [诊断] 扩展目录不存在: ${extensionDir}`);
      }
      
      // 诊断VSCode扩展信息
      try {
        const extensions = vscode.extensions.all;
        const thisExtension = extensions.find(ext => 
          ext.id.includes('diffsense') || 
          ext.id.includes('humphreyLi') ||
          ext.packageJSON?.name === 'diffsense'
        );
        
        if (thisExtension) {
          console.log(`🔌 [诊断] 找到扩展: ${thisExtension.id}`);
          console.log(`🔌 [诊断] 扩展路径: ${thisExtension.extensionPath}`);
          console.log(`🔌 [诊断] 扩展版本: ${thisExtension.packageJSON?.version}`);
          console.log(`🔌 [诊断] 扩展激活状态: ${thisExtension.isActive}`);
        } else {
          console.warn(`⚠️ [诊断] 未找到DiffSense扩展实例`);
        }
      } catch (err) {
        console.error(`❌ [诊断] 获取扩展信息失败: ${err}`);
      }
      
    } catch (error) {
      console.error(`❌ [诊断] JAR环境诊断失败:`, error);
    }
  }

  private diagnoseAnalyzerEnvironment(analyzerType: string): void {
    console.log(`🔧 [诊断] 开始${analyzerType}分析器环境诊断...`);
    
    try {
      // 诊断扩展目录
      const extensionDir = this._extensionUri.fsPath;
      console.log(`📁 [诊断] 扩展目录: ${extensionDir}`);
      
      if (fs.existsSync(extensionDir)) {
        const extensionContents = fs.readdirSync(extensionDir);
        console.log(`📁 [诊断] 扩展目录内容:`, extensionContents);
        
        // 检查ui目录
        const uiPath = path.join(extensionDir, 'ui');
        if (fs.existsSync(uiPath)) {
          const uiContents = fs.readdirSync(uiPath);
          console.log(`📁 [诊断] UI目录内容:`, uiContents);
          
          // 检查具体分析器目录
          const analyzerDir = path.join(uiPath, analyzerType);
          if (fs.existsSync(analyzerDir)) {
            const analyzerContents = fs.readdirSync(analyzerDir);
            console.log(`📁 [诊断] ${analyzerType}目录内容:`, analyzerContents);
            
            // 检查每个文件的详细信息
            analyzerContents.forEach(file => {
              try {
                const filePath = path.join(analyzerDir, file);
                const stats = fs.statSync(filePath);
                const fileSizeKB = (stats.size / 1024).toFixed(2);
                console.log(`📄 [诊断] 文件: ${file}, 大小: ${fileSizeKB}KB, 修改时间: ${stats.mtime}`);
              } catch (err) {
                console.log(`❌ [诊断] 无法读取文件信息: ${file}, 错误: ${err}`);
              }
            });
          } else {
            console.error(`❌ [诊断] ${analyzerType}目录不存在: ${analyzerDir}`);
          }
        } else {
          console.error(`❌ [诊断] UI目录不存在: ${uiPath}`);
        }
      } else {
        console.error(`❌ [诊断] 扩展目录不存在: ${extensionDir}`);
      }
      
      // 诊断VSCode扩展信息
      try {
        const extensions = vscode.extensions.all;
        const thisExtension = extensions.find(ext => 
          ext.id.includes('diffsense') || 
          ext.id.includes('humphreyLi') ||
          ext.packageJSON?.name === 'diffsense'
        );
        
        if (thisExtension) {
          console.log(`🔌 [诊断] 找到扩展: ${thisExtension.id}`);
          console.log(`🔌 [诊断] 扩展路径: ${thisExtension.extensionPath}`);
          console.log(`🔌 [诊断] 扩展版本: ${thisExtension.packageJSON?.version}`);
          console.log(`🔌 [诊断] 扩展激活状态: ${thisExtension.isActive}`);
          
          // 检查扩展路径下的ui目录
          const extUiPath = path.join(thisExtension.extensionPath, 'ui', analyzerType);
          if (fs.existsSync(extUiPath)) {
            console.log(`✅ [诊断] 在扩展路径中找到${analyzerType}目录: ${extUiPath}`);
          } else {
            console.warn(`⚠️ [诊断] 在扩展路径中未找到${analyzerType}目录: ${extUiPath}`);
          }
        } else {
          console.warn(`⚠️ [诊断] 未找到DiffSense扩展实例`);
        }
      } catch (err) {
        console.error(`❌ [诊断] 获取扩展信息失败: ${err}`);
      }
      
    } catch (error) {
      console.error(`❌ [诊断] ${analyzerType}分析器环境诊断失败:`, error);
    }
  }

  // Bug汇报相关的辅助方法
  private recentErrors: Array<{timestamp: string, error: string, context?: string}> = [];

  private async collectGitInfo(workspacePath: string): Promise<any> {
    return new Promise((resolve) => {
      // 增加.git目录检查
      const gitPath = path.join(workspacePath, '.git');
      if (!fs.existsSync(gitPath) && workspacePath !== '未知路径') {
        const errorMsg = `指定的路径不是一个Git仓库: ${workspacePath}。`;
        console.error(errorMsg);
        resolve({
          currentBranch: `Error: ${errorMsg}`,
          currentCommit: `Error: ${errorMsg}`,
          remoteUrl: `Error: ${errorMsg}`,
          workingTreeStatus: `Error: ${errorMsg}`,
          recentCommits: `Error: ${errorMsg}`
        });
        return;
      }

      const { execFile } = require('child_process');
      
      // 收集基本Git信息
      const gitCommands = [
        ['git', ['rev-parse', 'HEAD'], 'currentCommit'],
        ['git', ['rev-parse', '--abbrev-ref', 'HEAD'], 'currentBranch'],
        ['git', ['remote', '-v'], 'remotes'],
        ['git', ['remote', 'get-url', 'origin'], 'remoteUrl'],
        ['git', ['status', '--porcelain'], 'workingTreeStatus'],
        ['git', ['log', '--oneline', '-5'], 'recentCommits'],
        ['git', ['--version'], 'gitVersion']
      ];
      
      const gitInfo: any = {};
      let completed = 0;
      
      gitCommands.forEach(([command, args, key]) => {
        execFile(command as string, args as string[], { cwd: workspacePath, timeout: 5000 }, (error: any, stdout: any, stderr: any) => {
          if (!error) {
            gitInfo[key as string] = stdout.trim();
          } else {
            gitInfo[key as string] = `Error: ${stderr || error.message}`;
          }
          
          completed++;
          if (completed === gitCommands.length) {
            resolve(gitInfo);
          }
        });
      });
      
      // 5秒超时
      setTimeout(() => {
        if (completed < gitCommands.length) {
          resolve({ ...gitInfo, timeout: true });
        }
      }, 5000);
    });
  }

  private getRecentErrors(): Array<{timestamp: string, error: string, context?: string}> {
    // 返回最近的错误（最多10个）
    return this.recentErrors.slice(-10);
  }

  private addErrorToLog(error: string, context?: string) {
    this.recentErrors.push({
      timestamp: new Date().toISOString(),
      error,
      context
    });
    
    // 保持最多50个错误记录
    if (this.recentErrors.length > 50) {
      this.recentErrors = this.recentErrors.slice(-50);
    }
  }

  private generateIssueTitle(reportData: any, systemInfo: any): string {
    const { projectType, analysisScope, backendLanguage, errorContext } = reportData;
    const platform = systemInfo.os || systemInfo.platform || 'Unknown';
    
    // 生成简洁明了的标题
    let title = '[Bug] ';
    
    // 根据错误类型生成更具体的标题
    if (errorContext && typeof errorContext === 'string') {
      if (errorContext.includes('不存在') || errorContext.includes('not found')) {
        title += '文件或路径不存在';
      } else if (errorContext.includes('权限') || errorContext.includes('permission')) {
        title += '权限问题';
      } else if (errorContext.includes('超时') || errorContext.includes('timeout')) {
        title += '分析超时';
      } else if (errorContext.includes('解析') || errorContext.includes('parse')) {
        title += '结果解析失败';
      } else {
        title += '分析执行错误';
      }
    } else {
      title += 'DiffSense执行异常';
    }
    
    // 添加项目类型信息
    if (projectType && projectType !== 'unknown') {
      if (backendLanguage && backendLanguage !== 'unknown') {
        title += ` (${backendLanguage}项目)`;
      } else {
        title += ` (${projectType}项目)`;
      }
    }
    
    // 添加平台信息（简化版）
    const platformShort = platform.includes('Windows') ? 'Win' : 
                         platform.includes('Darwin') ? 'Mac' : 
                         platform.includes('Linux') ? 'Linux' : platform;
    title += ` - ${platformShort}`;
    
    return title;
  }

  private generateIssueBody(data: any): string {
    const {
      commitInfo = {},
      analysisParams = {},
      analysisResults,
      errorContext,
      systemInfo,
      gitInfo,
      recentErrors,
    } = data;

    const codeBlock = (content: string, lang = '') => `\`\`\`${lang}\n${content}\n\`\`\``;

    let body = `## 🐛 问题描述

**问题概述：**
请简明描述遇到的问题（例如：分析某个提交时出现错误、界面无法加载等）

**具体表现：**
请描述错误的具体表现（例如：弹出了什么错误信息、界面显示异常等）

## 🔄 复现步骤

1. 在什么项目类型上进行分析（Java/Golang/前端）
2. 执行了什么操作
3. 比较的是哪两个提交或分支
4. 出现了什么结果

## 🎯 期望结果

请描述您期望看到的正确结果

---

## 📊 环境信息

**系统环境：**
- OS: ${systemInfo.os || 'Unknown'}
- VS Code: ${systemInfo.vscodeVersion || 'Unknown'}
- DiffSense: ${systemInfo.extensionVersion || 'Unknown'}

**项目信息：**
- 分支: \`${gitInfo.currentBranch || 'Unknown'}\`
- Git版本: ${gitInfo.gitVersion || 'Unknown'}
- 工作区状态: ${gitInfo.workingTreeStatus ? '有未提交更改' : '工作区干净'}`;

    // 添加分析参数（如果有的话）
    if (analysisParams && Object.keys(analysisParams).length > 0) {
      body += `

**分析参数：**
${codeBlock(JSON.stringify(analysisParams, null, 2), 'json')}`;
    }

    // 添加错误日志（只显示最近的几条）
    if (recentErrors && recentErrors.length > 0) {
      const recentErrorsLimited = recentErrors.slice(-3); // 只显示最近3条
      body += `

**错误日志：**
${codeBlock(recentErrorsLimited.map((e: any) => `[${e.timestamp}] ${e.context ? `(${e.context}) ` : ''}${e.error}`).join('\n'))}`;
    }

    // 添加错误上下文（如果有的话）
    if (errorContext) {
      body += `

**错误详情：**
${codeBlock(String(errorContext))}`;
    }

    body += `

---
**💡 提示：** 您可以在上方添加截图或其他补充信息来帮助我们更好地定位问题。`;

    return body;
  }

  private buildGitHubIssueUrl(repoUrl: string, title: string, body: string): string {
    // 确保仓库URL格式正确
    const baseUrl = repoUrl.replace(/\.git$/, '').endsWith('/') 
      ? repoUrl.replace(/\.git$/, '') 
      : `${repoUrl.replace(/\.git$/, '')}/`;
    
    // 清理和编码标题和正文
    const cleanTitle = title.replace(/[#%]/g, ''); // 移除可能导致编码问题的字符
    const cleanBody = body.replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // 移除控制字符
    
    const encodedTitle = encodeURIComponent(cleanTitle);
    const encodedBody = encodeURIComponent(cleanBody);
    
    // GitHub URL参数长度限制（实际约8192字符）
    const maxUrlLength = 7000; // 使用更保守的值
    let issueUrl = `${baseUrl}issues/new?title=${encodedTitle}&body=${encodedBody}`;
    
    if (issueUrl.length > maxUrlLength) {
      console.warn('⚠️ GitHub Issue URL超长，正在优化内容...');
      
      // 计算可用的body长度
      const issueUrlPrefix = `${baseUrl}issues/new?title=${encodedTitle}&body=`;
      const availableLength = maxUrlLength - issueUrlPrefix.length - 200; // 保留更多缓冲
      
      // 智能截断：尽量保留核心信息
      let truncatedBody = cleanBody;
      if (cleanBody.length > availableLength) {
        // 找到环境信息部分的开始位置
        const envInfoIndex = cleanBody.indexOf('## 📊 环境信息');
        if (envInfoIndex > 0 && envInfoIndex < availableLength) {
          // 保留问题描述和环境信息，移除详细日志
          const beforeEnvInfo = cleanBody.substring(0, envInfoIndex);
          const envInfoPart = cleanBody.substring(envInfoIndex, Math.min(cleanBody.length, envInfoIndex + 500));
          truncatedBody = beforeEnvInfo + envInfoPart + '\n\n---\n**注意：** 详细日志信息已省略，完整信息请查看插件输出。';
        } else {
          // 简单截断
          truncatedBody = cleanBody.substring(0, availableLength) + '\n\n---\n**注意：** 内容已截断。';
        }
      }
      
      const encodedTruncatedBody = encodeURIComponent(truncatedBody);
      issueUrl = `${baseUrl}issues/new?title=${encodedTitle}&body=${encodedTruncatedBody}`;
    }
    
    return issueUrl;
  }

  private async handleDetectRevert(params: { baseCommit: string, headCommit?: string }) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('未找到工作区文件夹');
      }
      const repoPath = workspaceFolder.uri.fsPath;

      const nodeAnalyzerDirPath = this.getAnalyzerPath('node-analyzer');
      const mergeImpactPath = path.join(nodeAnalyzerDirPath, 'mergeImpact.js');
      if (!fs.existsSync(mergeImpactPath)) {
        throw new Error(`mergeImpact.js 不存在: ${mergeImpactPath}`);
      }

      const baseCommit = params.baseCommit || 'origin/main';
      const headCommit = params.headCommit || 'WORKTREE';

      console.log('🔍 检测组件回退:', baseCommit, headCommit);

      const execPromise = new Promise<{ stdout: string }>((resolve, reject) => {
        execFile('node', [mergeImpactPath, baseCommit, headCommit], {
          cwd: repoPath,
          timeout: 60000,
          maxBuffer: 1024 * 1024 * 5
        }, (error, stdout, stderr) => {
          if (error) {
            console.error('mergeImpact 执行错误:', error);
            console.error('stderr:', stderr);
            reject(error);
          } else {
            resolve({ stdout });
          }
        });
      });

      const { stdout } = await execPromise;
      let result: any;
      try {
        result = JSON.parse(stdout);
      } catch (err) {
        console.error('mergeImpact 输出解析失败:', err);
        result = { changes: [], parseError: String(err) };
      }

      // 发送到前端
      this._view?.webview.postMessage({
        command: 'snapshotDiffResult',
        data: result
      });

    } catch (error) {
      console.error('检测组件回退失败:', error);
      this._view?.webview.postMessage({
        command: 'analysisError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export function deactivate() {
  // 清理资源
}