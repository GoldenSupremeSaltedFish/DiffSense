import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 添加调试信息
console.log('main.tsx loaded');
console.log('DOM ready state:', document.readyState);

// 确保DOM完全加载
function initApp() {
  console.log('Initializing React app...');
  
  const rootElement = document.getElementById('root');
  console.log('Root element:', rootElement);
  
  if (!rootElement) {
    console.error('Root element not found!');
    // 创建root元素作为fallback
    const newRoot = document.createElement('div');
    newRoot.id = 'root';
    newRoot.style.width = '100%';
    newRoot.style.height = '100%';
    newRoot.style.border = '2px solid yellow';
    document.body.appendChild(newRoot);
    
    setTimeout(() => initApp(), 100);
    return;
  }

  try {
    console.log('Creating React root...');
    const root = createRoot(rootElement);
    
    console.log('Rendering App...');
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    
    console.log('React app rendered successfully');
    
    // 验证渲染结果
    setTimeout(() => {
      console.log('Root content after render:', rootElement.innerHTML.substring(0, 200));
      const reactComponents = document.querySelectorAll('.react-component');
      console.log('React components found:', reactComponents.length);
    }, 100);
    
  } catch (error) {
    console.error('React render error:', error);
    
    // Fallback: 显示错误信息
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red; border: 2px solid red;">
        <h3>React渲染失败</h3>
        <p>错误: ${error}</p>
        <p>尝试重新加载插件</p>
      </div>
    `;
  }
}

// 根据DOM状态决定何时初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM已经准备好了
  setTimeout(initApp, 0);
}
