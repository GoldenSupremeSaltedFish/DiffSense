import React, { useState } from 'react';
import CallGraphVisualization from './CallGraphVisualization';
import SnapshotDiffList from './SnapshotDiffList';

interface FileClassification {
  filePath: string;
  classification: {
    category: string;
    categoryName: string;
    description: string;
    reason: string;
    confidence: number;
    indicators: string[];
  };
  changedMethods: string[];
}

interface CommitImpact {
  commitId: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  timestamp: string;
  changedFilesCount: number;
  changedMethodsCount: number;
  impactedMethods: string[];
  impactedTests: Record<string, string[]>;
  changeClassifications: FileClassification[];
  classificationSummary: {
    totalFiles: number;
    categoryStats: Record<string, number>;
    averageConfidence: number;
    detailedClassifications: Record<string, any[]>;
  };
}

interface ReportRendererProps {
  impacts: CommitImpact[];
  snapshotDiffs?: any[];
}

const ReportRenderer: React.FC<ReportRendererProps> = ({ impacts, snapshotDiffs = [] }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'classifications' | 'commits' | 'callgraph' | 'snapshot'>('overview');

  if (!impacts || impacts.length === 0) {
    return (
      <div style={{ 
        padding: "20px", 
        textAlign: "center", 
        color: "var(--vscode-descriptionForeground)" 
      }}>
        <h3>📊 暂无分析数据</h3>
        <p>请点击"开始分析"按钮进行代码影响分析</p>
      </div>
    );
  }

  // 计算统计信息
  const stats = {
    totalCommits: impacts.length,
    totalChangedFiles: impacts.reduce((sum, impact) => sum + impact.changedFilesCount, 0),
    totalChangedMethods: impacts.reduce((sum, impact) => sum + impact.changedMethodsCount, 0),
    totalClassifiedFiles: impacts.reduce((sum, impact) => sum + (impact.changeClassifications?.length || 0), 0),
    avgConfidence: impacts.length > 0 
      ? impacts.reduce((sum, impact) => sum + (impact.classificationSummary?.averageConfidence || 0), 0) / impacts.length 
      : 0,
    categoryStats: impacts.reduce((acc, impact) => {
      if (impact.classificationSummary?.categoryStats) {
        Object.entries(impact.classificationSummary.categoryStats).forEach(([category, count]) => {
          acc[category] = (acc[category] || 0) + count;
        });
      }
      return acc;
    }, {} as Record<string, number>),
    importantChanges: impacts.filter(impact => 
      impact.changeClassifications?.some(fc => 
        fc.classification.category === 'A1' || fc.classification.category === 'A2'
      )
    )
  };

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('zh-CN');
    } catch {
      return timestamp;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'A1': '#ff9800',
      'A2': '#f44336', 
      'A3': '#9c27b0',
      'A4': '#3f51b5',
      'A5': '#4caf50'
    };
    return colors[category] || '#666';
  };

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      'A1': '业务逻辑变更',
      'A2': '接口变更',
      'A3': '数据结构变更', 
      'A4': '中间件/框架调整',
      'A5': '非功能性修改'
    };
    return names[category] || '未知类型';
  };

  const renderOverview = () => (
    <div style={{ padding: "12px" }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>📊 分析概览</h3>
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr 1fr", 
        gap: "8px",
        marginBottom: "12px"
      }}>
        <div style={{ 
          padding: "8px", 
          backgroundColor: "var(--vscode-textBlockQuote-background)",
          borderRadius: "4px",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--vscode-charts-blue)" }}>
            {stats.totalCommits}
          </div>
          <div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
            提交数
          </div>
        </div>
        <div style={{ 
          padding: "8px", 
          backgroundColor: "var(--vscode-textBlockQuote-background)",
          borderRadius: "4px",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--vscode-charts-green)" }}>
            {stats.totalChangedFiles}
          </div>
          <div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
            变更文件
          </div>
        </div>
        <div style={{ 
          padding: "8px", 
          backgroundColor: "var(--vscode-textBlockQuote-background)",
          borderRadius: "4px",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--vscode-charts-yellow)" }}>
            {stats.totalChangedMethods}
          </div>
          <div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
            变更方法
          </div>
        </div>
        <div style={{ 
          padding: "8px", 
          backgroundColor: "var(--vscode-textBlockQuote-background)",
          borderRadius: "4px",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--vscode-charts-purple)" }}>
            {stats.totalClassifiedFiles}
          </div>
          <div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
            分类文件
          </div>
        </div>
      </div>
      
      <h4 style={{ margin: "12px 0 8px 0", fontSize: "12px" }}>🏷️ 变更类型分布</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {Object.entries(stats.categoryStats).map(([category, count]) => (
          <div key={category} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 8px",
            backgroundColor: "var(--vscode-textBlockQuote-background)",
            borderRadius: "4px",
            borderLeft: `3px solid ${getCategoryColor(category)}`
          }}>
            <span style={{ fontSize: "11px" }}>
              {category} {getCategoryName(category)}
            </span>
            <span style={{ 
              fontSize: "11px", 
              fontWeight: "bold",
              color: getCategoryColor(category)
            }}>
              {count}
            </span>
          </div>
        ))}
      </div>

      <div style={{ 
        marginTop: "12px",
        padding: "8px",
        backgroundColor: "var(--vscode-textBlockQuote-background)",
        borderRadius: "4px",
        textAlign: "center"
      }}>
        <div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
          平均分类置信度
        </div>
        <div style={{ fontSize: "16px", fontWeight: "bold", color: "var(--vscode-charts-blue)" }}>
          {stats.avgConfidence.toFixed(1)}%
        </div>
      </div>
    </div>
  );

  const renderClassifications = () => (
    <div style={{ padding: "12px" }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>🎯 重要变更分类</h3>
      <p style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginBottom: "12px" }}>
        A1 业务逻辑变更和 A2 接口变更
      </p>
      {stats.importantChanges.length === 0 ? (
        <p style={{ color: "var(--vscode-descriptionForeground)", fontSize: "11px" }}>
          没有发现重要变更
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {stats.importantChanges.map((commit) => {
            const importantFiles = commit.changeClassifications?.filter(fc => 
              fc.classification.category === 'A1' || fc.classification.category === 'A2'
            ) || [];
            
            return importantFiles.map((fileClass, index) => (
              <div key={`${commit.commitId}-${index}`} style={{
                padding: "8px",
                backgroundColor: "var(--vscode-inputValidation-warningBackground)",
                borderRadius: "4px",
                border: "1px solid var(--vscode-inputValidation-warningBorder)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ 
                    fontFamily: "monospace", 
                    fontSize: "10px",
                    color: "var(--vscode-descriptionForeground)"
                  }}>
                    {commit.commitId ? commit.commitId.substring(0, 7) : 'Unknown'}
                  </span>
                  <span style={{ 
                    fontSize: "10px", 
                    fontWeight: "bold",
                    color: "white",
                    backgroundColor: getCategoryColor(fileClass.classification.category),
                    padding: "2px 6px",
                    borderRadius: "3px"
                  }}>
                    {fileClass.classification.categoryName}
                  </span>
                </div>
                <div style={{ fontSize: "11px", marginBottom: "4px", fontWeight: "500" }}>
                  {fileClass.filePath}
                </div>
                <div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", marginBottom: "4px" }}>
                  {fileClass.classification.reason}
                </div>
                <div style={{ fontSize: "9px", color: "var(--vscode-descriptionForeground)" }}>
                  {commit.author?.name || '未知作者'} • 置信度: {fileClass.classification.confidence.toFixed(1)}%
                </div>
              </div>
            ));
          })}
        </div>
      )}
    </div>
  );

  const renderCommits = () => (
    <div style={{ padding: "12px" }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>📝 提交详情</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {impacts.map((commit) => {
          // 获取主要分类
          const mainCategory = Object.entries(commit.classificationSummary?.categoryStats || {})
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'A5';

          return (
            <div key={commit.commitId} style={{
              padding: "8px",
              borderBottom: "1px solid var(--vscode-panel-border)",
              backgroundColor: "var(--vscode-textBlockQuote-background)",
              borderRadius: "4px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ 
                  fontFamily: "monospace", 
                  fontSize: "10px",
                  color: "var(--vscode-textLink-foreground)"
                }}>
                  {commit.commitId ? commit.commitId.substring(0, 7) : 'Unknown'}
                </span>
                <span style={{ 
                  fontSize: "9px", 
                  fontWeight: "bold",
                  color: "white",
                  backgroundColor: getCategoryColor(mainCategory),
                  padding: "2px 6px",
                  borderRadius: "3px"
                }}>
                  主要: {getCategoryName(mainCategory)}
                </span>
              </div>
              <div style={{ fontSize: "11px", marginBottom: "6px", fontWeight: "500" }}>
                {commit.message || '无提交信息'}
              </div>
              <div style={{ fontSize: "9px", color: "var(--vscode-descriptionForeground)", marginBottom: "4px" }}>
                作者: {commit.author?.name || '未知作者'} • {formatDate(commit.timestamp)}
              </div>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr", 
                gap: "4px",
                fontSize: "9px",
                color: "var(--vscode-descriptionForeground)",
                marginBottom: "6px"
              }}>
                <div>变更文件: {commit.changedFilesCount || 0}</div>
                <div>变更方法: {commit.changedMethodsCount || 0}</div>
                <div>影响方法: {commit.impactedMethods?.length || 0}</div>
                <div>影响测试: {Object.keys(commit.impactedTests || {}).length}</div>
              </div>
              
              {/* 分类详情 */}
              {commit.changeClassifications && commit.changeClassifications.length > 0 && (
                <div style={{ 
                  marginTop: "6px",
                  padding: "6px",
                  backgroundColor: "var(--vscode-editorWidget-background)",
                  borderRadius: "3px",
                  fontSize: "9px"
                }}>
                  <div style={{ fontWeight: "bold", marginBottom: "4px" }}>文件分类:</div>
                  {commit.changeClassifications.slice(0, 3).map((fc, index) => (
                    <div key={index} style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      marginBottom: "2px"
                    }}>
                      <span style={{ fontSize: "8px", color: "var(--vscode-descriptionForeground)" }}>
                        {fc.filePath.split('/').pop()}
                      </span>
                      <span style={{ 
                        fontSize: "8px",
                        color: getCategoryColor(fc.classification.category),
                        fontWeight: "bold"
                      }}>
                        {fc.classification.category}
                      </span>
                    </div>
                  ))}
                  {commit.changeClassifications.length > 3 && (
                    <div style={{ fontSize: "8px", color: "var(--vscode-descriptionForeground)" }}>
                      ...还有 {commit.changeClassifications.length - 3} 个文件
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderSnapshot = () => (
    <div style={{ padding: "12px" }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>📸 组件变动</h3>
      <SnapshotDiffList changes={snapshotDiffs} />
    </div>
  );

  return (
    <div className="report-renderer react-component" style={{
      display: "flex",
      flexDirection: "column", 
      height: "100%",
      backgroundColor: "var(--vscode-editor-background)"
    }}>
      {/* Tab navigation */}
      <div style={{ 
        display: "flex",
        borderBottom: "1px solid var(--vscode-panel-border)",
        backgroundColor: "var(--vscode-tab-inactiveBackground)"
      }}>
        {[
          { key: 'overview', label: '📊 概览' },
          { key: 'classifications', label: '🎯 重要变更' },
          { key: 'commits', label: '📝 提交' },
          { key: 'callgraph', label: '🔗 调用图' },
          { key: 'snapshot', label: '📸 组件变动' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: "8px 12px",
              border: "none",
              backgroundColor: activeTab === tab.key ? "var(--vscode-tab-activeBackground)" : "transparent",
              color: activeTab === tab.key ? "var(--vscode-tab-activeForeground)" : "var(--vscode-tab-inactiveForeground)",
              cursor: "pointer",
              fontSize: "11px",
              borderBottom: activeTab === tab.key ? "2px solid var(--vscode-focusBorder)" : "none"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: "1", overflow: "auto" }}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'classifications' && renderClassifications()}
        {activeTab === 'commits' && renderCommits()}
        {activeTab === 'callgraph' && (
          <CallGraphVisualization 
            data={{ 
              impactedFiles: impacts.map(impact => ({
                file: impact.commitId,
                methods: impact.impactedMethods.map(method => ({
                  name: method,
                  signature: method,
                  file: impact.commitId
                }))
              }))
            }} 
          />
        )}
        {activeTab === 'snapshot' && renderSnapshot()}
      </div>
    </div>
  );
};

export default ReportRenderer; 