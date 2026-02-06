// 获取VSCode API
declare global {
  function acquireVsCodeApi(): any;
  interface Window {
    vscode?: any;
    acquireVsCodeApi?: () => any;
  }
}

let vscode: any = null;

// ✅ 尝试多种方式获取 VSCode API
try {
  // 方式1: 直接调用全局函数
  if (typeof acquireVsCodeApi === 'function') {
    vscode = acquireVsCodeApi();
    console.log('[VSCode Utils] ✅ 通过全局函数获取 VSCode API');
  }
  // 方式2: 从 window.vscode 获取
  else if (window.vscode) {
    vscode = window.vscode;
    console.log('[VSCode Utils] ✅ 通过 window.vscode 获取 VSCode API');
  }
  // 方式3: 从 window.acquireVsCodeApi 获取
  else if (window.acquireVsCodeApi && typeof window.acquireVsCodeApi === 'function') {
    vscode = window.acquireVsCodeApi();
    console.log('[VSCode Utils] ✅ 通过 window.acquireVsCodeApi 获取 VSCode API');
  }
  else {
    throw new Error('无法找到 VSCode API');
  }
} catch (error) {
  console.error('[VSCode Utils] ❌ VSCode API 不可用，使用 Mock:', error);
  // Mock API for development
  vscode = {
    postMessage: (message: any) => {
      console.warn('[VSCode Utils] Mock postMessage:', message);
      console.warn('[VSCode Utils] ⚠️  这是 Mock API，消息不会发送到扩展');
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
  console.log('[VSCode Utils] 准备发送消息:', message);
  console.log('[VSCode Utils] VSCode 对象:', vscode);
  
  if (!vscode) {
    console.error('[VSCode Utils] ❌ VSCode API 未初始化');
    return;
  }
  
  if (!vscode.postMessage) {
    console.error('[VSCode Utils] ❌ VSCode API 没有 postMessage 方法');
    return;
  }
  
  try {
    vscode.postMessage(message);
    console.log('[VSCode Utils] ✅ 消息已发送');
  } catch (error) {
    console.error('[VSCode Utils] ❌ 发送消息失败:', error);
  }
};

// 保存状态
export const saveState = (state: any) => {
  vscode.setState(state);
};

// 获取状态
export const getState = () => {
  return vscode.getState() || {};
}; 