import { useState, useEffect } from "react";
import Toolbar from "../components/Toolbar";
import HotspotAnalysis from "../components/HotspotAnalysis";
import CommitList from "../components/CommitList";
import { saveState, getState, postMessage } from "../utils/vscode";
import ProductModeView from "./ProductModeView";
import { transformToViewModel } from "../utils/productModeTransformer";

const MainView = () => {
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshotDiffs, setSnapshotDiffs] = useState<any[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isAnalyzingProject, setIsAnalyzingProject] = useState(true);
  const [hotspotResults, setHotspotResults] = useState<any>(null);
  const [hasHotspotAnalyzed, setHasHotspotAnalyzed] = useState(false);
  
  // Product Mode State
  const [viewMode, setViewMode] = useState<'product' | 'expert'>('product');
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');

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
    if (savedState.viewMode) {
      setViewMode(savedState.viewMode);
    }
  }, []);

  // 保存分析结果到状态
  useEffect(() => {
    const currentState = getState();
    const newState = {
      ...currentState,
      viewMode, // Persist view mode
      ...(analysisResults.length > 0 ? { analysisResults, snapshotDiffs } : {})
    };
    saveState(newState);
  }, [analysisResults, snapshotDiffs, viewMode]);

  useEffect(() => {
    console.log('MainView mounted');
    
    // Initial fetch for branches to support Product Mode
    postMessage({ command: 'getBranches' });
    
    // Restore analysis results and project status
    postMessage({ command: 'restoreAnalysisResults' });
    
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('MainView received message:', message);
      
      switch (message.command) {
        case 'branchesLoaded':
          if (message.branches && message.branches.length > 0) {
            setBranches(message.branches);
            setCurrentBranch(message.branches[0]);
          }
          break;
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
            // 确保状态重置
            setIsLoading(false);
            setIsAnalyzingProject(false);
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

  const handleProductModeAnalyze = () => {
    if (!currentBranch) {
      // Try to fetch branches again if missing
      postMessage({ command: 'getBranches' });
      // Show temporary message or just wait? 
      // Ideally we should wait for branch, but for now let's just alert if missing
      alert('Loading branches... please try again in a second.');
      return;
    }

    const analysisData = {
      branch: currentBranch,
      range: 'Last 5 commits', // Fixed default
      analysisType: 'mixed',   // Fixed default
      analysisOptions: ['fullStack'], // Fixed default
      analysisMode: 'quick',   // Fixed default
      language: 'en' // Default to en or detect? Toolbar uses 'useLanguage'. We'll default to en for now or 'zh-CN' if user prefers? 
                     // The prompt text is in Chinese, so maybe 'zh-CN' is safer if that's the primary audience?
                     // Actually, let's just stick to 'en' or pass undefined to let backend decide?
                     // Toolbar defaults to browser language. 
                     // I'll leave it as 'en' or maybe add language detection later.
    };

    setIsLoading(true);
    postMessage({
      command: 'analyze',
      data: analysisData
    });
  };

  if (viewMode === 'product') {
    const viewModel = transformToViewModel(analysisResults);
    return (
      <ProductModeView 
        model={viewModel}
        onSwitchToExpert={() => setViewMode('expert')}
        onAnalyze={handleProductModeAnalyze}
        isAnalyzing={isLoading || isAnalyzingProject}
        branches={branches}
        initialBranch={currentBranch}
        onExport={(format) => {
          postMessage({
            command: 'exportResults',
            format: format,
            language: 'zh-CN' // Product mode defaults to Chinese as per UI
          });
        }}
      />
    );
  }

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
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: "4px", 
        backgroundColor: 'var(--vscode-editor-background)',
        borderBottom: '1px solid var(--vscode-panel-border)'
      }}>
        <div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
          🔍 DiffSense v1.0 - Expert Mode
        </div>
        <button 
          onClick={() => setViewMode('product')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--vscode-textLink-foreground)',
            fontSize: '10px',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          Switch to Product Mode
        </button>
      </div>
      {(isAnalyzingProject || isLoading) && (
        <div style={{ padding: "4px", fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
          {isAnalyzingProject ? '正在分析项目...' : '正在分析...'}
        </div>
      )}
      <Toolbar />
      {hasHotspotAnalyzed && hotspotResults && (
        <div style={{ padding: "4px" }}>
          <HotspotAnalysis results={hotspotResults} isLoading={isLoading} error={error || undefined} />
        </div>
      )}
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
