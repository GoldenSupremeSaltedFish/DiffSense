
import type { AnalysisViewModel } from '../models/ProductModeModel';

// Reuse types from ReportRenderer or define a subset if we want to be strict
// For now, we assume the input is the same 'any[]' or 'CommitImpact[]' that MainView receives
interface CommitImpact {
  commitId: string;
  message: string;
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
      }
    };
  }

  let highRiskCount = 0;
  let mediumRiskCount = 0;
  const keyFindings: string[] = [];

  // Risk categorization
  // High: A1 (Business Logic), A2 (Interface Change)
  // Medium: A3 (Data Structure), A4 (Middleware), F1 (Component Behavior), F2 (UI Structure)
  // Low: Others
  
  const highRiskCategories = ['A1', 'A2'];
  const mediumRiskCategories = ['A3', 'A4', 'F1', 'F2'];

  // Map category codes to human-friendly terms
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
    
    classifications.forEach(fc => {
      const cat = fc.classification.category;
      const categoryName = categoryNames[cat] || fc.classification.categoryName || '未知模块';
      
      if (highRiskCategories.includes(cat)) {
        highRiskCount++;
        // Add to findings if we have fewer than 3
        if (keyFindings.length < 3) {
          // Avoid filename if possible, or keep it simple. Requirement says "Human language, not filenames".
          // But context is needed. Let's try to be generic.
          // "Involved core business logic changes"
          keyFindings.push(`检测到 ${categoryName} 发生高风险变更`);
        }
      } else if (mediumRiskCategories.includes(cat)) {
        mediumRiskCount++;
        if (keyFindings.length < 3 && highRiskCount === 0) { // Prioritize high risk
           keyFindings.push(`检测到 ${categoryName} 发生变动，可能影响稳定性`);
        }
      }
    });
  });

  // Deduplicate findings
  const uniqueFindings = Array.from(new Set(keyFindings));

  // Determine overall level
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

  // Fallback findings if empty but risks exist (shouldn't happen with logic above, but safety net)
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
      keyFindings: uniqueFindings.slice(0, 3), // Limit to top 3
      recommendation
    }
  };
};
