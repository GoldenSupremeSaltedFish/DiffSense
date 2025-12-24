import { useState } from 'react';
import Collapse from '../ui/motion/Collapse';

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
    <div className="h-full flex flex-col bg-surface">
      {/* 搜索和统计 */}
      <div className="p-2 border-b border-border">
        {/* 搜索框 */}
        <input
          type="text"
          placeholder="搜索文件或方法..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-2 py-1 text-[12px] rounded border border-border bg-surface text-text mb-2 transition-colors duration-fast ease-standard"
        />
        
        {/* 统计信息 */}
        <div className="grid grid-cols-2 gap-1 text-[10px] text-subtle">
          <div>📁 文件: {stats.totalFiles}</div>
          <div>⚙️ 方法: {stats.totalMethods}</div>
          <div>🔴 修改: {stats.modifiedMethods}</div>
          <div>🟢 新增: {stats.newMethods}</div>
        </div>
      </div>

      {/* 文件和方法列表 */}
      <div className="flex-1 overflow-auto p-1">
        {filteredData.map((fileData) => (
          <div key={fileData.file} className="mb-2">
            {/* 文件头 */}
            <div
              onClick={() => {
                toggleFile(fileData.file);
                onFileSelect?.(fileData.file);
              }}
              className={`flex items-center px-2 py-1 rounded cursor-pointer text-[11px] font-semibold transition-colors duration-fast ease-standard ${
                expandedFiles.has(fileData.file) ? 'bg-surface-alt text-text' : 'bg-transparent text-text hover:bg-surface-alt'
              }`}
            >
              <span className="mr-1.5">
                {expandedFiles.has(fileData.file) ? '📂' : '📁'}
              </span>
              <span className="flex-1 min-w-0">
                {fileData.file.split('/').pop()}
              </span>
              <span className="text-[9px] text-subtle bg-[var(--vscode-badge-background)] px-1 py-0.5 rounded min-w-[20px] text-center">
                {fileData.methods.length}
              </span>
            </div>

            {/* 方法列表 */}
            <Collapse open={expandedFiles.has(fileData.file)} className="ml-4 mt-1">
                {fileData.methods.map((method) => {
                  const methodStyle = getMethodStyle(method.type);
                  const isSelected = selectedMethod === method.name;
                  
                  return (
                    <div
                      key={`${fileData.file}:${method.name}`}
                      onClick={() => onMethodSelect?.(method.name)}
                      className={`flex items-center px-2 py-1 my-0.5 rounded-r cursor-pointer text-[10px] transition-colors duration-fast ease-standard border-l-4`}
                      style={{ borderLeftColor: methodStyle.color, backgroundColor: isSelected ? 'var(--vscode-list-focusBackground)' : 'transparent' }}
                    >
                      <span className="mr-1.5">{methodStyle.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-text mb-0.5">
                          {method.name}
                        </div>
                        <div className="text-[9px] text-subtle font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                          {method.signature}
                        </div>
                        
                        {/* 调用关系信息 */}
                        {(method.calls?.length || method.calledBy?.length) && (
                          <div className="text-[8px] text-subtle mt-0.5 flex gap-2">
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
                      <span className="text-[8px] px-1 rounded font-semibold" style={{ color: methodStyle.color, backgroundColor: `${methodStyle.color}20` }}>
                        {methodStyle.label}
                      </span>
                    </div>
                  );
                })}
            </Collapse>
          </div>
        ))}
        
        {filteredData.length === 0 && (
          <div className="text-center p-5 text-subtle text-[12px]">
            {searchTerm ? '🔍 未找到匹配的文件或方法' : '📭 暂无数据'}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="p-2 border-t border-border flex gap-1">
        <button
          onClick={() => setExpandedFiles(new Set(data.impactedFiles.map(f => f.file)))}
          className="flex-1 px-2 py-1 text-[10px] rounded bg-surface-alt text-subtle hover:text-text transition-colors duration-fast ease-standard"
        >
          📂 全部展开
        </button>
        <button
          onClick={() => setExpandedFiles(new Set())}
          className="flex-1 px-2 py-1 text-[10px] rounded bg-surface-alt text-subtle hover:text-text transition-colors duration-fast ease-standard"
        >
          📁 全部折叠
        </button>
      </div>
    </div>
  );
};

export default FileMethodList; 
