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
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // 新增：分析范围和类型状态
  // ✅ 初始状态设为 'unknown'，等待项目类型检测后自动设置
  const [analysisScope, setAnalysisScope] = useState<'backend' | 'frontend' | 'mixed'>('backend');
  const [projectType, setProjectType] = useState<'backend' | 'frontend' | 'mixed' | 'unknown'>('unknown');
  const [backendLanguage, setBackendLanguage] = useState<'java' | 'golang' | 'unknown'>('unknown');
  const [analysisTypes, setAnalysisTypes] = useState<string[]>([]);
  const [frontendPath, setFrontendPath] = useState<string>('');
  // 分析模式：快速模式（quick）或深度模式（deep）
  const [analysisMode, setAnalysisMode] = useState<'quick' | 'deep'>('quick');
  
  // Commit ID范围相关状态
  const [startCommitId, setStartCommitId] = useState<string>('');
  const [endCommitId, setEndCommitId] = useState<string>('');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');

  // 基准分支/提交（用于组件回退检测）
  const [baseCommitForRevert, setBaseCommitForRevert] = useState<string>('origin/main');

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
    if (savedState.baseCommitForRevert) {
      setBaseCommitForRevert(savedState.baseCommitForRevert);
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
      branches,
      baseCommitForRevert
    };
    
    saveState(currentState);
    console.log('💾 保存状态:', currentState);
  }, [selectedBranch, selectedRange, analysisScope, analysisTypes, frontendPath, backendLanguage, startCommitId, endCommitId, customDateFrom, customDateTo, branches, baseCommitForRevert]);

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
          // ✅ 根据检测结果自动设置分析范围（包括 mixed 类型）
          if (message.projectType !== 'unknown') {
            // 如果是 mixed 类型，默认选择 backend（用户后续可以手动切换）
            const autoScope = message.projectType === 'mixed' ? 'backend' : message.projectType;
            setAnalysisScope(autoScope);
            console.log(`[Toolbar] 自动设置分析范围: ${autoScope} (项目类型: ${message.projectType})`);
          }
          // ✅ 设置前端路径（从推理结果）
          if (message.frontendPaths && message.frontendPaths.length > 0) {
            const firstPath = message.frontendPaths[0];
            setFrontendPath(firstPath);
            console.log(`[Toolbar] 自动设置前端路径: ${firstPath}`);
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
      analysisMode: analysisMode, // 新增：分析模式（quick/deep）
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
    
    // ✅ 添加调试日志
    console.log('[Toolbar] 准备发送分析请求:', {
      command: 'analyze',
      data: analysisData
    });
    
    // 使用新的postMessage函数
    try {
      postMessage({
        command: 'analyze',
        data: analysisData
      });
      console.log('[Toolbar] ✅ 分析请求已发送');
    } catch (error) {
      console.error('[Toolbar] ❌ 发送分析请求失败:', error);
      setIsAnalyzing(false);
      alert(t('messages.analysisRequestFailed') || '发送分析请求失败，请查看控制台获取详细信息');
    }
  };

  const handleHotspotAnalysis = () => {
    const hotspotData: any = {
      branch: selectedBranch,
      range: selectedRange,
      minChurn: 5,
      minComplexity: 10,
      includeLang: backendLanguage !== 'unknown' ? [backendLanguage] : [],
      excludePatterns: ['*.md', '*.txt', '*.json', '*.yml', '*.yaml'],
      language: currentLanguage
    };

    if (selectedRange === 'Commit ID Range') {
      if (!startCommitId || !endCommitId) {
        alert(t('messages.enterCommitIdsError'));
        return;
      }
      hotspotData.startCommit = startCommitId;
      hotspotData.endCommit = endCommitId;
    } else if (selectedRange === 'Custom Date Range') {
      if (!customDateFrom) {
        alert(t('messages.selectStartDateError'));
        return;
      }
      hotspotData.dateFrom = customDateFrom;
      hotspotData.dateTo = customDateTo;
    }

    setIsAnalyzing(true);
    postMessage({
      command: 'getHotspotAnalysis',
      data: hotspotData
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
  const handleExport = (format: 'json' | 'html') => {
    postMessage({
      command: 'exportResults',
      format: format,
      language: currentLanguage
    });
    setShowExportMenu(false); // 关闭下拉菜单
  };

  // 点击外部区域关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showExportMenu && !target.closest('.export-button-container')) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showExportMenu]);

  const handleReportBug = () => {
    // 收集当前状态信息用于bug报告
    const reportData = {
      projectType,
      backendLanguage,
      selectedBranch,
      selectedRange,
      analysisScope,
      analysisTypes,
      frontendPath,
      startCommitId,
      endCommitId,
      customDateFrom,
      customDateTo,
      branches: branches.length,
      userAgent: navigator.userAgent,
      currentLanguage,
      timestamp: new Date().toISOString()
    };

    postMessage({ 
      command: 'reportBug',
      data: reportData
    });
  };

  const handleDetectRevert = () => {
    if (!baseCommitForRevert) {
      alert('请输入基准分支或提交');
      return;
    }
    postMessage({
      command: 'detectRevert',
      data: {
        baseCommit: baseCommitForRevert.trim(),
        headCommit: 'HEAD'
      }
    });
  };

  return (
    <div className="toolbar-container react-component flex flex-col gap-2 p-2 border-b border-border">
      {/* 语言切换器 */}
      <div className="flex items-center justify-between px-2 py-1 rounded bg-surface-alt text-xs">
        <span className="font-semibold text-text">🌐</span>
        <select
          value={currentLanguage}
          onChange={(e) => changeLanguage(e.target.value as any)}
          className="flex-1 ml-2 px-1 py-0.5 text-[10px] rounded border border-border bg-surface text-subtle transition-colors duration-fast ease-standard"
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
        <div className="px-2 py-1 rounded bg-surface-alt text-center text-[10px] border border-border">
          <span className="font-semibold" style={{ color: getProjectTypeInfo().color }}>
            {getProjectTypeInfo().text}
          </span>
          {projectType === 'mixed' && (
            <div className="mt-0.5 text-[9px] text-subtle">
              {currentLanguage === 'zh-CN' ? '建议先选择分析范围' : 'Please select analysis scope first'}
            </div>
          )}
        </div>
      )}

      {/* 第1层：分析范围选择 */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold">{t('toolbar.analysisScope')}</label>
        <div className="flex gap-1">
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
              className={`flex-1 px-2 py-1 text-[9px] rounded border transition-all duration-fast ease-standard ${
                analysisScope === option.value
                  ? 'bg-accent text-white border-accent shadow-token'
                  : 'bg-surface text-subtle border-border opacity-80 hover:opacity-100'
              } ${isAnalyzing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 第2层：分析模式选择（仅在前端或混合模式下显示） */}
      {(analysisScope === 'frontend' || analysisScope === 'mixed') && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold">分析模式</label>
          <div className="flex gap-1">
            {[
              { value: 'quick', label: '快速', title: '快速模式：<100文件全量分析，≥100文件显示FFIS评分最高的100个' },
              { value: 'deep', label: '深度', title: '深度模式：显示所有文件，完整分析' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setAnalysisMode(option.value as 'quick' | 'deep')}
                disabled={isAnalyzing}
                title={option.title}
                className={`flex-1 px-2 py-1 text-[9px] rounded border transition-all duration-fast ease-standard ${
                  analysisMode === option.value
                    ? 'bg-accent text-white border-accent shadow-token'
                    : 'bg-surface text-subtle border-border opacity-80 hover:opacity-100'
                } ${isAnalyzing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 第3层：分析类型选择 */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold">{t('toolbar.analysisTypes')}</label>
        <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">
          {analysisOptions[analysisScope]?.map(option => (
            <label 
              key={option.id}
              className={`flex items-start gap-1 px-2 py-1 rounded ${analysisTypes.includes(option.id) ? 'bg-surface-alt' : 'bg-transparent'} ${isAnalyzing ? 'cursor-not-allowed' : 'cursor-pointer'} transition-colors duration-fast ease-standard`}
            >
              <input
                type="checkbox"
                checked={analysisTypes.includes(option.id)}
                onChange={() => handleAnalysisTypeToggle(option.id)}
                disabled={isAnalyzing}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="text-[9px] font-medium">
                  {option.label}
                </div>
                <div className="text-[8px] text-subtle leading-[1.2]">
                  {option.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 前端路径输入（仅在前端或混合模式下显示） */}
      {(analysisScope === 'frontend' || analysisScope === 'mixed') && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold">{t('toolbar.frontendPath')}</label>
          <input
            type="text"
            placeholder={t('toolbar.frontendPathPlaceholder')}
            value={frontendPath}
            onChange={(e) => setFrontendPath(e.target.value)}
            disabled={isAnalyzing}
            className="px-2 py-1 text-[10px] rounded border border-border bg-surface text-text transition-colors duration-fast ease-standard"
          />
          <div className="text-[8px] text-subtle">
            {t('toolbar.frontendPathDesc')}
          </div>
        </div>
      )}

      {/* 分支选择 */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold">{t('toolbar.gitBranch')}</label>
        <div className="flex gap-1">
          <select 
            value={selectedBranch} 
            onChange={(e) => setSelectedBranch(e.target.value)}
            disabled={isAnalyzing}
            className="flex-1 px-2 py-1 text-[10px] rounded border border-border bg-surface text-text transition-colors duration-fast ease-standard"
          >
            <option value="">{t('toolbar.selectBranch')}</option>
            {branches.map(branch => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
          <button 
            onClick={handleRefresh}
            disabled={isAnalyzing}
            className="px-2 py-1 text-[10px] min-w-[40px] rounded border border-border bg-surface text-subtle hover:text-text transition-colors duration-fast ease-standard"
            title={currentLanguage === 'zh-CN' ? '刷新分支列表' : 'Refresh branch list'}
          >
            {t('toolbar.refresh')}
          </button>
        </div>
      </div>

      {/* 分析范围 */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold">{t('toolbar.analysisRange')}</label>
        <select 
          value={selectedRange} 
          onChange={(e) => setSelectedRange(e.target.value)}
          disabled={isAnalyzing}
          className="px-2 py-1 text-[10px] rounded border border-border bg-surface text-text transition-colors duration-fast ease-standard"
        >
          {ranges.map(range => (
            <option key={range} value={range}>{range}</option>
          ))}
        </select>
      </div>

      {/* Commit ID 范围输入 */}
      {isCommitRange && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold">{t('toolbar.commitRange')}</label>
          <input
            type="text"
            placeholder={t('toolbar.commitStartPlaceholder')}
            value={startCommitId}
            onChange={(e) => setStartCommitId(e.target.value)}
            disabled={isAnalyzing}
            className="px-2 py-1 text-[10px] rounded border border-border bg-surface text-text transition-colors duration-fast ease-standard"
          />
          <input
            type="text"
            placeholder={t('toolbar.commitEndPlaceholder')}
            value={endCommitId}
            onChange={(e) => setEndCommitId(e.target.value)}
            disabled={isAnalyzing}
            className="px-2 py-1 text-[10px] rounded border border-border bg-surface text-text transition-colors duration-fast ease-standard"
          />
          <button
            onClick={validateCommitIds}
            disabled={isAnalyzing || !startCommitId || !endCommitId}
            className="px-2 py-1 text-[9px] rounded bg-surface-alt text-subtle hover:text-text transition-colors duration-fast ease-standard"
          >
            {t('toolbar.validateCommits')}
          </button>
        </div>
      )}

      {/* 自定义日期范围输入 */}
      {isCustomRange && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold">{t('toolbar.dateRange')}</label>
          <input
            type="date"
            value={customDateFrom}
            onChange={(e) => setCustomDateFrom(e.target.value)}
            disabled={isAnalyzing}
            className="px-2 py-1 text-[10px] rounded border border-border bg-surface text-text transition-colors duration-fast ease-standard"
          />
          <input
            type="date"
            placeholder={currentLanguage === 'zh-CN' ? '结束日期（可选）' : 'End date (optional)'}
            value={customDateTo}
            onChange={(e) => setCustomDateTo(e.target.value)}
            disabled={isAnalyzing}
            className="px-2 py-1 text-[10px] rounded border border-border bg-surface text-text transition-colors duration-fast ease-standard"
          />
        </div>
      )}

      {/* 回退检测输入 */}
      <div className="flex flex-col gap-1 mt-2">
        <label className="text-[10px] font-semibold">{t('toolbar.baseCommitLabel')}</label>
        <input
          type="text"
          placeholder={t('toolbar.baseCommitPlaceholder')}
          value={baseCommitForRevert}
          onChange={(e) => setBaseCommitForRevert(e.target.value)}
          disabled={isAnalyzing}
          className="px-2 py-1 text-[10px] rounded border border-border bg-surface text-text transition-colors duration-fast ease-standard"
        />
      </div>

      {/* 分析按钮和导出按钮 */}
      <div className="flex gap-2 mt-3">
        <button 
          onClick={handleAnalyze}
          disabled={!selectedBranch || isAnalyzing}
          className={`flex-1 text-[11px] px-2 py-1 rounded transition-colors duration-fast ease-standard ${
            isAnalyzing
              ? 'bg-surface-alt text-subtle cursor-not-allowed'
              : 'bg-accent text-white cursor-pointer'
          }`}
        >
          {isAnalyzing ? t('toolbar.analyzing') : t('toolbar.startAnalysis')}
        </button>
        
        {/* 热点分析按钮 */}
        <button 
          onClick={handleHotspotAnalysis}
          disabled={!selectedBranch || isAnalyzing}
          className={`text-[10px] px-2 py-1 rounded transition-colors duration-fast ease-standard ${
            isAnalyzing ? 'bg-surface-alt text-subtle cursor-not-allowed' : 'bg-[#FF6B35] text-white'
          }`}
          title="分析代码热点 - 识别高风险文件"
        >
          {isAnalyzing ? '分析中...' : '🔥 热点分析'}
        </button>
        
        {/* 检测回退按钮 */}
        <button
          onClick={handleDetectRevert}
          className="text-[10px] px-2 py-1 rounded bg-surface-alt text-subtle transition-colors duration-fast ease-standard"
          title={t('toolbar.detectRevert')}
        >
          {t('toolbar.detectRevert')}
        </button>
        
        {/* 导出按钮（带下拉菜单） */}
        <div 
          className="export-button-container relative min-w-[100px]"
        >
          <button 
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="text-[10px] px-2 py-1 rounded bg-surface-alt text-subtle w-full flex items-center justify-between gap-1 transition-colors duration-fast ease-standard"
          >
            <span>{t('toolbar.export')}</span>
            <span className="text-[8px]">▼</span>
          </button>
          {showExportMenu && (
            <div className="absolute top-full left-0 right-0 mt-0.5 bg-surface rounded border border-border shadow-token z-10 flex flex-col animate-fade-in">
              <button
                onClick={() => handleExport('json')}
                className="text-[10px] px-2 py-1 text-left rounded-t hover:bg-surface-alt transition-colors duration-fast ease-standard border-b border-border"
              >
                {t('toolbar.exportJSON')}
              </button>
              <button
                onClick={() => handleExport('html')}
                className="text-[10px] px-2 py-1 text-left rounded-b hover:bg-surface-alt transition-colors duration-fast ease-standard"
              >
                {t('toolbar.exportHTML')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bug汇报按钮 */}
      <div className="mt-2">
        <button 
          onClick={handleReportBug}
          className="w-full text-[10px] px-2 py-1 rounded border border-border bg-surface-alt text-subtle hover:text-text transition-colors duration-fast ease-standard font-medium"
          title={t('toolbar.reportBugTitle')}
        >
          {t('toolbar.reportBug')}
        </button>
      </div>

      {/* 状态信息 */}
      {branches.length === 0 && (
        <div className="text-[9px] text-subtle text-center p-1 animate-fade-in">
          {t('toolbar.loadingBranches')}
        </div>
      )}
    </div>
  );
};

export default Toolbar;
