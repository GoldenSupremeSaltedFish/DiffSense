import { useState, useEffect } from "react";
import { postMessage } from "../utils/vscode";
import ReportRenderer from "./ReportRenderer";

// 类型定义
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

const CommitList = () => {
  const [impacts, setImpacts] = useState<CommitImpact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportPath, setReportPath] = useState<string | null>(null);

  useEffect(() => {
    // 监听来自扩展的消息
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.command) {
        case 'analysisResult':
          try {
            // 解析JSON数据
            const jsonData = typeof message.data === 'string' ? 
              JSON.parse(message.data) : message.data;
            
            console.log('收到分析结果:', jsonData);
            console.log('数据类型:', typeof jsonData);
            console.log('是否为数组:', Array.isArray(jsonData));
            
            if (Array.isArray(jsonData)) {
              console.log('数组长度:', jsonData.length);
              if (jsonData.length > 0) {
                console.log('第一个元素:', jsonData[0]);
                console.log('第一个元素的commitId:', jsonData[0]?.commitId);
                console.log('第一个元素类型:', typeof jsonData[0]);
              }
            }
            
            setImpacts(Array.isArray(jsonData) ? jsonData : []);
            setReportPath(message.reportPath || null);
            setIsLoading(false);
            setError(null);
          } catch (parseError) {
            console.error('解析JSON数据失败:', parseError);
            console.error('原始数据:', message.data);
            setError('解析分析结果失败');
            setIsLoading(false);
          }
          break;
        case 'analysisError':
          setError(message.error);
          setIsLoading(false);
          // 保持现有数据，不清空
          break;
        case 'analysisStarted':
          setIsLoading(true);
          setError(null);
          // 不清空现有数据，保持界面状态
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleOpenReport = () => {
    if (reportPath) {
      postMessage({
        command: 'openReport',
        reportPath: reportPath
      });
    }
  };

  const handleOpenReportInBrowser = () => {
    if (reportPath) {
      postMessage({
        command: 'openReportInBrowser', 
        reportPath: reportPath
      });
    }
  };

  // 显示加载状态
  if (isLoading) {
    return (
      <div className="commit-list react-component" style={{ 
        textAlign: 'center', 
        padding: 'var(--sidebar-gap)',
        color: 'var(--vscode-foreground)',
        fontSize: '11px'
      }}>
        <div>🔄 正在分析中...</div>
        <div style={{ 
          marginTop: '4px', 
          fontSize: '9px',
          color: 'var(--vscode-descriptionForeground)'
        }}>
          请稍候，分析可能需要几分钟...
        </div>
      </div>
    );
  }

  // 显示错误状态
  if (error) {
    return (
      <div className="commit-list react-component" style={{ 
        color: 'var(--vscode-errorForeground)', 
        padding: 'var(--sidebar-gap)',
        backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
        borderRadius: '3px',
        fontSize: '10px'
      }}>
        <div style={{ marginBottom: '4px' }}>❌ 分析失败:</div>
        <div style={{ 
          marginBottom: '8px',
          fontSize: '9px',
          wordBreak: 'break-word'
        }}>
          {error}
        </div>
        {/* 如果有现有数据，仍然显示 */}
        {impacts.length > 0 && (
          <div>
            <div style={{ 
              fontSize: '9px',
              color: 'var(--vscode-descriptionForeground)',
              marginBottom: '8px'
            }}>
              显示上次分析结果:
            </div>
            <ReportRenderer impacts={impacts} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="commit-list react-component" style={{ 
      flex: 1, 
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 报告操作区域 - 如果有报告路径的话 */}
      {reportPath && (
        <div style={{
          padding: 'var(--sidebar-gap)',
          backgroundColor: 'var(--vscode-textBlockQuote-background)',
          borderRadius: '3px',
          marginBottom: 'var(--sidebar-gap)',
          borderLeft: '3px solid var(--vscode-textBlockQuote-border)'
        }}>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: '600',
            marginBottom: '4px',
            color: 'var(--vscode-foreground)'
          }}>
            📊 HTML报告已生成
          </div>
          <div style={{ 
            fontSize: '9px',
            color: 'var(--vscode-descriptionForeground)',
            marginBottom: '6px',
            wordBreak: 'break-all'
          }}>
            {reportPath}
          </div>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '4px'
          }}>
            <button 
              onClick={handleOpenReportInBrowser}
              style={{ 
                fontSize: '10px',
                padding: '4px 6px',
                backgroundColor: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)'
              }}
            >
              🌐 在浏览器中打开
            </button>
            <button 
              onClick={handleOpenReport}
              style={{ 
                fontSize: '10px',
                padding: '4px 6px',
                backgroundColor: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)'
              }}
            >
              📝 在VSCode中查看
            </button>
          </div>
        </div>
      )}

      {/* 使用新的ReportRenderer显示数据 */}
      <div style={{ flex: 1 }}>
        <ReportRenderer impacts={impacts} />
      </div>
    </div>
  );
};

export default CommitList; 