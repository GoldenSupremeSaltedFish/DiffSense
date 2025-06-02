import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('diffsense.runAnalysis', () => {
    const jarPath = path.resolve(__dirname, '../../cli/target/diffsense.jar');
    const repoPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';

    execFile('java', ['-jar', jarPath, '--repo', repoPath], (error, stdout, stderr) => {
      const panel = vscode.window.createWebviewPanel(
        'diffsense',
        'DiffSense',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      const htmlPath = path.resolve(__dirname, '../../ui/diffsense-frontend/dist/index.html');
      panel.webview.html = fs.readFileSync(htmlPath, 'utf-8');
      
      if (error) {
        panel.webview.postMessage({ error: stderr });
      } else {
        panel.webview.postMessage({ result: stdout });
      }
    });
  });

  context.subscriptions.push(disposable);
} 