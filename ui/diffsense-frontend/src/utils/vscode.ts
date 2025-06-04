// 获取VSCode API
declare global {
  function acquireVsCodeApi(): any;
}

let vscode: any = null;

try {
  vscode = acquireVsCodeApi();
} catch (error) {
  console.log('VSCode API not available, using mock');
  // Mock API for development
  vscode = {
    postMessage: (message: any) => {
      console.log('Mock postMessage:', message);
    },
    getState: () => {
      const stored = localStorage.getItem('vscode-state');
      return stored ? JSON.parse(stored) : {};
    },
    setState: (state: any) => {
      localStorage.setItem('vscode-state', JSON.stringify(state));
    }
  };
}

// 发送消息到扩展
export const postMessage = (message: any) => {
  vscode.postMessage(message);
};

// 保存状态
export const saveState = (state: any) => {
  vscode.setState(state);
};

// 获取状态
export const getState = () => {
  return vscode.getState() || {};
}; 