import * as path from 'path';
import * as fs from 'fs';
// @ts-ignore
import { execFile } from 'child_process';
import * as vscode from 'vscode';
import { DatabaseService } from './database/DatabaseService';

// 手动声明缺失的全局变量类型，绕过环境构建限制
declare var require: any;
declare var console: any;
declare var setTimeout: any;
declare var process: any;

// Lazy load ProjectInferenceEngine to speed up activation
let ProjectInferenceEngine: any;

// 插件状态枚举
enum PluginState {
  IDLE = 'idle',
  SCANNING = 'scanning',
  ANALYZING = 'analyzing',
  READY = 'ready',
  ERROR = 'error'
}

export default class DiffSense implements vscode.WebviewViewProvider {

  private _extensionUri: vscode.Uri;
  private _outputChannel!: vscode.OutputChannel;
  private _databaseService!: any;
  private _themeDisposable!: vscode.Disposable;
  private _view?: vscode.Webview;
  private inferenceEngine: any;
  private context: vscode.ExtensionContext;
  private currentState: PluginState = PluginState.IDLE;
  private backgroundTaskCancellation: vscode.CancellationTokenSource | null = null;
  
  // ✅ 缓存数据，用于模式切换时恢复状态
  private _cachedBranches: string[] = [];
  private _cachedAnalysisResult: any = null;
  private _cachedProjectType: any = null;
  private _cachedProjectInference: any = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this._extensionUri = context.extensionUri;
    
    // ✅ 1. 插件激活第一行：立即注册 OutputChannel（工程级要求）
    this._outputChannel = vscode.window.createOutputChannel('DiffSense');
    this._outputChannel.show(true); // 立即显示输出通道
    this.log('[Activation] DiffSense 插件激活中...', 'info');

    this._databaseService = DatabaseService.getInstance(context);
    
    // 数据库初始化在后台进行，不阻塞
    this._databaseService.initialize().catch((err: any) => {
        this.log(`[Database] 数据库初始化失败: ${err}`, 'error');
    });

    this.log('[Activation] DiffSense 插件已激活，等待 UI 解析...', 'info');
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView.webview;
    this.log('[UI] WebviewView 正在解析...', 'info');
    this.log(`[UI] Webview 对象: ${this._view ? '已创建' : '未创建'}`, 'info');

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri
      ]
    };

    // ✅ 2. UI 立即显示（空状态），不等待任何分析
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    this.log('[UI] Webview HTML 已设置，UI 已显示', 'info');
    
    // ✅ 立即通知 UI 插件已激活
    this.updateUIState(PluginState.IDLE, 'DiffSense 已激活，准备分析项目...');

    // ✅ Handle messages from the webview
    // ✅ 确保消息监听器已正确设置
    this.log('[UI] 设置消息监听器...', 'info');
    webviewView.webview.onDidReceiveMessage(async (data) => {
      this.log(`[Message] ========== 收到前端消息 ==========`, 'info');
      this.log(`[Message] 命令: ${data ? data.command : '(无命令)'}`, 'info');
      this.log(`[Message] 数据: ${data ? JSON.stringify(data, null, 2) : '(无数据)'}`, 'info');
      
      // ✅ 验证数据格式
      if (!data || typeof data !== 'object') {
        this.log(`[Message] ❌ 错误：消息格式无效`, 'error');
        return;
      }
      
      if (!data.command) {
        this.log(`[Message] ❌ 错误：消息缺少 command 字段`, 'error');
        return;
      }
      
      try {
        switch (data.command) {
          case 'refresh':
            this.log('[Message] 处理 refresh 命令', 'info');
            this.startBackgroundAnalysis();
            break;
          case 'openLog':
            this.log('[Message] 处理 openLog 命令', 'info');
            this.showOutput();
            break;
          case 'cancelAnalysis':
            this.log('[Message] 处理 cancelAnalysis 命令', 'info');
            this.cancelBackgroundAnalysis();
            break;
          case 'test':
          // ✅ 测试消息处理
          this.log('[Message] ✅ 收到测试消息，VSCode API 通信正常', 'info');
          this._view?.postMessage({
            command: 'testResponse',
            data: '后端收到测试消息'
          });
          break;
        case 'analyze':
            // ✅ 处理分析请求
            this.log('[Message] ========== 开始处理分析请求 ==========', 'info');
            this.log(`[Message] 分析数据: ${JSON.stringify(data.data, null, 2)}`, 'info');
            
            if (!data.data) {
              this.log('[Message] ❌ 错误：分析数据为空', 'error');
              this._view?.postMessage({
                command: 'analysisError',
                error: '分析数据为空'
              });
              return;
            }
            
            // 使用 try-catch 确保错误被捕获
            try {
              await this.handleAnalysisRequest(data.data);
              this.log('[Message] ✅ 分析请求处理完成', 'info');
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              const errorStack = error instanceof Error ? error.stack : 'N/A';
              this.log(`[Message] ❌ 分析请求处理失败: ${errorMsg}`, 'error');
              this.log(`[Message] 错误堆栈: ${errorStack}`, 'error');
              this._view?.postMessage({
                command: 'analysisError',
                error: errorMsg
              });
            }
            break;
        case 'getHotspotAnalysis':
          // ✅ 处理热点分析请求
          this.log('[Analysis] 收到热点分析请求', 'info');
          this.handleGetHotspotAnalysis(data.data).catch((error) => {
            this.log(`[Analysis] 热点分析失败: ${error}`, 'error');
            this._view?.postMessage({
              command: 'hotspotAnalysisError',
              error: error instanceof Error ? error.message : String(error)
            });
          });
          break;
        case 'detectRevert':
          // ✅ 处理组件回退检测
          this.log('[Analysis] 收到组件回退检测请求', 'info');
          this.handleDetectRevert(data.data).catch((error) => {
            this.log(`[Analysis] 组件回退检测失败: ${error}`, 'error');
            this._view?.postMessage({
              command: 'analysisError',
              error: error instanceof Error ? error.message : String(error)
            });
          });
          break;
        case 'reportBug':
          // ✅ 处理 Bug 汇报
          this.log('[BugReport] 收到 Bug 汇报请求', 'info');
          this.handleReportBug(data.data).catch((error) => {
            this.log(`[BugReport] Bug 汇报处理失败: ${error}`, 'error');
            vscode.window.showErrorMessage(`Bug 汇报失败: ${error instanceof Error ? error.message : String(error)}`);
          });
          break;
        case 'validateCommitIds':
          // ✅ 处理 Commit ID 验证
          this.log('[Validation] 收到 Commit ID 验证请求', 'info');
          this.handleValidateCommitIds(data.data).catch((error) => {
            this.log(`[Validation] Commit ID 验证失败: ${error}`, 'error');
            this._view?.postMessage({
              command: 'commitValidationResult',
              valid: false,
              error: error instanceof Error ? error.message : String(error)
            });
          });
          break;

        case 'getBranches':
          this.log('[Message] 收到获取分支列表请求', 'info');
          if (this._cachedBranches && this._cachedBranches.length > 0) {
            this.log(`[Message] 使用缓存的分支列表 (${this._cachedBranches.length} 个)`, 'info');
            this._view?.postMessage({
              command: 'branchesLoaded',
              branches: this._cachedBranches
            });
          } else {
            // 尝试重新加载
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
              this.loadGitBranches(workspaceFolders[0].uri.fsPath).then(branches => {
                this._cachedBranches = branches;
                this._view?.postMessage({
                  command: 'branchesLoaded',
                  branches: branches
                });
              });
            }
          }
          break;

        case 'restoreAnalysisResults':
          this.log('[Message] 收到恢复分析结果请求', 'info');
          if (this._cachedAnalysisResult) {
            this.log('[Message] 恢复缓存的分析结果', 'info');
            this._view?.postMessage({
              command: 'restoredAnalysisResults',
              data: this._cachedAnalysisResult
            });
          }
          // 同时恢复项目信息
          if (this._cachedProjectInference) {
            this._view?.postMessage({
              command: 'projectAnalysisCompleted',
              data: this._cachedProjectInference
            });
          }
          if (this._cachedProjectType) {
            this._view?.postMessage({
              command: 'projectTypeDetected',
              projectType: this._cachedProjectType.projectType,
              backendLanguage: this._cachedProjectType.backendLanguage,
              frontendPaths: this._cachedProjectInference?.sourceRoots || []
            });
          }
          break;

        case 'detectProjectType':
          this.log('[Message] 收到项目类型检测请求', 'info');
          if (this._cachedProjectType) {
            this._view?.postMessage({
              command: 'projectTypeDetected',
              projectType: this._cachedProjectType.projectType,
              backendLanguage: this._cachedProjectType.backendLanguage,
              frontendPaths: this._cachedProjectInference?.sourceRoots || []
            });
          } else {
            // 如果没有缓存，尝试快速检测
            if (this._cachedProjectInference && vscode.workspace.workspaceFolders) {
              const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
              this.detectProjectType(rootPath, this._cachedProjectInference).then(info => {
                this._cachedProjectType = info;
                this._view?.postMessage({
                  command: 'projectTypeDetected',
                  projectType: info.projectType,
                  backendLanguage: info.backendLanguage,
                  frontendPaths: this._cachedProjectInference?.sourceRoots || []
                });
              });
            }
          }
          break;

        default:
          this.log(`[Message] ⚠️  未知命令: ${data.command}`, 'warn');
          this.log(`[Message] 完整消息数据: ${JSON.stringify(data, null, 2)}`, 'warn');
      }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : 'N/A';
        this.log(`[Message] ❌ 消息处理异常: ${errorMsg}`, 'error');
        this.log(`[Message] 错误堆栈: ${errorStack}`, 'error');
      }
      this.log(`[Message] ========== 消息处理完成 ==========`, 'info');
    });

    // ✅ 3. UI 显示后，立即启动后台任务（不阻塞）
    this.log('[Background] 调度后台分析任务...', 'info');
    // 使用 setTimeout 确保 UI 完全渲染后再启动
    setTimeout(() => {
      this.startBackgroundAnalysis();
    }, 100);
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    if (this._outputChannel) {
      const timestamp = new Date().toLocaleTimeString();
      this._outputChannel.appendLine(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }

  public showOutput() {
    this._outputChannel.show();
  }

  /**
   * ✅ 更新 UI 状态（状态驱动）
   */
  private updateUIState(state: PluginState, message: string, details?: string) {
    this.currentState = state;
    this._view?.postMessage({
      command: 'stateUpdate',
      state: state,
      message: message,
      details: details
    });
    this.log(`[State] ${state.toUpperCase()}: ${message}${details ? ` - ${details}` : ''}`, 'info');
  }

  /**
   * ✅ 取消后台分析任务
   */
  private cancelBackgroundAnalysis() {
    if (this.backgroundTaskCancellation) {
      this.log('[Background] 取消后台分析任务', 'info');
      this.backgroundTaskCancellation.cancel();
      this.backgroundTaskCancellation.dispose();
      this.backgroundTaskCancellation = null;
      this.updateUIState(PluginState.IDLE, '分析已取消');
    }
  }

  /**
   * ✅ 启动后台分析任务（完全后台化，不阻塞主线程）
   */
  private async startBackgroundAnalysis() {
    // 如果已经在运行，先取消
    if (this.backgroundTaskCancellation) {
      this.cancelBackgroundAnalysis();
    }

    // 创建取消令牌
    this.backgroundTaskCancellation = new vscode.CancellationTokenSource();

    // 在后台执行，不阻塞
    this.runBackgroundAnalysis(this.backgroundTaskCancellation.token).catch((error) => {
      this.log(`[Background] 后台分析任务异常: ${error}`, 'error');
      this.updateUIState(PluginState.ERROR, `分析失败: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  /**
   * ✅ 执行后台分析（分阶段，带详细日志）
   */
  private async runBackgroundAnalysis(cancellationToken: vscode.CancellationToken) {
    this.log('[Background] ========== 开始后台项目分析 ==========', 'info');

    // 检查工作区
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this.log('[Background] ❌ 未找到工作区文件夹', 'warn');
      this.updateUIState(PluginState.ERROR, '未找到工作区，请先打开一个项目');
      return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    this.log(`[Background] 工作区路径: ${rootPath}`, 'info');

    // 延迟初始化推理引擎
    if (!this.inferenceEngine) {
      this.log('[Background] [阶段 0] 初始化推理引擎...', 'info');
      try {
        if (!ProjectInferenceEngine) {
          this.log('[Background] [阶段 0] 加载 ProjectInferenceEngine 模块...', 'info');
          ProjectInferenceEngine = require('../analyzers/project-inference/engine');
        }
        const logger = {
          log: (msg: string) => this.log(`[Engine] ${msg}`, 'info'),
          error: (msg: string) => this.log(`[Engine] ${msg}`, 'error'),
          warn: (msg: string) => this.log(`[Engine] ${msg}`, 'warn')
        };
        this.inferenceEngine = new ProjectInferenceEngine(logger);
        this.log('[Background] [阶段 0] ✅ 推理引擎初始化完成', 'info');
      } catch (e) {
        const errorMsg = `推理引擎加载失败: ${e}`;
        this.log(`[Background] [阶段 0] ❌ ${errorMsg}`, 'error');
        this.updateUIState(PluginState.ERROR, errorMsg);
        return;
      }
    }

    // ✅ 阶段 1: 文件扫描
    if (cancellationToken.isCancellationRequested) return;
    this.updateUIState(PluginState.SCANNING, '正在扫描项目文件...', '阶段 1/5');
    this.log('[Background] [阶段 1] 开始文件扫描...', 'info');

    // ✅ 阶段 2-5: 项目推理（带进度回调）
    if (cancellationToken.isCancellationRequested) return;
    this.updateUIState(PluginState.ANALYZING, '正在分析项目结构...', '阶段 2/5');
    this.log('[Background] [阶段 2] 开始项目推理...', 'info');

    try {
      const result = await this.inferenceEngine.infer(rootPath, null, (msg: string) => {
        // ✅ 所有进度更新都记录日志
        this.log(`[Background] [进度] ${msg}`, 'info');
        this._view?.postMessage({
          command: 'progressUpdate',
          message: msg
        });
      });

      if (cancellationToken.isCancellationRequested) {
        this.log('[Background] 分析被用户取消', 'info');
        return;
      }

      // ✅ 阶段完成：记录详细结果
      this.log('[Background] [阶段 2] ✅ 项目推理完成', 'info');
      this.log(`[Background] [结果] 项目类型: ${result.projectType}`, 'info');
      
      // ✅ 缓存项目推理结果
      this._cachedProjectInference = result;
      
      this.log(`[Background] [结果] 源根目录: ${JSON.stringify(result.sourceRoots)}`, 'info');
      this.log(`[Background] [结果] 检测详情: ${JSON.stringify(result.detectionDetails)}`, 'info');
      
      // ✅ 阶段 3: 检测项目类型和后端语言
      this.log('[Background] [阶段 3] 开始检测项目类型和后端语言...', 'info');
      const projectTypeInfo = await this.detectProjectType(rootPath, result);
      
      // ✅ 缓存项目类型信息
      this._cachedProjectType = projectTypeInfo;
      
      this.log(`[Background] [阶段 3] ✅ 项目类型检测完成: ${projectTypeInfo.projectType} (后端语言: ${projectTypeInfo.backendLanguage})`, 'info');
      
      // ✅ 阶段 4: 加载 Git 分支
      this.log('[Background] [阶段 4] 开始加载 Git 分支...', 'info');
      const branches = await this.loadGitBranches(rootPath);
      
      // ✅ 缓存分支列表
      this._cachedBranches = branches;
      
      this.log(`[Background] [阶段 4] ✅ 加载完成，找到 ${branches.length} 个分支`, 'info');
      
      this.log(`[Background] ========== 后台分析完成 ==========`, 'info');

      // ✅ 更新 UI 状态为就绪
      this.updateUIState(PluginState.READY, '项目分析完成，可以开始检测变更');
      
      // ✅ 发送结果到 React 前端应用
      if (this._view) {
        // 发送项目分析完成消息（React 应用会监听）
        this._view.postMessage({
          command: 'projectAnalysisCompleted',
          data: result
        });
        
        // ✅ 发送项目类型检测结果（Toolbar 需要）
        this._view.postMessage({
          command: 'projectTypeDetected',
          projectType: projectTypeInfo.projectType,
          backendLanguage: projectTypeInfo.backendLanguage,
          frontendPaths: result.sourceRoots || []
        });
        
        // ✅ 发送分支列表（Toolbar 需要）
        if (branches.length > 0) {
          this._view.postMessage({
            command: 'branchesLoaded',
            branches: branches
          });
        }
        
        // 同时发送推理结果（兼容旧代码）
        this._view.postMessage({
          command: 'projectInferenceResult',
          data: result
        });
        
        this.log('[UI] ✅ 已发送项目分析结果、类型检测和分支列表到前端', 'info');
      }

      // 清理取消令牌
      if (this.backgroundTaskCancellation) {
        this.backgroundTaskCancellation.dispose();
        this.backgroundTaskCancellation = null;
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`[Background] ❌ 分析失败: ${errorMsg}`, 'error');
      this.log(`[Background] [错误堆栈] ${error instanceof Error ? error.stack : 'N/A'}`, 'error');
      this.updateUIState(PluginState.ERROR, `分析失败: ${errorMsg}`);
    }
  }

  /**
   * ✅ 检测项目类型和后端语言
   */
  private async detectProjectType(rootPath: string, inferenceResult: any): Promise<{
    projectType: 'backend' | 'frontend' | 'mixed' | 'unknown',
    backendLanguage: 'java' | 'golang' | 'unknown'
  }> {
    try {
      let hasBackend = false;
      let hasFrontend = false;
      let backendLanguage: 'java' | 'golang' | 'unknown' = 'unknown';
      
      // 检查文件系统以确定项目类型
      const checkPath = (relativePath: string): boolean => {
        return fs.existsSync(path.join(rootPath, relativePath));
      };
      
      // 检测后端语言
      if (checkPath('pom.xml') || checkPath('build.gradle') || checkPath('build.gradle.kts')) {
        hasBackend = true;
        backendLanguage = 'java';
        this.log('[Detect] 检测到 Java 项目 (Maven/Gradle)', 'info');
      } else if (checkPath('go.mod') || checkPath('Gopkg.toml') || checkPath('glide.yaml')) {
        hasBackend = true;
        backendLanguage = 'golang';
        this.log('[Detect] 检测到 Golang 项目', 'info');
      }
      
      // 检测前端
      const frontendIndicators = [
        'package.json',
        'vite.config.js', 'vite.config.ts',
        'next.config.js', 'next.config.ts',
        'webpack.config.js', 'webpack.config.ts',
        'angular.json',
        'vue.config.js'
      ];
      
      for (const indicator of frontendIndicators) {
        if (checkPath(indicator)) {
          hasFrontend = true;
          this.log(`[Detect] 检测到前端项目 (${indicator})`, 'info');
          break;
        }
      }
      
      // 检查源根目录（从推理结果）
      if (inferenceResult.sourceRoots && inferenceResult.sourceRoots.length > 0) {
        hasFrontend = true; // 如果有前端根目录，说明有前端代码
        this.log('[Detect] 从推理结果检测到前端根目录', 'info');
      }
      
      // 确定项目类型
      let projectType: 'backend' | 'frontend' | 'mixed' | 'unknown' = 'unknown';
      if (hasBackend && hasFrontend) {
        projectType = 'mixed';
      } else if (hasBackend) {
        projectType = 'backend';
      } else if (hasFrontend) {
        projectType = 'frontend';
      }
      
      this.log(`[Detect] 最终项目类型: ${projectType}, 后端语言: ${backendLanguage}`, 'info');
      
      return { projectType, backendLanguage };
    } catch (error) {
      this.log(`[Detect] 项目类型检测失败: ${error}`, 'error');
      return { projectType: 'unknown', backendLanguage: 'unknown' };
    }
  }

  /**
   * ✅ 清理分支名称，移除 "HEAD ->" 前缀和无效字符
   */
  private cleanBranchName(branchName: string): string {
    if (!branchName) return '';
    
    // 移除 "HEAD -> " 前缀（Git branch 输出格式）
    let cleaned = branchName.replace(/^HEAD\s*->\s*/i, '').trim();
    
    // 移除 "* " 前缀（当前分支标记）
    cleaned = cleaned.replace(/^\*\s+/, '').trim();
    
    // 移除 "remotes/" 前缀（远程分支），但保留 remote 名称（如 origin/）以便 Git 正确识别
    cleaned = cleaned.replace(/^remotes\//, '');
    
    // 移除其他无效字符
    cleaned = cleaned.replace(/[<>|]/g, '').trim();
    
    return cleaned;
  }

  /**
   * ✅ 验证分支名称是否为有效的 Git 引用
   */
  private isValidBranchName(branchName: string): boolean {
    if (!branchName || branchName.length === 0) return false;
    
    // 排除无效的分支名称
    const invalidNames = ['HEAD', '->', 'origin', 'remotes'];
    if (invalidNames.includes(branchName)) return false;
    
    // 检查是否包含箭头或其他无效字符
    if (branchName.includes('->') || branchName.includes('|')) return false;
    
    return true;
  }

  /**
   * ✅ 加载 Git 分支列表
   */
  private async loadGitBranches(rootPath: string): Promise<string[]> {
    return new Promise((resolve) => {
      try {
        execFile('git', ['branch', '-a'], { cwd: rootPath, timeout: 5000 }, (error, stdout, stderr) => {
          if (error) {
            this.log(`[Git] 加载分支失败: ${error.message}`, 'warn');
            resolve([]);
            return;
          }
          
          // 解析分支列表
          const branches: string[] = [];
          const lines = stdout.split('\n');
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // 清理分支名称
            let branchName = this.cleanBranchName(trimmed);
            
            // 验证分支名称
            if (!this.isValidBranchName(branchName)) {
              continue;
            }
            
            // 处理远程分支 (remotes/origin/xxx)
            if (trimmed.startsWith('remotes/')) {
              // 已经通过 cleanBranchName 处理了
              if (branchName && !branches.includes(branchName)) {
                branches.push(branchName);
              }
            } else {
              // 本地分支（跳过当前分支标记）
              if (trimmed.startsWith('*')) {
                // 当前分支，需要清理
                branchName = this.cleanBranchName(trimmed);
                if (this.isValidBranchName(branchName) && !branches.includes(branchName)) {
                  branches.push(branchName);
                }
              } else {
                // 普通本地分支
                if (!branches.includes(branchName)) {
                  branches.push(branchName);
                }
              }
            }
          }
          
          // 排序并去重
          const uniqueBranches = Array.from(new Set(branches)).sort();
          this.log(`[Git] 找到 ${uniqueBranches.length} 个分支: ${uniqueBranches.slice(0, 5).join(', ')}${uniqueBranches.length > 5 ? '...' : ''}`, 'info');
          resolve(uniqueBranches);
        });
      } catch (error) {
        this.log(`[Git] 加载分支异常: ${error}`, 'error');
        resolve([]);
      }
    });
  }

  /**
   * 保持向后兼容的 refresh 方法
   */
  public async refresh() {
    this.startBackgroundAnalysis();
  }

  /**
   * ✅ 获取 React 前端 HTML（如果存在）
   */
  private _getReactFrontendHtml(webview: vscode.Webview): string | null {
    try {
      // 尝试加载 dist/index.html（前端构建产物）
      const indexPath = path.join(this.context.extensionPath, 'dist', 'index.html');
      if (fs.existsSync(indexPath)) {
        this.log('[UI] ✅ 找到 React 前端构建产物，加载中...', 'info');
        let html = fs.readFileSync(indexPath, 'utf8');
        
        // 获取扩展 URI
        const extensionUri = this._extensionUri;
        
        // ✅ 替换所有资源路径为 webview URI
        // 处理 script 标签
        html = html.replace(
          /(<script[^>]*src=["'])([^"']+)(["'])/gi,
          (match, prefix, src, suffix) => {
            if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
              return match; // 外部资源不处理
            }
            // 处理相对路径（去掉开头的 /）
            const cleanSrc = src.startsWith('/') ? src.substring(1) : src;
            const uri = webview.asWebviewUri(
              vscode.Uri.joinPath(extensionUri, 'dist', cleanSrc)
            );
            return prefix + uri.toString() + suffix;
          }
        );
        
        // 处理 link 标签（CSS）
        html = html.replace(
          /(<link[^>]*href=["'])([^"']+\.css)(["'])/gi,
          (match, prefix, href, suffix) => {
            if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('data:')) {
              return match;
            }
            const cleanHref = href.startsWith('/') ? href.substring(1) : href;
            const uri = webview.asWebviewUri(
              vscode.Uri.joinPath(extensionUri, 'dist', cleanHref)
            );
            return prefix + uri.toString() + suffix;
          }
        );
        
        // 处理其他资源（如 favicon）
        html = html.replace(
          /(<link[^>]*href=["'])([^"']+)(["'])/gi,
          (match, prefix, href, suffix) => {
            if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('data:') || href.includes('#')) {
              return match;
            }
            const cleanHref = href.startsWith('/') ? href.substring(1) : href;
            const uri = webview.asWebviewUri(
              vscode.Uri.joinPath(extensionUri, 'dist', cleanHref)
            );
            return prefix + uri.toString() + suffix;
          }
        );
        
        // ✅ 注入 VSCode API（确保总是注入，即使 HTML 中已有）
        // 移除旧的脚本（如果有）
        html = html.replace(/<script[^>]*>[\s\S]*?acquireVsCodeApi[\s\S]*?<\/script>/gi, '');
        
        const vscodeApiScript = `
            <script>
              (function() {
                try {
                  console.log('[VSCode API] 正在初始化 VSCode API...');
                  const vscode = acquireVsCodeApi();
                  window.vscode = vscode;
                  window.acquireVsCodeApi = function() { return vscode; };
                  console.log('[VSCode API] ✅ VSCode API 初始化成功', vscode);
                  
                  // 测试消息发送
                  setTimeout(() => {
                    console.log('[VSCode API] 发送测试消息...');
                    vscode.postMessage({ command: 'test', data: 'VSCode API 测试' });
                  }, 1000);
                } catch (error) {
                  console.error('[VSCode API] ❌ 初始化失败:', error);
                  // 提供 Mock API 用于开发
                  window.vscode = {
                    postMessage: (message) => {
                      console.warn('[VSCode API] Mock postMessage:', message);
                    },
                    getState: () => ({}),
                    setState: () => {}
                  };
                }
              })();
            </script>
          `;
        html = html.replace('</head>', vscodeApiScript + '</head>');
        
        this.log('[UI] ✅ React 前端 HTML 已加载并处理', 'info');
        return html;
      } else {
        this.log(`[UI] ⚠️ React 前端未找到: ${indexPath}`, 'warn');
      }
    } catch (error) {
      this.log(`[UI] ❌ 加载 React 前端失败: ${error}`, 'error');
    }
    return null;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // ✅ 优先尝试加载 React 前端应用
    const reactHtml = this._getReactFrontendHtml(webview);
    if (reactHtml) {
      return reactHtml;
    }
    
    // ✅ 如果 React 前端不存在，显示加载状态和提示
    this.log('[UI] React 前端未找到，使用临时加载界面', 'warn');
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DiffSense</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 0; margin: 0; display: flex; flex-direction: column; height: 100vh; color: var(--vscode-foreground); background-color: var(--vscode-editor-background); overflow: hidden; }
            .spinner { border: 3px solid var(--vscode-widget-border); border-top: 3px solid var(--vscode-progressBar-background); border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; display: inline-block; margin-right: 10px; vertical-align: middle; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .hidden { display: none; }
            #content { width: 100%; text-align: left; }
            .status-container { text-align: left; width: 100%; max-width: 400px; margin: 40px auto; padding: 20px; }
            .status-step { display: flex; align-items: center; margin-bottom: 12px; opacity: 0.5; transition: opacity 0.3s; }
            .status-step.active { opacity: 1; font-weight: 600; }
            .status-step.completed { opacity: 1; color: var(--vscode-testing-iconPassed); }
            .status-icon { margin-right: 10px; width: 20px; text-align: center; }
            .sub-status { font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-left: 30px; margin-top: -8px; margin-bottom: 12px; min-height: 1.2em; }
            .warning-box { background: var(--vscode-inputValidation-warningBackground); border: 1px solid var(--vscode-inputValidation-warningBorder); padding: 12px; border-radius: 4px; margin: 20px; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="warning-box">
            <strong>⚠️ React 前端未构建</strong><br>
            请运行构建脚本生成前端应用，或检查 dist/index.html 是否存在。
        </div>
        <div id="status-container" class="status-container">
            <div class="status-step completed">
                <span class="status-icon">✅</span>
                <span>DiffSense 已激活</span>
            </div>
            <div class="status-step" id="state-step">
                <span class="status-icon" id="state-icon">⏳</span>
                <span id="status-text">等待初始化...</span>
            </div>
            <div id="detailed-status" class="sub-status">准备开始分析...</div>
            <div id="progress-status" class="sub-status" style="display: none;"></div>
        </div>

        <!-- ✅ 主界面容器（分析完成后显示） -->
        <div id="main-content" class="hidden" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div style="padding: 12px; border-bottom: 1px solid var(--vscode-panel-border);">
                <h3 style="margin: 0; font-size: 14px; font-weight: 600;">DiffSense - 代码影响分析</h3>
                <div id="project-info" style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 4px;"></div>
            </div>
            <div style="flex: 1; padding: 12px; overflow-y: auto;">
                <div id="ready-message" style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">项目分析完成</div>
                    <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 24px;">
                        项目结构已识别，可以开始检测代码变更影响
                    </div>
                    <div style="font-size: 11px; color: var(--vscode-descriptionForeground); padding: 12px; background: var(--vscode-input-background); border-radius: 4px; text-align: left; max-width: 500px; margin: 0 auto;">
                        <div style="margin-bottom: 8px;"><strong>提示：</strong></div>
                        <div>• 使用工具栏开始分析代码变更</div>
                        <div>• 查看输出面板获取详细日志</div>
                        <div>• 分析结果将显示在下方</div>
                    </div>
                </div>
                <div id="analysis-results" style="display: none;">
                    <h4 style="font-size: 13px; margin-bottom: 12px;">分析结果</h4>
                    <pre id="result-data" style="background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 4px; font-size: 11px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;"></pre>
                </div>
            </div>
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            const statusText = document.getElementById('status-text');
            const detailedStatus = document.getElementById('detailed-status');
            const progressStatus = document.getElementById('progress-status');
            const stateStep = document.getElementById('state-step');
            const stateIcon = document.getElementById('state-icon');
            const statusContainer = document.getElementById('status-container');
            const mainContent = document.getElementById('main-content');

            // ✅ 状态驱动 UI 更新
            function updateState(state, message, details) {
                stateStep.classList.remove('active', 'completed');
                
                switch(state) {
                    case 'idle':
                        stateIcon.innerHTML = '⏳';
                        stateStep.classList.add('active');
                        statusText.innerText = message || '等待开始...';
                        detailedStatus.innerText = details || '准备分析项目';
                        progressStatus.style.display = 'none';
                        break;
                    case 'scanning':
                        stateIcon.innerHTML = '<div class="spinner"></div>';
                        stateStep.classList.add('active');
                        statusText.innerText = message || '正在扫描文件...';
                        detailedStatus.innerText = details || '扫描项目文件';
                        progressStatus.style.display = 'block';
                        break;
                    case 'analyzing':
                        stateIcon.innerHTML = '<div class="spinner"></div>';
                        stateStep.classList.add('active');
                        statusText.innerText = message || '正在分析项目...';
                        detailedStatus.innerText = details || '分析项目结构';
                        progressStatus.style.display = 'block';
                        break;
                    case 'ready':
                        stateIcon.innerHTML = '✅';
                        stateStep.classList.add('completed');
                        statusText.innerText = message || '分析完成';
                        detailedStatus.innerText = details || '可以开始检测变更';
                        progressStatus.style.display = 'none';
                        break;
                    case 'error':
                        stateIcon.innerHTML = '❌';
                        stateStep.classList.add('active');
                        statusText.innerText = '错误';
                        detailedStatus.innerText = message || '发生错误';
                        detailedStatus.style.color = 'var(--vscode-errorForeground)';
                        progressStatus.style.display = 'none';
                        break;
                }
            }

            window.addEventListener('message', event => {
                const message = event.data;

                switch (message.command) {
                    case 'stateUpdate':
                        // ✅ 状态驱动更新
                        updateState(message.state, message.message, message.details);
                        break;
                    case 'progressUpdate':
                        // ✅ 进度更新
                        progressStatus.innerText = message.message;
                        progressStatus.style.display = 'block';
                        break;
                    case 'projectInferenceResult':
                        updateState('ready', '分析完成', '项目结构已识别');
                        
                        // ✅ 显示主界面，而不是只显示 JSON
                        setTimeout(() => {
                            statusContainer.style.display = 'none';
                            const mainContent = document.getElementById('main-content');
                            if (mainContent) {
                                mainContent.classList.remove('hidden');
                                
                                // 显示项目信息
                                const projectInfo = document.getElementById('project-info');
                                if (projectInfo && message.data) {
                                    const roots = message.data.sourceRoots || [];
                                    const projectType = message.data.projectType || 'unknown';
                                    let infoHtml = '<span>项目类型: <strong>' + projectType + '</strong></span>';
                                    if (roots.length > 0) {
                                        infoHtml += ' | 源根目录: <strong>' + roots.join(', ') + '</strong>';
                                    }
                                    projectInfo.innerHTML = infoHtml;
                                }
                                
                                // 可选：在调试模式下显示 JSON（默认隐藏）
                                const analysisResults = document.getElementById('analysis-results');
                                const resultData = document.getElementById('result-data');
                                if (analysisResults && resultData) {
                                    // 默认隐藏 JSON，只在需要时显示
                                    // analysisResults.style.display = 'block';
                                    // resultData.innerText = JSON.stringify(message.data, null, 2);
                                }
                            }
                            
                            // ✅ 通知 React 应用（如果存在）项目分析已完成
                            if (window.vscode) {
                                window.vscode.postMessage({
                                    command: 'projectAnalysisCompleted',
                                    data: message.data
                                });
                            }
                        }, 1000);
                        break;
                    case 'error':
                        updateState('error', message.text, '请查看输出面板获取详细信息');
                        
                        // ✅ 即使失败也显示主界面
                        setTimeout(() => {
                            statusContainer.style.display = 'none';
                            const mainContent = document.getElementById('main-content');
                            if (mainContent) {
                                mainContent.classList.remove('hidden');
                                const readyMessage = document.getElementById('ready-message');
                                if (readyMessage) {
                                    const errorText = message.text || '发生未知错误';
                                    readyMessage.innerHTML = 
                                        '<div style="font-size: 48px; margin-bottom: 16px;">❌</div>' +
                                        '<div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">分析失败</div>' +
                                        '<div style="font-size: 12px; color: var(--vscode-errorForeground); margin-bottom: 24px;">' +
                                            errorText.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
                                        '</div>' +
                                        '<div style="font-size: 11px; color: var(--vscode-descriptionForeground); padding: 12px; background: var(--vscode-input-background); border-radius: 4px; text-align: left; max-width: 500px; margin: 0 auto;">' +
                                            '<div style="margin-bottom: 8px;"><strong>建议：</strong></div>' +
                                            '<div>• 查看输出面板获取详细错误信息</div>' +
                                            '<div>• 检查项目结构是否正确</div>' +
                                            '<div>• 尝试重新加载插件</div>' +
                                        '</div>';
                                }
                            }
                        }, 1000);
                        break;
                }
            });
            
            // ✅ UI 就绪后立即请求分析（不阻塞）
            setTimeout(() => {
                vscode.postMessage({ command: 'refresh' });
            }, 100);
        </script>
    </body>
    </html>`;
  }

  /**
   * 处理扩展更新
   * 当检测到版本变更时调用，用于重置资源或迁移数据
   */
  public async handleUpdate(oldVersion: string | undefined, newVersion: string, reason: 'update' | 'reinstall' = 'update') {
    const actionText = reason === 'reinstall' ? '重新安装' : '更新';
    this.log(`检测到扩展${actionText}: ${oldVersion || '未知'} -> ${newVersion}`);
    this.log('正在执行资源重置...');

    try {
      // 1. 关闭现有数据库连接（如果已打开）
      if (this._databaseService) {
        await this._databaseService.dispose();
      }

      // 2. 重新初始化数据库服务（这会自动处理潜在的损坏）
      this._databaseService = DatabaseService.getInstance(this.context);
      await this._databaseService.initialize();

      // 3. 执行深度清理
      // 如果是重装，我们可能想要更彻底的清理（例如全部清理），但为了保留用户历史数据（如果是云同步的），
      // 我们还是保留最近的数据。如果用户真的想全新开始，通常会手动删除数据文件夹。
      // 这里我们维持30天的策略，或者对于重装可以考虑清理更多。
      // 考虑到"卸载重装"通常是为了解决问题，执行一次 VACUUM 和索引重建（包含在 initialize/cleanup 中）是有益的。
      await this._databaseService.cleanupData(Date.now() - (30 * 24 * 60 * 60 * 1000)); 

      vscode.window.showInformationMessage(
        `DiffSense 已${actionText}至 v${newVersion}，资源已重置以确保最佳性能。`
      );
      
      this.log('资源重置完成');
    } catch (error) {
      this.log(`资源重置失败: ${error}`, 'error');
    }
  }

  private async exportResult(exportData: any, language: string, saveUri: vscode.Uri) {
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
    // 尝试多个可能的路径
    const possiblePaths = [
      path.join(this._extensionUri.fsPath, 'analyzers', 'node-analyzer', 'analyze.js'),
      path.join(this._extensionUri.fsPath, 'ui', 'node-analyzer', 'analyze.js'),
      this.getAnalyzerPath('node-analyzer/analyze.js')
    ];
    
    for (const analyzerPath of possiblePaths) {
      if (fs.existsSync(analyzerPath)) {
        this.log(`[Path] 找到前端分析器: ${analyzerPath}`, 'info');
        return analyzerPath;
      }
    }
    
    // 如果都不存在，返回第一个作为默认值（会在运行时报错）
    this.log(`[Path] ⚠️ 前端分析器未找到，使用默认路径: ${possiblePaths[0]}`, 'warn');
    return possiblePaths[0];
  }

  private getGolangAnalyzerPath(): string {
    const possiblePaths = [
      path.join(this._extensionUri.fsPath, 'analyzers', 'golang-analyzer', 'analyze.js'),
      path.join(this._extensionUri.fsPath, 'ui', 'golang-analyzer', 'analyze.js'),
      this.getAnalyzerPath('golang-analyzer/analyze.js')
    ];
    
    for (const analyzerPath of possiblePaths) {
      if (fs.existsSync(analyzerPath)) {
        this.log(`[Path] 找到 Golang 分析器: ${analyzerPath}`, 'info');
        return analyzerPath;
      }
    }
    
    this.log(`[Path] ⚠️ Golang 分析器未找到，使用默认路径: ${possiblePaths[0]}`, 'warn');
    return possiblePaths[0];
  }

  private getJavaAnalyzerPath(): string {
    const possiblePaths = [
      path.join(this._extensionUri.fsPath, 'analyzers', 'gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar'),
      path.join(this._extensionUri.fsPath, 'target', 'gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar'),
      this.getAnalyzerPath('gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar')
    ];
    
    for (const analyzerPath of possiblePaths) {
      if (fs.existsSync(analyzerPath)) {
        this.log(`[Path] 找到 Java 分析器: ${analyzerPath}`, 'info');
        return analyzerPath;
      }
    }
    
    this.log(`[Path] ⚠️ Java 分析器未找到，使用默认路径: ${possiblePaths[0]}`, 'warn');
    return possiblePaths[0];
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
          maxBuffer: 1024 * 1024 * 50 // 50MB
        }, (error, stdout, stderr) => {
          if (error) {
            console.error('mergeImpact 执行错误:', error);
            if (error.message.includes('maxBuffer')) {
              console.error('⚠️ stdout maxBuffer length exceeded in mergeImpact');
            }
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
      this._view?.postMessage({
        command: 'snapshotDiffResult',
        data: result
      });

    } catch (error) {
      console.error('检测组件回退失败:', error);
      this._view?.postMessage({
        command: 'analysisError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 清理资源
   */
  public async dispose() {
    // 清理输出通道
    if (this._outputChannel) {
      this._outputChannel.dispose();
    }
    
    // 清理数据库服务
    if (this._databaseService) {
      this.log('正在关闭数据库服务...');
      await this._databaseService.dispose();
    }
    
    // 清理主题监听器
    if (this._themeDisposable) {
      this._themeDisposable.dispose();
    }
    
    this.log('DiffSense服务已清理');
  }

  /**
   * 执行数据库清理
   */
  public async cleanupDatabase() {
    if (!this._databaseService) {
      vscode.window.showWarningMessage('数据库服务未初始化');
      return;
    }

    try {
      this.log('开始清理数据库...');
      
      // 删除90天未修改的文件
      const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
      const deletedCount = await this._databaseService.cleanupData(ninetyDaysAgo);
      
      this.log(`清理完成，删除了 ${deletedCount} 条过期记录`);
      
      // 获取清理后的统计信息
      const stats = await this._databaseService.getStats();
      this.log(`清理后数据库统计: ${JSON.stringify(stats, null, 2)}`);
      
      vscode.window.showInformationMessage(
        `数据库清理完成，删除了 ${deletedCount} 条过期记录`
      );
      
    } catch (error) {
      this.log(`数据库清理失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      vscode.window.showErrorMessage('数据库清理失败，请查看输出面板获取详细信息');
    }
  }

  /**
   * ✅ 处理分析请求（主要入口）
   */
  private async handleAnalysisRequest(data: any) {
    this.log('[Analysis] ========== 开始代码分析 ==========', 'info');
    this.log(`[Analysis] 接收到的数据: ${JSON.stringify(data, null, 2)}`, 'info');
    
    // ✅ 验证数据
    if (!data) {
      const errorMsg = '分析数据为空';
      this.log(`[Analysis] ❌ ${errorMsg}`, 'error');
      throw new Error(errorMsg);
    }
    
    // ✅ 发送分析开始消息
    this.log('[Analysis] 发送 analysisStarted 消息到前端', 'info');
    this._view?.postMessage({
      command: 'analysisStarted'
    });
    
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('未找到工作区文件夹');
      }
      const repoPath = workspaceFolder.uri.fsPath;
      
      const analysisType = data.analysisType || 'backend';
      // ✅ 清理分支名称，移除 "HEAD ->" 等无效前缀
      const rawBranch = data.branch || 'HEAD';
      const branch = this.cleanBranchName(rawBranch) || 'HEAD';
      const range = data.range || 'Last 3 commits';
      const analysisMode = data.analysisMode || 'unknown'; // 获取分析模式
      
      this.log(`[Analysis] 工作区: ${repoPath}`, 'info');
      this.log(`[Analysis] 分析类型: ${analysisType}`, 'info');
      this.log(`[Analysis] 分支: ${branch} (原始: ${rawBranch})`, 'info');
      this.log(`[Analysis] 范围: ${range}`, 'info');
      
      // ✅ 验证分支名称
      if (!this.isValidBranchName(branch)) {
        this.log(`[Analysis] ⚠️  分支名称无效，使用默认值 HEAD: ${branch}`, 'warn');
        data.branch = 'HEAD';
      } else {
        data.branch = branch;
      }
      this.log(`[Analysis] 前端路径: ${data.frontendPath || '(未指定)'}`, 'info');
      this.log(`[Analysis] 完整参数: ${JSON.stringify(data, null, 2)}`, 'info');
      
      let result: any;
      
      // 根据分析类型选择分析器
      if (analysisType === 'frontend' || analysisType === 'mixed') {
        this.log('[Analysis] 使用前端分析器...', 'info');
        result = await this.runFrontendAnalysis(repoPath, data);
      } else if (analysisType === 'backend') {
        // 根据后端语言选择分析器
        const backendLang = data.backendLanguage || 'java';
        if (backendLang === 'golang') {
          this.log('[Analysis] 使用 Golang 分析器...', 'info');
          result = await this.runGolangAnalysis(repoPath, data);
        } else {
          this.log('[Analysis] 使用 Java 分析器...', 'info');
          result = await this.runJavaAnalysis(repoPath, data);
        }
      } else {
        throw new Error(`不支持的分析类型: ${analysisType}`);
      }
      
      this.log(`[Analysis] ✅ 分析完成，结果包含 ${result.commits?.length || 0} 个提交`, 'info');
      
      // ✅ 缓存分析结果
      this._cachedAnalysisResult = result.commits || result;

      // ✅ 发送分析结果
      this._view?.postMessage({
        command: 'analysisResult',
        data: result.commits || result
      });
      
      // ✅ 保存分析结果到数据库（可选，失败不影响分析功能）
      if (this._databaseService) {
        try {
          await this._databaseService.saveAnalysisResult(
            repoPath,
            analysisType,
            result,
            data,
            `分析了 ${result.commits?.length || 0} 个提交`
          );
          this.log('[Analysis] ✅ 分析结果已保存到数据库', 'info');
        } catch (dbError) {
          this.log(`[Analysis] ⚠️  保存分析结果到数据库失败（不影响分析功能）: ${dbError}`, 'warn');
        }
      } else {
        this.log('[Analysis] ⚠️  数据库服务未初始化，跳过保存分析结果', 'warn');
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`[Analysis] ❌ 分析失败: ${errorMsg}`, 'error');
      this.log(`[Analysis] [错误堆栈] ${error instanceof Error ? error.stack : 'N/A'}`, 'error');
      
      // ✅ 记录错误
      this.addErrorToLog(errorMsg, 'analysis');
      
      // ✅ 发送错误消息
      this._view?.postMessage({
        command: 'analysisError',
        error: errorMsg
      });
      
      throw error;
    }
  }

  /**
   * ✅ 执行前端分析
   */
  private async runFrontendAnalysis(repoPath: string, options: any): Promise<any> {
    const nodeAnalyzerPath = this.getNodeAnalyzerPath();
    if (!fs.existsSync(nodeAnalyzerPath)) {
      throw new Error(`前端分析器不存在: ${nodeAnalyzerPath}`);
    }
    
    this.log(`[Analysis] 前端分析器路径: ${nodeAnalyzerPath}`, 'info');
    this.log(`[Analysis] 仓库根目录: ${repoPath}`, 'info');
    this.log(`[Analysis] 接收到的前端路径参数: ${options.frontendPath || '(未指定)'}`, 'info');
    
    // ✅ 确定目标目录：如果指定了 frontendPath，使用它；否则使用仓库根目录
    let targetDir: string;
    if (options.frontendPath) {
      // 如果 frontendPath 是绝对路径，直接使用；否则与 repoPath 组合
      if (path.isAbsolute(options.frontendPath)) {
        targetDir = options.frontendPath;
      } else {
        targetDir = path.join(repoPath, options.frontendPath);
      }
      this.log(`[Analysis] ✅ 使用前端路径作为目标目录: ${targetDir}`, 'info');
    } else {
      targetDir = repoPath;
      this.log(`[Analysis] ⚠️  未指定前端路径，使用仓库根目录: ${targetDir}`, 'warn');
    }
    
    // 验证目标目录是否存在
    if (!fs.existsSync(targetDir)) {
      this.log(`[Analysis] ❌ 目标目录不存在: ${targetDir}`, 'error');
      throw new Error(`目标目录不存在: ${targetDir}`);
    }
    
    // 构建命令行参数（第一个参数是目标目录）
    const args: string[] = [nodeAnalyzerPath, targetDir, '--format', 'json'];
    
    // ✅ 传递分支参数（必需，用于Git分析）
    if (options.branch) {
      // ✅ 清理分支名称，确保是有效的 Git 引用
      const cleanedBranch = this.cleanBranchName(options.branch);
      if (this.isValidBranchName(cleanedBranch)) {
        args.push('--branch', cleanedBranch);
        this.log(`[Analysis] ✅ 分支参数: ${cleanedBranch} (原始: ${options.branch})`, 'info');
      } else {
        // 如果清理后无效，使用默认值
        this.log(`[Analysis] ⚠️  分支名称无效，使用默认值 HEAD: ${options.branch}`, 'warn');
        args.push('--branch', 'HEAD');
      }
    } else {
      this.log(`[Analysis] ⚠️  未指定分支，使用默认值 HEAD`, 'warn');
      args.push('--branch', 'HEAD');
    }
    
    // ✅ 处理范围参数（必需，用于启用Git分析）
    let hasGitParams = false;
    if (options.range) {
      if (options.range.startsWith('Last ')) {
        const count = parseInt(options.range.replace('Last ', '').replace(' commits', ''));
        if (!isNaN(count)) {
          args.push('--commits', count.toString());
          hasGitParams = true;
          this.log(`[Analysis] ✅ 提交数量参数: ${count}`, 'info');
        }
      } else if (options.range === 'Today') {
        args.push('--since', 'today');
        hasGitParams = true;
        this.log(`[Analysis] ✅ 日期范围: today`, 'info');
      } else if (options.range === 'This week') {
        args.push('--since', '1 week ago');
        hasGitParams = true;
        this.log(`[Analysis] ✅ 日期范围: 1 week ago`, 'info');
      } else if (options.range === 'Custom Date Range') {
        // ✅ 处理自定义日期范围
        if (options.dateFrom) {
          args.push('--since', options.dateFrom);
          hasGitParams = true;
          this.log(`[Analysis] ✅ 自定义日期范围开始: ${options.dateFrom}`, 'info');
        }
        if (options.dateTo) {
          args.push('--until', options.dateTo);
          hasGitParams = true;
          this.log(`[Analysis] ✅ 自定义日期范围结束: ${options.dateTo}`, 'info');
        }
      }
    }
    
    // ✅ 处理提交ID范围
    if (options.startCommit && options.endCommit) {
      args.push('--start-commit', options.startCommit);
      args.push('--end-commit', options.endCommit);
      hasGitParams = true;
      this.log(`[Analysis] ✅ 提交范围: ${options.startCommit}..${options.endCommit}`, 'info');
    }
    
    // ✅ 验证Git参数
    if (!hasGitParams && !options.branch) {
      this.log(`[Analysis] ⚠️  警告：未提供Git参数，Git分析可能不会启用`, 'warn');
    } else {
      this.log(`[Analysis] ✅ Git参数已设置，分析器将启用Git分析`, 'info');
    }
    
    // ✅ 注意：前端路径已经作为第一个参数（targetDir）传递，不需要单独传递
    
    this.log(`[Analysis] ========== 前端分析器命令 ==========`, 'info');
    this.log(`[Analysis] 完整命令: node ${args.join(' ')}`, 'info');
    this.log(`[Analysis] 工作目录: ${repoPath}`, 'info');
    this.log(`[Analysis] 目标目录: ${targetDir}`, 'info');
    this.log(`[Analysis] ====================================`, 'info');
    
    return new Promise((resolve, reject) => {
      this.log(`[Analysis] 开始执行前端分析器...`, 'info');
      
      const childProcess = execFile('node', args, {
        cwd: repoPath,
        timeout: 300000, // 5分钟超时
        maxBuffer: 1024 * 1024 * 10 // 10MB
      }, (error, stdout, stderr) => {
        if (error) {
          this.log(`[Analysis] ❌ 前端分析器执行错误: ${error.message}`, 'error');
          if (error.code) {
            this.log(`[Analysis] 错误代码: ${error.code}`, 'error');
          }
          if (stderr) {
            this.log(`[Analysis] [stderr] ${stderr}`, 'error');
          }
          if (stdout) {
            this.log(`[Analysis] [stdout] ${stdout.substring(0, 1000)}`, 'error');
          }
          reject(error);
          return;
        }
        
        // ✅ 所有输出都记录日志（分析器使用 console.error 输出到 stderr）
        if (stderr && stderr.trim()) {
          // 将 stderr 按行分割，逐行记录日志
          const stderrLines = stderr.trim().split('\n');
          for (const line of stderrLines) {
            if (line.trim()) {
              this.log(`[Analysis] [前端分析器] ${line}`, 'info');
            }
          }
        }
        
        try {
          if (!stdout || !stdout.trim()) {
            throw new Error('分析器没有返回任何输出');
          }
          
          const result = JSON.parse(stdout);
          this.log(`[Analysis] ✅ 前端分析完成，结果包含 ${result.commits?.length || 0} 个提交`, 'info');
          resolve(result);
        } catch (parseError) {
          this.log(`[Analysis] ❌ 解析分析结果失败: ${parseError}`, 'error');
          this.log(`[Analysis] [原始输出长度] ${stdout ? stdout.length : 0} 字符`, 'error');
          if (stdout) {
            this.log(`[Analysis] [原始输出前500字符] ${stdout.substring(0, 500)}`, 'error');
          }
          reject(new Error(`解析分析结果失败: ${parseError}`));
        }
      });
      
      // ✅ 实时捕获子进程的输出（如果可能）
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.trim()) {
            this.log(`[Analysis] [stdout] ${output.trim()}`, 'info');
          }
        });
      }
      
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          const output = data.toString();
          if (output.trim()) {
            this.log(`[Analysis] [stderr] ${output.trim()}`, 'info');
          }
        });
      }
    });
  }

  /**
   * ✅ 执行 Golang 分析
   */
  private async runGolangAnalysis(repoPath: string, options: any): Promise<any> {
    const golangAnalyzerPath = this.getGolangAnalyzerPath();
    if (!fs.existsSync(golangAnalyzerPath)) {
      throw new Error(`Golang 分析器不存在: ${golangAnalyzerPath}`);
    }
    
    this.log(`[Analysis] Golang 分析器路径: ${golangAnalyzerPath}`, 'info');
    
    // 类似前端分析的实现
    const args: string[] = [golangAnalyzerPath, repoPath, '--format', 'json'];
    
    if (options.branch) {
      // ✅ 清理分支名称
      const cleanedBranch = this.cleanBranchName(options.branch);
      const validBranch = this.isValidBranchName(cleanedBranch) ? cleanedBranch : 'HEAD';
      args.push('--branch', validBranch);
      this.log(`[Analysis] ✅ Golang 分析器分支参数: ${validBranch} (原始: ${options.branch})`, 'info');
    } else {
      args.push('--branch', 'HEAD');
      this.log(`[Analysis] ⚠️  未指定分支，使用默认值 HEAD`, 'warn');
    }
    
    this.log(`[Analysis] 执行命令: node ${args.join(' ')}`, 'info');
    
    return new Promise((resolve, reject) => {
      execFile('node', args, {
        cwd: repoPath,
        timeout: 300000,
        maxBuffer: 1024 * 1024 * 10
      }, (error, stdout, stderr) => {
        if (error) {
          this.log(`[Analysis] Golang 分析器执行错误: ${error.message}`, 'error');
          if (stderr) {
            this.log(`[Analysis] stderr: ${stderr}`, 'error');
          }
          reject(error);
          return;
        }
        
        if (stderr) {
          this.log(`[Analysis] [Golang分析器输出] ${stderr}`, 'info');
        }
        
        try {
          const result = JSON.parse(stdout);
          this.log(`[Analysis] ✅ Golang 分析完成`, 'info');
          resolve(result);
        } catch (parseError) {
          this.log(`[Analysis] ❌ 解析分析结果失败: ${parseError}`, 'error');
          reject(new Error(`解析分析结果失败: ${parseError}`));
        }
      });
    });
  }

  /**
   * ✅ 执行 Java 分析
   */
  private async runJavaAnalysis(repoPath: string, options: any): Promise<any> {
    const javaAnalyzerPath = this.getJavaAnalyzerPath();
    if (!fs.existsSync(javaAnalyzerPath)) {
      throw new Error(`Java 分析器不存在: ${javaAnalyzerPath}`);
    }
    
    this.log(`[Analysis] Java 分析器路径: ${javaAnalyzerPath}`, 'info');
    
    // ✅ Java 分析器使用 inspect 命令（InspectCommand）
    // ✅ 清理分支名称
    const rawBranch = options.branch || 'HEAD';
    const cleanedBranch = this.cleanBranchName(rawBranch);
    const validBranch = this.isValidBranchName(cleanedBranch) ? cleanedBranch : 'HEAD';
    
    const args: string[] = [
      '-jar', javaAnalyzerPath,
      'inspect',  // 使用 inspect 子命令
      '--branch', validBranch,
      '--output', 'json'
    ];
    
    this.log(`[Analysis] ✅ Java 分析器分支参数: ${validBranch} (原始: ${rawBranch})`, 'info');
    
    // ✅ 处理范围参数
    if (options.range) {
      if (options.range.startsWith('Last ')) {
        const count = parseInt(options.range.replace('Last ', '').replace(' commits', ''));
        if (!isNaN(count)) {
          args.push('--commits', count.toString());
          this.log(`[Analysis] 提交数量参数: ${count}`, 'info');
        }
      } else if (options.range === 'Today') {
        // 转换为日期格式 yyyy-MM-dd
        const today = new Date().toISOString().split('T')[0];
        args.push('--since', today);
        this.log(`[Analysis] 日期范围: ${today}`, 'info');
      } else if (options.range === 'This week') {
        // 计算一周前的日期
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        args.push('--since', weekAgoStr);
        this.log(`[Analysis] 日期范围: ${weekAgoStr}`, 'info');
      }
    }
    
    // ✅ 处理自定义日期范围
    if (options.range === 'Custom Date Range') {
      if (options.dateFrom) {
        // 确保日期格式为 yyyy-MM-dd
        const dateFrom = this.formatDateForJava(options.dateFrom);
        args.push('--since', dateFrom);
        this.log(`[Analysis] 自定义日期范围开始: ${dateFrom}`, 'info');
      }
      // Java 分析器不支持 --until，只支持 --since
    }
    
    // ✅ 处理提交ID范围（Java分析器不支持，但可以尝试使用 --baseline）
    if (options.startCommit && options.endCommit) {
      // 使用 --baseline 参数指定起始提交
      args.push('--baseline', options.startCommit);
      this.log(`[Analysis] 基准提交: ${options.startCommit}`, 'info');
    }
    
    // ✅ 添加深度参数（如果有）
    if (options.maxDepth) {
      args.push('--depth', options.maxDepth.toString());
    }
    
    this.log(`[Analysis] 执行命令: java ${args.join(' ')}`, 'info');
    
    return new Promise((resolve, reject) => {
      this.log(`[Analysis] 开始执行 Java 分析器...`, 'info');
      
      const childProcess = execFile('java', args, {
        cwd: repoPath,
        timeout: 300000,
        maxBuffer: 1024 * 1024 * 50 // 50MB
      }, (error, stdout, stderr) => {
        if (error) {
          this.log(`[Analysis] ❌ Java 分析器执行错误: ${error.message}`, 'error');
          if (error.message.includes('maxBuffer')) {
            this.log('[Analysis] ⚠️ stdout maxBuffer length exceeded. Please try reducing the analysis scope.', 'error');
          }
          if (error.code) {
            this.log(`[Analysis] 错误代码: ${error.code}`, 'error');
          }
          if (stderr) {
            this.log(`[Analysis] [stderr] ${stderr}`, 'error');
          }
          if (stdout) {
            this.log(`[Analysis] [stdout] ${stdout.substring(0, 1000)}`, 'error');
          }
          reject(error);
          return;
        }
        
        // ✅ 所有输出都记录日志
        if (stderr && stderr.trim()) {
          const stderrLines = stderr.trim().split('\n');
          for (const line of stderrLines) {
            if (line.trim()) {
              this.log(`[Analysis] [Java分析器] ${line}`, 'info');
            }
          }
        }
        
        try {
          if (!stdout || !stdout.trim()) {
            throw new Error('Java 分析器没有返回任何输出');
          }
          
          const result = JSON.parse(stdout);
          this.log(`[Analysis] ✅ Java 分析完成，结果包含 ${Array.isArray(result) ? result.length : 0} 个提交`, 'info');
          resolve(result);
        } catch (parseError) {
          this.log(`[Analysis] ❌ 解析分析结果失败: ${parseError}`, 'error');
          this.log(`[Analysis] [原始输出长度] ${stdout ? stdout.length : 0} 字符`, 'error');
          if (stdout) {
            this.log(`[Analysis] [原始输出前500字符] ${stdout.substring(0, 500)}`, 'error');
          }
          reject(new Error(`解析分析结果失败: ${parseError}`));
        }
      });
      
      // ✅ 实时捕获子进程的输出
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.trim()) {
            this.log(`[Analysis] [stdout] ${output.trim()}`, 'info');
          }
        });
      }
      
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          const output = data.toString();
          if (output.trim()) {
            this.log(`[Analysis] [stderr] ${output.trim()}`, 'info');
          }
        });
      }
    });
  }

  /**
   * ✅ 格式化日期为 Java 分析器需要的格式 (yyyy-MM-dd)
   */
  private formatDateForJava(dateStr: string): string {
    try {
      // 尝试解析各种日期格式
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        // 如果解析失败，尝试其他格式
        return dateStr;
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      // 如果格式化失败，返回原始字符串
      return dateStr;
    }
  }

  /**
   * ✅ 处理 Bug 汇报
   */
  private async handleReportBug(reportData: any) {
    this.log('[BugReport] ========== 处理 Bug 汇报 ==========', 'info');
    
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const workspacePath = workspaceFolder?.uri.fsPath || '未知路径';
      
      // ✅ 收集系统信息
      const systemInfo = {
        os: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        vscodeVersion: vscode.version,
        extensionVersion: this.context.extension.packageJSON.version
      };
      
      // ✅ 收集 Git 信息
      const gitInfo = await this.collectGitInfo(workspacePath);
      
      // ✅ 收集最近的错误
      const recentErrors = this.getRecentErrors();
      
      // ✅ 构建完整的报告数据
      const fullReportData = {
        ...reportData,
        systemInfo,
        gitInfo,
        recentErrors,
        commitInfo: gitInfo,
        analysisParams: {
          projectType: reportData.projectType,
          analysisScope: reportData.analysisScope,
          backendLanguage: reportData.backendLanguage
        }
      };
      
      // ✅ 生成 Issue 标题和正文
      const title = this.generateIssueTitle(fullReportData, systemInfo);
      const body = this.generateIssueBody(fullReportData);
      
      this.log(`[BugReport] Issue 标题: ${title}`, 'info');
      this.log(`[BugReport] Issue 正文长度: ${body.length} 字符`, 'info');
      
      // ✅ 获取仓库 URL（从 Git 信息）
      let repoUrl = gitInfo.remoteUrl || '';
      if (!repoUrl || repoUrl.includes('Error:')) {
        // 尝试从其他来源获取
        repoUrl = 'https://github.com/yourorg/diffsense'; // 默认仓库
        this.log('[BugReport] ⚠️ 无法获取仓库 URL，使用默认值', 'warn');
      }
      
      // ✅ 构建 GitHub Issue URL
      const issueUrl = this.buildGitHubIssueUrl(repoUrl, title, body);
      
      this.log(`[BugReport] ✅ Issue URL 已生成: ${issueUrl.substring(0, 100)}...`, 'info');
      
      // ✅ 打开浏览器
      vscode.env.openExternal(vscode.Uri.parse(issueUrl));
      
      // ✅ 显示成功消息
      vscode.window.showInformationMessage('Bug 汇报页面已在浏览器中打开');
      
      this.log('[BugReport] ✅ Bug 汇报处理完成', 'info');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`[BugReport] ❌ Bug 汇报处理失败: ${errorMsg}`, 'error');
      throw error;
    }
  }

  /**
   * ✅ 验证 Commit ID
   */
  private async handleValidateCommitIds(data: { branch: string, startCommit: string, endCommit: string }) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('未找到工作区文件夹');
      }
      const repoPath = workspaceFolder.uri.fsPath;
      
      this.log(`[Validation] 验证 Commit ID: ${data.startCommit} -> ${data.endCommit}`, 'info');
      
      // 验证两个 commit 是否存在
      const validateCommit = (commitId: string): Promise<boolean> => {
        return new Promise((resolve) => {
          execFile('git', ['rev-parse', '--verify', commitId], { cwd: repoPath, timeout: 5000 }, (error) => {
            resolve(!error);
          });
        });
      };
      
      const [startValid, endValid] = await Promise.all([
        validateCommit(data.startCommit),
        validateCommit(data.endCommit)
      ]);
      
      if (startValid && endValid) {
        this.log('[Validation] ✅ Commit ID 验证通过', 'info');
        this._view?.postMessage({
          command: 'commitValidationResult',
          valid: true
        });
      } else {
        const errorMsg = `无效的 Commit ID: ${!startValid ? data.startCommit : ''} ${!endValid ? data.endCommit : ''}`;
        this.log(`[Validation] ❌ ${errorMsg}`, 'error');
        this._view?.postMessage({
          command: 'commitValidationResult',
          valid: false,
          error: errorMsg
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`[Validation] ❌ 验证失败: ${errorMsg}`, 'error');
      this._view?.postMessage({
        command: 'commitValidationResult',
        valid: false,
        error: errorMsg
      });
    }
  }

  /**
   * ✅ 处理hotspot分析请求
   */
  private async handleGetHotspotAnalysis(data: { 
    limit?: number;
    minChurn?: number;
    minComplexity?: number;
    includeLang?: string[];
    excludePatterns?: string[];
  }) {
    if (!this._databaseService) {
      this.log('数据库服务未初始化，无法执行热点分析', 'warn');
      this._view?.postMessage({
        command: 'hotspotAnalysisResult',
        error: '数据库服务未初始化'
      });
      return;
    }

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('未找到工作区文件夹');
      }

      const repoPath = workspaceFolder.uri.fsPath;
      const options = {
        limit: data.limit || 50,
        minChurn: data.minChurn || 1,
        minComplexity: data.minComplexity || 0,
        includeLang: data.includeLang || null,
        excludePatterns: data.excludePatterns || []
      };

      this.log(`[Hotspot] 执行热点分析，参数: ${JSON.stringify(options)}`, 'info');
      
      const result = await this._databaseService.analyzeHotspots(repoPath, options);
      
      this.log(`[Hotspot] ✅ 热点分析完成，发现 ${result.hotspots.length} 个热点文件`, 'info');
      this.log(`[Hotspot] 统计信息: ${JSON.stringify(result.summary, null, 2)}`, 'info');
      
      this._view?.postMessage({
        command: 'hotspotAnalysisResult',
        data: result.hotspots,
        summary: result.summary,
        fromDatabase: true
      });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`[Hotspot] ❌ 热点分析失败: ${errorMsg}`, 'error');
      this._view?.postMessage({
        command: 'hotspotAnalysisError',
        error: errorMsg
      });
      
      // 记录错误到数据库
      if (this._databaseService) {
        await this._databaseService.logError(
          'get-hotspot-analysis',
          `Failed to get hotspot analysis: ${errorMsg}`,
          'hotspot-analysis'
        );
      }
    }
  }

  private getCategoryDisplayName(category: string): string {
    return category;
  }
}
export async function deactivate() {
  // 清理资源
  if (provider) {
    await provider.dispose();
  }
}

/**
 * 数据库清理命令
 */
export async function cleanupDatabase() {
  if (provider) {
    await provider.cleanupDatabase();
  }
}

let provider: DiffSense | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('[DiffSense] Activation started');
  provider = new DiffSense(context);
  
  // Register WebviewViewProvider immediately
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('diffsense.analysisView', provider)
  );
  
  // 检查版本更新或重装
  const currentVersion = context.extension.packageJSON.version;
  const previousVersion = context.globalState.get<string>('diffsenseVersion');
  
  // 检查安装标记文件（用于检测同版本重装）
  // 当用户卸载插件时，扩展目录会被删除，标记文件也会消失
  // 但 globalState 会保留。所以如果 globalState 有值但标记文件不存在，说明是重装
  const markerPath = path.join(context.extensionPath, '.install-marker');
  const isReinstall = previousVersion && !fs.existsSync(markerPath);

  if (currentVersion !== previousVersion || isReinstall) {
    const reason = isReinstall ? 'reinstall' : 'update';
    provider.handleUpdate(previousVersion, currentVersion, reason).then(() => {
      context.globalState.update('diffsenseVersion', currentVersion);
      // 创建标记文件
      try {
        fs.writeFileSync(markerPath, Date.now().toString());
      } catch (e) {
        console.error('Failed to create install marker:', e);
      }
    });
  } else {
    // 确保标记文件存在（防止意外删除）
    if (!fs.existsSync(markerPath)) {
      try {
        fs.writeFileSync(markerPath, Date.now().toString());
      } catch (e) {
        // Ignore
      }
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('diffsense.refresh', () => provider?.refresh()),
    vscode.commands.registerCommand('diffsense.showOutput', () => provider?.showOutput()),
    vscode.commands.registerCommand('diffsense.cleanupDatabase', () => provider?.cleanupDatabase()),
    vscode.commands.registerCommand('diffsense.runAnalysis', () => {
        vscode.window.showInformationMessage('Analysis started (Check Output)');
        provider?.refresh();
    })
  );
}


