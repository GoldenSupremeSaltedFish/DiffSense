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

interface ModificationDetail {
  type: string;
  typeName: string;
  description: string;
  file: string;
  method?: string;
  confidence: number;
  indicators: string[];
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
  modifications?: ModificationDetail[];
}

interface ReportRendererProps {
  impacts: CommitImpact[];
  snapshotDiffs?: any[];
}

const ReportRenderer: React.FC<ReportRendererProps> = ({ impacts, snapshotDiffs = [] }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'classifications' | 'commits' | 'modifications' | 'callgraph' | 'snapshot'>('overview');
  // TODO: 待实现国际化
  // const { currentLanguage, t } = useLanguage();

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
      // 后端分类 (A1-A5)
      'A1': '#ff9800',
      'A2': '#f44336', 
      'A3': '#9c27b0',
      'A4': '#3f51b5',
      'A5': '#4caf50',
      // 前端分类 (F1-F5)
      'F1': '#e91e63',
      'F2': '#2196f3',
      'F3': '#ff5722',
      'F4': '#795548',
      'F5': '#607d8b'
    };
    return colors[category] || '#666';
  };

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      // 后端分类
      'A1': '业务逻辑变更',
      'A2': '接口变更',
      'A3': '数据结构变更', 
      'A4': '中间件/框架调整',
      'A5': '非功能性修改',
      // 前端分类
      'F1': '组件行为变更',
      'F2': 'UI结构调整',
      'F3': '样式改动',
      'F4': '交互事件修改',
      'F5': '依赖/配置变动'
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
              {getCategoryName(category)}
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
          // 获取所有分类及其数量
          const categoryStats = commit.classificationSummary?.categoryStats || {};
          const allCategories = Object.entries(categoryStats).filter(([_, count]) => count > 0);
          const mainCategory = allCategories.sort(([,a], [,b]) => b - a)[0]?.[0] || 'A5';

          return (
          <div key={commit.commitId} style={{
            padding: "8px",
            borderBottom: "1px solid var(--vscode-panel-border)",
            backgroundColor: "var(--vscode-textBlockQuote-background)",
            borderRadius: "4px"
          }}>
            {/* 提交头部 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ 
                  fontFamily: "monospace", 
                  fontSize: "10px",
                  color: "var(--vscode-textLink-foreground)"
                }}>
                  {commit.commitId ? commit.commitId.substring(0, 7) : 'Unknown'}
                </span>
                
                {/* 显示所有分类标签 */}
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {allCategories.map(([category, count]) => (
                    <span key={category} style={{ 
                      fontSize: "8px", 
                      fontWeight: "bold",
                      color: "white",
                      backgroundColor: getCategoryColor(category),
                      padding: "2px 4px",
                      borderRadius: "2px",
                      display: "flex",
                      alignItems: "center",
                      gap: "2px"
                    }}>
                      {getCategoryName(category)}
                      <span style={{ 
                        fontSize: "7px", 
                        backgroundColor: "rgba(255,255,255,0.3)",
                        padding: "1px 3px",
                        borderRadius: "2px"
                      }}>
                        {count}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              
              {/* 主要分类指示器 */}
              <div style={{
                fontSize: "8px",
                color: getCategoryColor(mainCategory),
                fontWeight: "bold",
                padding: "2px 4px",
                border: `1px solid ${getCategoryColor(mainCategory)}`,
                borderRadius: "2px",
                backgroundColor: `${getCategoryColor(mainCategory)}15`
              }}>
                主要: {getCategoryName(mainCategory)}
              </div>
            </div>
            
            <div style={{ fontSize: "11px", marginBottom: "6px", fontWeight: "500" }}>
              {commit.message || '无提交信息'}
            </div>
            <div style={{ fontSize: "9px", color: "var(--vscode-descriptionForeground)", marginBottom: "6px" }}>
                作者: {commit.author?.name || '未知作者'} • {formatDate(commit.timestamp)}
            </div>
            
            {/* 统计信息 */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: "4px",
              fontSize: "9px",
              color: "var(--vscode-descriptionForeground)",
              marginBottom: "8px"
            }}>
              <div>变更文件: {commit.changedFilesCount || 0}</div>
              <div>变更方法: {commit.changedMethodsCount || 0}</div>
              <div>影响方法: {commit.impactedMethods?.length || 0}</div>
              <div>影响测试: {Object.keys(commit.impactedTests || {}).length}</div>
            </div>
            
            {/* 分类摘要 */}
            {allCategories.length > 0 && (
              <div style={{ 
                marginBottom: "6px",
                padding: "6px",
                backgroundColor: "var(--vscode-editorWidget-background)",
                borderRadius: "3px",
                fontSize: "9px"
              }}>
                <div style={{ fontWeight: "bold", marginBottom: "4px" }}>🏷️ 修改类型摘要:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {allCategories.map(([category, count]) => (
                    <div key={category} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "2px 4px",
                      borderRadius: "2px",
                      backgroundColor: `${getCategoryColor(category)}10`
                    }}>
                      <span style={{ 
                        color: getCategoryColor(category),
                        fontWeight: "bold",
                        fontSize: "8px"
                      }}>
                        {getCategoryName(category)}
                      </span>
                      <span style={{ 
                        fontSize: "8px",
                        color: "var(--vscode-descriptionForeground)"
                      }}>
                        {count} 个文件
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 细粒度修改标签 */}
            {commit.modifications && commit.modifications.length > 0 && (
              <div style={{ 
                marginBottom: "6px",
                padding: "6px",
                backgroundColor: "var(--vscode-editorWidget-background)",
                borderRadius: "3px",
                fontSize: "9px"
              }}>
                <div style={{ fontWeight: "bold", marginBottom: "4px" }}>🔍 细粒度修改标签:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {(() => {
                    // 按类型分组并统计
                    const modificationStats = commit.modifications.reduce((acc, mod) => {
                      if (!acc[mod.type]) {
                        acc[mod.type] = { count: 0, typeName: mod.typeName };
                      }
                      acc[mod.type].count++;
                      return acc;
                    }, {} as Record<string, { count: number; typeName: string }>);

                    const getModificationTypeColor = (type: string) => {
                      const colors: Record<string, string> = {
                        'behavior-change': '#ff6b6b',
                        'interface-change': '#4ecdc4',
                        'api-endpoint-change': '#45b7d1',
                        'config-change': '#96ceb4',
                        'logging-added': '#feca57',
                        'test-modified': '#ff9ff3',
                        'dependency-updated': '#54a0ff',
                        'css-change': '#ff6348',
                        'component-logic-change': '#2ed573',
                        'hook-change': '#5f27cd'
                      };
                      return colors[type] || '#6c757d';
                    };

                    return Object.entries(modificationStats).map(([type, stats]) => (
                      <span key={type} style={{
                        display: "inline-block",
                        fontSize: "8px",
                        padding: "2px 6px",
                        borderRadius: "10px",
                        backgroundColor: getModificationTypeColor(type) + '20',
                        color: getModificationTypeColor(type),
                        fontWeight: "bold",
                        border: `1px solid ${getModificationTypeColor(type)}40`
                      }}>
                        {stats.typeName} ({stats.count})
                      </span>
                    ));
                  })()}
                </div>
              </div>
            )}
              
            {/* 分类详情 */}
            {commit.changeClassifications && commit.changeClassifications.length > 0 && (
              <div style={{ 
                marginTop: "6px",
                padding: "6px",
                backgroundColor: "var(--vscode-editorWidget-background)",
                borderRadius: "3px",
                fontSize: "9px"
              }}>
                <div style={{ fontWeight: "bold", marginBottom: "4px" }}>📁 文件分类详情:</div>
                {commit.changeClassifications.slice(0, 5).map((fc, index) => (
                  <div key={index} style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    marginBottom: "2px",
                    padding: "2px 4px",
                    borderRadius: "2px",
                    backgroundColor: `${getCategoryColor(fc.classification.category)}10`
                  }}>
                    <span style={{ 
                      fontSize: "8px", 
                      color: "var(--vscode-descriptionForeground)",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {fc.filePath.split('/').pop()}
                    </span>
                    <span style={{ 
                      fontSize: "8px",
                      color: getCategoryColor(fc.classification.category),
                      fontWeight: "bold",
                      marginLeft: "8px"
                    }}>
                      {getCategoryName(fc.classification.category)}
                    </span>
                  </div>
                ))}
                {commit.changeClassifications.length > 5 && (
                  <div style={{ 
                    fontSize: "8px", 
                    color: "var(--vscode-descriptionForeground)",
                    textAlign: "center",
                    marginTop: "4px",
                    fontStyle: "italic"
                  }}>
                    ...还有 {commit.changeClassifications.length - 5} 个文件
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

  const renderModifications = () => {
    // 收集所有提交的细粒度修改详情
    const allModifications = impacts.reduce((acc, impact) => {
      if (impact.modifications) {
        acc.push(...impact.modifications.map(mod => ({
          ...mod,
          commitId: impact.commitId,
          commitMessage: impact.message,
          timestamp: impact.timestamp
        })));
      }
      return acc;
    }, [] as Array<ModificationDetail & { commitId: string; commitMessage: string; timestamp: string }>);

    if (allModifications.length === 0) {
      return (
        <div style={{ padding: "12px", textAlign: "center", color: "var(--vscode-descriptionForeground)" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>🔍 细粒度修改详情</h3>
          <p>暂无细粒度修改数据，请使用 --include-type-tags 参数进行分析</p>
        </div>
      );
    }

    // 按修改类型分组
    const modificationsByType = allModifications.reduce((acc, mod) => {
      if (!acc[mod.type]) {
        acc[mod.type] = [];
      }
      acc[mod.type].push(mod);
      return acc;
    }, {} as Record<string, Array<ModificationDetail & { commitId: string; commitMessage: string; timestamp: string }>>);

    const getModificationTypeColor = (type: string) => {
      const colors: Record<string, string> = {
        'behavior-change': '#ff6b6b',
        'interface-change': '#4ecdc4',
        'api-endpoint-change': '#45b7d1',
        'config-change': '#96ceb4',
        'logging-added': '#feca57',
        'test-modified': '#ff9ff3',
        'dependency-updated': '#54a0ff',
        'css-change': '#ff6348',
        'component-logic-change': '#2ed573',
        'hook-change': '#5f27cd'
      };
      return colors[type] || '#6c757d';
    };

    return (
      <div style={{ padding: "12px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>🔍 细粒度修改详情</h3>
        
        <div style={{ marginBottom: "12px", fontSize: "11px", color: "var(--vscode-descriptionForeground)" }}>
          总计 {allModifications.length} 个细粒度修改，涵盖 {Object.keys(modificationsByType).length} 种类型
        </div>

        {Object.entries(modificationsByType).map(([type, modifications]) => (
          <div key={type} style={{ 
            marginBottom: "16px",
            border: "1px solid var(--vscode-panel-border)",
            borderRadius: "4px",
            overflow: "hidden"
          }}>
            {/* 类型标题 */}
            <div style={{
              padding: "8px 12px",
              backgroundColor: getModificationTypeColor(type) + '20',
              borderBottom: "1px solid var(--vscode-panel-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{
                fontWeight: "bold",
                fontSize: "12px",
                color: getModificationTypeColor(type)
              }}>
                {modifications[0].typeName || type}
              </span>
              <span style={{
                fontSize: "10px",
                color: "var(--vscode-descriptionForeground)",
                backgroundColor: "var(--vscode-badge-background)",
                padding: "2px 6px",
                borderRadius: "10px"
              }}>
                {modifications.length} 个修改
              </span>
            </div>

            {/* 修改列表 */}
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {modifications.map((mod, index) => (
                <div key={index} style={{
                  padding: "8px 12px",
                  borderBottom: index < modifications.length - 1 ? "1px solid var(--vscode-panel-border)" : "none",
                  backgroundColor: index % 2 === 0 ? "var(--vscode-list-evenBackground)" : "transparent"
                }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "4px"
                  }}>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: "500",
                      color: "var(--vscode-editor-foreground)"
                    }}>
                      {mod.description}
                    </span>
                    <span style={{
                      fontSize: "9px",
                      color: "var(--vscode-descriptionForeground)",
                      backgroundColor: "var(--vscode-textCodeBlock-background)",
                      padding: "2px 4px",
                      borderRadius: "2px",
                      marginLeft: "8px",
                      whiteSpace: "nowrap"
                    }}>
                      置信度: {Math.round(mod.confidence * 100)}%
                    </span>
                  </div>
                  
                  <div style={{
                    fontSize: "9px",
                    color: "var(--vscode-descriptionForeground)",
                    marginBottom: "2px"
                  }}>
                    📁 {mod.file}
                    {mod.method && ` → ${mod.method}()`}
                  </div>
                  
                  <div style={{
                    fontSize: "9px",
                    color: "var(--vscode-descriptionForeground)"
                  }}>
                    💾 提交: {mod.commitId.substring(0, 8)} - {mod.commitMessage.substring(0, 50)}
                    {mod.commitMessage.length > 50 && '...'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

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
      minHeight: "100%",
      backgroundColor: "var(--vscode-editor-background)"
    }}>
      {/* Tab navigation */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "4px",
        borderBottom: "1px solid var(--vscode-panel-border)",
        backgroundColor: "var(--vscode-tab-inactiveBackground)",
        padding: "4px"
      }}>
        {[
          { key: 'overview', label: '📊 概览' },
          { key: 'classifications', label: '🎯 重要变更' },
          { key: 'commits', label: '📝 提交' },
          { key: 'modifications', label: '🔍 细粒度修改' },
          { key: 'callgraph', label: '🔗 调用图' },
          { key: 'snapshot', label: '📸 组件变动' }
        ].map(tab => {
          const tabLabel = tab.label;
          
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: "8px 16px",
                border: "none",
                backgroundColor: activeTab === tab.key ? "var(--vscode-tab-activeBackground)" : "transparent",
                color: activeTab === tab.key ? "var(--vscode-tab-activeForeground)" : "var(--vscode-tab-inactiveForeground)",
                cursor: "pointer",
                fontSize: "12px",
                borderBottom: activeTab === tab.key ? "2px solid var(--vscode-focusBorder)" : "none",
                position: "relative",
                minWidth: "fit-content",
                whiteSpace: "nowrap",
                borderRadius: "4px 4px 0 0",
                transition: "all 0.2s ease"
              }}
            >
              {tabLabel}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: "1", overflow: "visible" }}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'classifications' && renderClassifications()}
        {activeTab === 'commits' && renderCommits()}
        {activeTab === 'modifications' && renderModifications()}
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