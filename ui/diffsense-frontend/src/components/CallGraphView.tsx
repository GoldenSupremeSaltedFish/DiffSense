import { useState } from 'react';
import FileMethodList from './FileMethodList';
import CallGraphVisualization from './CallGraphVisualization';

interface CallGraphViewProps {
  analysisResults: any[];
}

const CallGraphView = ({ analysisResults }: CallGraphViewProps) => {
  const [selectedMethod, setSelectedMethod] = useState<string>('');

  // 转换分析结果为调用图数据格式
  const transformToCallGraphData = () => {
    // 这里先创建模拟数据，后续会从真实的分析结果中提取
    const mockData = {
      impactedFiles: [
        {
          file: 'src/service/UserService.java',
          methods: [
            {
              name: 'createUser',
              signature: 'createUser(User user)',
              file: 'src/service/UserService.java',
              calls: ['validateUser', 'saveUser', 'sendNotification'],
              calledBy: ['register', 'adminCreateUser'],
              type: 'modified' as const
            },
            {
              name: 'validateUser', 
              signature: 'validateUser(User user)',
              file: 'src/service/UserService.java',
              calls: ['checkEmail', 'checkPhone'],
              calledBy: ['createUser', 'updateUser'],
              type: 'affected' as const
            },
            {
              name: 'saveUser',
              signature: 'saveUser(User user)',
              file: 'src/service/UserService.java',
              calls: ['userRepository.save'],
              calledBy: ['createUser'],
              type: 'new' as const
            }
          ]
        },
        {
          file: 'src/controller/UserController.java',
          methods: [
            {
              name: 'register',
              signature: 'register(RegisterRequest request)',
              file: 'src/controller/UserController.java',
              calls: ['createUser', 'logUserAction'],
              calledBy: [],
              type: 'affected' as const
            },
            {
              name: 'adminCreateUser',
              signature: 'adminCreateUser(AdminCreateRequest request)',
              file: 'src/controller/UserController.java', 
              calls: ['createUser', 'auditLog'],
              calledBy: [],
              type: 'modified' as const
            }
          ]
        },
        {
          file: 'src/repository/UserRepository.java',
          methods: [
            {
              name: 'save',
              signature: 'save(User user)',
              file: 'src/repository/UserRepository.java',
              calls: [],
              calledBy: ['saveUser'],
              type: 'affected' as const
            }
          ]
        }
      ]
    };

    // 如果有真实数据，尝试转换
    if (analysisResults.length > 0) {
      try {
        // 尝试从现有的分析结果中提取调用关系信息
        const transformedData = analysisResults.map(commit => {
          const files = commit.impactedFiles || commit.files || [];
          return files.map((file: any) => ({
            file: file.path || file.filePath || '未知文件',
            methods: (file.methods || file.impactedMethods || []).map((method: any) => ({
              name: typeof method === 'string' ? method : method.methodName || method.name || '未知方法',
              signature: typeof method === 'string' ? method : method.signature || method.methodName || method.name || '未知签名',
              file: file.path || file.filePath || '未知文件',
              calls: method.calls || [],
              calledBy: method.calledBy || [],
              type: method.type || 'affected'
            }))
          }));
        }).flat();

        if (transformedData.length > 0 && transformedData.some(f => f.methods.length > 0)) {
          return { impactedFiles: transformedData };
        }
      } catch (error) {
        console.error('转换分析结果失败:', error);
      }
    }

    // 返回模拟数据
    return mockData;
  };

  const callGraphData = transformToCallGraphData();

  return (
    <div className="h-full flex bg-surface">
      {/* 左侧：文件和方法列表 */}
      <div className="w-[300px] border-r border-border flex flex-col">
        <div className="px-3 py-2 bg-surface-alt text-text border-b border-border text-[12px] font-semibold">
          🗂️ 影响文件和方法
        </div>
        
        <div className="flex-1">
          <FileMethodList
            data={callGraphData}
            selectedMethod={selectedMethod}
            onMethodSelect={setSelectedMethod}
          />
        </div>
      </div>

      {/* 右侧：调用关系可视化 */}
      <div className="flex-1 flex flex-col">
        <div className="px-3 py-2 bg-surface-alt text-text border-b border-border text-[12px] font-semibold flex items-center justify-between">
          <span>🕸️ 调用关系图</span>
          {selectedMethod && (
            <span className="text-[10px] bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-1.5 py-0.5 rounded">
              选中: {selectedMethod}
            </span>
          )}
        </div>
        
        <div className="flex-1">
          <CallGraphVisualization
            data={callGraphData}
            onMethodSelect={setSelectedMethod}
          />
        </div>
      </div>

      {/* 如果没有数据，显示提示 */}
      {callGraphData.impactedFiles.length === 0 && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-subtle text-[14px]">
          <div className="text-[48px] mb-4">🕸️</div>
          <div>暂无调用关系数据</div>
          <div className="text-[12px] mt-2">请先进行代码分析以生成调用关系图</div>
        </div>
      )}
    </div>
  );
};

export default CallGraphView; 
