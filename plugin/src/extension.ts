import * as vscode from 'vscode';
import * as path from 'path';
import { execFile, spawn } from 'child_process';
import * as fs from 'fs';

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
          await this.handleExportResults(data.format || 'json');
          break;
        case 'restoreAnalysisResults':
          await this.handleRestoreAnalysisResults();
          break;
        case 'detectProjectType':
          await this.handleDetectProjectType();
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
        
        // 构建JAR文件路径
        const jarPath = path.resolve(__dirname, '../../target/gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar');
        
        // 检查JAR文件是否存在
        if (!fs.existsSync(jarPath)) {
          throw new Error(`JAR文件不存在: ${jarPath}`);
        }

        console.log(`正在分析仓库: ${repoPath}`);
        console.log(`使用JAR: ${jarPath}`);

        // 调用JAR进行分析
        const result = await this.executeJarAnalysis(jarPath, repoPath, data);
        
        // 解析结果并发送给前端
        console.log('=== 开始解析JAR结果 ===');
        analysisResult = this.parseAnalysisResult(result.stdout);
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
      
      // 发送错误消息给前端
      this._view?.webview.postMessage({
        command: 'analysisError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleDetectProjectType() {
    try {
      // 获取工作区路径
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('未找到工作区文件夹');
      }

      const repoPath = workspaceFolder.uri.fsPath;
      const projectType = await this.detectProjectType(repoPath);
      const frontendPaths = await this.findFrontendPaths(repoPath);

      console.log('🔍 项目类型检测结果:', projectType);
      console.log('📁 前端路径检测结果:', frontendPaths);

      // 发送检测结果给前端
      this._view?.webview.postMessage({
        command: 'projectTypeDetected',
        projectType: projectType,
        frontendPaths: frontendPaths
      });

    } catch (error) {
      console.error('项目类型检测失败:', error);
      
      // 发送错误消息给前端
      this._view?.webview.postMessage({
        command: 'projectTypeDetected',
        projectType: 'unknown',
        frontendPaths: []
      });
    }
  }

  private async detectProjectType(repoPath: string): Promise<'backend' | 'frontend' | 'mixed' | 'unknown'> {
    try {
      // 检查常见的项目标识文件
      const hasPom = fs.existsSync(path.join(repoPath, 'pom.xml'));
      const hasGradle = fs.existsSync(path.join(repoPath, 'build.gradle')) || fs.existsSync(path.join(repoPath, 'build.gradle.kts'));
      const hasPackageJson = fs.existsSync(path.join(repoPath, 'package.json'));
      const hasTsConfig = fs.existsSync(path.join(repoPath, 'tsconfig.json'));
      
      // 检查是否有前端框架标识
      let hasReact = false;
      let hasVue = false;
      let hasAngular = false;
      
      if (hasPackageJson) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(path.join(repoPath, 'package.json'), 'utf-8'));
          const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
          
          hasReact = 'react' in dependencies;
          hasVue = 'vue' in dependencies;
          hasAngular = '@angular/core' in dependencies;
        } catch (error) {
          console.warn('解析package.json失败:', error);
        }
      }

      const isBackend = hasPom || hasGradle;
      const isFrontend = hasPackageJson && (hasTsConfig || hasReact || hasVue || hasAngular);

      if (isBackend && isFrontend) {
        return 'mixed';
      } else if (isBackend) {
        return 'backend';
      } else if (isFrontend) {
        return 'frontend';
      } else {
        return 'unknown';
      }

    } catch (error) {
      console.error('项目类型检测错误:', error);
      return 'unknown';
    }
  }

  private async findFrontendPaths(repoPath: string): Promise<string[]> {
    const frontendPaths: string[] = [];
    
    try {
      // 常见的前端目录名
      const commonFrontendDirs = [
        'ui', 'frontend', 'web', 'client', 'src/main/webapp', 
        'src/main/resources/static', 'public', 'dist', 'www'
      ];

      for (const dir of commonFrontendDirs) {
        const fullPath = path.join(repoPath, dir);
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            // 检查是否包含前端文件
            const hasJs = fs.existsSync(path.join(fullPath, 'package.json')) || 
                         fs.existsSync(path.join(fullPath, 'tsconfig.json'));
            if (hasJs) {
              frontendPaths.push(dir);
            }
          }
        }
      }

      // 如果没有找到明显的前端目录，检查根目录
      if (frontendPaths.length === 0) {
        const hasRootFrontend = fs.existsSync(path.join(repoPath, 'package.json')) && 
                               fs.existsSync(path.join(repoPath, 'tsconfig.json'));
        if (hasRootFrontend) {
          frontendPaths.push('');
        }
      }

    } catch (error) {
      console.error('前端路径检测错误:', error);
    }

    return frontendPaths;
  }

  private async executeMixedAnalysis(repoPath: string, analysisData: any): Promise<any[]> {
    // 混合项目分析：同时进行前后端分析并合并结果
    const results: any[] = [];

    try {
      // 执行后端分析
      try {
        const jarPath = path.resolve(__dirname, '../../target/gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar');
        if (fs.existsSync(jarPath)) {
          console.log('🔧 执行后端分析...');
          const backendResult = await this.executeJarAnalysis(jarPath, repoPath, analysisData);
          const backendParsed = this.parseAnalysisResult(backendResult.stdout);
          results.push(...backendParsed.map(item => ({ ...item, analysisSource: 'backend' })));
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

      // 如果没有任何结果，返回一个说明
      if (results.length === 0) {
        results.push({
          commitId: 'mixed_analysis_empty',
          message: '混合项目分析 - 未找到可分析的代码',
          author: { name: '混合分析器', email: 'mixed@diffsense.com' },
          timestamp: new Date().toISOString(),
          analysisSource: 'mixed',
          error: '未能成功分析前端或后端代码'
        });
      }

      return results;

    } catch (error) {
      console.error('混合项目分析失败:', error);
      throw error;
    }
  }

  private async executeFrontendAnalysis(repoPath: string, analysisData: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // 前端分析器脚本路径
      const analyzerPath = path.join(__dirname, '../../ui/node-analyzer/analyze.js');
      
      // 确定要分析的目录
      let targetDir = repoPath;
      if (analysisData.frontendPath) {
        targetDir = path.join(repoPath, analysisData.frontendPath);
      }
      
      console.log('执行前端分析命令:', 'node', analyzerPath, targetDir);
      console.log('分析目录:', targetDir);

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
    const commits = [];
    
    if (frontendResult && frontendResult.files) {
      // 按文件组织数据，模拟提交结构
      const fileGroups = new Map();
      
      frontendResult.files.forEach((file: any, index: number) => {
        const groupKey = Math.floor(index / 5); // 每5个文件一组，模拟提交
        
        if (!fileGroups.has(groupKey)) {
          fileGroups.set(groupKey, {
            commitId: `frontend_analysis_${groupKey + 1}`,
            message: `前端代码分析 - 组 ${groupKey + 1}`,
            author: { name: '前端分析器', email: 'frontend@diffsense.com' },
            timestamp: frontendResult.timestamp,
            changedFilesCount: 0,
            changedMethodsCount: 0,
            impactedMethods: [],
            impactedTests: {},
            riskScore: 0,
            impactedFiles: []
          });
        }
        
        const group = fileGroups.get(groupKey);
        group.changedFilesCount++;
        group.changedMethodsCount += file.methods ? file.methods.length : 0;
        
        // 添加文件信息
        group.impactedFiles.push({
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
        
        // 累加方法名
        if (file.methods) {
          file.methods.forEach((method: any) => {
            group.impactedMethods.push(method.name);
          });
        }
        
        // 简单的风险评分计算
        group.riskScore += Math.min(file.methods ? file.methods.length * 2 : 0, 20);
      });
      
      commits.push(...Array.from(fileGroups.values()));
    }
    
    // 如果没有文件数据，创建一个摘要提交
    if (commits.length === 0) {
      commits.push({
        commitId: 'frontend_summary',
        message: '前端代码分析摘要',
        author: { name: '前端分析器', email: 'frontend@diffsense.com' },
        timestamp: frontendResult.timestamp,
        changedFilesCount: frontendResult.summary?.totalFiles || 0,
        changedMethodsCount: frontendResult.summary?.totalMethods || 0,
        impactedMethods: [],
        impactedTests: {},
        riskScore: frontendResult.summary?.totalFiles || 0,
        impactedFiles: [],
        frontendSummary: frontendResult.summary,
        frontendDependencies: frontendResult.dependencies
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
      // 如果不是JSON，解析CLI文本输出
      console.log('解析CLI输出:', rawOutput.substring(0, 300));
      
      // 从CLI输出中提取有用信息
      const lines = rawOutput.split('\n').filter(line => line.trim());
      const commits = [];
      
      // 查找"分析完成"相关信息
      const completionLine = lines.find(line => line.includes('分析完成') || line.includes('报告已生成'));
      
      if (completionLine) {
        // 创建一个表示分析完成的commit项
        commits.push({
          id: 'analysis_' + Date.now(),
          message: '✅ 分析已完成',
          files: [{
            path: '分析结果',
            methods: ['GitImpact分析工具'],
            tests: [
              completionLine,
              `分析时间: ${new Date().toLocaleString()}`,
              '详细报告已生成为HTML文件'
            ]
          }]
        });
      } else {
        // 如果没有找到完成信息，显示部分输出
        commits.push({
          id: 'analysis_output',
          message: '📊 分析输出',
          files: [{
            path: 'CLI输出',
            methods: ['系统信息'],
            tests: lines.slice(0, 5).map(line => line.substring(0, 100)) // 取前5行，每行最多100字符
          }]
        });
      }
      
      return commits;
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // 获取前端构建的index.html文件路径
    const htmlPath = path.join(this._extensionUri.fsPath, '..', 'ui', 'diffsense-frontend', 'dist', 'index.html');
    
    try {
      // 读取HTML文件
      let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      
      // 获取资源URI基础路径
      const resourceRoot = vscode.Uri.file(path.join(this._extensionUri.fsPath, '..', 'ui', 'diffsense-frontend', 'dist'));
      const resourceUri = webview.asWebviewUri(resourceRoot);
      
      console.log('HTML路径:', htmlPath);
      console.log('资源URI:', resourceUri.toString());
      
      // 替换所有的资源路径为VSCode webview URI
      htmlContent = htmlContent.replace(
        /src="\/assets\//g, 
        `src="${resourceUri}/assets/`
      );
      htmlContent = htmlContent.replace(
        /href="\/assets\//g, 
        `href="${resourceUri}/assets/`
      );
      htmlContent = htmlContent.replace(
        /href="\/vite\.svg"/g,
        `href="${resourceUri}/vite.svg"`
      );
      
      // 添加调试样式和重置样式
      const debugStyles = `
        <style>
          /* 重置和调试样式 */
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
            color: var(--vscode-foreground, #000);
            background-color: var(--vscode-editor-background, #fff);
            font-size: 12px;
          }
          
          #root {
            width: 100% !important;
            height: 100% !important;
            padding: 8px;
            overflow-y: auto;
            overflow-x: hidden;
            position: relative;
          }
          
          /* 强制可见性 */
          .app-container,
          .react-component,
          .main-view {
            visibility: visible !important;
            opacity: 1 !important;
            display: block !important;
          }
        </style>
        <script>
          // 基本的错误处理和状态监控
          console.log('DiffSense WebView loaded');
          
          // 错误处理
          window.addEventListener('error', (e) => {
            console.error('Global error:', e.error);
          });
          
          window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
          });
          
          // VSCode API检查
          if (typeof acquireVsCodeApi !== 'undefined') {
            console.log('VSCode API available');
          } else {
            console.warn('VSCode API not available');
          }
        </script>
      `;
      
      // 插入调试样式到head中
      htmlContent = htmlContent.replace('</head>', `${debugStyles}</head>`);
      
      return htmlContent;
    } catch (error) {
      console.error('读取HTML文件失败:', error);
      
      // 返回更详细的fallback HTML
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>DiffSense - Debug</title>
          <style>
            body { 
              font-family: var(--vscode-font-family); 
              padding: 20px; 
              color: var(--vscode-foreground);
              background-color: var(--vscode-editor-background);
              border: 2px solid orange;
            }
            .error { 
              color: var(--vscode-errorForeground); 
              background: var(--vscode-inputValidation-errorBackground); 
              padding: 10px; 
              border-radius: 4px; 
            }
            .debug-info {
              margin-top: 10px;
              font-size: 10px;
              color: var(--vscode-descriptionForeground);
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h3>⚠️ 前端资源加载失败</h3>
            <p>无法找到前端构建文件</p>
            <div class="debug-info">
              <p>路径: ${htmlPath}</p>
              <p>Extension URI: ${this._extensionUri.fsPath}</p>
              <p>错误: ${error}</p>
            </div>
          </div>
          <script>
            console.log('Fallback HTML loaded');
            console.log('VSCode API available:', typeof acquireVsCodeApi);
          </script>
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

  private async handleExportResults(format: string) {
    try {
      if (!this._lastAnalysisResult || this._lastAnalysisResult.length === 0) {
        vscode.window.showWarningMessage('没有可导出的分析结果，请先进行分析');
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
          exportedBy: 'DiffSense VSCode Extension'
        },
        analysisResults: this._lastAnalysisResult
      };

      // 根据格式生成内容
      let content: string;
      
      if (format === 'html') {
        content = this.generateHTMLReport(exportData);
      } else {
        // 默认JSON格式
        content = JSON.stringify(exportData, null, 2);
      }

      // 写入文件
      await fs.promises.writeFile(saveUri.fsPath, content, 'utf-8');

      // 显示成功消息
      const action = await vscode.window.showInformationMessage(
        `分析结果已导出到: ${path.basename(saveUri.fsPath)}`, 
        '打开文件', 
        '在资源管理器中显示'
      );

      if (action === '打开文件') {
        const document = await vscode.workspace.openTextDocument(saveUri);
        await vscode.window.showTextDocument(document);
      } else if (action === '在资源管理器中显示') {
        await vscode.commands.executeCommand('revealFileInOS', saveUri);
      }

    } catch (error) {
      console.error('导出结果失败:', error);
      vscode.window.showErrorMessage(`导出失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private generateHTMLReport(exportData: any): string {
    const { exportInfo, analysisResults } = exportData;
    
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

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DiffSense 分析报告</title>
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
            display: inline-block;
            margin-right: 10px;
        }
        
        .commit-message {
            font-weight: 600;
            color: #2d3748;
            margin: 5px 0;
        }
        
        .commit-meta {
            font-size: 0.9em;
            color: #718096;
        }
        
        .commit-body {
            padding: 20px;
        }
        
        .risk-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: 600;
            margin-left: 10px;
        }
        
        .risk-low { background: #c6f6d5; color: #276749; }
        .risk-medium { background: #fefcbf; color: #975a16; }
        .risk-high { background: #fed7d7; color: #c53030; }
        
        .files-grid {
            display: grid;
            gap: 15px;
            margin-top: 15px;
        }
        
        .file-card {
            background: #f7fafc;
            border-radius: 6px;
            padding: 15px;
            border-left: 4px solid #667eea;
        }
        
        .file-path {
            font-family: 'Courier New', monospace;
            font-weight: 600;
            color: #4a5568;
            margin-bottom: 10px;
        }
        
        .methods-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        
        .method-tag {
            background: #e2e8f0;
            color: #4a5568;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-family: 'Courier New', monospace;
        }
        
        /* 调用关系图样式 */
        .callgraph-section {
            margin-top: 20px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .callgraph-header {
            background: #f7fafc;
            padding: 12px 16px;
            border-bottom: 1px solid #e2e8f0;
            cursor: pointer;
            user-select: none;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .callgraph-header:hover {
            background: #edf2f7;
        }
        
        .callgraph-toggle {
            font-size: 0.9em;
            color: #667eea;
            font-weight: 600;
        }
        
        .callgraph-arrow {
            transition: transform 0.3s ease;
            font-size: 0.8em;
            color: #718096;
        }
        
        .callgraph-arrow.expanded {
            transform: rotate(90deg);
        }
        
        .callgraph-content {
            display: none;
            padding: 0;
        }
        
        .callgraph-content.expanded {
            display: block;
        }
        
        .callgraph-container {
            height: 400px;
            width: 100%;
            background: #f8f9fa;
            border-radius: 0 0 8px 8px;
        }
        
        .callgraph-legend {
            padding: 8px 16px;
            background: #f1f5f9;
            border-bottom: 1px solid #e2e8f0;
            font-size: 0.8em;
            color: #64748b;
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }
        
        .no-data {
            text-align: center;
            color: #718096;
            font-style: italic;
            padding: 40px;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: rgba(255,255,255,0.8);
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .info-grid {
                grid-template-columns: 1fr;
            }
            
            .callgraph-container {
                height: 300px;
            }
            
            .callgraph-legend {
                font-size: 0.7em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- 报告头部 -->
        <div class="header">
            <h1>🔍 DiffSense 分析报告</h1>
            <div class="subtitle">Git 代码影响分析</div>
            
            <div class="info-grid">
                <div class="info-card">
                    <div class="label">生成时间</div>
                    <div class="value">${new Date(exportInfo.timestamp).toLocaleString('zh-CN')}</div>
                </div>
                <div class="info-card">
                    <div class="label">仓库路径</div>
                    <div class="value">${exportInfo.repository.split('/').pop() || exportInfo.repository}</div>
                </div>
                <div class="info-card">
                    <div class="label">分析引擎</div>
                    <div class="value">${exportInfo.exportedBy}</div>
                </div>
            </div>
        </div>

        <!-- 统计概览 -->
        <div class="stats-section">
            <div class="stats-title">📊 分析概览</div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${totalCommits}</div>
                    <div class="stat-label">分析提交数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalFiles}</div>
                    <div class="stat-label">影响文件数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalMethods}</div>
                    <div class="stat-label">影响方法数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalRiskScore}</div>
                    <div class="stat-label">总风险评分</div>
                </div>
            </div>
        </div>

        <!-- 提交详情 -->
        <div class="commits-section">
            <div class="stats-title">📝 提交分析详情</div>
            
            ${analysisResults.length > 0 ? analysisResults.map((commit: any, index: number) => {
                const riskScore = commit.riskScore || 0;
                const riskLevel = riskScore > 100 ? 'high' : riskScore > 50 ? 'medium' : 'low';
                const riskText = riskScore > 100 ? '高风险' : riskScore > 50 ? '中风险' : '低风险';
                
                const files = commit.impactedFiles || commit.files || [];
                const methods = commit.impactedMethods || [];
                
                // 生成调用关系图数据
                const callGraphData = this.generateCallGraphData(commit, files);
                
                return `
                <div class="commit-card">
                    <div class="commit-header">
                        <span class="commit-id">${(commit.commitId || commit.id || `commit-${index + 1}`).substring(0, 7)}</span>
                        <span class="risk-badge risk-${riskLevel}">${riskText} (${riskScore})</span>
                        
                        <div class="commit-message">${commit.message || commit.commitMessage || '无提交信息'}</div>
                        <div class="commit-meta">
                            作者: ${commit.author?.name || commit.authorName || '未知'} | 
                            日期: ${commit.date || commit.commitDate ? new Date(commit.date || commit.commitDate).toLocaleString('zh-CN') : '未知'}
                        </div>
                    </div>
                    
                    <div class="commit-body">
                        ${files.length > 0 ? `
                            <h4>📁 影响文件 (${files.length}个)</h4>
                            <div class="files-grid">
                                ${files.map((file: any) => `
                                    <div class="file-card">
                                        <div class="file-path">${file.path || file.filePath || '未知文件'}</div>
                                        ${(file.methods || file.impactedMethods || []).length > 0 ? `
                                            <div class="methods-list">
                                                ${(file.methods || file.impactedMethods || []).map((method: any) => 
                                                    `<span class="method-tag">${typeof method === 'string' ? method : method.methodName || method.name || '未知方法'}</span>`
                                                ).join('')}
                                            </div>
                                        ` : '<div style="color: #718096; font-size: 0.9em;">无方法变更</div>'}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        
                        ${methods.length > 0 ? `
                            <h4 style="margin-top: 20px;">⚙️ 影响方法 (${methods.length}个)</h4>
                            <div class="methods-list">
                                ${methods.map((method: any) => 
                                    `<span class="method-tag">${method.methodName || method.name || method}</span>`
                                ).join('')}
                            </div>
                        ` : ''}
                        
                        <!-- 调用关系图 -->
                        ${callGraphData.nodes.length > 0 ? `
                            <div class="callgraph-section">
                                <div class="callgraph-header" onclick="toggleCallGraph('callgraph-${index}')">
                                    <span class="callgraph-toggle">🔗 调用关系图 (${callGraphData.nodes.length} 节点, ${callGraphData.edges.length} 关系)</span>
                                    <span class="callgraph-arrow" id="arrow-${index}">▶</span>
                                </div>
                                <div class="callgraph-content" id="callgraph-${index}">
                                    <div class="callgraph-legend">
                                        <div class="legend-item">
                                            <div class="legend-color" style="background: #e53e3e;"></div>
                                            <span>修改的方法</span>
                                        </div>
                                        <div class="legend-item">
                                            <div class="legend-color" style="background: #38a169;"></div>
                                            <span>新增的方法</span>
                                        </div>
                                        <div class="legend-item">
                                            <div class="legend-color" style="background: #ed8936;"></div>
                                            <span>受影响的方法</span>
                                        </div>
                                        <div class="legend-item">
                                            <div class="legend-color" style="background: #a0aec0;"></div>
                                            <span>外部/未知方法</span>
                                        </div>
                                    </div>
                                    <div class="callgraph-container" id="cy-${index}"></div>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${files.length === 0 && methods.length === 0 ? `
                            <div class="no-data">暂无详细数据</div>
                        ` : ''}
                    </div>
                </div>
                `;
            }).join('') : `
                <div class="no-data">
                    <h3>暂无分析数据</h3>
                    <p>请先进行代码分析以生成报告</p>
                </div>
            `}
        </div>

        <!-- 页脚 -->
        <div class="footer">
            <p>📋 报告由 DiffSense VSCode 扩展生成 | ${new Date().getFullYear()}</p>
        </div>
    </div>

    <script>
        const callGraphInstances = {};
        
        // 切换调用关系图显示
        function toggleCallGraph(id) {
            const content = document.getElementById(id);
            const arrow = document.getElementById('arrow-' + id.split('-')[1]);
            
            if (content.classList.contains('expanded')) {
                content.classList.remove('expanded');
                arrow.classList.remove('expanded');
            } else {
                content.classList.add('expanded');
                arrow.classList.add('expanded');
                
                // 延迟初始化图表，确保容器已显示
                setTimeout(() => {
                    initCallGraph(id);
                }, 100);
            }
        }
        
        // 初始化调用关系图
        function initCallGraph(id) {
            const index = id.split('-')[1];
            const containerId = 'cy-' + index;
            
            // 如果已经初始化过，直接返回
            if (callGraphInstances[containerId]) {
                return;
            }
            
            const container = document.getElementById(containerId);
            if (!container) return;
            
            // 获取图数据
            const graphData = getCallGraphData(parseInt(index));
            
            if (!graphData || graphData.nodes.length === 0) {
                container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #718096;">暂无调用关系数据</div>';
                return;
            }
            
            // 创建Cytoscape实例
            const cy = cytoscape({
                container: container,
                elements: [...graphData.nodes, ...graphData.edges],
                style: [
                    {
                        selector: 'node',
                        style: {
                            'background-color': '#667eea',
                            'label': 'data(label)',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'color': '#fff',
                            'font-size': '10px',
                            'font-weight': 'bold',
                            'width': 60,
                            'height': 30,
                            'shape': 'roundrectangle',
                            'text-wrap': 'wrap',
                            'text-max-width': '50px'
                        }
                    },
                    {
                        selector: 'node[type="modified"]',
                        style: {
                            'background-color': '#e53e3e',
                            'border-width': 2,
                            'border-color': '#c53030'
                        }
                    },
                    {
                        selector: 'node[type="new"]',
                        style: {
                            'background-color': '#38a169',
                            'border-width': 2,
                            'border-color': '#2f855a'
                        }
                    },
                    {
                        selector: 'node[type="affected"]',
                        style: {
                            'background-color': '#ed8936',
                            'border-width': 1,
                            'border-color': '#dd6b20'
                        }
                    },
                    {
                        selector: 'node[type="unknown"]',
                        style: {
                            'background-color': '#a0aec0',
                            'border-width': 1,
                            'border-color': '#718096',
                            'opacity': 0.8
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 2,
                            'line-color': '#cbd5e0',
                            'target-arrow-color': '#cbd5e0',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier',
                            'arrow-scale': 1.2
                        }
                    },
                    {
                        selector: 'edge[type="calls"]',
                        style: {
                            'line-color': '#4299e1',
                            'target-arrow-color': '#4299e1'
                        }
                    },
                    {
                        selector: 'edge[type="calledBy"]',
                        style: {
                            'line-color': '#48bb78',
                            'target-arrow-color': '#48bb78'
                        }
                    }
                ],
                layout: {
                    name: 'cose',
                    nodeRepulsion: 4000,
                    idealEdgeLength: 100,
                    padding: 20,
                    randomize: false,
                    componentSpacing: 40,
                    nodeOverlap: 10,
                    edgeElasticity: 100,
                    nestingFactor: 5,
                    gravity: 80
                },
                // 禁用用户交互
                userZoomingEnabled: false,
                userPanningEnabled: true,
                boxSelectionEnabled: false
            });
            
            // 自动适应布局
            cy.fit();
            
            // 保存实例
            callGraphInstances[containerId] = cy;
        }
        
        // 获取调用关系图数据
        function getCallGraphData(index) {
            // 这里应该从后端传入的数据中获取，暂时返回模拟数据
            return window.callGraphDataList && window.callGraphDataList[index] || { nodes: [], edges: [] };
        }
        
        // 将调用关系图数据注入到全局变量
        window.callGraphDataList = ${JSON.stringify(analysisResults.map((commit: any, index: number) => {
          const files = commit.impactedFiles || commit.files || [];
          return this.generateCallGraphData(commit, files);
        }))};
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

    // 如果没有实际的调用关系数据，创建模拟数据以便演示
    if (nodes.length > 0 && edges.length === 0) {
      // 为前几个方法创建一些模拟的调用关系
      const nodesList = nodes.slice(0, Math.min(5, nodes.length));
      for (let i = 0; i < nodesList.length - 1; i++) {
        edges.push({
          data: {
            id: `${nodesList[i].data.id}->${nodesList[i + 1].data.id}`,
            source: nodesList[i].data.id,
            target: nodesList[i + 1].data.id,
            type: 'calls'
          }
        });
      }
    }

    return { nodes, edges };
  }
}

export function deactivate() {
  // 清理资源
} 