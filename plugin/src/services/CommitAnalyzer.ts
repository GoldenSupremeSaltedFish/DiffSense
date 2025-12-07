import { DatabaseService } from './DatabaseService';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface CommitInfo {
  sha: string;
  timestamp: number;
  author: string;
  message: string;
  files: string[];
}

export interface FileChangeInfo {
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  linesAdded: number;
  linesDeleted: number;
}

export class CommitAnalyzer {
  private databaseService: DatabaseService;
  private workspaceRoot: string;
  private isAnalyzing = false;

  constructor(databaseService: DatabaseService, workspaceRoot: string) {
    this.databaseService = databaseService;
    this.workspaceRoot = workspaceRoot;
  }

  async analyzeCommit(commitInfo: CommitInfo): Promise<void> {
    if (this.isAnalyzing) {
      return;
    }

    this.isAnalyzing = true;

    try {
      // Check if commit already processed
      const hasProcessed = await this.databaseService.hasCommit(commitInfo.sha);
      if (hasProcessed) {
        console.log(`Commit ${commitInfo.sha} already processed, skipping`);
        return;
      }

      console.log(`Analyzing commit: ${commitInfo.sha}`);
      
      // Process each file in the commit
      for (const filePath of commitInfo.files) {
        await this.processFileChange(filePath, commitInfo);
      }

      // Record commit as processed
      await this.databaseService.recordCommit(commitInfo.sha, commitInfo.timestamp);
      
      console.log(`Commit analysis completed: ${commitInfo.sha}`);
    } catch (error) {
      await this.databaseService.logError({
        timestamp: Date.now(),
        file: 'commit-analysis',
        action: 'analyze-commit',
        message: `Failed to analyze commit ${commitInfo.sha}: ${error instanceof Error ? error.message : String(error)}`
      });
      throw error;
    } finally {
      this.isAnalyzing = false;
    }
  }

  private async processFileChange(filePath: string, commitInfo: CommitInfo): Promise<void> {
    try {
      const relativePath = path.relative(this.workspaceRoot, filePath);
      
      // Skip if file doesn't exist or is not a supported file type
      if (!fs.existsSync(filePath)) {
        return;
      }

      const fileStats = fs.statSync(filePath);
      if (!fileStats.isFile()) {
        return;
      }

      // Get current metrics for the file
      const currentMetrics = await this.databaseService.getFileMetrics(relativePath);
      
      // Calculate new metrics
      const newMetrics = await this.calculateFileMetrics(filePath, currentMetrics);
      
      // Update database
      await this.databaseService.updateFileMetrics(relativePath, {
        ...newMetrics,
        last_commit_sha: commitInfo.sha,
        churn: (currentMetrics?.churn || 0) + 1
      });

    } catch (error) {
      await this.databaseService.logError({
        timestamp: Date.now(),
        file: filePath,
        action: 'process-file-change',
        message: `Failed to process file change: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async calculateFileMetrics(filePath: string, currentMetrics?: any): Promise<any> {
    const ext = path.extname(filePath).toLowerCase();
    const lang = this.getLanguageFromExtension(ext);
    
    let complexity = 0;
    let fiis_score = 0;
    let ffis_score = 0;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Calculate complexity based on file type
      complexity = this.calculateComplexity(content, lang);
      
      // Calculate FFIS/FIIS scores (placeholder - integrate with existing classifier)
      const scores = await this.calculateImpactScores(content, filePath, lang);
      fiis_score = scores.fiis_score;
      ffis_score = scores.ffis_score;
      
    } catch (error) {
      // If we can't read the file, use existing metrics or defaults
      complexity = currentMetrics?.complexity || 0;
      fiis_score = currentMetrics?.fiis_score || 0;
      ffis_score = currentMetrics?.ffis_score || 0;
    }

    return {
      complexity,
      fiis_score,
      ffis_score,
      lang
    };
  }

  private getLanguageFromExtension(ext: string): string {
    const langMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.vue': 'vue',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.rs': 'rust',
      '.scala': 'scala',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.sh': 'shell',
      '.sql': 'sql'
    };
    
    return langMap[ext] || 'unknown';
  }

  private calculateComplexity(content: string, lang: string): number {
    const lines = content.split('\n');
    let complexity = 0;
    
    // Basic complexity calculation based on language patterns
    switch (lang) {
      case 'javascript':
      case 'typescript':
      case 'vue':
        complexity = this.calculateJSComplexity(content);
        break;
      case 'python':
        complexity = this.calculatePythonComplexity(content);
        break;
      case 'java':
        complexity = this.calculateJavaComplexity(content);
        break;
      default:
        // Fallback: complexity based on lines of code
        complexity = Math.floor(lines.length / 10);
    }
    
    return Math.min(complexity, 100); // Cap at 100
  }

  private calculateJSComplexity(content: string): number {
    let complexity = 0;
    
    // Count control flow statements
    const controlFlowPatterns = [
      /\b(if|else|switch|case|default)\b/g,
      /\b(for|while|do)\b/g,
      /\b(try|catch|finally)\b/g,
      /\b(break|continue|return)\b/g,
      /\b(function|class|interface)\b/g,
      /\b(async|await)\b/g,
      /\b(new|delete|typeof|instanceof)\b/g,
      /\b(import|export|require)\b/g
    ];
    
    controlFlowPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    // Count nesting depth
    const nestingMatches = content.match(/[{\[](?:[^{\[]*[{\[])*[}\]]/g);
    if (nestingMatches) {
      complexity += nestingMatches.length;
    }
    
    return Math.floor(complexity / 5); // Normalize
  }

  private calculatePythonComplexity(content: string): number {
    let complexity = 0;
    
    const patterns = [
      /\b(if|elif|else)\b/g,
      /\b(for|while)\b/g,
      /\b(try|except|finally)\b/g,
      /\b(def|class|lambda)\b/g,
      /\b(import|from|as)\b/g,
      /\b(and|or|not|in|is)\b/g,
      /\b(with|yield|async|await)\b/g
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return Math.floor(complexity / 3);
  }

  private calculateJavaComplexity(content: string): number {
    let complexity = 0;
    
    const patterns = [
      /\b(if|else|switch|case|default)\b/g,
      /\b(for|while|do)\b/g,
      /\b(try|catch|finally)\b/g,
      /\b(class|interface|enum)\b/g,
      /\b(public|private|protected|static|final)\b/g,
      /\b(new|throw|throws)\b/g,
      /\b(import|package)\b/g,
      /\b(synchronized|volatile|transient)\b/g
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return Math.floor(complexity / 4);
  }

  private async calculateImpactScores(content: string, filePath: string, lang: string): Promise<{fiis_score: number, ffis_score: number}> {
    // Placeholder for FFIS/FIIS calculation
    // This should integrate with your existing FrontendChangeClassifier
    
    // For now, return basic scores based on file characteristics
    const lines = content.split('\n').length;
    const hasImports = content.includes('import') || content.includes('require') || content.includes('from');
    const hasExports = content.includes('export') || content.includes('module.exports');
    
    let fiis_score = 0;
    let ffis_score = 0;
    
    // Basic FIIS (File Impact Importance Score)
    if (hasImports) fiis_score += 10;
    if (hasExports) fiis_score += 15;
    if (lines > 100) fiis_score += 20;
    if (lines > 200) fiis_score += 10;
    
    // Basic FFIS (File Functional Importance Score)
    if (content.includes('function') || content.includes('class')) ffis_score += 20;
    if (content.includes('component') || content.includes('Component')) ffis_score += 25;
    if (content.includes('service') || content.includes('api')) ffis_score += 15;
    
    return {
      fiis_score: Math.min(fiis_score, 100),
      ffis_score: Math.min(ffis_score, 100)
    };
  }

  async getHotspotAnalysis(limit: number = 50): Promise<any[]> {
    return await this.databaseService.getHotspotFiles(limit);
  }

  async getFileMetricsHistory(filePath: string): Promise<any> {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    return await this.databaseService.getFileMetrics(relativePath);
  }
}