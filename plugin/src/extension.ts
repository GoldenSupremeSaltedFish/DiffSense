import * as vscode from 'vscode';
import * as path from 'path';
import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as glob from 'glob';

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

  context.subscriptions.push(analysisCommand, refreshCommand);
}

class DiffSenseViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'diffsense.analysisView';

  private _view?: vscode.WebviewView;
  private _lastReportPath?: string; // 保存最后生成的报告路径
  private _lastAnalysisResult?: any[]; // 保存最后的分析结果
  private _themeDisposable?: vscode.Disposable; // 主题变化监听器

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) { }

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
        vscode.Uri.file(path.join(this._extensionUri.fsPath, '..', 'ui', 'diffsense-frontend', 'dist'))
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
      console.log('=== 开始分析请求 ===');
      console.log('请求数据:', data);
      
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
        console.log('🔍 执行前端代码分析...');
        console.log('分析选项:', analysisOptions);
        analysisResult = await this.executeFrontendAnalysis(repoPath, data);
      } else if (analysisType === 'mixed') {
        // 混合项目分析
        console.log('🔍 执行混合项目分析...');
        analysisResult = await this.executeMixedAnalysis(repoPath, data);
      } else {
        // 后端代码分析 (原有逻辑)
        console.log('🔍 执行后端代码分析...');
        console.log('分析选项:', analysisOptions);
        
        // 检测后端语言
        const repoUri = vscode.Uri.file(repoPath);
        const backendLanguage = await this.detectBackendLanguage(repoUri);
        console.log('🔍 检测到的后端语言:', backendLanguage);

        if (backendLanguage === 'java') {
          // Java分析
          console.log('☕ 使用Java分析器...');
          
          // 构建JAR文件路径 - 支持多种环境
          const jarPath = this.getJavaAnalyzerPath();
          
          // 检查JAR文件是否存在
          if (!fs.existsSync(jarPath)) {
            throw new Error(`JAR文件不存在: ${jarPath}`);
          }

          console.log(`正在分析Java仓库: ${repoPath}`);
          console.log(`使用JAR: ${jarPath}`);

          // 调用JAR进行分析
          const result = await this.executeJarAnalysis(jarPath, repoPath, data);
          
          // 解析结果并发送给前端
          console.log('=== 开始解析JAR结果 ===');
          analysisResult = this.parseAnalysisResult(result.stdout);
          
        } else if (backendLanguage === 'golang') {
          // Golang分析
          console.log('🐹 使用Golang分析器...');
          analysisResult = await this.executeGolangAnalysis(repoPath, data);
          
        } else {
          throw new Error(`不支持的后端语言: ${backendLanguage}。目前支持Java和Golang。`);
        }
      }
      
      console.log('解析后的结果:', analysisResult);
      console.log('解析后结果数量:', Array.isArray(analysisResult) ? analysisResult.length : '非数组');
      
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
      console.error('分析失败:', error);
      
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

      // 发送检测结果给前端
      this._view?.webview.postMessage({
        command: 'projectTypeDetected',
        projectType: projectType,
        backendLanguage: backendLanguage,
        frontendPaths: frontendPaths
      });

    } catch (error) {
      console.error('项目类型检测失败:', error);
      
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
      } else if (goFeatures.detected) {
        backendLanguage = 'golang';
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
        console.warn('后端分析失败:', error);
      }

      // 执行前端分析
      try {
        console.log('🌐 执行前端分析...');
        const frontendResult = await this.executeFrontendAnalysis(repoPath, analysisData);
        results.push(...frontendResult.map(item => ({ ...item, analysisSource: 'frontend' })));
      } catch (error) {
        console.warn('前端分析失败:', error);
      }

      // 如果没有任何结果，抛出错误而不是创建虚假提交
      if (results.length === 0) {
        throw new Error('混合项目分析失败：未能成功分析前端或后端代码，请检查项目结构和分析器配置');
      }

      return results;

    } catch (error) {
      console.error('混合项目分析失败:', error);
      throw error;
    }
  }

  private async executeFrontendAnalysis(repoPath: string, analysisData: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // 前端分析器脚本路径 - 修复远程开发环境路径问题
      const analyzerPath = this.getAnalyzerPath('node-analyzer');
      
      // 确定要分析的目录
      let targetDir = repoPath;
      if (analysisData.frontendPath) {
        targetDir = path.join(repoPath, analysisData.frontendPath);
      }
      
      console.log('执行前端分析命令:', 'node', analyzerPath, targetDir);
      console.log('分析目录:', targetDir);

      // 检查分析器文件是否存在
      if (!fs.existsSync(analyzerPath)) {
        reject(new Error(`前端分析器文件不存在: ${analyzerPath}`));
        return;
      }

      // 执行前端分析器
      const child = execFile('node', [analyzerPath, targetDir, 'json'], {
        cwd: repoPath,
        timeout: 60000, // 60秒超时
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      }, (error, stdout, stderr) => {
      if (error) {
          console.error('前端分析器执行错误:', error);
          console.error('stderr:', stderr);
          reject(new Error(`前端分析失败: ${error.message}\n${stderr}`));
      } else {
          console.log('前端分析器执行成功');
          console.log('stderr信息:', stderr); // 显示调试信息
          
          try {
            const result = JSON.parse(stdout);
            console.log('前端分析结果:', result);
            
            // 转换为与后端分析结果兼容的格式
            const convertedResult = this.convertFrontendResult(result, targetDir);
            resolve(convertedResult);
            
          } catch (parseError) {
            console.error('前端分析结果JSON解析失败:', parseError);
            console.log('输出前500字符:', stdout.substring(0, 500));
            reject(new Error(`前端分析结果解析失败: ${parseError}`));
          }
        }
      });

      // 监听进程退出
      child.on('exit', (code) => {
        console.log(`前端分析器进程退出，代码: ${code}`);
      });
    });
  }

  private convertFrontendResult(frontendResult: any, targetDir: string): any[] {
    // 将前端分析结果转换为与后端分析结果兼容的格式
    // 不再人为分组，而是生成一个统一的分析结果
    const commits = [];
    
    if (frontendResult && frontendResult.files && frontendResult.files.length > 0) {
      // 创建单一的前端分析结果，包含所有文件
      const allMethods: string[] = [];
      const allFiles: any[] = [];
      let totalRiskScore = 0;
      
      frontendResult.files.forEach((file: any) => {
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
        
        // 累计风险评分
        totalRiskScore += Math.min(file.methods ? file.methods.length * 2 : 0, 20);
      });
      
      // 创建单一的前端分析提交记录
      commits.push({
        commitId: 'frontend_analysis',
        message: '前端代码分析结果',
        author: { name: '前端分析器', email: 'frontend@diffsense.com' },
        timestamp: frontendResult.timestamp || new Date().toISOString(),
        changedFilesCount: frontendResult.files.length,
        changedMethodsCount: allMethods.length,
        impactedMethods: allMethods,
        impactedFiles: allFiles,
        impactedTests: {},
        riskScore: Math.min(totalRiskScore, 100), // 限制最大风险评分为100
        language: 'frontend',
        analysisSource: 'frontend',
        frontendSummary: frontendResult.summary,
        frontendDependencies: frontendResult.dependencies
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
        impactedTests: {},
        riskScore: 0,
        language: 'frontend',
        analysisSource: 'frontend',
        frontendSummary: frontendResult.summary,
        frontendDependencies: frontendResult.dependencies
      });
    }
    
    return commits;
  }

  private async executeGolangAnalysis(repoPath: string, analysisData: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // Golang分析器脚本路径 - 修复远程开发环境路径问题
      const analyzerPath = this.getAnalyzerPath('golang-analyzer');
      
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
      // 创建单一的Golang分析结果，包含所有文件和包
      const allMethods: string[] = [];
      const allFiles: any[] = [];
      let totalRiskScore = 0;
      const packages = new Set<string>();
      
      golangResult.files.forEach((file: any) => {
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
        
        // 累计风险评分
        const exportedFunctions = file.functions ? file.functions.filter((f: any) => f.isExported).length : 0;
        const totalFunctions = file.functions ? file.functions.length : 0;
        totalRiskScore += Math.min(exportedFunctions * 3 + totalFunctions * 1, 30);
      });
      
      // 创建单一的Golang分析提交记录
      commits.push({
        commitId: 'golang_analysis',
        message: `Golang代码分析结果 (包含${packages.size}个包: ${Array.from(packages).join(', ')})`,
        author: { name: 'Golang分析器', email: 'golang@diffsense.com' },
        timestamp: golangResult.timestamp || new Date().toISOString(),
        changedFilesCount: golangResult.files.length,
        changedMethodsCount: allMethods.length,
        impactedMethods: allMethods,
        impactedFiles: allFiles,
        impactedTests: {},
        riskScore: Math.min(totalRiskScore, 100), // 限制最大风险评分为100
        language: 'golang',
        analysisSource: 'golang',
        packages: Array.from(packages),
        golangSummary: golangResult.summary,
        golangModules: golangResult.modules
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
        riskScore: 0,
        language: 'golang',
        analysisSource: 'golang',
        packages: [],
        golangSummary: golangResult.summary,
        golangModules: golangResult.modules
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
          console.error('JAR执行错误:', error);
          console.error('stderr:', stderr);
          reject(new Error(`JAR执行失败: ${error.message}\n${stderr}`));
        } else {
          console.log('JAR执行成功');
          console.log('stderr信息:', stderr); // 显示调试信息
          console.log('JSON输出长度:', stdout.length);
          console.log('=== JAR原始输出开始 ===');
          console.log(stdout);
          console.log('=== JAR原始输出结束 ===');
          
          // 尝试解析JSON以验证格式
          try {
            const parsed = JSON.parse(stdout);
            console.log('JSON解析成功，数据类型:', typeof parsed);
            console.log('是否为数组:', Array.isArray(parsed));
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
            overflow: hidden;
            font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
            color: var(--vscode-foreground) !important;
            background-color: var(--vscode-editor-background) !important;
            font-size: 12px;
          }
          
          #root {
            width: 100% !important;
            height: 100% !important;
            padding: 8px;
            overflow-y: auto;
            overflow-x: hidden;
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
      totalRiskScore: isEnglish ? 'Total Risk Score' : '总风险评分',
      averageRisk: isEnglish ? 'Average Risk Score' : '平均风险评分',
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
    const totalRiskScore = analysisResults.reduce((sum: number, commit: any) => 
      sum + (commit.riskScore || 0), 0);

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
                    <div class="stat-number">${totalRiskScore}</div>
                    <div class="stat-label">${text.totalRiskScore}</div>
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
                const commitRiskLevel = commit.riskScore >= 50 ? 'high' : commit.riskScore >= 20 ? 'medium' : 'low';
                const callGraphData = this.generateCallGraphData(commit, commit.files || []);
                
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
                            <span class="risk-score risk-${commitRiskLevel}">
                                ${commit.riskScore || 0}
                            </span>
                        </div>
                    </div>
                    <div class="commit-content">
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
                                        <div class="file-item">${file.path || file}</div>
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
    // 使用相对于插件根目录的路径
    const defaultPath = path.join(this._extensionUri.fsPath, 'analyzers', analyzerType);
    
    try {
      // 检查文件是否存在
      if (fs.existsSync(defaultPath)) {
        return defaultPath;
      }

      // 如果不存在，返回默认路径
      return defaultPath;
    } catch (error: any) {
      console.error('获取分析器路径失败:', error);
      return defaultPath;
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
      const { execFile } = require('child_process');
      
      // 收集基本Git信息
      const gitCommands = [
        ['git', ['rev-parse', 'HEAD'], 'currentCommit'],
        ['git', ['rev-parse', '--abbrev-ref', 'HEAD'], 'currentBranch'],
        ['git', ['remote', 'get-url', 'origin'], 'remoteUrl'],
        ['git', ['status', '--porcelain'], 'workingTreeStatus'],
        ['git', ['log', '--oneline', '-5'], 'recentCommits']
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
    const { projectType, analysisScope, backendLanguage } = reportData;
    const platform = systemInfo.platform;
    
    // 生成有意义的标题
    let title = '🐛 ';
    
    if (projectType && projectType !== 'unknown') {
      title += `${projectType}项目分析问题`;
      if (backendLanguage && backendLanguage !== 'unknown') {
        title += ` (${backendLanguage})`;
      }
    } else {
      title += 'DiffSense分析问题';
    }
    
    title += ` - ${platform}`;
    
    return title;
  }

  private generateIssueBody(data: any): string {
    const { reportData, systemInfo, gitInfo, workspacePath, workspaceName, recentErrors, timestamp } = data;
    
    const body = `
## 🐛 问题描述

**发生时间**: ${new Date(timestamp).toLocaleString('zh-CN')}
**报告来源**: DiffSense VSCode 扩展自动汇报

## 📊 用户环境信息

**项目信息**:
- 项目名称: ${workspaceName}
- 项目类型: ${reportData.projectType || '未知'}
- 后端语言: ${reportData.backendLanguage || '未知'}
- 分析范围: ${reportData.analysisScope || '未设置'}

**系统环境**:
- 操作系统: ${systemInfo.platform} ${systemInfo.arch}
- Node.js版本: ${systemInfo.nodeVersion}
- VSCode版本: ${systemInfo.vscodeVersion}
- 扩展版本: ${systemInfo.extensionVersion}
- 用户代理: ${reportData.userAgent || '未知'}

**Git信息**:
- 当前分支: ${gitInfo.currentBranch || '未知'}
- 当前提交: ${gitInfo.currentCommit || '未知'}
- 远程仓库: ${gitInfo.remoteUrl || '未知'}
- 工作区状态: ${gitInfo.workingTreeStatus || '干净'}

## 🔧 插件状态信息

**分析配置**:
- 选中分支: ${reportData.selectedBranch || '未选择'}
- 分析范围: ${reportData.selectedRange || '未设置'}
- 分析类型: ${reportData.analysisTypes?.join(', ') || '未选择'}
- 前端路径: ${reportData.frontendPath || '未设置'}
- 语言设置: ${reportData.currentLanguage || '未知'}

**时间信息**:
- 开始Commit: ${reportData.startCommitId || '未设置'}
- 结束Commit: ${reportData.endCommitId || '未设置'}
- 自定义开始日期: ${reportData.customDateFrom || '未设置'}
- 自定义结束日期: ${reportData.customDateTo || '未设置'}

**其他状态**:
- 可用分支数: ${reportData.branches || 0}

## 🚨 最近错误日志

${recentErrors.length > 0 ? 
  recentErrors.map((err: any, idx: number) => 
    `**错误 ${idx + 1}** (${new Date(err.timestamp).toLocaleString('zh-CN')}):
\`\`\`
${err.error}
\`\`\`
${err.context ? `上下文: ${err.context}` : ''}
`).join('\n') : 
  '无最近错误记录'}

## 📝 重现步骤

请描述您遇到问题时的操作步骤：
1. 
2. 
3. 

## 🎯 期望行为

请描述您期望的正确行为：

## 📸 截图（可选）

如果可能，请粘贴相关截图

## 💡 其他信息

请提供任何其他有用的信息：

---

> 此问题报告由DiffSense VSCode扩展自动生成。
> 如有隐私相关的信息，请在提交前进行编辑。
> 项目路径: \`${workspacePath}\`
`;

    return body;
  }

  private buildGitHubIssueUrl(repoUrl: string, title: string, body: string): string {
    // 构建GitHub Issue URL
    const encodedTitle = encodeURIComponent(title);
    const encodedBody = encodeURIComponent(body);
    
    // GitHub URL参数有长度限制，检查并截断
    const maxUrlLength = 8000; // GitHub的实际限制可能更小，但这是一个安全值
    let issueUrl = `${repoUrl}/issues/new?title=${encodedTitle}&body=${encodedBody}`;
    
    if (issueUrl.length > maxUrlLength) {
      console.warn('⚠️ GitHub Issue URL太长，将截断body内容');
      
      // 计算可用的body长度
      const baseUrl = `${repoUrl}/issues/new?title=${encodedTitle}&body=`;
      const availableLength = maxUrlLength - baseUrl.length - 100; // 保留100字符的缓冲
      
      // 截断body内容
      const truncatedBody = body.substring(0, availableLength) + '\n\n... (内容因长度限制被截断，请查看VSCode控制台获取完整信息)';
      issueUrl = baseUrl + encodeURIComponent(truncatedBody);
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

      const analyzerPath = this.getAnalyzerPath('node-analyzer');
      const mergeImpactPath = path.join(path.dirname(analyzerPath), 'mergeImpact.js');
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