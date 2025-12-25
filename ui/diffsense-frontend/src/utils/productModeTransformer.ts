
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
        headline: 'No analysis data available',
        keyFindings: [],
        recommendation: 'Run an analysis to see results.'
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

  impacts.forEach(commit => {
    const classifications = commit.changeClassifications || [];
    
    classifications.forEach(fc => {
      const cat = fc.classification.category;
      if (highRiskCategories.includes(cat)) {
        highRiskCount++;
        // Add to findings if we have fewer than 3
        if (keyFindings.length < 3) {
          keyFindings.push(`High Risk: ${fc.classification.categoryName} in ${fc.filePath.split('/').pop()}`);
        }
      } else if (mediumRiskCategories.includes(cat)) {
        mediumRiskCount++;
        if (keyFindings.length < 3 && highRiskCount === 0) { // Prioritize high risk
           keyFindings.push(`Medium Risk: ${fc.classification.categoryName} in ${fc.filePath.split('/').pop()}`);
        }
      }
    });
  });

  // Determine overall level
  let level: 'low' | 'medium' | 'high' = 'low';
  let headline = 'Changes appear safe';
  let recommendation = 'Safe to proceed.';

  if (highRiskCount > 0) {
    level = 'high';
    headline = `Detected ${highRiskCount} High Risk Changes`;
    recommendation = 'Careful review required. Focus on business logic and interface changes.';
  } else if (mediumRiskCount > 0) {
    level = 'medium';
    headline = `Detected ${mediumRiskCount} Medium Risk Changes`;
    recommendation = 'Review recommended. Check for side effects in UI behavior.';
  } else {
    headline = 'Low Risk Changes Detected';
    recommendation = 'Standard review process is sufficient.';
  }

  // Fallback findings if empty
  if (keyFindings.length === 0) {
    keyFindings.push('No significant risk patterns detected.');
  }

  return {
    summary: {
      level,
      headline,
      keyFindings: keyFindings.slice(0, 3), // Limit to top 3
      recommendation
    }
  };
};
