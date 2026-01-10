
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

  // Update internal branch state if initialBranch changes (e.g. loaded later)
  useEffect(() => {
    if (initialBranch && !selectedBranch) {
      setSelectedBranch(initialBranch);
    }
  }, [initialBranch]);

  // If we have a model with actual data (not just empty placeholder), show results
  // We check if 'level' is set or if keyFindings are populated to decide if it's a real result
  const hasResults = model && model.summary.keyFindings.length > 0 && model.summary.headline !== 'No analysis data available';

  const handleStart = () => {
    onAnalyze(selectedBranch, selectedScope);
  };

  if (hasResults && model) {
    // --- Result View ---
    const { level, headline, keyFindings, recommendation } = model.summary;

    const getLevelColor = (l: string) => {
      switch (l) {
        case 'high': return 'var(--vscode-inputValidation-errorBorder)'; // Red-ish
        case 'medium': return 'var(--vscode-inputValidation-warningBorder)'; // Orange-ish
        default: return 'var(--vscode-notebook-cellEditorBackground)'; // Neutral/Green-ish
      }
    };

    const getLevelBg = (l: string) => {
      switch (l) {
        case 'high': return 'var(--vscode-inputValidation-errorBackground)';
        case 'medium': return 'var(--vscode-inputValidation-warningBackground)';
        default: return 'var(--vscode-textBlockQuote-background)';
      }
    };

    return (
      <div style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        gap: '24px',
        fontFamily: 'var(--vscode-font-family)'
      }}>
        {/* 1. Header / Status Card */}
        <div style={{
          padding: '24px',
          backgroundColor: getLevelBg(level),
          border: `2px solid ${getLevelColor(level)}`,
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h1 style={{ 
            margin: '0 0 16px 0', 
            fontSize: '24px', 
            fontWeight: '600',
            color: 'var(--vscode-foreground)'
          }}>
            {headline}
          </h1>
          
          <div style={{
            fontSize: '16px',
            fontWeight: '500',
            marginBottom: '8px',
            color: 'var(--vscode-foreground)'
          }}>
            {recommendation}
          </div>
        </div>

        {/* 2. Key Findings (Evidence) */}
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            fontSize: '14px', 
            textTransform: 'uppercase', 
            letterSpacing: '1px',
            color: 'var(--vscode-descriptionForeground)',
            marginBottom: '12px'
          }}>
            Key Findings
          </h3>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {keyFindings.map((finding, idx) => (
              <li key={idx} style={{
                padding: '12px',
                backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
                borderRadius: '6px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <span style={{ marginRight: '8px' }}>•</span>
                {finding}
              </li>
            ))}
          </ul>
        </div>

        {/* 3. Escape Hatch */}
        <div style={{ marginTop: 'auto', textAlign: 'center' }}>
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
        <p style={{ color: 'var(--vscode-descriptionForeground)' }}>代码变更风险评估</p>
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
        
        {/* Branch Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600' }}>分析分支</label>
          <select 
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
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
            {branches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
            {branches.length === 0 && <option value="">Loading branches...</option>}
          </select>
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
