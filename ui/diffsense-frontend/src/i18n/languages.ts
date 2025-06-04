// 语言配置文件
export interface LanguageConfig {
  // 通用
  language: string;
  projectTypes: {
    javaBackend: string;
    golangBackend: string;
    backend: string;
    frontend: string;
    mixedJava: string;
    mixedGolang: string;
    mixed: string;
    unknown: string;
  };
  
  // 工具栏
  toolbar: {
    analysisScope: string;
    backendLabel: string;
    frontendLabel: string;
    allLabel: string;
    backendTitle: string;
    frontendTitle: string;
    allTitle: string;
    
    analysisTypes: string;
    classes: string;
    classesDesc: string;
    methods: string;
    methodsDesc: string;
    callChain: string;
    callChainDesc: string;
    dependencies: string;
    dependenciesDesc: string;
    entryPoints: string;
    entryPointsDesc: string;
    uiImpact: string;
    uiImpactDesc: string;
    fullStack: string;
    fullStackDesc: string;
    apiChanges: string;
    apiChangesDesc: string;
    dataFlow: string;
    dataFlowDesc: string;
    
    frontendPath: string;
    frontendPathPlaceholder: string;
    frontendPathDesc: string;
    
    gitBranch: string;
    selectBranch: string;
    refresh: string;
    
    analysisRange: string;
    commitRange: string;
    commitStartPlaceholder: string;
    commitEndPlaceholder: string;
    validateCommits: string;
    
    dateRange: string;
    
    startAnalysis: string;
    analyzing: string;
    exportJSON: string;
    exportHTML: string;
    
    loadingBranches: string;
  };
  
  // 报告
  report: {
    overview: string;
    risks: string;
    commits: string;
    callGraph: string;
    
    totalCommits: string;
    totalFiles: string;
    totalMethods: string;
    highRisk: string;
    mediumRisk: string;
    lowRisk: string;
    
    commitInfo: string;
    author: string;
    date: string;
    filesChanged: string;
    methodsChanged: string;
    riskScore: string;
    
    impactedFiles: string;
    impactedMethods: string;
    callRelationships: string;
    noDetailedData: string;
    
    // 导出相关
    exportTitle: string;
    exportSubtitle: string;
    generatedTime: string;
    repositoryPath: string;
    analysisEngine: string;
    analysisOverview: string;
    analysisDetails: string;
    reportGenerated: string;
  };
  
  // 消息
  messages: {
    selectBranchError: string;
    selectAnalysisTypeError: string;
    enterCommitIdsError: string;
    selectStartDateError: string;
    noAnalysisResults: string;
    exportSuccess: string;
    openFile: string;
    showInExplorer: string;
    exportFailed: string;
    analysisCompleted: string;
    commitValidationSuccess: string;
    commitValidationFailed: string;
  };
  
  // 图表
  charts: {
    nodes: string;
    relationships: string;
    modifiedMethods: string;
    newMethods: string;
    affectedMethods: string;
    unknownMethods: string;
    noCallGraphData: string;
  };
}

// 中文配置
export const zhCN: LanguageConfig = {
  language: '中文',
  projectTypes: {
    javaBackend: '☕ Java后端项目',
    golangBackend: '🐹 Golang后端项目',
    backend: '🔧 后端项目',
    frontend: '🌐 前端项目',
    mixedJava: '🧩 混合项目 (Java + 前端)',
    mixedGolang: '🧩 混合项目 (Golang + 前端)',
    mixed: '🧩 混合项目',
    unknown: '❓ 未知项目类型'
  },
  
  toolbar: {
    analysisScope: '🎯 分析范围:',
    backendLabel: '🔧 后端',
    frontendLabel: '🌐 前端',
    allLabel: '🧩 全部',
    backendTitle: 'Java/Golang代码分析',
    frontendTitle: 'TypeScript/React分析',
    allTitle: '混合项目分析',
    
    analysisTypes: '📋 分析类型:',
    classes: '📦 变更影响了哪些类？',
    classesDesc: '分析类级别的影响范围',
    methods: '⚙️ 变更影响了哪些方法？',
    methodsDesc: '分析方法级别的影响范围',
    callChain: '🔗 方法调用链是怎样的？',
    callChainDesc: '分析方法间的调用关系',
    dependencies: '📁 哪些文件被哪些组件依赖？',
    dependenciesDesc: '分析文件依赖关系',
    entryPoints: '🚪 哪些方法是入口触发？',
    entryPointsDesc: '分析函数调用入口',
    uiImpact: '🎨 哪些UI会受影响？',
    uiImpactDesc: '分析组件树级联影响',
    fullStack: '🧩 全栈影响分析',
    fullStackDesc: '分析前后端交互影响',
    apiChanges: '🔌 API变更影响分析',
    apiChangesDesc: '分析接口变更对前端的影响',
    dataFlow: '📊 数据流影响分析',
    dataFlowDesc: '分析数据传递链路影响',
    
    frontendPath: '📁 前端代码路径:',
    frontendPathPlaceholder: '例: ui/frontend 或 src/main/webapp',
    frontendPathDesc: '相对于项目根目录的路径，留空表示自动检测',
    
    gitBranch: 'Git分支:',
    selectBranch: '选择分支...',
    refresh: '🔄',
    
    analysisRange: '分析范围:',
    commitRange: 'Commit ID范围:',
    commitStartPlaceholder: '起始Commit ID (例: abc1234)',
    commitEndPlaceholder: '结束Commit ID (例: def5678)',
    validateCommits: '🔍 验证Commit ID',
    
    dateRange: '日期范围:',
    
    startAnalysis: '🚀 开始分析',
    analyzing: '🔄 分析中...',
    exportJSON: '📄 导出JSON',
    exportHTML: '🌐 导出HTML',
    
    loadingBranches: '正在加载分支列表...'
  },
  
  report: {
    overview: '📊 概览',
    risks: '⚠️ 风险',
    commits: '📝 提交',
    callGraph: '🔗 调用关系',
    
    totalCommits: '分析提交数',
    totalFiles: '影响文件数',
    totalMethods: '影响方法数',
    highRisk: '高风险',
    mediumRisk: '中风险',
    lowRisk: '低风险',
    
    commitInfo: '提交信息',
    author: '作者',
    date: '日期',
    filesChanged: '个文件',
    methodsChanged: '个方法',
    riskScore: '风险评分',
    
    impactedFiles: '📁 影响文件',
    impactedMethods: '⚙️ 影响方法',
    callRelationships: '🔗 调用关系图',
    noDetailedData: '暂无详细数据',
    
    exportTitle: '🔍 DiffSense 分析报告',
    exportSubtitle: 'Git 代码影响分析',
    generatedTime: '生成时间',
    repositoryPath: '仓库路径',
    analysisEngine: '分析引擎',
    analysisOverview: '📊 分析概览',
    analysisDetails: '📝 提交分析详情',
    reportGenerated: '📋 报告由 DiffSense VSCode 扩展生成'
  },
  
  messages: {
    selectBranchError: '❌ 请选择分支',
    selectAnalysisTypeError: '❌ 请至少选择一种分析类型',
    enterCommitIdsError: '❌ 请输入起始和结束Commit ID',
    selectStartDateError: '❌ 请选择开始日期',
    noAnalysisResults: '没有可导出的分析结果，请先进行分析',
    exportSuccess: '分析结果已导出到: ',
    openFile: '打开文件',
    showInExplorer: '在资源管理器中显示',
    exportFailed: '导出失败: ',
    analysisCompleted: '✅ 分析已完成',
    commitValidationSuccess: '✅ Commit ID验证成功',
    commitValidationFailed: '❌ Commit ID验证失败: '
  },
  
  charts: {
    nodes: '节点',
    relationships: '关系',
    modifiedMethods: '修改的方法',
    newMethods: '新增的方法',
    affectedMethods: '受影响的方法',
    unknownMethods: '外部/未知方法',
    noCallGraphData: '暂无调用关系数据'
  }
};

// 英文配置
export const enUS: LanguageConfig = {
  language: 'English',
  projectTypes: {
    javaBackend: '☕ Java Backend Project',
    golangBackend: '🐹 Golang Backend Project',
    backend: '🔧 Backend Project',
    frontend: '🌐 Frontend Project',
    mixedJava: '🧩 Mixed Project (Java + Frontend)',
    mixedGolang: '🧩 Mixed Project (Golang + Frontend)',
    mixed: '🧩 Mixed Project',
    unknown: '❓ Unknown Project Type'
  },
  
  toolbar: {
    analysisScope: '🎯 Analysis Scope:',
    backendLabel: '🔧 Backend',
    frontendLabel: '🌐 Frontend',
    allLabel: '🧩 All',
    backendTitle: 'Java/Golang Code Analysis',
    frontendTitle: 'TypeScript/React Analysis',
    allTitle: 'Mixed Project Analysis',
    
    analysisTypes: '📋 Analysis Types:',
    classes: '📦 Which classes are affected by changes?',
    classesDesc: 'Analyze class-level impact scope',
    methods: '⚙️ Which methods are affected by changes?',
    methodsDesc: 'Analyze method-level impact scope',
    callChain: '🔗 What are the method call chains?',
    callChainDesc: 'Analyze call relationships between methods',
    dependencies: '📁 Which files depend on which components?',
    dependenciesDesc: 'Analyze file dependency relationships',
    entryPoints: '🚪 Which methods are entry triggers?',
    entryPointsDesc: 'Analyze function call entry points',
    uiImpact: '🎨 Which UI will be affected?',
    uiImpactDesc: 'Analyze component tree cascade impact',
    fullStack: '🧩 Full-stack impact analysis',
    fullStackDesc: 'Analyze frontend-backend interaction impact',
    apiChanges: '🔌 API change impact analysis',
    apiChangesDesc: 'Analyze API change impact on frontend',
    dataFlow: '📊 Data flow impact analysis',
    dataFlowDesc: 'Analyze data pipeline impact',
    
    frontendPath: '📁 Frontend Code Path:',
    frontendPathPlaceholder: 'e.g.: ui/frontend or src/main/webapp',
    frontendPathDesc: 'Path relative to project root, leave empty for auto-detection',
    
    gitBranch: 'Git Branch:',
    selectBranch: 'Select branch...',
    refresh: '🔄',
    
    analysisRange: 'Analysis Range:',
    commitRange: 'Commit ID Range:',
    commitStartPlaceholder: 'Start Commit ID (e.g.: abc1234)',
    commitEndPlaceholder: 'End Commit ID (e.g.: def5678)',
    validateCommits: '🔍 Validate Commit IDs',
    
    dateRange: 'Date Range:',
    
    startAnalysis: '🚀 Start Analysis',
    analyzing: '🔄 Analyzing...',
    exportJSON: '📄 Export JSON',
    exportHTML: '🌐 Export HTML',
    
    loadingBranches: 'Loading branch list...'
  },
  
  report: {
    overview: '📊 Overview',
    risks: '⚠️ Risks',
    commits: '📝 Commits',
    callGraph: '🔗 Call Graph',
    
    totalCommits: 'Analyzed Commits',
    totalFiles: 'Affected Files',
    totalMethods: 'Affected Methods',
    highRisk: 'High Risk',
    mediumRisk: 'Medium Risk',
    lowRisk: 'Low Risk',
    
    commitInfo: 'Commit Info',
    author: 'Author',
    date: 'Date',
    filesChanged: 'files',
    methodsChanged: 'methods',
    riskScore: 'Risk Score',
    
    impactedFiles: '📁 Affected Files',
    impactedMethods: '⚙️ Affected Methods',
    callRelationships: '🔗 Call Relationship Graph',
    noDetailedData: 'No detailed data available',
    
    exportTitle: '🔍 DiffSense Analysis Report',
    exportSubtitle: 'Git Code Impact Analysis',
    generatedTime: 'Generated Time',
    repositoryPath: 'Repository Path',
    analysisEngine: 'Analysis Engine',
    analysisOverview: '📊 Analysis Overview',
    analysisDetails: '📝 Commit Analysis Details',
    reportGenerated: '📋 Report generated by DiffSense VSCode Extension'
  },
  
  messages: {
    selectBranchError: '❌ Please select a branch',
    selectAnalysisTypeError: '❌ Please select at least one analysis type',
    enterCommitIdsError: '❌ Please enter start and end Commit IDs',
    selectStartDateError: '❌ Please select start date',
    noAnalysisResults: 'No analysis results to export, please run analysis first',
    exportSuccess: 'Analysis results exported to: ',
    openFile: 'Open File',
    showInExplorer: 'Show in Explorer',
    exportFailed: 'Export failed: ',
    analysisCompleted: '✅ Analysis completed',
    commitValidationSuccess: '✅ Commit ID validation successful',
    commitValidationFailed: '❌ Commit ID validation failed: '
  },
  
  charts: {
    nodes: 'nodes',
    relationships: 'relationships',
    modifiedMethods: 'Modified methods',
    newMethods: 'New methods',
    affectedMethods: 'Affected methods',
    unknownMethods: 'External/Unknown methods',
    noCallGraphData: 'No call graph data available'
  }
};

// 支持的语言列表
export const supportedLanguages = {
  'zh-CN': zhCN,
  'en-US': enUS
};

export type SupportedLanguage = keyof typeof supportedLanguages; 