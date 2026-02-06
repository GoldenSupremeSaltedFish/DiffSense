import { useState } from 'react';

interface MethodNode {
  name: string;
  signature: string;
  file: string;
  calls?: string[];
  calledBy?: string[];
  type?: 'modified' | 'new' | 'affected';
}

interface FileMethodListProps {
  data: {
    impactedFiles: Array<{
      file: string;
      methods: MethodNode[];
    }>;
  };
  selectedMethod?: string;
  onMethodSelect?: (method: string) => void;
  onFileSelect?: (file: string) => void;
}

const FileMethodList = ({ data, selectedMethod, onMethodSelect, onFileSelect }: FileMethodListProps) => {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // 切换文件展开状态
  const toggleFile = (fileName: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileName)) {
      newExpanded.delete(fileName);
    } else {
      newExpanded.add(fileName);
    }
    setExpandedFiles(newExpanded);
  };

  // 获取方法类型的图标和颜色
  const getMethodStyle = (type?: string) => {
    const styles = {
      modified: { icon: '🔴', color: '#e53e3e', label: '修改' },
      new: { icon: '🟢', color: '#38a169', label: '新增' },
      affected: { icon: '🟠', color: '#ed8936', label: '影响' }
    };
    return styles[type as keyof typeof styles] || styles.affected;
  };

  // 过滤数据
  const filteredData = data.impactedFiles.filter(file => {
    if (!searchTerm.trim()) return true;
    
    const term = searchTerm.toLowerCase();
    const fileMatches = file.file.toLowerCase().includes(term);
    const methodMatches = file.methods.some(method => 
      method.name.toLowerCase().includes(term) || 
      method.signature.toLowerCase().includes(term)
    );
    
    return fileMatches || methodMatches;
  });

  // 统计信息
  const stats = {
    totalFiles: data.impactedFiles.length,
    totalMethods: data.impactedFiles.reduce((sum, file) => sum + file.methods.length, 0),
    modifiedMethods: data.impactedFiles.reduce((sum, file) => 
      sum + file.methods.filter(m => m.type === 'modified').length, 0),
    newMethods: data.impactedFiles.reduce((sum, file) => 
      sum + file.methods.filter(m => m.type === 'new').length, 0)
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'var(--vscode-sidebar-background)'
    }}>
      {/* 搜索和统计 */}
      <div style={{
        padding: '8px',
        borderBottom: '1px solid var(--vscode-panel-border)'
      }}>
        {/* 搜索框 */}
        <input
          type="text"
          placeholder="搜索文件或方法..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '12px',
            border: '1px solid var(--vscode-input-border)',
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderRadius: '3px',
            marginBottom: '8px'
          }}
        />
        
        {/* 统计信息 */}
        <div style={{
          fontSize: '10px',
          color: 'var(--vscode-descriptionForeground)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px'
        }}>
          <div>📁 文件: {stats.totalFiles}</div>
          <div>⚙️ 方法: {stats.totalMethods}</div>
          <div>🔴 修改: {stats.modifiedMethods}</div>
          <div>🟢 新增: {stats.newMethods}</div>
        </div>
      </div>

      {/* 文件和方法列表 */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: '4px'
      }}>
        {filteredData.map((fileData) => (
          <div key={fileData.file} style={{ marginBottom: '8px' }}>
            {/* 文件头 */}
            <div
              onClick={() => {
                toggleFile(fileData.file);
                onFileSelect?.(fileData.file);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 8px',
                backgroundColor: expandedFiles.has(fileData.file) 
                  ? 'var(--vscode-list-activeSelectionBackground)' 
                  : 'var(--vscode-list-inactiveSelectionBackground)',
                color: 'var(--vscode-list-activeSelectionForeground)',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600'
              }}
            >
              <span style={{ marginRight: '6px' }}>
                {expandedFiles.has(fileData.file) ? '📂' : '📁'}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {fileData.file.split('/').pop()}
              </span>
              <span style={{
                fontSize: '9px',
                color: 'var(--vscode-descriptionForeground)',
                backgroundColor: 'var(--vscode-badge-background)',
                padding: '2px 4px',
                borderRadius: '2px',
                minWidth: '20px',
                textAlign: 'center'
              }}>
                {fileData.methods.length}
              </span>
            </div>

            {/* 方法列表 */}
            {expandedFiles.has(fileData.file) && (
              <div style={{ marginLeft: '16px', marginTop: '4px' }}>
                {fileData.methods.map((method) => {
                  const methodStyle = getMethodStyle(method.type);
                  const isSelected = selectedMethod === method.name;
                  
                  return (
                    <div
                      key={`${fileData.file}:${method.name}`}
                      onClick={() => onMethodSelect?.(method.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px 8px',
                        margin: '2px 0',
                        backgroundColor: isSelected 
                          ? 'var(--vscode-list-focusBackground)' 
                          : 'transparent',
                        borderLeft: `3px solid ${methodStyle.color}`,
                        borderRadius: '0 3px 3px 0',
                        cursor: 'pointer',
                        fontSize: '10px',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <span style={{ marginRight: '6px' }}>{methodStyle.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontWeight: '500',
                          color: 'var(--vscode-foreground)',
                          marginBottom: '2px'
                        }}>
                          {method.name}
                        </div>
                        <div style={{
                          fontSize: '9px',
                          color: 'var(--vscode-descriptionForeground)',
                          fontFamily: 'monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {method.signature}
                        </div>
                        
                        {/* 调用关系信息 */}
                        {(method.calls?.length || method.calledBy?.length) && (
                          <div style={{
                            fontSize: '8px',
                            color: 'var(--vscode-descriptionForeground)',
                            marginTop: '2px',
                            display: 'flex',
                            gap: '8px'
                          }}>
                            {method.calls?.length && (
                              <span>📞 调用: {method.calls.length}</span>
                            )}
                            {method.calledBy?.length && (
                              <span>📨 被调用: {method.calledBy.length}</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* 类型标签 */}
                      <span style={{
                        fontSize: '8px',
                        color: methodStyle.color,
                        backgroundColor: `${methodStyle.color}20`,
                        padding: '1px 4px',
                        borderRadius: '2px',
                        fontWeight: '600'
                      }}>
                        {methodStyle.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        
        {filteredData.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: 'var(--vscode-descriptionForeground)',
            fontSize: '12px'
          }}>
            {searchTerm ? '🔍 未找到匹配的文件或方法' : '📭 暂无数据'}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div style={{
        padding: '8px',
        borderTop: '1px solid var(--vscode-panel-border)',
        display: 'flex',
        gap: '4px'
      }}>
        <button
          onClick={() => setExpandedFiles(new Set(data.impactedFiles.map(f => f.file)))}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: '10px',
            backgroundColor: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          📂 全部展开
        </button>
        <button
          onClick={() => setExpandedFiles(new Set())}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: '10px',
            backgroundColor: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          📁 全部折叠
        </button>
      </div>
    </div>
  );
};

export default FileMethodList; 