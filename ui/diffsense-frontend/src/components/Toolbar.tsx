import { useState, useEffect } from "react";
import { postMessage, saveState, getState } from "../utils/vscode";
import { useLanguage } from "../hooks/useLanguage";

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
  const { currentLanguage, changeLanguage, t, supportedLanguages } = useLanguage();
  
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

  // 分析类型选项（使用国际化）
  const analysisOptions = {
    backend: [
      { id: 'classes', label: t('toolbar.classes'), description: t('toolbar.classesDesc') },
      { id: 'methods', label: t('toolbar.methods'), description: t('toolbar.methodsDesc') },
      { id: 'callChain', label: t('toolbar.callChain'), description: t('toolbar.callChainDesc') }
    ],
    frontend: [
      { id: 'dependencies', label: t('toolbar.dependencies'), description: t('toolbar.dependenciesDesc') },
      { id: 'entryPoints', label: t('toolbar.entryPoints'), description: t('toolbar.entryPointsDesc') },
      { id: 'uiImpact', label: t('toolbar.uiImpact'), description: t('toolbar.uiImpactDesc') }
    ],
    mixed: [
      { id: 'fullStack', label: t('toolbar.fullStack'), description: t('toolbar.fullStackDesc') },
      { id: 'apiChanges', label: t('toolbar.apiChanges'), description: t('toolbar.apiChangesDesc') },
      { id: 'dataFlow', label: t('toolbar.dataFlow'), description: t('toolbar.dataFlowDesc') }
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
            console.log(t('messages.commitValidationSuccess'));
          } else {
            alert(`${t('messages.commitValidationFailed')}${message.error}`);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedBranch, t]);

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
      alert(t('messages.selectBranchError'));
      return;
    }

    if (analysisTypes.length === 0) {
      alert(t('messages.selectAnalysisTypeError'));
      return;
    }

    // 构建分析数据
    const analysisData: any = {
      branch: selectedBranch,
      range: selectedRange,
      analysisType: analysisScope, // 新增：分析范围
      analysisOptions: analysisTypes, // 新增：具体分析类型
      language: currentLanguage, // 传递当前语言
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
        alert(t('messages.enterCommitIdsError'));
        return;
      }
      analysisData.startCommit = startCommitId;
      analysisData.endCommit = endCommitId;
    } else if (selectedRange === 'Custom Date Range') {
      if (!customDateFrom) {
        alert(t('messages.selectStartDateError'));
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

  // 获取项目类型显示文本和颜色（使用国际化）
  const getProjectTypeInfo = () => {
    switch (projectType) {
      case 'backend':
        const backendText = backendLanguage === 'java' ? t('projectTypes.javaBackend') : 
                           backendLanguage === 'golang' ? t('projectTypes.golangBackend') : 
                           t('projectTypes.backend');
        return { text: backendText, color: '#4CAF50' };
      case 'frontend':
        return { text: t('projectTypes.frontend'), color: '#2196F3' };
      case 'mixed':
        const mixedText = backendLanguage === 'java' ? t('projectTypes.mixedJava') :
                         backendLanguage === 'golang' ? t('projectTypes.mixedGolang') :
                         t('projectTypes.mixed');
        return { text: mixedText, color: '#FF9800' };
      default:
        return { text: t('projectTypes.unknown'), color: '#757575' };
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
      format: 'json',
      language: currentLanguage
    });
  };

  const handleExportHTML = () => {
    postMessage({
      command: 'exportResults', 
      format: 'html',
      language: currentLanguage
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
      {/* 语言切换器 */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "4px 8px",
        backgroundColor: "var(--vscode-textBlockQuote-background)",
        borderRadius: "4px",
        fontSize: "10px"
      }}>
        <span style={{ fontWeight: "600", color: "var(--vscode-foreground)" }}>
          🌐
        </span>
        <select
          value={currentLanguage}
          onChange={(e) => changeLanguage(e.target.value as any)}
          style={{
            flex: 1,
            marginLeft: "6px",
            padding: "2px 4px",
            fontSize: "9px",
            border: "1px solid var(--vscode-button-border)",
            borderRadius: "2px",
            backgroundColor: "var(--vscode-button-secondaryBackground)",
            color: "var(--vscode-button-secondaryForeground)"
          }}
        >
          {supportedLanguages.map(lang => (
            <option key={lang} value={lang}>
              {lang === 'zh-CN' ? '中文' : 'English'}
            </option>
          ))}
        </select>
      </div>

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
              {currentLanguage === 'zh-CN' ? '建议先选择分析范围' : 'Please select analysis scope first'}
            </div>
          )}
        </div>
      )}

      {/* 第1层：分析范围选择 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <label style={{ fontSize: "10px", fontWeight: "600" }}>{t('toolbar.analysisScope')}</label>
        <div style={{ display: "flex", gap: "2px" }}>
          {[
            { value: 'backend', label: t('toolbar.backendLabel'), title: t('toolbar.backendTitle') },
            { value: 'frontend', label: t('toolbar.frontendLabel'), title: t('toolbar.frontendTitle') },
            { value: 'mixed', label: t('toolbar.allLabel'), title: t('toolbar.allTitle') }
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
        <label style={{ fontSize: "10px", fontWeight: "600" }}>{t('toolbar.analysisTypes')}</label>
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
          <label style={{ fontSize: "10px", fontWeight: "600" }}>{t('toolbar.frontendPath')}</label>
          <input
            type="text"
            placeholder={t('toolbar.frontendPathPlaceholder')}
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
            {t('toolbar.frontendPathDesc')}
          </div>
        </div>
      )}

      {/* 分支选择 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <label style={{ fontSize: "10px", fontWeight: "600" }}>{t('toolbar.gitBranch')}</label>
        <div style={{ display: "flex", gap: "4px" }}>
          <select 
            value={selectedBranch} 
            onChange={(e) => setSelectedBranch(e.target.value)}
            disabled={isAnalyzing}
            style={{ flex: 1 }}
          >
            <option value="">{t('toolbar.selectBranch')}</option>
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
            title={currentLanguage === 'zh-CN' ? '刷新分支列表' : 'Refresh branch list'}
          >
            {t('toolbar.refresh')}
          </button>
        </div>
      </div>

      {/* 分析范围 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <label style={{ fontSize: "10px", fontWeight: "600" }}>{t('toolbar.analysisRange')}</label>
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
          <label style={{ fontSize: "10px", fontWeight: "600" }}>{t('toolbar.commitRange')}</label>
          <input
            type="text"
            placeholder={t('toolbar.commitStartPlaceholder')}
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
            placeholder={t('toolbar.commitEndPlaceholder')}
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
            {t('toolbar.validateCommits')}
          </button>
        </div>
      )}

      {/* 自定义日期范围输入 */}
      {isCustomRange && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "10px", fontWeight: "600" }}>{t('toolbar.dateRange')}</label>
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
            placeholder={currentLanguage === 'zh-CN' ? '结束日期（可选）' : 'End date (optional)'}
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
          {isAnalyzing ? t('toolbar.analyzing') : t('toolbar.startAnalysis')}
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
            {t('toolbar.exportJSON')}
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
            {t('toolbar.exportHTML')}
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
          {t('toolbar.loadingBranches')}
        </div>
      )}
    </div>
  );
};

export default Toolbar; 