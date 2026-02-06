
import React, { useState, useEffect } from 'react';
import type { AnalysisViewModel } from '../models/ProductModeModel';

interface ProductModeViewProps {
  model: AnalysisViewModel | null; // Null if no analysis yet
  branches: string[];
  initialBranch: string;
  onSwitchToExpert: () => void;
  onAnalyze: (branch: string, scope: string) => void;
  isAnalyzing: boolean;
  onExport: (format: 'json' | 'html') => void;
  t: (key: string) => string;
}

const ProductModeView: React.FC<ProductModeViewProps> = ({ 
  model, 
  branches, 
  initialBranch, 
  onSwitchToExpert, 
  onAnalyze, 
  isAnalyzing,
  onExport,
  t
}) => {
  const [selectedBranch, setSelectedBranch] = useState(initialBranch);
  const [selectedScope, setSelectedScope] = useState('Last 5 commits');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Update internal branch state if initialBranch changes (e.g. loaded later)
  useEffect(() => {
    if (initialBranch && !selectedBranch) {
      setSelectedBranch(initialBranch);
    }
  }, [initialBranch]);

  // Click outside listener for export menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showExportMenu && !target.closest('.export-container')) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showExportMenu]);

  const hasResults = model && model.items.length > 0;

  const handleStart = () => {
    onAnalyze(selectedBranch, selectedScope);
  };

  const handleReset = () => {
    setSelectedBranch(initialBranch);
    setSelectedScope('Last 5 commits');
  };

  const handleExportClick = (format: 'json' | 'html') => {
    onExport(format);
    setShowExportMenu(false);
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
        overflowY: 'auto',
        animation: 'fadeIn 0.5s ease-out'
      }}>
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideIn {
              from { opacity: 0; transform: translateX(-10px); }
              to { opacity: 1; transform: translateX(0); }
            }
            .hover-card {
              transition: transform 0.2s, box-shadow 0.2s;
            }
            .hover-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
            .action-btn {
              transition: all 0.2s;
            }
            .action-btn:hover {
              filter: brightness(1.1);
            }
            .expand-content {
              animation: fadeIn 0.3s ease-out;
            }
          `}
        </style>

        {/* 3. 关键提示区域 (Critical Alerts) */}
        <div style={{
          padding: '20px',
          background: `linear-gradient(to right, ${getRiskColor(summary.level)}22, transparent)`,
          borderLeft: `5px solid ${getRiskColor(summary.level)}`,
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          animation: 'slideIn 0.4s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '24px', marginRight: '12px', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))' }}>
              {getRiskIcon(summary.level)}
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--vscode-foreground)' }}>
                {summary.headline}
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px', fontWeight: '500' }}>
                {summary.level === 'high' ? t('productMode.highRisk') : summary.level === 'medium' ? t('productMode.mediumRisk') : t('productMode.lowRisk')}
              </div>
            </div>
          </div>
          
          <div style={{ 
            backgroundColor: 'var(--vscode-editor-background)', 
            padding: '12px', 
            borderRadius: '6px',
            fontSize: '13px', 
            color: 'var(--vscode-foreground)',
            lineHeight: '1.5',
            border: '1px solid var(--vscode-widget-border)'
          }}>
            <strong>{t('productMode.recommendation')}：</strong> {summary.recommendation}
          </div>
          
          {summary.keyFindings.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--vscode-descriptionForeground)', marginBottom: '10px', fontWeight: '600' }}>
                {t('productMode.keyFindings')}
              </h3>
              <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none' }}>
                {summary.keyFindings.map((finding, idx) => (
                  <li key={idx} style={{ 
                    marginBottom: '8px', 
                    fontSize: '13px', 
                    display: 'flex', 
                    alignItems: 'start',
                    gap: '8px'
                  }}>
                    <span style={{ color: getRiskColor(summary.level), fontSize: '14px', lineHeight: '1' }}>•</span>
                    {finding}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 4. 分析结果展示 (Analysis Results) */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📋</span> {t('productMode.changeDetails')}
            </h3>
            <div style={{ 
              fontSize: '11px', 
              color: 'var(--vscode-badge-foreground)', 
              backgroundColor: 'var(--vscode-badge-background)',
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              {items.length} {t('productMode.commitsCount')}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item, index) => (
              <div key={item.id} className="hover-card" style={{
                border: '1px solid var(--vscode-widget-border)',
                borderRadius: '8px',
                backgroundColor: 'var(--vscode-editor-background)',
                overflow: 'hidden',
                animation: 'slideIn 0.4s ease-out forwards',
                animationDelay: `${index * 0.1}s`,
                opacity: 0 // Start hidden for animation
              }}>
                {/* List Item Header */}
                <div 
                  onClick={() => toggleExpand(item.id)}
                  style={{
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    backgroundColor: expandedItems.has(item.id) ? 'var(--vscode-list-hoverBackground)' : 'transparent',
                    transition: 'background-color 0.2s'
                  }}
                >
                  {/* Risk Indicator */}
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginRight: '16px',
                    minWidth: '40px'
                  }}>
                    <div style={{ 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%', 
                      backgroundColor: getRiskColor(item.riskLevel),
                      boxShadow: `0 0 6px ${getRiskColor(item.riskLevel)}`
                    }} />
                    {expandedItems.has(item.id) && <div style={{ width: '1px', height: '100%', backgroundColor: 'var(--vscode-widget-border)', marginTop: '4px' }} />}
                  </div>

                  {/* Main Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '12px', 
                        fontWeight: 'bold', 
                        marginRight: '10px',
                        padding: '2px 6px',
                        backgroundColor: 'var(--vscode-textBlockQuote-background)',
                        borderRadius: '4px',
                        color: 'var(--vscode-textLink-foreground)'
                      }}>
                        {item.id.substring(0, 7)}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.message.split('\n')[0]}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>👤 {item.author}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>🕒 {item.time.split(' ')[0]}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📄 {item.fileCount} {t('productMode.filesCount')}</span>
                    </div>
                  </div>

                  {/* Risk Summary */}
                  <div style={{ 
                    marginLeft: '16px', 
                    fontSize: '11px', 
                    color: getRiskColor(item.riskLevel),
                    fontWeight: '700',
                    textAlign: 'right',
                    flexShrink: 0,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: `${getRiskColor(item.riskLevel)}15`,
                    border: `1px solid ${getRiskColor(item.riskLevel)}30`
                  }}>
                    {item.riskSummary}
                  </div>
                  
                  {/* Chevron Icon */}
                  <div style={{ marginLeft: '12px', color: 'var(--vscode-descriptionForeground)', transform: expandedItems.has(item.id) ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                    ▼
                  </div>
                </div>

                {/* Expandable Details */}
                {expandedItems.has(item.id) && (
                  <div className="expand-content" style={{
                    padding: '12px 16px 16px 70px',
                    borderTop: '1px solid var(--vscode-widget-border)',
                    backgroundColor: 'var(--vscode-textBlockQuote-background)',
                    fontSize: '12px'
                  }}>
                    {item.details?.affectedModules && item.details.affectedModules.length > 0 ? (
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--vscode-foreground)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🧩</span> {t('productMode.affectedModules')}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {item.details.affectedModules.map((mod, idx) => (
                            <span key={idx} style={{
                              backgroundColor: 'var(--vscode-editor-background)',
                              border: '1px solid var(--vscode-widget-border)',
                              color: 'var(--vscode-foreground)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}>
                              {mod}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>{t('productMode.noModules')}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 5. 操作按钮 (Action Buttons) */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', paddingBottom: '20px' }}>
          <button
            className="action-btn"
            onClick={handleStart}
            disabled={isAnalyzing}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '4px',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              opacity: isAnalyzing ? 0.7 : 1,
              fontWeight: '600',
              fontSize: '14px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {isAnalyzing ? `🔄 ${t('productMode.analyzing')}` : `🔄 ${t('productMode.startAnalysis')}`}
          </button>
          
          <div className="export-container" style={{ position: 'relative' }}>
            <button
              className="action-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{
                padding: '12px 20px',
                backgroundColor: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                height: '100%'
              }}
              title={t('productMode.export')}
            >
              📋 {t('productMode.export')} <span style={{ fontSize: '10px' }}>▼</span>
            </button>
            
            {showExportMenu && (
              <div style={{
                position: 'absolute',
                bottom: '100%', // Show above the button
                left: 0,
                minWidth: '120px',
                marginBottom: '4px',
                backgroundColor: 'var(--vscode-dropdown-background)',
                border: '1px solid var(--vscode-dropdown-border)',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => handleExportClick('json')}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: 'transparent',
                    color: 'var(--vscode-foreground)',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span>📄</span> {t('productMode.exportJson')}
                </button>
                <div style={{ height: '1px', backgroundColor: 'var(--vscode-dropdown-border)' }} />
                <button
                  onClick={() => handleExportClick('html')}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: 'transparent',
                    color: 'var(--vscode-foreground)',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span>🌐</span> {t('productMode.exportHtml')}
                </button>
              </div>
            )}
          </div>

          <button
            className="action-btn"
             onClick={onSwitchToExpert}
             style={{
               padding: '12px 20px',
               backgroundColor: 'transparent',
               color: 'var(--vscode-textLink-foreground)',
               border: '1px solid var(--vscode-button-secondaryBackground)',
               borderRadius: '4px',
               cursor: 'pointer',
               fontWeight: '500'
             }}
          >
            🔍 {t('productMode.switchToExpert')}
          </button>
        </div>

        {/* 6. 辅助信息 (Auxiliary Info) */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '24px', 
          fontSize: '11px', 
          color: 'var(--vscode-descriptionForeground)',
          paddingTop: '16px',
          borderTop: '1px solid var(--vscode-widget-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--vscode-charts-red)', boxShadow: '0 0 4px var(--vscode-charts-red)' }} />
            <span>{t('productMode.highRisk')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--vscode-charts-orange)', boxShadow: '0 0 4px var(--vscode-charts-orange)' }} />
            <span>{t('productMode.mediumRisk')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--vscode-charts-green)', boxShadow: '0 0 4px var(--vscode-charts-green)' }} />
            <span>{t('productMode.lowRisk')}</span>
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
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>DiffSense</h1>
        <p style={{ color: 'var(--vscode-descriptionForeground)' }}>{t('productMode.subtitle')}</p>
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
        
        {/* Branch Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600' }}>{t('toolbar.gitBranch')}</label>
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
              {branches.length === 0 && <option value="">{t('toolbar.loadingBranches')}</option>}
            </select>
            <button
              onClick={handleReset}
              title={t('productMode.reset')}
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
          <label style={{ fontSize: '12px', fontWeight: '600' }}>{t('productMode.scope')}</label>
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
            <option value="Last 5 commits">{t('productMode.scopeLast5')}</option>
            <option value="Last 10 commits">{t('productMode.scopeLast10')}</option>
            <option value="Last 30 commits">{t('productMode.scopeSinceRelease')}</option>
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
        {isAnalyzing ? t('productMode.analyzing') : t('productMode.startAnalysis')}
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
          {t('productMode.switchToExpert')}
        </button>
      </div>
    </div>
  );
};

export default ProductModeView;
