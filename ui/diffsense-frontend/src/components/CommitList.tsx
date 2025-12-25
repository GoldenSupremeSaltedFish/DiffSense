import ReportRenderer from "./ReportRenderer";

interface CommitListProps {
  analysisResults: any[];
  snapshotDiffs?: any[];
  error?: string | null;
  hasAnalyzed?: boolean;
}

const CommitList = ({ analysisResults, snapshotDiffs = [], error, hasAnalyzed = false }: CommitListProps) => {
  console.log('CommitList渲染，结果数量:', analysisResults?.length || 0, '错误:', error, '已分析:', hasAnalyzed);

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "visible",
      padding: "8px"
    }}>
      {analysisResults && analysisResults.length > 0 ? (
        <ReportRenderer impacts={analysisResults} snapshotDiffs={snapshotDiffs} />
      ) : (
        <div style={{
          textAlign: "center",
          padding: "40px",
          color: "var(--vscode-descriptionForeground)",
          fontSize: "14px"
        }}>
          <div>🔍 暂无分析结果</div>
          {error ? (
            <div style={{ 
              fontSize: "12px", 
              marginTop: "12px",
              padding: "12px",
              backgroundColor: "var(--vscode-inputValidation-errorBackground)",
              color: "var(--vscode-errorForeground)",
              borderRadius: "4px",
              border: "1px solid var(--vscode-inputValidation-errorBorder)",
              textAlign: "left",
              maxWidth: "600px",
              margin: "12px auto 0"
            }}>
              <div style={{ fontWeight: "600", marginBottom: "4px" }}>❌ 分析失败</div>
              <div style={{ fontSize: "11px", wordBreak: "break-word" }}>{error}</div>
            </div>
          ) : hasAnalyzed ? (
            <div style={{ 
              fontSize: "12px", 
              marginTop: "12px",
              padding: "12px",
              backgroundColor: "var(--vscode-inputValidation-infoBackground)",
              color: "var(--vscode-foreground)",
              borderRadius: "4px",
              border: "1px solid var(--vscode-inputValidation-infoBorder)"
            }}>
              ⚠️ 分析完成，但未返回结果数据
            </div>
          ) : (
            <div style={{ fontSize: "12px", marginTop: "8px" }}>
              选择分支和范围后点击"开始分析"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommitList; 