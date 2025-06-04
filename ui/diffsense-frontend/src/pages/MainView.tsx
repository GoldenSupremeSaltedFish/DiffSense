import Toolbar from "../components/Toolbar";
import CommitList from "../components/CommitList";
import { useEffect } from "react";

const MainView = () => {
  useEffect(() => {
    console.log('MainView mounted');
    
    // 添加调试信息
    const logDimensions = () => {
      const mainDiv = document.querySelector('.main-view') as HTMLElement;
      if (mainDiv) {
        console.log('MainView dimensions:', {
          width: mainDiv.offsetWidth,
          height: mainDiv.offsetHeight,
          visible: mainDiv.offsetParent !== null,
          style: mainDiv.style.cssText
        });
      }
    };
    
    logDimensions();
    
    // 每秒检查一次，看是否消失
    const interval = setInterval(logDimensions, 1000);
    
    return () => {
      console.log('MainView unmounting');
      clearInterval(interval);
    };
  }, []);

  return (
    <div 
      className="main-view react-component"
      style={{ 
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sidebar-gap, 6px)",
        minHeight: "200px", // 确保有最小高度
        backgroundColor: "var(--vscode-editor-background, #fff)", // 添加背景色
        border: "1px solid var(--vscode-panel-border, #ccc)" // 调试边框
      }}
    >
      <div style={{ padding: "4px", fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
        🔍 DiffSense v1.0 - Debug Mode
      </div>
      <Toolbar />
      <CommitList />
    </div>
  );
};

export default MainView; 