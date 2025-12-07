import { useState, useEffect } from "react";
import Toolbar from "../components/Toolbar";
import CommitList from "../components/CommitList";
import { saveState, getState } from "../utils/vscode";

const MainView = () => {
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshotDiffs, setSnapshotDiffs] = useState<any[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isAnalyzingProject, setIsAnalyzingProject] = useState(true);
  const [hotspotResults, setHotspotResults] = useState<any>(null);
  const [hasHotspotAnalyzed, setHasHotspotAnalyzed] = useState(false);

  // 组件挂载时恢复分析结果
  useEffect(() => {
    const savedState = getState();
    if (savedState.analysisResults) {
      console.log('🔄 恢复分析结果:', savedState.analysisResults);
      setAnalysisResults(savedState.analysisResults);
      setHasAnalyzed(true);
    }
    if (savedState.snapshotDiffs) {
      console.log('🔄 恢复快照对比结果:', savedState.snapshotDiffs);
      setSnapshotDiffs(savedState.snapshotDiffs);
    }
    if (savedState.hotspotResults) {
      console.log('🔄 恢复热点分析结果:', savedState.hotspotResults);
      setHotspotResults(savedState.hotspotResults);
      setHasHotspotAnalyzed(true);
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
        case 'projectAnalysisStarted':
          setIsAnalyzingProject(true);
          break;
        case 'projectAnalysisCompleted':
          setIsAnalyzingProject(false);
          break;
        case 'analysisStarted':
          setIsLoading(true);
          setError(null);
          setHasAnalyzed(false);
          break;
        case 'snapshotDiffResult':
          if (message.data) {
            setSnapshotDiffs(message.data.changes || message.data);
          }
          break;
        case 'analysisResult':
          setIsLoading(false);
          setError(null);
          setHasAnalyzed(true);
          if (message.data) {
            setAnalysisResults(message.data);
          }
          break;
        case 'analysisError':
          setIsLoading(false);
          setError(message.error || '分析失败');
          setHasAnalyzed(true);
          break;
        case 'restoredAnalysisResults':
          if (message.data) {
            setAnalysisResults(message.data);
            setHasAnalyzed(true);
          }
          break;
        case 'hotspotAnalysisResult':
          setIsLoading(false);
          setError(null);
          if (message.data) {
            setHotspotResults(message.data);
            setHasHotspotAnalyzed(true);
            // 保存热点分析结果
            const currentState = getState();
            const newState = {
              ...currentState,
              hotspotResults: message.data
            };
            saveState(newState);
            console.log('💾 保存热点分析结果:', message.data);
          }
          break;
        case 'hotspotAnalysisError':
          setIsLoading(false);
          setError(message.error || '热点分析失败');
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
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "0"
      }}
    >
      <div style={{ padding: "4px", fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
        🔍 DiffSense v1.0 - Debug Mode
      </div>
      {(isAnalyzingProject || isLoading) && (
        <div style={{ padding: "4px", fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
          {isAnalyzingProject ? '正在分析项目...' : '正在分析...'}
        </div>
      )}
      <Toolbar />
      <CommitList 
        analysisResults={analysisResults} 
        snapshotDiffs={snapshotDiffs} 
        error={error}
        hasAnalyzed={hasAnalyzed}
      />
    </div>
  );
};

export default MainView; 
