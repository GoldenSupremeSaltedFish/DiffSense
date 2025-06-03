import { useState, useEffect } from "react";

const fakeData = [
  {
    id: "c1",
    message: "Fix login bug",
    files: [
      {
        path: "src/LoginService.java",
        methods: ["validateUser"],
        tests: ["testLoginSuccess"],
      },
    ],
  },
  {
    id: "c2",
    message: "Add feature X",
    files: [
      {
        path: "src/FeatureX.java",
        methods: ["runFeature"],
        tests: ["testFeatureX"],
      },
    ],
  },
];

interface AnalysisData {
  commits?: any[];
  error?: string;
  loading?: boolean;
}

const CommitList = () => {
  const [analysisData, setAnalysisData] = useState<AnalysisData>({ loading: false });

  useEffect(() => {
    // 监听来自VSCode插件的消息
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.command) {
        case 'analysisResult':
          setAnalysisData({ 
            commits: message.data || [],
            loading: false 
          });
          break;
        case 'analysisError':
          setAnalysisData({ 
            error: message.error,
            loading: false 
          });
          break;
        case 'analysisStarted':
          setAnalysisData({ loading: true });
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // 显示加载状态
  if (analysisData.loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div>🔄 正在分析中...</div>
      </div>
    );
  }

  // 显示错误状态
  if (analysisData.error) {
    return (
      <div style={{ color: 'red', padding: '20px' }}>
        <div>❌ 分析失败: {analysisData.error}</div>
        <div style={{ marginTop: '10px', fontSize: '12px' }}>
          显示测试数据:
        </div>
        {renderCommits(fakeData)}
      </div>
    );
  }

  // 显示真实数据或假数据
  const dataToShow = analysisData.commits || fakeData;
  
  return (
    <div>
      {dataToShow.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          📝 点击 "Analyze" 按钮开始分析
        </div>
      ) : (
        renderCommits(dataToShow)
      )}
    </div>
  );
};

// 提取渲染逻辑为独立函数
const renderCommits = (commits: any[]) => {
  return commits.map((commit) => (
    <div
      key={commit.id}
      style={{
        borderBottom: "1px solid #ccc",
        marginBottom: "10px",
        paddingBottom: "10px",
      }}
    >
      <strong>{commit.message}</strong>
      {commit.files?.map((f: any, i: number) => (
        <div key={i} style={{ marginLeft: "20px" }}>
          📄 {f.path}
          {f.methods?.map((m: any, j: number) => (
            <div key={j} style={{ marginLeft: "20px" }}>
              🧠 {m}
              <div style={{ marginLeft: "20px", color: "green" }}>
                ✅ {f.tests?.join(", ") || "无测试"}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  ));
};

export default CommitList; 