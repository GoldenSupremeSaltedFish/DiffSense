import { useState } from 'react';

interface ChangeItem {
  component: string;
  filePath: string;
  changeType: string;
  before: any;
  after: any;
}

interface SnapshotDiffListProps {
  changes: ChangeItem[];
}

// 判断该变更是否为潜在功能回退
const isRisky = (changeType: string) => {
  return [
    'removedProp',
    'removedHook',
    'removedEventBinding',
    'removedRenderElement',
    'componentDeleted',
  ].includes(changeType);
};

const SnapshotDiffList: React.FC<SnapshotDiffListProps> = ({ changes }) => {
  const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});

  if (!changes || changes.length === 0) {
    return (
      <div style={{
        padding: '12px',
        color: 'var(--vscode-descriptionForeground)',
        fontSize: '12px'
      }}>
        暂未检测到组件变动。
      </div>
    );
  }

  // 按组件分组
  const grouped = changes.reduce<Record<string, ChangeItem[]>>((acc, ch) => {
    const key = `${ch.component}|${ch.filePath}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ch);
    return acc;
  }, {});

  const toggle = (key: string) => {
    setExpandedComponents(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{ padding: '8px', overflowY: 'auto', flex: 1 }}>
      {Object.entries(grouped).map(([key, list]) => {
        const [comp, file] = key.split('|');
        const hasRisk = list.some(item => isRisky(item.changeType));
        const isExpanded = expandedComponents[key];
        return (
          <div key={key} style={{
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '4px',
            marginBottom: '6px',
            backgroundColor: 'var(--vscode-textBlockQuote-background)'
          }}>
            <div
              onClick={() => toggle(key)}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>{comp}</span>
                <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--vscode-descriptionForeground)' }}>
                  {file}
                </span>
              </div>
              <div>
                {hasRisk && (
                  <span style={{
                    backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
                    color: 'var(--vscode-inputValidation-warningBorder)',
                    padding: '0 4px',
                    borderRadius: '2px',
                    fontSize: '10px',
                    marginRight: '6px'
                  }}>
                    ⚠️ 可能功能回退
                  </span>
                )}
                <span style={{ fontSize: '12px' }}>{isExpanded ? '▼' : '▶'}</span>
              </div>
            </div>
            {isExpanded && (
              <div style={{ padding: '4px 12px', fontSize: '11px' }}>
                {list.map((item, idx) => (
                  <div key={idx} style={{
                    borderTop: idx === 0 ? 'none' : '1px solid var(--vscode-panel-border)',
                    padding: '4px 0'
                  }}>
                    <div>
                      <strong>{item.changeType}</strong>
                    </div>
                    {item.before && (
                      <div style={{ color: 'var(--vscode-descriptionForeground)' }}>
                        before: {Array.isArray(item.before) ? item.before.join(', ') : String(item.before)}
                      </div>
                    )}
                    {item.after && (
                      <div style={{ color: 'var(--vscode-descriptionForeground)' }}>
                        after: {Array.isArray(item.after) ? item.after.join(', ') : String(item.after)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SnapshotDiffList; 