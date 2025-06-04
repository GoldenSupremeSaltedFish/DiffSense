import { useState, useEffect } from "react";
import { postMessage, saveState, getState } from "../utils/vscode";

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
  
  // 新增：分析范围和类型状态
  const [analysisScope, setAnalysisScope] = useState<'backend' | 'frontend' | 'mixed'>('backend');
  const [projectType, setProjectType] = useState<'backend' | 'frontend' | 'mixed' | 'unknown'>('unknown');
  const [backendLanguage, setBackendLanguage] = useState<'java' | 'golang' | 'unknown'>('unknown');
  const [analysisTypes, setAnalysisTypes] = useState<string[]>([]);
  const [frontendPath, setFrontendPath] = useState<string>('');
  
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

  // 分析类型选项
  const analysisOptions = {
    backend: [
      { id: 'classes', label: '📦 变更影响了哪些类？', description: '分析类级别的影响范围' },
      { id: 'methods', label: '⚙️ 变更影响了哪些方法？', description: '分析方法级别的影响范围' },
      { id: 'callChain', label: '🔗 方法调用链是怎样的？', description: '分析方法间的调用关系' }
    ],
    frontend: [
      { id: 'dependencies', label: '📁 哪些文件被哪些组件依赖？', description: '分析文件依赖关系' },
      { id: 'entryPoints', label: '🚪 哪些方法是入口触发？', description: '分析函数调用入口' },
      { id: 'uiImpact', label: '🎨 哪些UI会受影响？', description: '分析组件树级联影响' }
    ],
    mixed: [
      { id: 'fullStack', label: '🧩 全栈影响分析', description: '分析前后端交互影响' },
      { id: 'apiChanges', label: '🔌 API变更影响分析', description: '分析接口变更对前端的影响' },
      { id: 'dataFlow', label: '📊 数据流影响分析', description: '分析数据传递链路影响' }
    ]
  };

  // 组件挂载时恢复状态
  useEffect(() => {
    const savedState = getState();
    console.log('🔄 恢复保存的状态:', savedState);
    
    if (savedState.selectedBranch) {
      setSelectedBranch(savedState.selectedBranch);
    }
    if (savedState.selectedRange) {
      setSelectedRange(savedState.selectedRange);
    }
    if (savedState.analysisScope) {
      setAnalysisScope(savedState.analysisScope);
    }
    if (savedState.analysisTypes) {
      setAnalysisTypes(savedState.analysisTypes);
    }
    if (savedState.frontendPath) {
      setFrontendPath(savedState.frontendPath);
    }
    if (savedState.backendLanguage) {
      setBackendLanguage(savedState.backendLanguage);
    }
    if (savedState.startCommitId) {
      setStartCommitId(savedState.startCommitId);
    }
    if (savedState.endCommitId) {
      setEndCommitId(savedState.endCommitId);
    }
    if (savedState.customDateFrom) {
      setCustomDateFrom(savedState.customDateFrom);
    }
    if (savedState.customDateTo) {
      setCustomDateTo(savedState.customDateTo);
    }
    if (savedState.branches) {
      setBranches(savedState.branches);
    }

    // 请求最新的分支列表、分析结果和项目类型检测
    postMessage({ command: 'getBranches' });
    postMessage({ command: 'restoreAnalysisResults' });
    postMessage({ command: 'detectProjectType' });
  }, []);

  // 保存状态当状态发生变化时
  useEffect(() => {
    const currentState = {
      selectedBranch,
      selectedRange,
      analysisScope,
      analysisTypes,
      frontendPath,
      backendLanguage,
      startCommitId,
      endCommitId,
      customDateFrom,
      customDateTo,
      branches
    };
    
    saveState(currentState);
    console.log('💾 保存状态:', currentState);
  }, [selectedBranch, selectedRange, analysisScope, analysisTypes, frontendPath, backendLanguage, startCommitId, endCommitId, customDateFrom, customDateTo, branches]);

  // 当分析范围改变时，重置分析类型并设置默认值
  useEffect(() => {
    if (analysisScope && analysisOptions[analysisScope]) {
      const defaultTypes = analysisScope === 'backend' ? ['methods', 'callChain'] :
                          analysisScope === 'frontend' ? ['dependencies', 'entryPoints'] :
                          ['fullStack'];
      setAnalysisTypes(defaultTypes);
    }
  }, [analysisScope]);

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
        case 'projectTypeDetected':
          setProjectType(message.projectType);
          setBackendLanguage(message.backendLanguage || 'unknown');
          // 根据检测结果自动设置分析范围
          if (message.projectType !== 'unknown' && message.projectType !== 'mixed') {
            setAnalysisScope(message.projectType);
          }
          if (message.frontendPaths && message.frontendPaths.length > 0) {
            setFrontendPath(message.frontendPaths[0]); // 设置第一个前端路径作为默认值
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

    if (analysisTypes.length === 0) {
      alert('❌ 请至少选择一种分析类型');
      return;
    }

    // 构建分析数据
    const analysisData: any = {
      branch: selectedBranch,
      range: selectedRange,
      analysisType: analysisScope, // 新增：分析范围
      analysisOptions: analysisTypes, // 新增：具体分析类型
    };

    // 前端分析需要指定路径
    if (analysisScope === 'frontend' || analysisScope === 'mixed') {
      if (frontendPath) {
        analysisData.frontendPath = frontendPath;
      }
    }

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

  // 分析类型切换处理
  const handleAnalysisTypeToggle = (typeId: string) => {
    setAnalysisTypes(prev => {
      if (prev.includes(typeId)) {
        return prev.filter(id => id !== typeId);
      } else {
        return [...prev, typeId];
      }
    });
  };

  // 获取项目类型显示文本和颜色
  const getProjectTypeInfo = () => {
    switch (projectType) {
      case 'backend':
        const backendText = backendLanguage === 'java' ? '☕ Java后端项目' : 
                           backendLanguage === 'golang' ? '🐹 Golang后端项目' : 
                           '🔧 后端项目';
        return { text: backendText, color: '#4CAF50' };
      case 'frontend':
        return { text: '🌐 前端项目', color: '#2196F3' };
      case 'mixed':
        const mixedText = backendLanguage === 'java' ? '🧩 混合项目 (Java + 前端)' :
                         backendLanguage === 'golang' ? '🧩 混合项目 (Golang + 前端)' :
                         '🧩 混合项目';
        return { text: mixedText, color: '#FF9800' };
      default:
        return { text: '❓ 未知项目类型', color: '#757575' };
    }
  };

  const handleRefresh = () => {
    // 重新获取分支列表
    postMessage({
      command: 'getBranches'
    });
  };

  const isCustomRange = selectedRange === 'Custom Date Range';
  const isCommitRange = selectedRange === 'Commit ID Range';

  // 导出分析结果（支持格式选择）
  const handleExportJSON = () => {
    postMessage({
      command: 'exportResults',
      format: 'json'
    });
  };

  const handleExportHTML = () => {
    postMessage({
      command: 'exportResults', 
      format: 'html'
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
      {/* 项目类型检测信息 */}
      {projectType !== 'unknown' && (
        <div style={{
          padding: "6px 8px",
          backgroundColor: "var(--vscode-textBlockQuote-background)",
          border: `1px solid ${getProjectTypeInfo().color}`,
          borderRadius: "4px",
          fontSize: "10px",
          textAlign: "center"
        }}>
          <span style={{ color: getProjectTypeInfo().color, fontWeight: "600" }}>
            {getProjectTypeInfo().text}
          </span>
          {projectType === 'mixed' && (
            <div style={{ marginTop: "2px", fontSize: "9px", color: "var(--vscode-descriptionForeground)" }}>
              建议先选择分析范围
            </div>
          )}
        </div>
      )}

      {/* 第1层：分析范围选择 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <label style={{ fontSize: "10px", fontWeight: "600" }}>🎯 分析范围:</label>
        <div style={{ display: "flex", gap: "2px" }}>
          {[
            { value: 'backend', label: '🔧 后端', title: 'Java代码分析' },
            { value: 'frontend', label: '🌐 前端', title: 'TypeScript/React分析' },
            { value: 'mixed', label: '🧩 全部', title: '混合项目分析' }
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setAnalysisScope(option.value as any)}
              disabled={isAnalyzing}
              title={option.title}
              style={{
                flex: 1,
                padding: "4px 6px",
                fontSize: "9px",
                border: "1px solid var(--vscode-button-border)",
                borderRadius: "2px",
                backgroundColor: analysisScope === option.value ? 
                  'var(--vscode-button-background)' : 
                  'var(--vscode-button-secondaryBackground)',
                color: analysisScope === option.value ? 
                  'var(--vscode-button-foreground)' : 
                  'var(--vscode-button-secondaryForeground)',
                cursor: isAnalyzing ? 'not-allowed' : 'pointer'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 第2层：分析类型选择 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label style={{ fontSize: "10px", fontWeight: "600" }}>📋 分析类型:</label>
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "2px",
          maxHeight: "120px",
          overflowY: "auto"
        }}>
          {analysisOptions[analysisScope]?.map(option => (
            <label 
              key={option.id}
              style={{ 
                display: "flex", 
                alignItems: "flex-start", 
                gap: "6px",
                padding: "4px",
                cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                borderRadius: "2px",
                backgroundColor: analysisTypes.includes(option.id) ? 
                  'var(--vscode-list-activeSelectionBackground)' : 
                  'transparent'
              }}
            >
              <input
                type="checkbox"
                checked={analysisTypes.includes(option.id)}
                onChange={() => handleAnalysisTypeToggle(option.id)}
                disabled={isAnalyzing}
                style={{ marginTop: "1px" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "9px", fontWeight: "500" }}>
                  {option.label}
                </div>
                <div style={{ 
                  fontSize: "8px", 
                  color: "var(--vscode-descriptionForeground)",
                  lineHeight: "1.2"
                }}>
                  {option.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 前端路径输入（仅在前端或混合模式下显示） */}
      {(analysisScope === 'frontend' || analysisScope === 'mixed') && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <label style={{ fontSize: "10px", fontWeight: "600" }}>📁 前端代码路径:</label>
          <input
            type="text"
            placeholder="例: ui/frontend 或 src/main/webapp"
            value={frontendPath}
            onChange={(e) => setFrontendPath(e.target.value)}
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
          <div style={{ 
            fontSize: "8px", 
            color: "var(--vscode-descriptionForeground)" 
          }}>
            相对于项目根目录的路径，留空表示自动检测
          </div>
        </div>
      )}

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
        
        {/* 导出按钮组 */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          minWidth: '100px'
        }}>
          <button 
            onClick={handleExportJSON}
            style={{ 
              fontSize: '10px',
              padding: '4px 8px',
              backgroundColor: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
              borderRadius: '3px 3px 0 0',
              cursor: 'pointer',
              borderBottom: '1px solid var(--vscode-panel-border)'
            }}
          >
            📄 导出JSON
          </button>
          <button 
            onClick={handleExportHTML}
            style={{ 
              fontSize: '10px',
              padding: '4px 8px',
              backgroundColor: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
              borderRadius: '0 0 3px 3px',
              cursor: 'pointer'
            }}
          >
            🌐 导出HTML
          </button>
        </div>
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