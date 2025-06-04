import { useState } from 'react';

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
  riskScore: number;
}

interface ReportRendererProps {
  impacts: CommitImpact[];
}

const ReportRenderer: React.FC<ReportRendererProps> = ({ impacts }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'risks' | 'commits'>('overview');

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
    avgRiskScore: impacts.length > 0 ? impacts.reduce((sum, impact) => sum + impact.riskScore, 0) / impacts.length : 0,
    highRiskCommits: impacts.filter(impact => impact.riskScore > 20)
  };

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('zh-CN');
    } catch {
      return timestamp;
    }
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
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--vscode-charts-red)" }}>
            {stats.avgRiskScore.toFixed(1)}
          </div>
          <div style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)" }}>
            平均风险分
          </div>
        </div>
      </div>
    </div>
  );

  const renderRisks = () => (
    <div style={{ padding: "12px" }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>⚠️ 高风险改动</h3>
      {stats.highRiskCommits.length === 0 ? (
        <p style={{ color: "var(--vscode-descriptionForeground)", fontSize: "11px" }}>
          没有发现高风险改动
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {stats.highRiskCommits.map((commit) => (
            <div key={commit.commitId} style={{
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
                  fontSize: "12px", 
                  fontWeight: "bold",
                  color: "var(--vscode-errorForeground)"
                }}>
                  风险分: {commit.riskScore}
                </span>
              </div>
              <div style={{ fontSize: "11px", marginBottom: "4px" }}>
                {commit.message || '无提交信息'}
              </div>
              <div style={{ fontSize: "9px", color: "var(--vscode-descriptionForeground)" }}>
                {commit.author?.name || '未知作者'} • 变更: {commit.changedFilesCount || 0} 文件, {commit.changedMethodsCount || 0} 方法
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCommits = () => (
    <div style={{ padding: "12px" }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>📝 提交详情</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {impacts.map((commit) => (
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
              <span style={{ fontSize: "9px", color: "var(--vscode-descriptionForeground)" }}>
                {formatDate(commit.timestamp)}
              </span>
            </div>
            <div style={{ fontSize: "11px", marginBottom: "6px", fontWeight: "500" }}>
              {commit.message || '无提交信息'}
            </div>
            <div style={{ fontSize: "9px", color: "var(--vscode-descriptionForeground)", marginBottom: "4px" }}>
              作者: {commit.author?.name || '未知作者'}
            </div>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: "4px",
              fontSize: "9px",
              color: "var(--vscode-descriptionForeground)"
            }}>
              <div>变更文件: {commit.changedFilesCount || 0}</div>
              <div>变更方法: {commit.changedMethodsCount || 0}</div>
              <div>影响方法: {commit.impactedMethods?.length || 0}</div>
              <div>影响测试: {Object.keys(commit.impactedTests || {}).length}</div>
            </div>
            {commit.riskScore > 0 && (
              <div style={{ 
                marginTop: "4px",
                padding: "2px 6px",
                backgroundColor: commit.riskScore > 20 ? "var(--vscode-errorForeground)" : "var(--vscode-charts-yellow)",
                color: "white",
                borderRadius: "2px",
                fontSize: "9px",
                display: "inline-block"
              }}>
                风险分: {commit.riskScore}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="report-renderer react-component" style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      backgroundColor: "var(--vscode-editor-background)"
    }}>
      {/* 标签页导航 */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--vscode-panel-border)",
        backgroundColor: "var(--vscode-tab-activeBackground)"
      }}>
        {[
          { key: 'overview', label: '概览', icon: '📊' },
          { key: 'risks', label: '风险', icon: '⚠️' },
          { key: 'commits', label: '提交', icon: '📝' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: "6px 12px",
              border: "none",
              backgroundColor: activeTab === tab.key ? 
                "var(--vscode-tab-activeBackground)" : 
                "var(--vscode-tab-inactiveBackground)",
              color: activeTab === tab.key ? 
                "var(--vscode-tab-activeForeground)" : 
                "var(--vscode-tab-inactiveForeground)",
              fontSize: "10px",
              cursor: "pointer",
              borderBottom: activeTab === tab.key ? 
                "2px solid var(--vscode-focusBorder)" : "none"
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'risks' && renderRisks()}
        {activeTab === 'commits' && renderCommits()}
      </div>
    </div>
  );
};

export default ReportRenderer; 