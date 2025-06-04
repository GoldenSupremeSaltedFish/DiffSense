import { useState, useEffect } from "react";
import { postMessage } from "../utils/vscode";

// Mock类型，避免重复定义
type MockApi = {
  acquireVsCodeApi: () => {
    postMessage: (message: any) => void;
  };
};

declare global {
  interface Window extends MockApi {}
}

const Toolbar = () => {
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<string>('Last 3 commits');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Commit ID范围相关状态
  const [startCommitId, setStartCommitId] = useState<string>('');
  const [endCommitId, setEndCommitId] = useState<string>('');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');

  const ranges = [
    'Last 3 commits',
    'Last 5 commits', 
    'Last 10 commits',
    'Today',
    'This week',
    'Custom Date Range',
    'Commit ID Range'
  ];

  useEffect(() => {
    // 监听来自扩展的消息
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case 'branchesLoaded':
          setBranches(message.branches);
          if (message.branches.length > 0 && !selectedBranch) {
            setSelectedBranch(message.branches[0]);
          }
          break;
        case 'analysisStarted':
          setIsAnalyzing(true);
          break;
        case 'analysisResult':
        case 'analysisError':
          setIsAnalyzing(false);
          break;
        case 'commitValidationResult':
          // 处理Commit ID验证结果
          if (message.valid) {
            console.log('✅ Commit ID验证成功');
          } else {
            alert(`❌ Commit ID验证失败: ${message.error}`);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedBranch]);

  const validateCommitIds = () => {
    if (selectedRange === 'Commit ID Range' && startCommitId && endCommitId) {
      postMessage({
        command: 'validateCommitIds',
        data: {
          branch: selectedBranch,
          startCommit: startCommitId,
          endCommit: endCommitId
        }
      });
    }
  };

  const handleAnalyze = () => {
    if (!selectedBranch) {
      alert('❌ 请选择分支');
      return;
    }

    // 构建分析数据
    const analysisData: any = {
      branch: selectedBranch,
      range: selectedRange
    };

    // 根据选择的范围类型添加额外参数
    if (selectedRange === 'Commit ID Range') {
      if (!startCommitId || !endCommitId) {
        alert('❌ 请输入起始和结束Commit ID');
        return;
      }
      analysisData.startCommit = startCommitId;
      analysisData.endCommit = endCommitId;
    } else if (selectedRange === 'Custom Date Range') {
      if (!customDateFrom) {
        alert('❌ 请选择开始日期');
        return;
      }
      analysisData.dateFrom = customDateFrom;
      analysisData.dateTo = customDateTo; // 可选
    }

    setIsAnalyzing(true);
    
    // 使用新的postMessage函数
    postMessage({
      command: 'analyze',
      data: analysisData
    });
  };

  const handleRefresh = () => {
    // 重新获取分支列表
    postMessage({
      command: 'getBranches'
    });
  };

  const isCustomRange = selectedRange === 'Custom Date Range';
  const isCommitRange = selectedRange === 'Commit ID Range';

  // 导出分析结果为JSON文件
  const handleExportResults = () => {
    postMessage({
      command: 'exportResults'
    });
  };

  return (
    <div className="toolbar-container react-component" style={{
      display: "flex",
      flexDirection: "column",
      gap: "var(--sidebar-gap)",
      padding: "var(--sidebar-padding)",
      borderBottom: "1px solid var(--vscode-panel-border, #ccc)"
    }}>
      {/* 分支选择 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <label style={{ fontSize: "10px", fontWeight: "600" }}>Git分支:</label>
        <div style={{ display: "flex", gap: "4px" }}>
          <select 
            value={selectedBranch} 
            onChange={(e) => setSelectedBranch(e.target.value)}
            disabled={isAnalyzing}
            style={{ flex: 1 }}
          >
            <option value="">选择分支...</option>
            {branches.map(branch => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
          <button 
            onClick={handleRefresh}
            disabled={isAnalyzing}
            style={{ 
              padding: "2px 6px", 
              fontSize: "10px",
              minWidth: "40px"
            }}
            title="刷新分支列表"
          >
            🔄
          </button>
        </div>
      </div>

      {/* 分析范围 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <label style={{ fontSize: "10px", fontWeight: "600" }}>分析范围:</label>
        <select 
          value={selectedRange} 
          onChange={(e) => setSelectedRange(e.target.value)}
          disabled={isAnalyzing}
        >
          {ranges.map(range => (
            <option key={range} value={range}>{range}</option>
          ))}
        </select>
      </div>

      {/* Commit ID 范围输入 */}
      {isCommitRange && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "10px", fontWeight: "600" }}>Commit ID范围:</label>
          <input
            type="text"
            placeholder="起始Commit ID (例: abc1234)"
            value={startCommitId}
            onChange={(e) => setStartCommitId(e.target.value)}
            disabled={isAnalyzing}
            style={{
              padding: "4px",
              fontSize: "10px",
              border: "1px solid var(--vscode-input-border)",
              backgroundColor: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              borderRadius: "2px"
            }}
          />
          <input
            type="text"
            placeholder="结束Commit ID (例: def5678)"
            value={endCommitId}
            onChange={(e) => setEndCommitId(e.target.value)}
            disabled={isAnalyzing}
            style={{
              padding: "4px",
              fontSize: "10px",
              border: "1px solid var(--vscode-input-border)",
              backgroundColor: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              borderRadius: "2px"
            }}
          />
          <button
            onClick={validateCommitIds}
            disabled={isAnalyzing || !startCommitId || !endCommitId}
            style={{
              padding: "2px 4px",
              fontSize: "9px",
              backgroundColor: "var(--vscode-button-secondaryBackground)",
              color: "var(--vscode-button-secondaryForeground)"
            }}
          >
            🔍 验证Commit ID
          </button>
        </div>
      )}

      {/* 自定义日期范围输入 */}
      {isCustomRange && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "10px", fontWeight: "600" }}>日期范围:</label>
          <input
            type="date"
            value={customDateFrom}
            onChange={(e) => setCustomDateFrom(e.target.value)}
            disabled={isAnalyzing}
            style={{
              padding: "4px",
              fontSize: "10px",
              border: "1px solid var(--vscode-input-border)",
              backgroundColor: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              borderRadius: "2px"
            }}
          />
          <input
            type="date"
            placeholder="结束日期（可选）"
            value={customDateTo}
            onChange={(e) => setCustomDateTo(e.target.value)}
            disabled={isAnalyzing}
            style={{
              padding: "4px",
              fontSize: "10px",
              border: "1px solid var(--vscode-input-border)",
              backgroundColor: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              borderRadius: "2px"
            }}
          />
        </div>
      )}

      {/* 分析按钮和导出按钮 */}
      <div style={{ 
        display: 'flex', 
        gap: '8px',
        marginTop: '12px'
      }}>
        <button 
          onClick={handleAnalyze}
          disabled={!selectedBranch || isAnalyzing}
          style={{ 
            flex: 1,
            fontSize: '11px',
            padding: '6px 8px',
            backgroundColor: isAnalyzing ? 
              'var(--vscode-button-secondaryBackground)' : 
              'var(--vscode-button-background)',
            color: isAnalyzing ? 
              'var(--vscode-button-secondaryForeground)' : 
              'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '3px',
            cursor: isAnalyzing ? 'not-allowed' : 'pointer'
          }}
        >
          {isAnalyzing ? '🔄 分析中...' : '🚀 开始分析'}
        </button>
        
        <button 
          onClick={handleExportResults}
          style={{ 
            fontSize: '11px',
            padding: '6px 8px',
            backgroundColor: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            minWidth: '80px'
          }}
        >
          📁 导出结果
        </button>
      </div>

      {/* 状态信息 */}
      {branches.length === 0 && (
        <div style={{ 
          fontSize: "9px", 
          color: "var(--vscode-descriptionForeground)",
          textAlign: "center",
          padding: "4px"
        }}>
          正在加载分支列表...
        </div>
      )}
    </div>
  );
};

export default Toolbar; 