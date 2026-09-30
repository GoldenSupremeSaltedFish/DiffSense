const { parentPort, workerData } = require('worker_threads');
const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function initializeDatabase(dbPath, config) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = sqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_metrics (
      path TEXT PRIMARY KEY,
      churn INTEGER DEFAULT 0,
      complexity INTEGER DEFAULT 0,
      fiis_score REAL DEFAULT 0,
      ffis_score REAL DEFAULT 0,
      lang TEXT DEFAULT NULL,
      last_modified INTEGER NOT NULL,
      last_commit_sha TEXT
    );

    CREATE TABLE IF NOT EXISTS commit_index (
      sha TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS error_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      file TEXT,
      action TEXT,
      message TEXT
    );

    CREATE TABLE IF NOT EXISTS analysis_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      workspace_path TEXT NOT NULL,
      analysis_type TEXT NOT NULL,
      analysis_options TEXT,
      results TEXT NOT NULL,
      summary TEXT,
      error_message TEXT
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_file_metrics_churn ON file_metrics(churn DESC);
    CREATE INDEX IF NOT EXISTS idx_file_metrics_complexity ON file_metrics(complexity DESC);
    CREATE INDEX IF NOT EXISTS idx_file_metrics_last_modified ON file_metrics(last_modified);
    CREATE INDEX IF NOT EXISTS idx_file_metrics_lang ON file_metrics(lang);
    CREATE INDEX IF NOT EXISTS idx_commit_index_timestamp ON commit_index(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_error_log_timestamp ON error_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_timestamp ON analysis_results(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_workspace ON analysis_results(workspace_path);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_type ON analysis_results(analysis_type);
  `);

  // Initial cleanup
  cleanupDatabase(config);
}

function cleanupDatabase(config) {
  const maxAge = config.maxAge || (90 * 24 * 60 * 60 * 1000);
  const cutoffTime = Date.now() - maxAge;

  db.prepare('DELETE FROM file_metrics WHERE last_modified < ?').run(cutoffTime);

  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = Date.now() - thirtyDays;
  db.prepare('DELETE FROM file_metrics WHERE churn <= 1 AND last_modified < ?').run(thirtyDaysAgo);
  db.prepare('DELETE FROM error_log WHERE timestamp < ?').run(thirtyDaysAgo);

  const oneEightyDays = Date.now() - (180 * 24 * 60 * 60 * 1000);
  db.prepare('DELETE FROM commit_index WHERE timestamp < ?').run(oneEightyDays);
}

function updateFileMetrics(filePath, metrics) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO file_metrics (
      path, churn, complexity, fiis_score, ffis_score, 
      lang, last_modified, last_commit_sha
    ) VALUES (
      @path, @churn, @complexity, @fiis_score, @ffis_score,
      @lang, @last_modified, @last_commit_sha
    )
  `);

  const now = Date.now();
  const existing = getFileMetrics(filePath);
  
  const data = {
    path: filePath,
    churn: metrics.churn ?? existing?.churn ?? 0,
    complexity: metrics.complexity ?? existing?.complexity ?? 0,
    fiis_score: metrics.fiis_score ?? existing?.fiis_score ?? 0,
    ffis_score: metrics.ffis_score ?? existing?.ffis_score ?? 0,
    lang: metrics.lang ?? existing?.lang ?? null,
    last_modified: now,
    last_commit_sha: metrics.last_commit_sha ?? existing?.last_commit_sha ?? null
  };

  stmt.run(data);
}

function getFileMetrics(filePath) {
  return db.prepare('SELECT * FROM file_metrics WHERE path = ?').get(filePath);
}

function getAllFileMetrics(limit = 1000) {
  return db.prepare('SELECT * FROM file_metrics ORDER BY last_modified DESC LIMIT ?').all(limit);
}

function getHotspotFiles(limit = 50) {
  return db.prepare(`
    SELECT *, (churn * 0.7 + complexity * 0.3) as hotspot_score
    FROM file_metrics 
    WHERE churn > 1 OR complexity > 0
    ORDER BY hotspot_score DESC, churn DESC
    LIMIT ?
  `).all(limit);
}

function recordCommit(sha, timestamp) {
  db.prepare('INSERT OR REPLACE INTO commit_index (sha, timestamp) VALUES (@sha, @timestamp)')
    .run({ sha, timestamp });
}

function hasCommit(sha) {
  return !!db.prepare('SELECT 1 FROM commit_index WHERE sha = ?').get(sha);
}

function logError(errorLog) {
  db.prepare('INSERT INTO error_log (timestamp, file, action, message) VALUES (@timestamp, @file, @action, @message)')
    .run(errorLog);
}

function getStats() {
  const fileMetricsCount = db.prepare('SELECT COUNT(*) as count FROM file_metrics').get();
  const commitIndexCount = db.prepare('SELECT COUNT(*) as count FROM commit_index').get();
  const errorLogCount = db.prepare('SELECT COUNT(*) as count FROM error_log').get();
  const analysisResultsCount = db.prepare('SELECT COUNT(*) as count FROM analysis_results').get();
  
  const topHotspots = getHotspotFiles(10);
  const recentErrors = db.prepare('SELECT * FROM error_log ORDER BY timestamp DESC LIMIT 5').all();
  const recentAnalysis = db.prepare('SELECT * FROM analysis_results ORDER BY timestamp DESC LIMIT 5').all();

  return {
    fileMetrics: fileMetricsCount.count,
    commitIndex: commitIndexCount.count,
    errorLog: errorLogCount.count,
    analysisResults: analysisResultsCount.count,
    topHotspots: topHotspots.map(h => ({ path: h.path, churn: h.churn, complexity: h.complexity })),
    recentErrors: recentErrors.map(e => ({ action: e.action, message: e.message, timestamp: e.timestamp })),
    recentAnalysis: recentAnalysis.map(a => ({ 
      workspace_path: a.workspace_path, 
      analysis_type: a.analysis_type, 
      timestamp: a.timestamp,
      has_error: !!a.error_message
    }))
  };
}

function saveAnalysisResult(workspacePath, analysisType, results, analysisOptions = null, summary = null, errorMessage = null) {
  const stmt = db.prepare(`
    INSERT INTO analysis_results (
      timestamp, workspace_path, analysis_type, analysis_options, 
      results, summary, error_message
    ) VALUES (
      @timestamp, @workspace_path, @analysis_type, @analysis_options,
      @results, @summary, @error_message
    )
  `);

  const data = {
    timestamp: Date.now(),
    workspace_path: workspacePath,
    analysis_type: analysisType,
    analysis_options: analysisOptions ? JSON.stringify(analysisOptions) : null,
    results: JSON.stringify(results),
    summary: summary,
    error_message: errorMessage
  };

  stmt.run(data);
  return { success: true };
}

function getAnalysisResults(workspacePath, analysisType = null, limit = 50) {
  let query = 'SELECT * FROM analysis_results WHERE workspace_path = ?';
  let params = [workspacePath];

  if (analysisType) {
    query += ' AND analysis_type = ?';
    params.push(analysisType);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params);
}

function getLatestAnalysisResult(workspacePath, analysisType = null) {
  let query = 'SELECT * FROM analysis_results WHERE workspace_path = ?';
  let params = [workspacePath];

  if (analysisType) {
    query += ' AND analysis_type = ?';
    params.push(analysisType);
  }

  query += ' ORDER BY timestamp DESC LIMIT 1';

  return db.prepare(query).get(...params);
}

function analyzeHotspots(workspacePath, options = {}) {
  const {
    minChurn = 1,
    minComplexity = 0,
    limit = 50,
    includeLang = null,
    excludePatterns = []
  } = options;

  let query = `
    SELECT *, 
           (churn * 0.7 + complexity * 0.3) as hotspot_score,
           CASE 
             WHEN churn > 10 OR complexity > 50 THEN 'critical'
             WHEN churn > 5 OR complexity > 20 THEN 'high'
             WHEN churn > 2 OR complexity > 10 THEN 'medium'
             ELSE 'low'
           END as risk_level
    FROM file_metrics 
    WHERE (churn > ? OR complexity > ?)
  `;
  
  let params = [minChurn, minComplexity];

  // Add language filter if specified
  if (includeLang && includeLang.length > 0) {
    const langPlaceholders = includeLang.map(() => '?').join(',');
    query += ` AND lang IN (${langPlaceholders})`;
    params.push(...includeLang);
  }

  // Add exclude patterns
  if (excludePatterns.length > 0) {
    excludePatterns.forEach(pattern => {
      query += ` AND path NOT LIKE ?`;
      params.push(`%${pattern}%`);
    });
  }

  query += ` ORDER BY hotspot_score DESC LIMIT ?`;
  params.push(limit);

  const hotspots = db.prepare(query).all(...params);

  // Calculate summary statistics
  const summaryQuery = `
    SELECT 
      COUNT(*) as total_files,
      COUNT(CASE WHEN churn > 10 OR complexity > 50 THEN 1 END) as critical_files,
      COUNT(CASE WHEN (churn > 5 OR complexity > 20) AND NOT (churn > 10 OR complexity > 50) THEN 1 END) as high_files,
      COUNT(CASE WHEN (churn > 2 OR complexity > 10) AND NOT (churn > 5 OR complexity > 20) THEN 1 END) as medium_files,
      AVG(churn) as avg_churn,
      AVG(complexity) as avg_complexity
    FROM file_metrics
    WHERE (churn > 0 OR complexity > 0)
  `;

  const summary = db.prepare(summaryQuery).get();

  // Get top languages
  const langQuery = `
    SELECT lang, COUNT(*) as count
    FROM file_metrics
    WHERE lang IS NOT NULL AND (churn > 0 OR complexity > 0)
    GROUP BY lang
    ORDER BY count DESC
    LIMIT 5
  `;

  const topLanguages = db.prepare(langQuery).all();

  return {
    hotspots: hotspots.map(h => ({
      ...h,
      hotspot_score: Math.round(h.hotspot_score * 100) / 100
    })),
    summary: {
      totalFiles: summary.total_files || 0,
      criticalRiskFiles: summary.critical_files || 0,
      highRiskFiles: summary.high_files || 0,
      mediumRiskFiles: summary.medium_files || 0,
      averageChurn: Math.round((summary.avg_churn || 0) * 100) / 100,
      averageComplexity: Math.round((summary.avg_complexity || 0) * 100) / 100,
      topLanguages: topLanguages.map(l => ({ lang: l.lang, count: l.count }))
    }
  };
}

if (parentPort) {
  parentPort.on('message', async (message) => {
    const { id, action, data } = message;

    try {
      let result;

      switch (action) {
        case 'initialize':
          initializeDatabase(workerData.dbPath, workerData.config);
          result = { success: true };
          break;

        case 'updateFileMetrics':
          updateFileMetrics(data.filePath, data.metrics);
          result = { success: true };
          break;

        case 'getFileMetrics':
          result = getFileMetrics(data.filePath);
          break;

        case 'getAllFileMetrics':
          result = getAllFileMetrics(data.limit);
          break;

        case 'getHotspotFiles':
          result = getHotspotFiles(data.limit);
          break;

        case 'recordCommit':
          recordCommit(data.sha, data.timestamp);
          result = { success: true };
          break;

        case 'hasCommit':
          result = hasCommit(data.sha);
          break;

        case 'logError':
          logError(data);
          result = { success: true };
          break;

        case 'getStats':
          result = getStats();
          break;

        case 'saveAnalysisResult':
          result = saveAnalysisResult(
            data.workspacePath,
            data.analysisType,
            data.results,
            data.analysisOptions,
            data.summary,
            data.errorMessage
          );
          break;

        case 'getAnalysisResults':
          result = getAnalysisResults(
            data.workspacePath,
            data.analysisType,
            data.limit
          );
          break;

        case 'getLatestAnalysisResult':
          result = getLatestAnalysisResult(
            data.workspacePath,
            data.analysisType
          );
          break;

        case 'analyzeHotspots':
          result = analyzeHotspots(data.workspacePath, data.options);
          break;

        case 'cleanupData':
          // Custom cleanup with specific cutoff
          const { cutoffTime } = data;
          db.prepare('DELETE FROM file_metrics WHERE last_modified < ?').run(cutoffTime);
          db.prepare('DELETE FROM error_log WHERE timestamp < ?').run(cutoffTime);
          // Vacuum to reclaim space
          db.exec('VACUUM');
          result = { success: true };
          break;

        case 'close':
          if (db) {
            db.close();
            db = null;
          }
          result = { success: true };
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      parentPort.postMessage({ id, result });
    } catch (error) {
      parentPort.postMessage({ 
        id, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
}