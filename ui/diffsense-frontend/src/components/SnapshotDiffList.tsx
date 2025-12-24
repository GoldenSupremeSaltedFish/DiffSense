import { useState } from 'react';
import Collapse from '../ui/motion/Collapse';

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
      <div className="p-3 text-subtle text-xs">
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
    <div className="p-2 overflow-y-auto flex-1">
      {Object.entries(grouped).map(([key, list]) => {
        const [comp, file] = key.split('|');
        const hasRisk = list.some(item => isRisky(item.changeType));
        const isExpanded = expandedComponents[key];
        return (
          <div key={key} className="border border-border rounded mb-1.5 bg-surface-alt">
            <div
              onClick={() => toggle(key)}
              className="px-2 py-1 cursor-pointer flex justify-between items-center transition-colors duration-fast ease-standard hover:bg-surface"
            >
              <div>
                <span className="font-semibold">{comp}</span>
                <span className="text-[10px] ml-1.5 text-subtle">{file}</span>
              </div>
              <div>
                {hasRisk && (
                  <span className="bg-[var(--vscode-inputValidation-warningBackground)] text-[var(--vscode-inputValidation-warningBorder)] px-1 rounded text-[10px] mr-1.5">
                    ⚠️ 可能功能回退
                  </span>
                )}
                <span className="text-[12px]">{isExpanded ? '▼' : '▶'}</span>
              </div>
            </div>
            <Collapse open={isExpanded} className="px-3 py-1 text-[11px]">
              {list.map((item, idx) => (
                <div key={idx} className={`py-1 ${idx === 0 ? '' : 'border-t border-border'}`}>
                  <div className="font-semibold">{item.changeType}</div>
                  {item.before && (
                    <div className="text-subtle">
                      before: {Array.isArray(item.before) ? item.before.join(', ') : String(item.before)}
                    </div>
                  )}
                  {item.after && (
                    <div className="text-subtle">
                      after: {Array.isArray(item.after) ? item.after.join(', ') : String(item.after)}
                    </div>
                  )}
                </div>
              ))}
            </Collapse>
          </div>
        );
      })}
    </div>
  );
};

export default SnapshotDiffList; 
