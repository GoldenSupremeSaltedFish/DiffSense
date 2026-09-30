/**
 * 前端文件重要度评分系统 (Frontend File Importance Score, FFIS)
 * 
 * 基于技术中心性、功能中心性、渲染中心性、交互中心性的综合评分模型
 */

class FFISScorer {
  /**
   * 计算文件的FFIS评分
   * @param {Object} fileInfo - 文件信息
   * @param {Object} dependencyGraph - 依赖图 (madge结果)
   * @param {Object} snapshot - 组件快照信息
   * @param {Object} classification - 变更分类信息
   * @returns {Object} FFIS评分结果
   */
  static calculateFFIS(fileInfo, dependencyGraph = {}, snapshot = null, classification = null) {
    // 1. 技术中心性评分
    const technicalScore = this.calculateTechnicalCentrality(
      fileInfo,
      dependencyGraph
    );

    // 2. 功能中心性评分
    const featureScore = this.calculateFeatureCentrality(
      fileInfo,
      snapshot
    );

    // 3. 渲染中心性评分
    const renderScore = this.calculateRenderCentrality(
      fileInfo,
      snapshot
    );

    // 4. 交互中心性评分
    const interactionScore = this.calculateInteractionCentrality(
      fileInfo,
      snapshot
    );

    // 5. 变更分类加权
    const changeWeight = this.getChangeClassificationWeight(classification);

    // 最终FFIS评分
    const baseFFIS = 
      0.35 * technicalScore +
      0.30 * featureScore +
      0.20 * renderScore +
      0.15 * interactionScore;

    // 应用变更分类加权
    const finalFFIS = Math.min(baseFFIS + changeWeight, 1.0);

    // 确定重要性等级
    let importanceLevel = '辅助文件';
    let importanceStars = '⭐';
    if (finalFFIS >= 0.6) {
      importanceLevel = '核心文件';
      importanceStars = '⭐⭐⭐⭐';
    } else if (finalFFIS >= 0.4) {
      importanceLevel = '关键文件';
      importanceStars = '⭐⭐⭐';
    } else if (finalFFIS >= 0.3) {
      importanceLevel = '普通文件';
      importanceStars = '⭐⭐';
    }

    return {
      ffis: finalFFIS,
      importanceLevel,
      importanceStars,
      breakdown: {
        technical: technicalScore,
        feature: featureScore,
        render: renderScore,
        interaction: interactionScore,
        changeWeight: changeWeight
      }
    };
  }

  /**
   * 1. 技术中心性评分 (Technical Centrality)
   * 基于依赖图的入度、出度和路径权重
   */
  static calculateTechnicalCentrality(fileInfo, dependencyGraph) {
    const filePath = fileInfo.relativePath || fileInfo.path || '';
    
    // 计算入度（被多少文件引用）
    let inDegree = 0;
    Object.entries(dependencyGraph).forEach(([depFile, deps]) => {
      if (deps.some(dep => dep.includes(filePath) || filePath.includes(dep))) {
        inDegree++;
      }
    });

    // 计算出度（依赖了多少文件）
    const outDegree = dependencyGraph[filePath]?.length || 0;

    // 路径权重（根据文件路径判断重要性）
    let pathWeight = 0;
    const normalizedPath = filePath.toLowerCase();
    if (normalizedPath.includes('/pages/') || normalizedPath.includes('/routes/') || 
        normalizedPath.includes('/views/') || normalizedPath.includes('/screens/')) {
      pathWeight = 1.0; // 页面级组件
    } else if (normalizedPath.includes('/components/') || normalizedPath.includes('/widgets/')) {
      pathWeight = 0.6; // 组件
    } else if (normalizedPath.includes('/shared/') || normalizedPath.includes('/common/')) {
      pathWeight = 0.4; // 共享组件
    } else if (normalizedPath.includes('/utils/') || normalizedPath.includes('/helpers/')) {
      pathWeight = 0.2; // 工具类
    } else if (normalizedPath.includes('/src/')) {
      pathWeight = 0.5; // 其他源码
    }

    // 归一化入度和出度（使用对数缩放避免极端值）
    const maxInDegree = Math.max(1, Math.max(...Object.values(dependencyGraph).map(deps => 
      deps.length
    )));
    const maxOutDegree = Math.max(1, Math.max(...Object.keys(dependencyGraph).map(file => 
      dependencyGraph[file]?.length || 0
    )));

    const normalizedInDegree = Math.min(1.0, Math.log10(inDegree + 1) / Math.log10(maxInDegree + 1));
    const normalizedOutDegree = Math.min(1.0, Math.log10(outDegree + 1) / Math.log10(maxOutDegree + 1));

    // 技术中心性 = 0.4*入度 + 0.4*出度 + 0.2*路径权重
    return 0.4 * normalizedInDegree + 0.4 * normalizedOutDegree + 0.2 * pathWeight;
  }

  /**
   * 2. 功能中心性评分 (Feature Centrality)
   * 基于组件快照的props、方法、API调用等
   */
  static calculateFeatureCentrality(fileInfo, snapshot) {
    if (!snapshot) {
      // 如果没有快照，基于文件信息估算
      const methods = fileInfo.methods || [];
      const hasApiCall = this.detectApiCalls(fileInfo.content || '');
      return Math.min(1.0, (methods.length / 20) * 0.5 + (hasApiCall ? 0.5 : 0));
    }

    // Props数量
    const propsCount = snapshot.props?.length || 0;
    const normalizedProps = Math.min(1.0, propsCount / 10); // 假设10个props为满分

    // 方法数量 + useEffect数量
    const methods = fileInfo.methods || [];
    const hooks = snapshot.hooksOrLifecycle || [];
    const effectCount = hooks.filter(h => h.includes('useEffect') || h.includes('mounted') || h.includes('created')).length;
    const methodCount = methods.length;
    const normalizedMethods = Math.min(1.0, (methodCount + effectCount) / 15); // 假设15个方法/effect为满分

    // API调用检测
    const hasApiCall = this.detectApiCalls(fileInfo.content || '') || 
                      snapshot.hooksOrLifecycle?.some(h => h.includes('fetch') || h.includes('axios'));

    // 功能中心性 = 0.5*Props + 0.3*方法 + 0.2*API调用
    return 0.5 * normalizedProps + 0.3 * normalizedMethods + 0.2 * (hasApiCall ? 1.0 : 0);
  }

  /**
   * 3. 渲染中心性评分 (Render Centrality)
   * 基于JSX/Template元素数量和嵌套深度
   */
  static calculateRenderCentrality(fileInfo, snapshot) {
    const content = fileInfo.content || '';
    
    // JSX元素数量
    const jsxElements = content.match(/<[A-Za-z][A-Za-z0-9]*[^>]*>/g) || [];
    const jsxElementCount = jsxElements.length;
    let normalizedElementCount = Math.min(1.0, jsxElementCount / 50); // 假设50个元素为满分

    // 嵌套深度（通过计算最大连续缩进或标签嵌套）
    const maxDepth = this.calculateJSXDepth(content);
    const normalizedDepth = Math.min(1.0, maxDepth / 8); // 假设8层嵌套为满分

    // 如果有快照，使用快照中的renderElements
    if (snapshot && snapshot.renderElements) {
      const renderElementsCount = snapshot.renderElements.length;
      const normalizedSnapshotElements = Math.min(1.0, renderElementsCount / 50);
      // 使用快照和代码分析的平均值
      normalizedElementCount = (normalizedElementCount + normalizedSnapshotElements) / 2;
    }

    // 渲染中心性 = 0.6*元素数量 + 0.4*嵌套深度
    return 0.6 * normalizedElementCount + 0.4 * normalizedDepth;
  }

  /**
   * 4. 交互中心性评分 (Interaction Centrality)
   * 基于事件绑定和状态管理
   */
  static calculateInteractionCentrality(fileInfo, snapshot) {
    const content = fileInfo.content || '';

    // 事件绑定数量
    const eventBindings = content.match(/on[A-Z][A-Za-z]+\s*=|@[a-zA-Z0-9_-]+=|\.addEventListener\(/g) || [];
    const eventCount = eventBindings.length;
    let normalizedEvents = Math.min(1.0, eventCount / 15); // 假设15个事件为满分

    // useState/状态数量
    const useStateMatches = content.match(/useState\s*\(|const\s+\[.*,\s*set.*\]\s*=/g) || [];
    const stateCount = useStateMatches.length;
    const normalizedState = Math.min(1.0, stateCount / 10); // 假设10个状态为满分

    // 如果有快照，使用快照中的事件信息
    if (snapshot && snapshot.eventBindings) {
      const snapshotEventCount = snapshot.eventBindings.length;
      const normalizedSnapshotEvents = Math.min(1.0, snapshotEventCount / 15);
      // 使用快照和代码分析的平均值
      normalizedEvents = (normalizedEvents + normalizedSnapshotEvents) / 2;
    }

    // 交互中心性 = 0.6*事件 + 0.4*状态
    return 0.6 * normalizedEvents + 0.4 * normalizedState;
  }

  /**
   * 计算变更分类的权重加成
   */
  static getChangeClassificationWeight(classification) {
    if (!classification || !classification.classification) {
      return 0;
    }

    const category = classification.classification.category;
    const weights = {
      'F1': 0.2,  // 逻辑变更 - 最高权重
      'F2': 0.1,  // UI改动
      'F3': 0.05, // 样式
      'F4': 0.15, // 交互
      'F5': 0.1   // 依赖
    };

    const baseWeight = weights[category] || 0;
    const confidence = classification.classification.confidence || 0;
    
    // 根据置信度调整权重
    return baseWeight * confidence;
  }

  /**
   * 检测API调用
   */
  static detectApiCalls(content) {
    const apiPatterns = [
      /fetch\s*\(/,
      /axios\.(get|post|put|delete|patch)/,
      /\.get\s*\(|\.post\s*\(|\.put\s*\(|\.delete\s*\(/,
      /XMLHttpRequest/,
      /api\s*\./,
      /request\s*\(/
    ];
    
    return apiPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 计算JSX嵌套深度
   */
  static calculateJSXDepth(content) {
    let maxDepth = 0;
    let currentDepth = 0;
    const stack = [];

    // 简单的标签匹配来估算深度
    const openTags = content.match(/<[A-Za-z][A-Za-z0-9]*[^/>]*>/g) || [];
    const closeTags = content.match(/<\/[A-Za-z][A-Za-z0-9]*>/g) || [];
    const selfClosingTags = content.match(/<[A-Za-z][A-Za-z0-9]*[^/>]*\/>/g) || [];

    // 计算最大嵌套深度
    for (const tag of openTags) {
      if (!tag.endsWith('/>')) {
        stack.push(tag);
        currentDepth = stack.length;
        maxDepth = Math.max(maxDepth, currentDepth);
      }
    }

    for (const tag of closeTags) {
      if (stack.length > 0) {
        stack.pop();
      }
      currentDepth = stack.length;
    }

    return maxDepth;
  }

  /**
   * 计算PageRank值（用于更精确的依赖中心性分析）
   */
  static calculatePageRank(dependencyGraph, iterations = 10, dampingFactor = 0.85) {
    const nodes = Object.keys(dependencyGraph);
    const nodeCount = nodes.length;
    
    if (nodeCount === 0) return {};

    // 初始化PageRank值
    const pageRank = {};
    nodes.forEach(node => {
      pageRank[node] = 1.0 / nodeCount;
    });

    // 构建反向图（谁依赖了我）
    const reverseGraph = {};
    nodes.forEach(node => {
      reverseGraph[node] = [];
    });

    Object.entries(dependencyGraph).forEach(([node, deps]) => {
      deps.forEach(dep => {
        // 找到依赖对应的节点
        const depNode = nodes.find(n => dep.includes(n) || n.includes(dep));
        if (depNode && depNode !== node) {
          if (!reverseGraph[depNode]) {
            reverseGraph[depNode] = [];
          }
          reverseGraph[depNode].push(node);
        }
      });
    });

    // PageRank迭代
    for (let i = 0; i < iterations; i++) {
      const newPageRank = {};
      
      nodes.forEach(node => {
        let sum = 0;
        const inLinks = reverseGraph[node] || [];
        
        inLinks.forEach(inLink => {
          const outDegree = dependencyGraph[inLink]?.length || 1;
          sum += pageRank[inLink] / outDegree;
        });

        newPageRank[node] = (1 - dampingFactor) / nodeCount + dampingFactor * sum;
      });

      // 归一化
      const total = Object.values(newPageRank).reduce((a, b) => a + b, 0);
      nodes.forEach(node => {
        pageRank[node] = newPageRank[node] / total;
      });
    }

    return pageRank;
  }

  /**
   * 批量计算多个文件的FFIS评分
   */
  static calculateBatchFFIS(files, dependencyGraph = {}, snapshots = [], classifications = []) {
    // 计算PageRank（如果依赖图存在）
    const pageRank = Object.keys(dependencyGraph).length > 0 
      ? this.calculatePageRank(dependencyGraph)
      : {};

    // 创建快照和分类的索引
    const snapshotMap = new Map();
    snapshots.forEach(snapshot => {
      snapshotMap.set(snapshot.filePath, snapshot);
    });

    const classificationMap = new Map();
    classifications.forEach(classification => {
      classificationMap.set(classification.filePath, classification);
    });

    // 为每个文件计算FFIS
    const scoredFiles = files.map(fileInfo => {
      const snapshot = snapshotMap.get(fileInfo.relativePath || fileInfo.path);
      const classification = classificationMap.get(fileInfo.relativePath || fileInfo.path);
      
      const ffisResult = this.calculateFFIS(fileInfo, dependencyGraph, snapshot, classification);
      
      return {
        ...fileInfo,
        ffis: ffisResult.ffis,
        importanceLevel: ffisResult.importanceLevel,
        importanceStars: ffisResult.importanceStars,
        ffisBreakdown: ffisResult.breakdown
      };
    });

    // 按FFIS降序排序
    scoredFiles.sort((a, b) => (b.ffis || 0) - (a.ffis || 0));

    return scoredFiles;
  }

  /**
   * 根据FFIS阈值筛选重要文件
   */
  static filterImportantFiles(scoredFiles, options = {}) {
    const {
      minFFIS = 0.3,        // 最低FFIS阈值
      maxFiles = null,      // 最大文件数（null表示不限制）
      useTopPercent = null  // 使用前N%的文件（null表示不使用）
    } = options;

    let filtered = scoredFiles.filter(file => (file.ffis || 0) >= minFFIS);

    if (useTopPercent !== null && useTopPercent > 0 && useTopPercent <= 100) {
      const topCount = Math.ceil(scoredFiles.length * (useTopPercent / 100));
      filtered = scoredFiles.slice(0, topCount);
    }

    if (maxFiles !== null && maxFiles > 0) {
      filtered = filtered.slice(0, maxFiles);
    }

    return filtered;
  }
}

module.exports = FFISScorer;

