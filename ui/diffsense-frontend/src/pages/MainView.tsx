import { useState, useEffect } from "react";
import Toolbar from "../components/Toolbar";
import CommitList from "../components/CommitList";
import { saveState, getState } from "../utils/vscode";

const MainView = () => {
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshotDiffs, setSnapshotDiffs] = useState<any[]>([]);

  // 组件挂载时恢复分析结果
  useEffect(() => {
    const savedState = getState();
    if (savedState.analysisResults) {
      console.log('🔄 恢复分析结果:', savedState.analysisResults);
      setAnalysisResults(savedState.analysisResults);
    }
    if (savedState.snapshotDiffs) {
      console.log('🔄 恢复快照对比结果:', savedState.snapshotDiffs);
      setSnapshotDiffs(savedState.snapshotDiffs);
    }
  }, []);

  // 保存分析结果到状态
  useEffect(() => {
    if (analysisResults.length > 0) {
      const currentState = getState();
      const newState = {
        ...currentState,
        analysisResults,
        snapshotDiffs
      };
      saveState(newState);
      console.log('💾 保存分析结果:', analysisResults);
    }
  }, [analysisResults, snapshotDiffs]);

  useEffect(() => {
    console.log('MainView mounted');
    
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('MainView received message:', message);
      
      switch (message.command) {
        case 'analysisStarted':
          setIsLoading(true);
          setError(null);
          break;
        case 'snapshotDiffResult':
          if (message.data) {
            setSnapshotDiffs(message.data.changes || message.data);
          }
          break;
        case 'analysisResult':
          setIsLoading(false);
          setError(null);
          if (message.data) {
            setAnalysisResults(message.data);
          }
          break;
        case 'analysisError':
          setIsLoading(false);
          setError(message.error || '分析失败');
          break;
        case 'restoredAnalysisResults':
          if (message.data) {
            setAnalysisResults(message.data);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div 
      className="main-view react-component" 
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        overflow: "hidden"
      }}
    >
      <div style={{ padding: "4px", fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
        🔍 DiffSense v1.0 - Debug Mode
      </div>
      <div style={{ padding: "4px", fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
        {isLoading ? '正在分析...' : error ? error : '分析完成'}
      </div>
      <Toolbar />
      <CommitList analysisResults={analysisResults} snapshotDiffs={snapshotDiffs} />
    </div>
  );
};

export default MainView; 