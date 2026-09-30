import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';

interface MethodNode {
  name: string;
  signature: string;
  file: string;
  calls?: string[];
  calledBy?: string[];
  type?: 'modified' | 'new' | 'affected';
}

interface CallGraphData {
  impactedFiles: Array<{
    file: string;
    methods: MethodNode[];
  }>;
}

interface CallGraphVisualizationProps {
  data: CallGraphData;
  onMethodSelect?: (method: string) => void;
}

const CallGraphVisualization = ({ data, onMethodSelect }: CallGraphVisualizationProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 构建图数据
  const buildGraphData = () => {
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeIds = new Set<string>();

    console.log('开始构建调用图数据...');
    console.log('输入数据:', data);

    // 第一遍：收集所有节点
    data.impactedFiles.forEach((file) => {
      file.methods.forEach((method) => {
        const nodeId = `${file.file}:${method.name}`;
        
        if (!nodeIds.has(nodeId)) {
          nodes.push({
            data: {
              id: nodeId,
              label: method.name,
              signature: method.signature,
              file: file.file,
              type: method.type || 'affected'
            }
          });
          nodeIds.add(nodeId);
          console.log('添加节点:', nodeId);
        }
      });
    });

    // 第二遍：收集所有被调用的方法，创建占位符节点
    const allCalledMethods = new Set<string>();
    data.impactedFiles.forEach((file) => {
      file.methods.forEach((method) => {
        method.calls?.forEach((calledMethod) => {
          const targetId = `${file.file}:${calledMethod}`;
          allCalledMethods.add(targetId);
          console.log('发现调用关系:', `${file.file}:${method.name} -> ${targetId}`);
        });
        method.calledBy?.forEach((callerMethod) => {
          const sourceId = `${file.file}:${callerMethod}`;
          allCalledMethods.add(sourceId);
          console.log('发现被调用关系:', `${sourceId} -> ${file.file}:${method.name}`);
        });
      });
    });

    // 为不存在的被调用方法创建占位符节点
    allCalledMethods.forEach((methodId) => {
      if (!nodeIds.has(methodId)) {
        const [filePath, methodName] = methodId.split(':');
        nodes.push({
          data: {
            id: methodId,
            label: methodName,
            signature: `${methodName}()`, // 占位符签名
            file: filePath,
            type: 'unknown' // 新类型：未知方法
          }
        });
        nodeIds.add(methodId);
        console.log('添加占位符节点:', methodId);
      }
    });

    // 第三遍：创建边，现在所有节点都存在了
    data.impactedFiles.forEach((file) => {
      file.methods.forEach((method) => {
        const nodeId = `${file.file}:${method.name}`;

        // 添加调用关系边
        method.calls?.forEach((calledMethod) => {
          const targetId = `${file.file}:${calledMethod}`;
          // 现在可以安全创建边，因为目标节点一定存在
          if (nodeIds.has(targetId)) {
            edges.push({
              data: {
                id: `${nodeId}->${targetId}`,
                source: nodeId,
                target: targetId,
                type: 'calls'
              }
            });
            console.log('创建调用边:', `${nodeId} -> ${targetId}`);
          } else {
            console.error('目标节点不存在:', targetId);
          }
        });

        method.calledBy?.forEach((callerMethod) => {
          const sourceId = `${file.file}:${callerMethod}`;
          // 现在可以安全创建边，因为源节点一定存在
          if (nodeIds.has(sourceId)) {
            edges.push({
              data: {
                id: `${sourceId}->${nodeId}`,
                source: sourceId,
                target: nodeId,
                type: 'calledBy'
              }
            });
            console.log('创建被调用边:', `${sourceId} -> ${nodeId}`);
          } else {
            console.error('源节点不存在:', sourceId);
          }
        });
      });
    });

    console.log('最终节点列表:', nodes.map(n => n.data.id));
    console.log('最终边列表:', edges.map(e => `${e.data.source} -> ${e.data.target}`));

    return { nodes, edges };
  };

  // 初始化Cytoscape
  useEffect(() => {
    if (!containerRef.current || !data.impactedFiles.length) return;

    setIsLoading(true);

    const { nodes, edges } = buildGraphData();

    // 创建Cytoscape实例
    const cy = cytoscape({
      container: containerRef.current,
      elements: [...nodes, ...edges],
      style: [
        // 节点样式
        {
          selector: 'node',
          style: {
            'background-color': '#667eea',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#fff',
            'font-size': '10px',
            'font-weight': 'bold',
            'width': 60,
            'height': 30,
            'shape': 'roundrectangle',
            'overlay-padding': '4px'
          }
        },
        // 修改的方法
        {
          selector: 'node[type="modified"]',
          style: {
            'background-color': '#e53e3e',
            'border-width': 2,
            'border-color': '#c53030'
          }
        },
        // 新增的方法
        {
          selector: 'node[type="new"]',
          style: {
            'background-color': '#38a169',
            'border-width': 2,
            'border-color': '#2f855a'
          }
        },
        // 受影响的方法
        {
          selector: 'node[type="affected"]',
          style: {
            'background-color': '#ed8936',
            'border-width': 1,
            'border-color': '#dd6b20'
          }
        },
        // 未知/外部方法
        {
          selector: 'node[type="unknown"]',
          style: {
            'background-color': '#a0aec0',
            'border-width': 1,
            'border-color': '#718096',
            'opacity': 0.8
          }
        },
        // 选中状态
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#4299e1',
            'background-color': '#3182ce'
          }
        },
        // 边样式
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#cbd5e0',
            'target-arrow-color': '#cbd5e0',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.2
          }
        },
        // 调用关系
        {
          selector: 'edge[type="calls"]',
          style: {
            'line-color': '#4299e1',
            'target-arrow-color': '#4299e1'
          }
        },
        // 被调用关系
        {
          selector: 'edge[type="calledBy"]',
          style: {
            'line-color': '#48bb78',
            'target-arrow-color': '#48bb78'
          }
        }
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        roots: nodes.filter(n => n.data.type === 'modified' || n.data.type === 'new').map(n => n.data.id),
        padding: 20,
        spacingFactor: 1.5
      }
    });

    // 事件处理
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const methodName = node.data('label');
      onMethodSelect?.(methodName);
    });

    // Tooltip效果
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      node.style('background-color', '#4299e1');
    });

    cy.on('mouseout', 'node', (evt) => {
      const node = evt.target;
      const type = node.data('type');
      const colors = {
        modified: '#e53e3e',
        new: '#38a169',
        affected: '#ed8936',
        unknown: '#a0aec0'
      };
      node.style('background-color', colors[type as keyof typeof colors] || '#667eea');
    });

    cyRef.current = cy;
    setIsLoading(false);

    return () => {
      cy.destroy();
    };
  }, [data, onMethodSelect]);

  // 搜索功能
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!cyRef.current) return;

    cyRef.current.nodes().removeClass('highlighted');
    
    if (term.trim()) {
      const matchedNodes = cyRef.current.nodes().filter((node) => {
        const label = node.data('label').toLowerCase();
        const file = node.data('file').toLowerCase();
        return label.includes(term.toLowerCase()) || file.includes(term.toLowerCase());
      });

      matchedNodes.addClass('highlighted');
      
      if (matchedNodes.length > 0) {
        cyRef.current.fit(matchedNodes, 50);
      }
    }
  };

  // 布局切换
  const changeLayout = (layoutName: string) => {
    if (!cyRef.current) return;

    const layouts = {
      breadthfirst: {
        name: 'breadthfirst',
        directed: true,
        padding: 20,
        spacingFactor: 1.5
      },
      cose: {
        name: 'cose',
        nodeRepulsion: 4000,
        idealEdgeLength: 100,
        padding: 20
      },
      circle: {
        name: 'circle',
        padding: 20
      },
      grid: {
        name: 'grid',
        padding: 20,
        rows: Math.ceil(Math.sqrt(cyRef.current.nodes().length))
      }
    };

    const layout = cyRef.current.layout(layouts[layoutName as keyof typeof layouts] || layouts.breadthfirst);
    layout.run();
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 控制栏 */}
      <div style={{
        padding: '8px',
        background: 'var(--vscode-editor-background)',
        borderBottom: '1px solid var(--vscode-panel-border)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* 搜索框 */}
        <input
          type="text"
          placeholder="搜索方法或文件..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '4px 8px',
            fontSize: '12px',
            border: '1px solid var(--vscode-input-border)',
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderRadius: '3px'
          }}
        />

        {/* 布局选择 */}
        <select 
          onChange={(e) => changeLayout(e.target.value)}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            border: '1px solid var(--vscode-input-border)',
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderRadius: '3px'
          }}
        >
          <option value="breadthfirst">层次布局</option>
          <option value="cose">力导向布局</option>
          <option value="circle">环形布局</option>
          <option value="grid">网格布局</option>
        </select>

        {/* 操作按钮 */}
        <button
          onClick={() => cyRef.current?.fit()}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          🔍 适应视图
        </button>

        <button
          onClick={() => cyRef.current?.center()}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          🎯 居中显示
        </button>
      </div>

      {/* 图例 */}
      <div style={{
        padding: '6px 8px',
        background: 'var(--vscode-editor-background)',
        borderBottom: '1px solid var(--vscode-panel-border)',
        fontSize: '10px',
        display: 'flex',
        gap: '12px',
        color: 'var(--vscode-descriptionForeground)'
      }}>
        <span>🔴 修改的方法</span>
        <span>🟢 新增的方法</span> 
        <span>🟠 受影响的方法</span>
        <span>⚫ 外部/未知方法</span>
        <span>🔵 调用关系</span>
        <span>🟢 被调用关系</span>
      </div>

      {/* 可视化容器 */}
      <div 
        ref={containerRef}
        style={{ 
          flex: 1, 
          position: 'relative',
          background: 'var(--vscode-editor-background)'
        }}
      >
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'var(--vscode-descriptionForeground)',
            fontSize: '14px'
          }}>
            🔄 正在构建调用关系图...
          </div>
        )}
      </div>

      {/* 添加高亮样式 */}
      <style>
        {`
          .highlighted {
            background-color: #ffd700 !important;
            border-width: 3px !important;
            border-color: #ff8c00 !important;
          }
        `}
      </style>
    </div>
  );
};

export default CallGraphVisualization; 