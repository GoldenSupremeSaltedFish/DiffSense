import React from 'react';

interface HotspotFile {
  filePath: string;
  changeCount: number;
  complexity: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastModified: string;
  contributors: string[];
  fileType: string;
  linesOfCode: number;
}

interface HotspotSummary {
  totalFiles: number;
  highRiskFiles: number;
  mediumRiskFiles: number;
  lowRiskFiles: number;
  totalChanges: number;
  averageComplexity: number;
}

interface HotspotResults {
  summary: HotspotSummary;
  files: HotspotFile[];
  generatedAt: string;
  analysisPeriod: {
    startDate: string;
    endDate: string;
  };
}

interface HotspotAnalysisProps {
  results?: HotspotResults;
  error?: string;
  isLoading?: boolean;
}

const getRiskLevelColor = (riskLevel: string) => {
  switch (riskLevel) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getRiskLevelIcon = (riskLevel: string) => {
  switch (riskLevel) {
    case 'critical':
    case 'high':
      return <span>⚠️</span>;
    case 'medium':
      return <span>📈</span>;
    case 'low':
      return <span>📄</span>;
    default:
      return <span>📄</span>;
  }
};

const formatFileSize = (lines: number) => {
  if (lines < 100) return `${lines} 行`;
  if (lines < 1000) return `${Math.round(lines / 100) / 10}K 行`;
  return `${Math.round(lines / 1000)}K 行`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`;
  return `${Math.floor(diffDays / 365)} 年前`;
};

export const HotspotAnalysis: React.FC<HotspotAnalysisProps> = ({ 
  results, 
  error, 
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <div className="w-full border rounded-lg">
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2 font-semibold">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            热点分析中...
          </div>
        </div>
        <div className="p-4">
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full border rounded-lg border-red-200">
        <div className="px-4 py-3 border-b">
          <div className="text-red-700 font-semibold flex items-center gap-2">
            <span>⚠️</span>
            热点分析失败
          </div>
        </div>
        <div className="p-4">
          <div className="text-red-600 bg-red-50 p-4 rounded-lg">
            <p className="font-medium">错误信息：</p>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!results || !results.files || results.files.length === 0) {
    return (
      <div className="w-full border rounded-lg">
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2 font-semibold">
            <span>📄</span>
            热点分析结果
          </div>
        </div>
        <div className="p-4">
          <div className="text-gray-500 text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 text-gray-300">📄</div>
            <p>暂无热点分析数据</p>
            <p className="text-sm mt-2">请先运行热点分析来获取文件变更热点信息</p>
          </div>
        </div>
      </div>
    );
  }

  const { summary, files } = results;

  return (
    <div className="space-y-6">
      {/* 摘要卡片 */}
      <div className="w-full border rounded-lg">
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2 font-semibold">
            <span>📈</span>
            热点分析摘要
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.totalFiles}</div>
              <div className="text-sm text-gray-500">总文件数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.highRiskFiles}</div>
              <div className="text-sm text-gray-500">高风险文件</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{summary.mediumRiskFiles}</div>
              <div className="text-sm text-gray-500">中风险文件</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.lowRiskFiles}</div>
              <div className="text-sm text-gray-500">低风险文件</div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-sm text-gray-600">
              <span>总变更次数: {summary.totalChanges}</span>
              <span>平均复杂度: {summary.averageComplexity.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 热点文件列表 */}
      <div className="w-full border rounded-lg">
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center gap-2">
              <span>⚠️</span>
              热点文件列表
            </span>
            <span className="text-sm font-normal text-gray-500">
              按风险级别排序
            </span>
          </div>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {files
              .sort((a, b) => {
                const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
              })
              .map((file, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center px-2 py-1 text-xs rounded border ${getRiskLevelColor(file.riskLevel)}`}>
                          <span className="flex items-center gap-1">
                            {getRiskLevelIcon(file.riskLevel)}
                            {file.riskLevel.toUpperCase()}
                          </span>
                        </span>
                        <span className="text-sm text-gray-500">{file.fileType}</span>
                      </div>
                       
                      <h4 className="font-medium text-gray-900 truncate" title={file.filePath}>
                        {file.filePath}
                      </h4>
                       
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <span>📈</span>
                          {file.changeCount} 次变更
                        </span>
                        <span className="flex items-center gap-1">
                          <span>📄</span>
                          {formatFileSize(file.linesOfCode)}
                        </span>
                        <span>{formatDate(file.lastModified)}</span>
                      </div>
                       
                      {file.contributors && file.contributors.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-500">贡献者:</span>
                          <div className="flex gap-1">
                            {file.contributors.slice(0, 3).map((contributor, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                              >
                                {contributor}
                              </span>
                            ))}
                            {file.contributors.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{file.contributors.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-4 text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        {file.complexity}
                      </div>
                      <div className="text-xs text-gray-500">复杂度</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* 分析信息 */}
      <div className="text-xs text-gray-500 text-center">
        <p>分析时间: {results.generatedAt}</p>
        <p>分析周期: {results.analysisPeriod.startDate} 至 {results.analysisPeriod.endDate}</p>
      </div>
    </div>
  );
};

export default HotspotAnalysis;
