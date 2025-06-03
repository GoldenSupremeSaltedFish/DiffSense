// 声明VSCode API类型
declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
      getState: () => any;
      setState: (state: any) => void;
    };
  }
}

const Toolbar = () => {
  const handleAnalyze = () => {
    // 获取VSCode API
    const vscode = window.acquireVsCodeApi?.();
    
    if (vscode) {
      // 向插件后端发送分析请求消息
      vscode.postMessage({
        command: 'analyze',
        data: {
          branch: 'master', // 这里可以从select获取实际值
          range: 'Last 3 commits' // 这里可以从select获取实际值
        }
      });
    } else {
      // 开发环境或测试环境的回退
      console.log("VSCode API not available");
      alert("VSCode API not available - running in dev mode");
    }
  };

  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
      <select>
        <option>master</option>
        <option>dev</option>
      </select>
      <select>
        <option>Last 3 commits</option>
        <option>Today</option>
        <option>Custom Range</option>
      </select>
      <button onClick={handleAnalyze}>Analyze</button>
    </div>
  );
};

export default Toolbar; 