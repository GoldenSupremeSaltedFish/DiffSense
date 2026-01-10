
import React, { useState, useEffect } from 'react';
import type { AnalysisViewModel } from '../models/ProductModeModel';

interface ProductModeViewProps {
  model: AnalysisViewModel | null; // Null if no analysis yet
  branches: string[];
  initialBranch: string;
  onSwitchToExpert: () => void;
  onAnalyze: (branch: string, scope: string) => void;
  isAnalyzing: boolean;
}

const ProductModeView: React.FC<ProductModeViewProps> = ({ 
  model, 
  branches, 
  initialBranch, 
  onSwitchToExpert, 
  onAnalyze, 
  isAnalyzing 
}) => {
  const [selectedBranch, setSelectedBranch] = useState(initialBranch);
  const [selectedScope, setSelectedScope] = useState('Last 5 commits');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Update internal branch state if initialBranch changes (e.g. loaded later)
  useEffect(() => {
    if (initialBranch && !selectedBranch) {
      setSelectedBranch(initialBranch);
    }
  }, [initialBranch]);

  const hasResults = model && model.items.length > 0;

  const handleStart = () => {
    onAnalyze(selectedBranch, selectedScope);
  };

  const handleReset = () => {
    setSelectedBranch(initialBranch);
    setSelectedScope('Last 5 commits');
  };

  const handleExport = () => {
    if (!model) return;
    const json = JSON.stringify(model, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      // Could show a toast here if we had one
      console.log('Copied to clipboard');
    });
  };

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedItems(newSet);
  };

  const getRiskColor = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high': return 'var(--vscode-charts-red)';
      case 'medium': return 'var(--vscode-charts-orange)';
      case 'low': return 'var(--vscode-charts-green)';
      default: return 'var(--vscode-descriptionForeground)';
    }
  };

  const getRiskIcon = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  if (hasResults && model) {
    const { summary, items } = model;
    
    return (
      <div style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        gap: '20px',
        fontFamily: 'var(--vscode-font-family)',
        overflowY: 'auto'
      }}>
        {/* 3. 关键提示区域 (Critical Alerts) */}
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
          borderLeft: `4px solid ${getRiskColor(summary.level)}`,
          borderRadius: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px', marginRight: '8px' }}>{getRiskIcon(summary.level)}</span>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{summary.headline}</h2>
          </div>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--vscode-foreground)' }}>
            {summary.recommendation}
          </p>
          
          {summary.keyFindings.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--vscode-descriptionForeground)', marginBottom: '8px' }}>
                关键发现
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                {summary.keyFindings.map((finding, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{finding}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 4. 分析结果展示 (Analysis Results) */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>变更详情</h3>
            <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
              共 {items.length} 个提交
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map(item => (
              <div key={item.id} style={{
                border: '1px solid var(--vscode-widget-border)',
                borderRadius: '4px',
                backgroundColor: 'var(--vscode-editor-background)',
                overflow: 'hidden'
              }}>
                {/* List Item Header */}
                <div 
                  onClick={() => toggleExpand(item.id)}
                  style={{
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    backgroundColor: expandedItems.has(item.id) ? 'var(--vscode-list-hoverBackground)' : 'transparent'
                  }}
                >
                  {/* Risk Indicator */}
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    backgroundColor: getRiskColor(item.riskLevel),
                    marginRight: '12px',
                    flexShrink: 0
                  }} />

                  {/* Main Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '12px', 
                        fontWeight: 'bold', 
                        marginRight: '8px',
                        color: 'var(--vscode-textLink-foreground)'
                      }}>
                        {item.id.substring(0, 7)}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.message.split('\n')[0]}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', display: 'flex', gap: '12px' }}>
                      <span>{item.author}</span>
                      <span>{item.time}</span>
                      <span>{item.fileCount} 文件</span>
                    </div>
                  </div>

                  {/* Risk Summary */}
                  <div style={{ 
                    marginLeft: '12px', 
                    fontSize: '11px', 
                    color: getRiskColor(item.riskLevel),
                    fontWeight: '600',
                    textAlign: 'right',
                    flexShrink: 0
                  }}>
                    {item.riskSummary}
                  </div>
                </div>

                {/* Expandable Details */}
                {expandedItems.has(item.id) && (
                  <div style={{
                    padding: '10px 10px 10px 30px',
                    borderTop: '1px solid var(--vscode-widget-border)',
                    backgroundColor: 'var(--vscode-textBlockQuote-background)',
                    fontSize: '12px'
                  }}>
                    {item.details?.affectedModules && item.details.affectedModules.length > 0 ? (
                      <div>
                        <span style={{ fontWeight: '600', marginRight: '8px' }}>受影响模块:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {item.details.affectedModules.map((mod, idx) => (
                            <span key={idx} style={{
                              backgroundColor: 'var(--vscode-badge-background)',
                              color: 'var(--vscode-badge-foreground)',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '11px'
                            }}>
                              {mod}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--vscode-descriptionForeground)' }}>无详细模块信息</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 5. 操作按钮 (Action Buttons) */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button
            onClick={handleStart}
            disabled={isAnalyzing}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '2px',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              opacity: isAnalyzing ? 0.7 : 1,
              fontWeight: '600'
            }}
          >
            {isAnalyzing ? '分析中...' : '重新分析'}
          </button>
          
          <button
            onClick={handleExport}
            style={{
              padding: '10px 16px',
              backgroundColor: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
            title="复制结果 JSON 到剪贴板"
          >
            复制/导出
          </button>

          <button
             onClick={onSwitchToExpert}
             style={{
               padding: '10px 16px',
               backgroundColor: 'transparent',
               color: 'var(--vscode-textLink-foreground)',
               border: '1px solid var(--vscode-button-secondaryBackground)',
               borderRadius: '2px',
               cursor: 'pointer'
             }}
          >
            专家模式
          </button>
        </div>

        {/* 6. 辅助信息 (Auxiliary Info) */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '16px', 
          fontSize: '11px', 
          color: 'var(--vscode-descriptionForeground)',
          paddingTop: '10px',
          borderTop: '1px solid var(--vscode-widget-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--vscode-charts-red)' }} />
            <span>高风险</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--vscode-charts-orange)' }} />
            <span>中风险</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--vscode-charts-green)' }} />
            <span>低风险</span>
          </div>
        </div>
      </div>
    );
  }

  // --- Input View (Home Page) ---
  return (
    <div style={{
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxSizing: 'border-box',
      fontFamily: 'var(--vscode-font-family)',
      maxWidth: '600px',
      margin: '0 auto',
      justifyContent: 'center'
    }}>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Commit Hero</h1>
        <p style={{ color: 'var(--vscode-descriptionForeground)' }}>代码变更风险评估 - 简易模式</p>
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
        
        {/* Branch Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600' }}>分析分支</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={isAnalyzing}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '13px',
                backgroundColor: 'var(--vscode-dropdown-background)',
                color: 'var(--vscode-dropdown-foreground)',
                border: '1px solid var(--vscode-dropdown-border)',
                borderRadius: '4px',
                outline: 'none'
              }}
            >
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
              {branches.length === 0 && <option value="">Loading branches...</option>}
            </select>
            <button
              onClick={handleReset}
              title="重置选项"
              style={{
                padding: '8px',
                backgroundColor: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔄
            </button>
          </div>
        </div>

        {/* Scope Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600' }}>分析范围</label>
          <select 
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            disabled={isAnalyzing}
            style={{
              padding: '8px',
              fontSize: '13px',
              backgroundColor: 'var(--vscode-dropdown-background)',
              color: 'var(--vscode-dropdown-foreground)',
              border: '1px solid var(--vscode-dropdown-border)',
              borderRadius: '4px',
              outline: 'none'
            }}
          >
            <option value="Last 5 commits">最近 5 次提交</option>
            <option value="Last 10 commits">最近 10 次提交</option>
            <option value="Last 30 commits">自上次发布以来</option>
          </select>
        </div>
      </div>

      {/* Main Action */}
      <button 
        onClick={handleStart}
        disabled={isAnalyzing || !selectedBranch}
        style={{
          padding: '14px',
          backgroundColor: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: (isAnalyzing || !selectedBranch) ? 'not-allowed' : 'pointer',
          opacity: (isAnalyzing || !selectedBranch) ? 0.7 : 1,
          width: '100%',
          marginBottom: '20px'
        }}
      >
        {isAnalyzing ? '正在评估...' : '开始评估'}
      </button>

      {/* Escape Hatch */}
      <div style={{ textAlign: 'center' }}>
        <button 
          onClick={onSwitchToExpert}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--vscode-textLink-foreground)',
            fontSize: '12px',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: '8px'
          }}
        >
          查看完整分析（专家模式）
        </button>
      </div>
    </div>
  );
};

export default ProductModeView;
