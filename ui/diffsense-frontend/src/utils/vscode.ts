// VSCode API 单例
let vscodeApi: any = null;

// 获取VSCode API实例（只获取一次）
export function getVSCodeApi() {
  if (!vscodeApi) {
    if (typeof window !== 'undefined' && (window as any).acquireVsCodeApi) {
      try {
        vscodeApi = (window as any).acquireVsCodeApi();
        console.log('✅ VSCode API acquired successfully');
      } catch (error) {
        console.error('❌ Failed to acquire VSCode API:', error);
        // 创建一个mock API用于开发测试
        vscodeApi = createMockApi();
      }
    } else {
      console.warn('⚠️ VSCode API not available, using mock');
      // 开发环境mock
      vscodeApi = createMockApi();
    }
  }
  
  return vscodeApi;
}

function createMockApi() {
  return {
    postMessage: (message: any) => {
      console.log('🔄 Mock postMessage:', message);
    },
    getState: () => ({}),
    setState: (state: any) => {
      console.log('💾 Mock setState:', state);
    }
  };
}

// 发送消息到VSCode
export function postMessage(message: any) {
  const api = getVSCodeApi();
  api.postMessage(message);
} 