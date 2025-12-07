import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';

export interface FileMetrics {
  path: string;
  churn: number;
  complexity: number;
  fiis_score: number;
  ffis_score: number;
  lang: string | null;
  last_modified: number;
  last_commit_sha: string | null;
}

export interface CommitIndex {
  sha: string;
  timestamp: number;
}

export interface ErrorLog {
  id?: number;
  timestamp: number;
  file?: string;
  action: string;
  message: string;
}

export interface DatabaseConfig {
  dbPath: string;
  enableWorker: boolean;
  maxRetries: number;
  retryDelay: number;
  cleanupInterval: number;
  maxAge: number;
  enableCorruptionRecovery?: boolean;
}

export class DatabaseService extends EventEmitter {
  private static instance: DatabaseService;
  private worker: Worker | null = null;
  private dbPath: string;
  private config: DatabaseConfig;
  private isInitialized = false;
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

  private constructor(context: vscode.ExtensionContext, config?: Partial<DatabaseConfig>) {
    super();
    
    this.config = {
      dbPath: path.join(context.globalStorageUri.fsPath, 'diffsense.db'),
      enableWorker: true,
      maxRetries: 3,
      retryDelay: 50,
      cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      enableCorruptionRecovery: true,
      ...config
    };
    
    this.dbPath = this.config.dbPath;
    this.ensureDirectoryExists();
  }

  public static getInstance(context: vscode.ExtensionContext, config?: Partial<DatabaseConfig>): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(context, config);
    }
    return DatabaseService.instance;
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      if (this.config.enableWorker) {
        await this.initializeWorker();
      } else {
        await this.initializeDirect();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      
      // Start cleanup interval
      setInterval(() => this.cleanup(), this.config.cleanupInterval);
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async initializeWorker(): Promise<void> {
    const workerPath = path.join(__dirname, 'database-worker.js');
    
    this.worker = new Worker(workerPath, {
      workerData: {
        dbPath: this.dbPath,
        config: this.config
      }
    });

    this.worker.on('message', (message) => {
      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id)!;
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.result);
        }
      }
    });

    this.worker.on('error', (error) => {
      this.emit('error', error);
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        this.emit('error', new Error(`Worker stopped with exit code ${code}`));
      }
    });

    // Wait for worker initialization
    await this.sendWorkerMessage('initialize');
  }

  private async initializeDirect(): Promise<void> {
    // Direct initialization will be implemented in the main thread
    // For now, we'll use worker-based approach
    throw new Error('Direct initialization not implemented yet');
  }

  private sendWorkerMessage(action: string, data?: any): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const id = ++this.messageId;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      this.worker!.postMessage({
        id,
        action,
        data
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Database operation timeout'));
        }
      }, 30000);
    });
  }

  // Database operations with retry mechanism
  private async withRetry<T>(operation: () => Promise<T>, retries = this.config.maxRetries): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check for database corruption
        if (this.isDatabaseCorrupted(error)) {
          await this.handleDatabaseCorruption();
          continue;
        }
        
        // Retry with exponential backoff
        if (i < retries) {
          const delay = this.config.retryDelay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // Log error and throw
    await this.logError('database_operation', lastError!.message);
    throw lastError;
  }

  private isDatabaseCorrupted(error: any): boolean {
    const errorMessage = error?.message || '';
    return errorMessage.includes('database disk image is malformed') ||
           errorMessage.includes('database is locked') ||
           errorMessage.includes('SQLITE_CORRUPT');
  }

  private async handleDatabaseCorruption(): Promise<void> {
    try {
      // Close worker if exists
      if (this.worker) {
        await this.worker.terminate();
        this.worker = null;
      }
      
      // Try to backup the corrupted file (just in case)
      const backupPath = `${this.dbPath}.backup.${Date.now()}`;
      try {
        fs.copyFileSync(this.dbPath, backupPath);
        console.log(`Created backup of corrupted database: ${backupPath}`);
      } catch (backupError) {
        console.warn('Failed to create backup:', backupError);
      }
      
      // Delete corrupted database
      if (fs.existsSync(this.dbPath)) {
        fs.unlinkSync(this.dbPath);
      }
      
      // Also remove WAL files if they exist
      const walPath = `${this.dbPath}-wal`;
      const shmPath = `${this.dbPath}-shm`;
      
      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
      }
      if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
      }
      
      // Show recovery notification to user
      vscode.window.showInformationMessage(
        'DiffSense database was corrupted and has been recreated. Your analysis data will be rebuilt as you work.'
      );
      
      // Reinitialize
      await this.initializeWorker();
      
      this.emit('database_recreated');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Public API methods
  public async updateFileMetrics(filePath: string, metrics: Partial<FileMetrics>): Promise<void> {
    await this.withRetry(async () => {
      if (this.config.enableWorker) {
        await this.sendWorkerMessage('updateFileMetrics', { filePath, metrics });
      }
    });
  }

  public async getFileMetrics(filePath: string): Promise<FileMetrics | null> {
    return await this.withRetry(async () => {
      if (this.config.enableWorker) {
        return await this.sendWorkerMessage('getFileMetrics', { filePath });
      }
      return null;
    });
  }

  public async getAllFileMetrics(limit = 1000): Promise<FileMetrics[]> {
    return await this.withRetry(async () => {
      if (this.config.enableWorker) {
        return await this.sendWorkerMessage('getAllFileMetrics', { limit });
      }
      return [];
    });
  }

  public async getHotspotFiles(limit = 50): Promise<FileMetrics[]> {
    return await this.withRetry(async () => {
      if (this.config.enableWorker) {
        return await this.sendWorkerMessage('getHotspotFiles', { limit });
      }
      return [];
    });
  }

  public async analyzeHotspots(workspacePath: string, options: {
    minChurn?: number;
    minComplexity?: number;
    limit?: number;
    includeLang?: string[];
    excludePatterns?: string[];
  } = {}): Promise<{
    hotspots: Array<FileMetrics & { hotspot_score: number; risk_level: 'low' | 'medium' | 'high' | 'critical' }>;
    summary: {
      totalFiles: number;
      highRiskFiles: number;
      mediumRiskFiles: number;
      criticalRiskFiles: number;
      averageChurn: number;
      averageComplexity: number;
      topLanguages: Array<{ lang: string; count: number }>;
    };
  }> {
    return await this.withRetry(async () => {
      if (this.config.enableWorker) {
        return await this.sendWorkerMessage('analyzeHotspots', {
          workspacePath,
          options
        });
      }
      return { hotspots: [], summary: { totalFiles: 0, highRiskFiles: 0, mediumRiskFiles: 0, criticalRiskFiles: 0, averageChurn: 0, averageComplexity: 0, topLanguages: [] } };
    });
  }

  public async recordCommit(sha: string, timestamp: number): Promise<void> {
    await this.withRetry(async () => {
      if (this.config.enableWorker) {
        await this.sendWorkerMessage('recordCommit', { sha, timestamp });
      }
    });
  }

  public async hasCommit(sha: string): Promise<boolean> {
    return await this.withRetry(async () => {
      if (this.config.enableWorker) {
        return await this.sendWorkerMessage('hasCommit', { sha });
      }
      return false;
    });
  }

  public async logError(action: string, message: string, file?: string): Promise<void> {
    const errorLog: ErrorLog = {
      timestamp: Date.now(),
      file,
      action,
      message
    };

    await this.withRetry(async () => {
      if (this.config.enableWorker) {
        await this.sendWorkerMessage('logError', errorLog);
      }
    });
  }

  public async cleanup(): Promise<void> {
    await this.withRetry(async () => {
      if (this.config.enableWorker) {
        await this.sendWorkerMessage('cleanup', {
          maxAge: this.config.maxAge
        });
      }
    });
  }

  public async getDatabaseStats(): Promise<any> {
    return await this.withRetry(async () => {
      if (this.config.enableWorker) {
        return await this.sendWorkerMessage('getStats');
      }
      return {};
    });
  }

  public async saveAnalysisResult(
    workspacePath: string,
    analysisType: string,
    results: any,
    analysisOptions?: any,
    summary?: string,
    errorMessage?: string
  ): Promise<void> {
    await this.withRetry(async () => {
      if (this.config.enableWorker) {
        await this.sendWorkerMessage('saveAnalysisResult', {
          workspacePath,
          analysisType,
          results,
          analysisOptions,
          summary,
          errorMessage
        });
      }
    });
  }

  public async getAnalysisResults(
    workspacePath: string,
    analysisType?: string,
    limit: number = 50
  ): Promise<any[]> {
    return await this.withRetry(async () => {
      if (this.config.enableWorker) {
        return await this.sendWorkerMessage('getAnalysisResults', {
          workspacePath,
          analysisType,
          limit
        });
      }
      return [];
    });
  }

  public async getLatestAnalysisResult(
    workspacePath: string,
    analysisType?: string
  ): Promise<any | null> {
    return await this.withRetry(async () => {
      if (this.config.enableWorker) {
        return await this.sendWorkerMessage('getLatestAnalysisResult', {
          workspacePath,
          analysisType
        });
      }
      return null;
    });
  }

  public async dispose(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.removeAllListeners();
  }
}