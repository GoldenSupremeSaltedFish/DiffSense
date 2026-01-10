
export interface AnalysisItem {
  id: string; // Commit ID
  author: string;
  time: string;
  riskLevel: 'high' | 'medium' | 'low';
  fileCount: number;
  riskSummary: string;
  message: string;
  details?: {
    affectedModules: string[];
    // dependencyGraph?: ... (Maybe skip for now or use placeholder)
  };
}

export interface AnalysisViewModel {
  summary: {
    level: 'low' | 'medium' | 'high';
    headline: string;
    keyFindings: string[];
    recommendation: string;
  };
  items: AnalysisItem[];
}
