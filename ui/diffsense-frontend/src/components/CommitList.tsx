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
    <div className="flex-1 flex flex-col overflow-visible p-2">
      {analysisResults && analysisResults.length > 0 ? (
        <ReportRenderer impacts={analysisResults} snapshotDiffs={snapshotDiffs} />
      ) : (
        <div className="text-center p-10 text-subtle text-sm animate-fade-in">
          <div>🔍 暂无分析结果</div>
          {error ? (
            <div className="text-xs mt-3 p-3 rounded border text-left max-w-[600px] mx-auto bg-[var(--vscode-inputValidation-errorBackground)] border-[var(--vscode-inputValidation-errorBorder)] text-[var(--vscode-errorForeground)]">
              <div className="font-semibold mb-1">❌ 分析失败</div>
              <div className="text-[11px] break-words">{error}</div>
            </div>
          ) : hasAnalyzed ? (
            <div className="text-xs mt-3 p-3 rounded border bg-[var(--vscode-inputValidation-infoBackground)] border-[var(--vscode-inputValidation-infoBorder)] text-text">
              ⚠️ 分析完成，但未返回结果数据
            </div>
          ) : (
            <div className="text-xs mt-2">
              选择分支和范围后点击“开始分析”
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommitList; 
