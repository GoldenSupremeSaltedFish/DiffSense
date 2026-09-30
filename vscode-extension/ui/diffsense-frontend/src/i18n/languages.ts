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
    export: string;
    exportJSON: string;
    exportHTML: string;
    reportBug: string;
    reportBugTitle: string;
    detectRevert: string;
    baseCommitLabel: string;
    baseCommitPlaceholder: string;
    
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

  // 产品模式
  productMode: {
    switchToExpert: string;
    switchToProduct: string;
    subtitle: string;
    startAnalysis: string;
    reset: string;
    scope: string;
    scopeLast5: string;
    scopeLast10: string;
    scopeSinceRelease: string;
    scopeToday: string;
    scopeWeek: string;
    export: string;
    exportJson: string;
    exportHtml: string;
    noResults: string;
    fileChange: string;
    risk: string;
    impact: string;
    highRisk: string;
    mediumRisk: string;
    lowRisk: string;
  analyzing: string;
  analyzingProject: string;
  recommendation: string;
    keyFindings: string;
    changeDetails: string;
    commitsCount: string;
    filesCount: string;
    affectedModules: string;
    noModules: string;
    expertModeTitle: string;
    noAnalysisData: string;
    runAnalysisToView: string;
    unknownModule: string;
    categoryA1: string;
    categoryA2: string;
    categoryA3: string;
    categoryA4: string;
    categoryF1: string;
    categoryF2: string;
    findingHighRisk: string;
    findingMediumRisk: string;
    commitRiskLow: string;
    commitRiskHigh: string;
    commitRiskMedium: string;
    summaryHeadlineLow: string;
    summaryRecommendationLow: string;
    summaryHeadlineHigh: string;
    summaryRecommendationHigh: string;
    summaryHeadlineMedium: string;
    summaryRecommendationMedium: string;
    noRiskPatterns: string;
    multipleAdjustments: string;
  };
}

export interface LanguageText {
  // 基础信息
  commits: string;
  files: string;
  methods: string;
  
  // 影响分析相关
  impactAnalysis: string;
  impactedFiles: string;
  impactedMethods: string;
  callRelationships: string;
  
  // 变更分类相关 (替代风险分)
  changeClassification: string;
  classificationSummary: string;
  // 后端分类
  categoryA1: string;
  categoryA2: string;
  categoryA3: string;
  categoryA4: string;
  categoryA5: string;
  // 前端分类
  categoryF1: string;
  categoryF2: string;
  categoryF3: string;
  categoryF4: string;
  categoryF5: string;
  confidence: string;
  importantChanges: string;
  
  // 统计相关
  totalCommits: string;
  totalFiles: string;
  totalMethods: string;
  totalClassifiedFiles: string;
  averageConfidence: string;
  
  // 详细信息相关
  commitDetails: string;
  fileClassification: string;
  changedMethods: string;
  
  // 新增：提交页面相关
  changeTypeSummary: string;
  fileClassificationDetails: string;
  primaryType: string;
  multipleTypesLabel: string;
  
  // 其他现有字段
  filesChanged: string;
  methodsChanged: string;
  noDetailedData: string;
  
  // 导出相关
  exportTitle: string;
  exportSubtitle: string;
  generatedTime: string;
  
  // 导航相关
  overview: string;
  classifications: string;
  commits_tab: string;
  callgraph: string;
  snapshot: string;
  
  // 状态信息
  noChanges: string;
  loading: string;
  analyzing: string;
  completed: string;
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
    export: '📤 导出',
    exportJSON: '📄 导出JSON',
    exportHTML: '🌐 导出HTML',
    reportBug: '📩 出bug了？点我汇报😊',
    reportBugTitle: '报告问题或建议',
    detectRevert: '检测回退',
    baseCommitLabel: '基准分支/提交',
    baseCommitPlaceholder: '例: origin/main',
    
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
  },

  productMode: {
    switchToExpert: '切换到专家模式',
    switchToProduct: '切换到产品模式',
    subtitle: '代码变更风险评估 - 简易模式',
    startAnalysis: '开始分析',
    reset: '重置',
    scope: '分析范围',
    scopeLast5: '最近5次提交',
    scopeLast10: '最近10次提交',
    scopeSinceRelease: '自上次发布以来',
    scopeToday: '今天的提交',
    scopeWeek: '本周的提交',
    export: '导出报告',
    exportJson: '导出 JSON',
    exportHtml: '导出 HTML',
    noResults: '暂无分析结果，请点击"开始分析"',
    fileChange: '文件 / 变更',
    risk: '风险等级',
    impact: '影响分析',
    highRisk: '高风险',
    mediumRisk: '中风险',
    lowRisk: '低风险',
    analyzing: '正在分析...',
    analyzingProject: '正在分析项目...',
    recommendation: '建议',
    keyFindings: '关键发现',
    changeDetails: '变更详情',
    commitsCount: '个提交',
    filesCount: '文件',
    affectedModules: '受影响模块',
    noModules: '暂无详细模块信息',
    expertModeTitle: '专家模式',
    noAnalysisData: '暂无分析数据',
    runAnalysisToView: '请运行分析以查看结果。',
    unknownModule: '未知模块',
    categoryA1: '核心业务逻辑',
    categoryA2: 'API 接口定义',
    categoryA3: '数据结构',
    categoryA4: '中间件配置',
    categoryF1: '前端组件行为',
    categoryF2: 'UI 结构',
    findingHighRisk: '检测到 {category} 发生高风险变更',
    findingMediumRisk: '检测到 {category} 发生变动，可能影响稳定性',
    commitRiskLow: '变更风险较低',
    commitRiskHigh: '涉及 {count} 处高风险变更',
    commitRiskMedium: '包含 {count} 处中等风险变更',
    summaryHeadlineLow: '本次变更风险较低',
    summaryRecommendationLow: '可以直接合并。',
    summaryHeadlineHigh: '本次修改涉及 {count} 处高风险变更，建议在合并前重点检查。',
    summaryRecommendationHigh: '建议进行详细 Code Review 并补充测试用例。',
    summaryHeadlineMedium: '本次修改包含 {count} 处中等风险变更，请注意回归测试。',
    summaryRecommendationMedium: '建议关注受影响的 UI/API 模块。',
    noRiskPatterns: '未发现显著的风险模式。',
    multipleAdjustments: '涉及多处代码调整。'
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
    export: '📤 Export',
    exportJSON: '📄 Export JSON',
    exportHTML: '🌐 Export HTML',
    reportBug: '📩 Bug Report 🐛',
    reportBugTitle: 'Report Issue or Suggestion',
    detectRevert: 'Detect Revert',
    baseCommitLabel: 'Base Commit/Branch',
    baseCommitPlaceholder: 'e.g.: origin/main',
    
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
  },

  productMode: {
    switchToExpert: 'Switch to Expert Mode',
    switchToProduct: 'Switch to Product Mode',
    subtitle: 'Code Change Risk Assessment - Simplified Mode',
    startAnalysis: 'Start Analysis',
    reset: 'Reset',
    scope: 'Scope',
    scopeLast5: 'Last 5 commits',
    scopeLast10: 'Last 10 commits',
    scopeSinceRelease: 'Since last release',
    scopeToday: 'Today\'s commits',
    scopeWeek: 'This week\'s commits',
    export: 'Export Report',
    exportJson: 'Export JSON',
    exportHtml: 'Export HTML',
    noResults: 'No analysis results yet. Click "Start Analysis".',
    fileChange: 'File / Change',
    risk: 'Risk',
    impact: 'Impact',
    highRisk: 'High Risk',
    mediumRisk: 'Medium Risk',
    lowRisk: 'Low Risk',
    analyzing: 'Analyzing...',
    analyzingProject: 'Analyzing Project...',
    recommendation: 'Recommendation',
    keyFindings: 'Key Findings',
    changeDetails: 'Change Details',
    commitsCount: 'commits',
    filesCount: 'files',
    affectedModules: 'Affected Modules',
    noModules: 'No detailed module info',
    expertModeTitle: 'Expert Mode',
    noAnalysisData: 'No analysis data',
    runAnalysisToView: 'Please run analysis to view results.',
    unknownModule: 'Unknown Module',
    categoryA1: 'Core Business Logic',
    categoryA2: 'API Definition',
    categoryA3: 'Data Structure',
    categoryA4: 'Middleware Config',
    categoryF1: 'Frontend Component Behavior',
    categoryF2: 'UI Structure',
    findingHighRisk: 'Detected high risk change in {category}',
    findingMediumRisk: 'Detected change in {category}, might affect stability',
    commitRiskLow: 'Low risk changes',
    commitRiskHigh: 'Involves {count} high risk changes',
    commitRiskMedium: 'Contains {count} medium risk changes',
    summaryHeadlineLow: 'Low risk changes',
    summaryRecommendationLow: 'Ready to merge.',
    summaryHeadlineHigh: 'Involves {count} high risk changes, check before merge.',
    summaryRecommendationHigh: 'Detailed Code Review and test cases recommended.',
    summaryHeadlineMedium: 'Contains {count} medium risk changes, check regression.',
    summaryRecommendationMedium: 'Focus on affected UI/API modules.',
    noRiskPatterns: 'No significant risk patterns found.',
    multipleAdjustments: 'Involves multiple code adjustments.'
  }
};

// 支持的语言列表
export const supportedLanguages = {
  'zh-CN': zhCN,
  'en-US': enUS
};

export type SupportedLanguage = keyof typeof supportedLanguages; 