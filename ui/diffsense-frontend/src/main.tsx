import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// 添加调试信息
console.log('main.tsx loaded');
console.log('DOM ready state:', document.readyState);

// 检测并应用VSCode主题
function detectAndApplyTheme() {
  const computedStyle = getComputedStyle(document.documentElement);
  
  // 获取VSCode主题变量
  const foregroundColor = computedStyle.getPropertyValue('--vscode-foreground');
  const backgroundColor = computedStyle.getPropertyValue('--vscode-editor-background');
  
  // 如果VSCode变量不可用，尝试手动检测
  if (!foregroundColor && !backgroundColor) {
    console.warn('⚠️ VSCode主题变量不可用，使用fallback');
    // 添加一个标记类，以便CSS可以提供fallback样式
    document.documentElement.classList.add('vscode-theme-fallback');
  } else {
    document.documentElement.classList.remove('vscode-theme-fallback');
  }
  
  // 强制应用主题颜色
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --diffsense-foreground: var(--vscode-foreground) !important;
      --diffsense-background: var(--vscode-editor-background) !important;
      --diffsense-button-background: var(--vscode-button-background) !important;
      --diffsense-button-foreground: var(--vscode-button-foreground) !important;
      --diffsense-button-hover-background: var(--vscode-button-hoverBackground) !important;
      --diffsense-dropdown-background: var(--vscode-dropdown-background) !important;
      --diffsense-dropdown-foreground: var(--vscode-dropdown-foreground) !important;
      --diffsense-input-background: var(--vscode-input-background) !important;
      --diffsense-input-foreground: var(--vscode-input-foreground) !important;
      --diffsense-input-border: var(--vscode-input-border) !important;
    }
    
    body, #root {
      color: var(--diffsense-foreground) !important;
      background-color: var(--diffsense-background) !important;
    }
    
    .vscode-theme-fallback {
      --diffsense-foreground: #333333;
      --diffsense-background: #ffffff;
      --diffsense-button-background: #0969da;
      --diffsense-button-foreground: #ffffff;
      --diffsense-button-hover-background: #0550ae;
      --diffsense-dropdown-background: #ffffff;
      --diffsense-dropdown-foreground: #24292f;
      --diffsense-input-background: #ffffff;
      --diffsense-input-foreground: #24292f;
      --diffsense-input-border: #d1d9e0;
    }
  `;
  
  // 移除旧的样式（如果存在）
  const oldStyle = document.getElementById('vscode-theme-style');
  if (oldStyle) {
    oldStyle.remove();
  }
  
  // 添加新的样式
  style.id = 'vscode-theme-style';
  document.head.appendChild(style);
}

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
    document.body.appendChild(newRoot);
    
    setTimeout(() => initApp(), 100);
    return;
  }

  try {
    console.log('Creating React root...');
    const root = createRoot(rootElement);
    
    // 初始化主题
    detectAndApplyTheme();
    
    // 监听主题变化
    window.addEventListener('message', (event) => {
      if (event.data.type === 'vscode-theme-changed') {
        detectAndApplyTheme();
      }
    });
    
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
