import ReportRenderer from "./ReportRenderer";

interface CommitListProps {
  analysisResults: any[];
}

const CommitList = ({ analysisResults }: CommitListProps) => {
  console.log('CommitList渲染，结果数量:', analysisResults?.length || 0);

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "auto",
      padding: "8px"
    }}>
      {analysisResults && analysisResults.length > 0 ? (
        <ReportRenderer impacts={analysisResults} />
      ) : (
        <div style={{
          textAlign: "center",
          padding: "40px",
          color: "var(--vscode-descriptionForeground)",
          fontSize: "14px"
        }}>
          <div>🔍 暂无分析结果</div>
          <div style={{ fontSize: "12px", marginTop: "8px" }}>
            选择分支和范围后点击"开始分析"
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitList; 