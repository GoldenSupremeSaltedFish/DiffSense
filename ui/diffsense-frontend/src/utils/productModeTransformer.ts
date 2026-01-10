
import type { AnalysisViewModel, AnalysisItem } from '../models/ProductModeModel';

interface CommitImpact {
  commitId: string;
  message: string;
  author?: {
    name: string;
    email: string;
  };
  timestamp?: string;
  changedFilesCount?: number;
  changeClassifications?: Array<{
    classification: {
      category: string;
      categoryName: string;
      reason: string;
      confidence: number;
    };
    filePath: string;
  }>;
  classificationSummary?: {
    categoryStats: Record<string, number>;
  };
}

export const transformToViewModel = (impacts: CommitImpact[]): AnalysisViewModel => {
  if (!impacts || impacts.length === 0) {
    return {
      summary: {
        level: 'low',
        headline: '暂无分析数据',
        keyFindings: [],
        recommendation: '请运行分析以查看结果。'
      },
      items: []
    };
  }

  let highRiskCount = 0;
  let mediumRiskCount = 0;
  const keyFindings: string[] = [];
  const items: AnalysisItem[] = [];

  const highRiskCategories = ['A1', 'A2'];
  const mediumRiskCategories = ['A3', 'A4', 'F1', 'F2'];

  const categoryNames: Record<string, string> = {
    'A1': '核心业务逻辑',
    'A2': 'API 接口定义',
    'A3': '数据结构',
    'A4': '中间件配置',
    'F1': '前端组件行为',
    'F2': 'UI 结构',
  };

  impacts.forEach(commit => {
    const classifications = commit.changeClassifications || [];
    let commitHighRisk = 0;
    let commitMediumRisk = 0;
    const affectedModules = new Set<string>();

    classifications.forEach(fc => {
      const cat = fc.classification.category;
      const categoryName = categoryNames[cat] || fc.classification.categoryName || '未知模块';
      affectedModules.add(categoryName);

      if (highRiskCategories.includes(cat)) {
        highRiskCount++;
        commitHighRisk++;
        if (keyFindings.length < 3) {
          keyFindings.push(`检测到 ${categoryName} 发生高风险变更`);
        }
      } else if (mediumRiskCategories.includes(cat)) {
        mediumRiskCount++;
        commitMediumRisk++;
        if (keyFindings.length < 3 && highRiskCount === 0) {
          keyFindings.push(`检测到 ${categoryName} 发生变动，可能影响稳定性`);
        }
      }
    });

    let commitRiskLevel: 'high' | 'medium' | 'low' = 'low';
    let commitRiskSummary = '变更风险较低';

    if (commitHighRisk > 0) {
      commitRiskLevel = 'high';
      commitRiskSummary = `涉及 ${commitHighRisk} 处高风险变更`;
    } else if (commitMediumRisk > 0) {
      commitRiskLevel = 'medium';
      commitRiskSummary = `包含 ${commitMediumRisk} 处中等风险变更`;
    }

    items.push({
      id: commit.commitId,
      author: commit.author?.name || 'Unknown',
      time: commit.timestamp ? new Date(commit.timestamp).toLocaleString('zh-CN') : 'Unknown',
      riskLevel: commitRiskLevel,
      fileCount: commit.changedFilesCount || 0,
      riskSummary: commitRiskSummary,
      message: commit.message,
      details: {
        affectedModules: Array.from(affectedModules).slice(0, 5) // Top 5 modules
      }
    });
  });

  const uniqueFindings = Array.from(new Set(keyFindings));

  let level: 'low' | 'medium' | 'high' = 'low';
  let headline = '本次变更风险较低';
  let recommendation = '可以直接合并。';

  if (highRiskCount > 0) {
    level = 'high';
    headline = `本次修改涉及 ${highRiskCount} 处高风险变更，建议在合并前重点检查。`;
    recommendation = '建议进行详细 Code Review 并补充测试用例。';
  } else if (mediumRiskCount > 0) {
    level = 'medium';
    headline = `本次修改包含 ${mediumRiskCount} 处中等风险变更，请注意回归测试。`;
    recommendation = '建议关注受影响的 UI/API 模块。';
  }

  if (uniqueFindings.length === 0) {
    if (level === 'low') {
      uniqueFindings.push('未发现显著的风险模式。');
    } else {
      uniqueFindings.push('涉及多处代码调整。');
    }
  }

  return {
    summary: {
      level,
      headline,
      keyFindings: uniqueFindings.slice(0, 3),
      recommendation
    },
    items
  };
};
