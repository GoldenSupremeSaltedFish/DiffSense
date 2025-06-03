import * as vscode from 'vscode';
import * as path from 'path';
import { execFile, spawn } from 'child_process';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  // 注册命令：显示DiffSense面板
  const disposable = vscode.commands.registerCommand('diffsense.runAnalysis', () => {
    createDiffSensePanel(context);
  });

  context.subscriptions.push(disposable);
}

function createDiffSensePanel(context: vscode.ExtensionContext) {
  // 创建并显示Webview面板
  const panel = vscode.window.createWebviewPanel(
    'diffsense',
    'DiffSense Analysis',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true, // 保持状态
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'dist')),
        vscode.Uri.file(path.join(context.extensionPath, '..', 'ui', 'diffsense-frontend', 'dist'))
      ]
    }
  );

  // 设置Webview HTML内容
  panel.webview.html = getWebviewContent(context, panel.webview);

  // 处理从Webview发来的消息
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'analyze':
          await handleAnalysisRequest(panel, message.data);
          break;
        default:
          console.log('Unknown command:', message.command);
      }
    },
    undefined,
    context.subscriptions
  );
}

async function handleAnalysisRequest(panel: vscode.WebviewPanel, data: any) {
  try {
    // 发送开始分析消息
    panel.webview.postMessage({
      command: 'analysisStarted'
    });

    // 获取工作区路径
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('未找到工作区文件夹');
    }

    const repoPath = workspaceFolder.uri.fsPath;
    
    // 构建JAR文件路径 - 使用实际的JAR文件名
    const jarPath = path.resolve(__dirname, '../../target/gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar');
    
    // 检查JAR文件是否存在
    if (!fs.existsSync(jarPath)) {
      throw new Error(`JAR文件不存在: ${jarPath}`);
    }

    console.log(`正在分析仓库: ${repoPath}`);
    console.log(`使用JAR: ${jarPath}`);

    // 调用JAR进行分析
    const result = await executeJarAnalysis(jarPath, repoPath, data);
    
    // 解析结果并发送给前端
    const parsedResult = parseAnalysisResult(result);
    
    panel.webview.postMessage({
      command: 'analysisResult',
      data: parsedResult
    });

  } catch (error) {
    console.error('分析失败:', error);
    
    // 发送错误消息给前端
    panel.webview.postMessage({
      command: 'analysisError',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function executeJarAnalysis(jarPath: string, repoPath: string, analysisData: any): Promise<string> {
  return new Promise((resolve, reject) => {
    // 构建命令参数
    const args = ['-jar', jarPath, '--repo', repoPath];
    
    // 根据分析参数添加额外选项
    if (analysisData.branch && analysisData.branch !== 'master') {
      args.push('--branch', analysisData.branch);
    }
    
    if (analysisData.range) {
      // 根据range设置提交数量限制
      if (analysisData.range === 'Last 3 commits') {
        args.push('--limit', '3');
      } else if (analysisData.range === 'Today') {
        args.push('--since', 'today');
      }
    }

    console.log('执行命令:', 'java', args.join(' '));

    // 执行Java JAR
    const child = execFile('java', args, {
      timeout: 60000, // 60秒超时
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('JAR执行错误:', error);
        console.error('stderr:', stderr);
        reject(new Error(`JAR执行失败: ${error.message}\n${stderr}`));
      } else {
        console.log('JAR执行成功');
        resolve(stdout);
      }
    });

    // 监听进程退出
    child.on('exit', (code) => {
      console.log(`JAR进程退出，代码: ${code}`);
    });
  });
}

function parseAnalysisResult(rawOutput: string): any[] {
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
    // 如果不是JSON，尝试解析文本输出
    console.log('原始输出不是JSON，尝试解析文本:', rawOutput.substring(0, 200));
    
    // 这里可以添加自定义的文本解析逻辑
    // 暂时返回一个示例结果
    return [{
      id: 'analysis_result',
      message: '分析完成',
      files: [{
        path: 'output.txt',
        methods: ['parseAnalysisResult'],
        tests: ['分析输出: ' + rawOutput.substring(0, 100) + '...']
      }]
    }];
  }
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  // 获取前端构建的index.html文件路径
  const htmlPath = path.join(context.extensionPath, '..', 'ui', 'diffsense-frontend', 'dist', 'index.html');
  
  try {
    // 读取HTML文件
    let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // 获取资源URI基础路径
    const resourceRoot = vscode.Uri.file(path.join(context.extensionPath, '..', 'ui', 'diffsense-frontend', 'dist'));
    const resourceUri = webview.asWebviewUri(resourceRoot);
    
    // 替换相对路径为VSCode webview URI
    htmlContent = htmlContent.replace(
      /src="\/assets\//g, 
      `src="${resourceUri}/assets/`
    );
    htmlContent = htmlContent.replace(
      /href="\/assets\//g, 
      `href="${resourceUri}/assets/`
    );
    
    return htmlContent;
  } catch (error) {
    console.error('读取HTML文件失败:', error);
    
    // 返回fallback HTML
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DiffSense</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .error { color: red; background: #ffe6e6; padding: 10px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h3>⚠️ 前端资源加载失败</h3>
          <p>无法找到前端构建文件: ${htmlPath}</p>
          <p>请确保已经构建前端应用：</p>
          <pre>cd ui/diffsense-frontend && npm run build</pre>
        </div>
      </body>
      </html>
    `;
  }
}

export function deactivate() {
  // 清理资源
} 