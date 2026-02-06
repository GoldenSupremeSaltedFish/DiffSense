
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

export const transformToViewModel = (impacts: CommitImpact[], t: (key: string, params?: any) => string): AnalysisViewModel => {
  if (!impacts || impacts.length === 0) {
    return {
      summary: {
        level: 'low',
        headline: t('productMode.noAnalysisData'),
        keyFindings: [],
        recommendation: t('productMode.runAnalysisToView')
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

  const getCategoryName = (code: string) => {
    switch (code) {
      case 'A1': return t('productMode.categoryA1');
      case 'A2': return t('productMode.categoryA2');
      case 'A3': return t('productMode.categoryA3');
      case 'A4': return t('productMode.categoryA4');
      case 'F1': return t('productMode.categoryF1');
      case 'F2': return t('productMode.categoryF2');
      default: return t('productMode.unknownModule');
    }
  };

  impacts.forEach(commit => {
    const classifications = commit.changeClassifications || [];
    let commitHighRisk = 0;
    let commitMediumRisk = 0;
    const affectedModules = new Set<string>();

    classifications.forEach(fc => {
      const cat = fc.classification.category;
      const categoryName = getCategoryName(cat) || fc.classification.categoryName || t('productMode.unknownModule');
      affectedModules.add(categoryName);

      if (highRiskCategories.includes(cat)) {
        highRiskCount++;
        commitHighRisk++;
        if (keyFindings.length < 3) {
          keyFindings.push(t('productMode.findingHighRisk', { category: categoryName }));
        }
      } else if (mediumRiskCategories.includes(cat)) {
        mediumRiskCount++;
        commitMediumRisk++;
        if (keyFindings.length < 3 && highRiskCount === 0) {
          keyFindings.push(t('productMode.findingMediumRisk', { category: categoryName }));
        }
      }
    });

    let commitRiskLevel: 'high' | 'medium' | 'low' = 'low';
    let commitRiskSummary = t('productMode.commitRiskLow');

    if (commitHighRisk > 0) {
      commitRiskLevel = 'high';
      commitRiskSummary = t('productMode.commitRiskHigh', { count: commitHighRisk });
    } else if (commitMediumRisk > 0) {
      commitRiskLevel = 'medium';
      commitRiskSummary = t('productMode.commitRiskMedium', { count: commitMediumRisk });
    }

    items.push({
      id: commit.commitId,
      author: commit.author?.name || 'Unknown',
      time: commit.timestamp ? new Date(commit.timestamp).toLocaleString() : 'Unknown',
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
  let headline = t('productMode.summaryHeadlineLow');
  let recommendation = t('productMode.summaryRecommendationLow');

  if (highRiskCount > 0) {
    level = 'high';
    headline = t('productMode.summaryHeadlineHigh', { count: highRiskCount });
    recommendation = t('productMode.summaryRecommendationHigh');
  } else if (mediumRiskCount > 0) {
    level = 'medium';
    headline = t('productMode.summaryHeadlineMedium', { count: mediumRiskCount });
    recommendation = t('productMode.summaryRecommendationMedium');
  }

  if (uniqueFindings.length === 0) {
    if (level === 'low') {
      uniqueFindings.push(t('productMode.noRiskPatterns'));
    } else {
      uniqueFindings.push(t('productMode.multipleAdjustments'));
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
