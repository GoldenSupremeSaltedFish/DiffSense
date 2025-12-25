
export interface AnalysisViewModel {
  summary: {
    level: 'low' | 'medium' | 'high';
    headline: string;
    keyFindings: string[];
    recommendation: string;
  };
}
