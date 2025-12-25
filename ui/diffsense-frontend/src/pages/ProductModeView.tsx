
import React from 'react';
import { AnalysisViewModel } from '../models/ProductModeModel';

interface ProductModeViewProps {
  model: AnalysisViewModel;
  onSwitchToExpert: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

const ProductModeView: React.FC<ProductModeViewProps> = ({ model, onSwitchToExpert, onAnalyze, isAnalyzing }) => {
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

      {/* 3. Action Area */}
      <div style={{
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <button 
          onClick={onAnalyze}
          disabled={isAnalyzing}
          style={{
            padding: '14px',
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isAnalyzing ? 'wait' : 'pointer',
            opacity: isAnalyzing ? 0.7 : 1
          }}
        >
          {isAnalyzing ? 'Analyzing...' : 'Start Assessment'}
        </button>

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
          Need detailed analysis? Switch to Expert Mode
        </button>
      </div>
    </div>
  );
};

export default ProductModeView;
