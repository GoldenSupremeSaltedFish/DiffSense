/**
 * DiffSense 统一错误处理系统
 * 提供结构化的错误管理、错误码体系和日志记录
 */

const fs = require('fs');
const path = require('path');

/**
 * 错误码枚举
 */
const ErrorCodes = {
  // 文件系统错误 (1000-1999)
  FILE_NOT_FOUND: 1001,
  FILE_READ_ERROR: 1002,
  FILE_WRITE_ERROR: 1003,
  DIRECTORY_NOT_FOUND: 1004,
  PERMISSION_DENIED: 1005,
  
  // 解析错误 (2000-2999)
  PARSE_ERROR: 2001,
  SYNTAX_ERROR: 2002,
  INVALID_FORMAT: 2003,
  UNSUPPORTED_LANGUAGE: 2004,
  
  // 分析错误 (3000-3999)
  ANALYSIS_FAILED: 3001,
  DEPENDENCY_ANALYSIS_ERROR: 3002,
  CALL_GRAPH_ERROR: 3003,
  CLASSIFICATION_ERROR: 3004,
  
  // 配置错误 (4000-4999)
  CONFIG_ERROR: 4001,
  INVALID_CONFIG: 4002,
  MISSING_CONFIG: 4003,
  
  // 网络和外部依赖错误 (5000-5999)
  NETWORK_ERROR: 5001,
  API_ERROR: 5002,
  TIMEOUT_ERROR: 5003,
  
  // 系统错误 (9000-9999)
  UNKNOWN_ERROR: 9001,
  INTERNAL_ERROR: 9002,
  MEMORY_ERROR: 9003
};

/**
 * 错误严重程度枚举
 */
const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * DiffSense错误类
 */
class DiffSenseError extends Error {
  constructor(code, message, details = {}, severity = ErrorSeverity.MEDIUM) {
    super(message);
    this.name = 'DiffSenseError';
    this.code = code;
    this.details = details;
    this.severity = severity;
    this.timestamp = new Date().toISOString();
    this.stack = this.stack;
  }

  /**
   * 转换为可序列化的对象
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      severity: this.severity,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * 获取错误描述
   */
  getDescription() {
    return `[${this.code}] ${this.message}`;
  }
}

/**
 * 错误处理器类
 */
class ErrorHandler {
  constructor(options = {}) {
    this.logFile = options.logFile || 'diffsense-errors.log';
    this.enableConsoleLog = options.enableConsoleLog !== false;
    this.enableFileLog = options.enableFileLog !== false;
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB
    this.errorCounts = new Map();
    this.context = options.context || {};
  }

  /**
   * 设置上下文信息
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  /**
   * 创建错误实例
   */
  createError(code, message, details = {}, severity = ErrorSeverity.MEDIUM) {
    return new DiffSenseError(code, message, details, severity);
  }

  /**
   * 处理错误
   */
  handleError(error, context = {}) {
    // 确保错误是DiffSenseError实例
    if (!(error instanceof DiffSenseError)) {
      error = this.createError(
        ErrorCodes.UNKNOWN_ERROR,
        error.message || 'Unknown error occurred',
        { originalError: error.message, stack: error.stack },
        ErrorSeverity.MEDIUM
      );
    }

    // 合并上下文
    const fullContext = { ...this.context, ...context };
    error.details.context = fullContext;

    // 更新错误计数
    this.updateErrorCount(error.code);

    // 记录错误
    this.logError(error);

    // 根据严重程度决定是否抛出
    if (error.severity === ErrorSeverity.CRITICAL) {
      throw error;
    }

    return error;
  }

  /**
   * 安全执行函数，自动处理错误
   */
  async safeExecute(fn, context = {}) {
    try {
      return await fn();
    } catch (error) {
      return this.handleError(error, context);
    }
  }

  /**
   * 记录错误到日志
   */
  logError(error) {
    const logEntry = {
      timestamp: error.timestamp,
      code: error.code,
      message: error.message,
      severity: error.severity,
      details: error.details,
      stack: error.stack
    };

    const logMessage = JSON.stringify(logEntry, null, 2);

    // 控制台输出
    if (this.enableConsoleLog) {
      const colorCode = this.getSeverityColor(error.severity);
      console.error(`\x1b[${colorCode}m[${error.severity.toUpperCase()}] ${error.getDescription()}\x1b[0m`);
      
      if (error.details && Object.keys(error.details).length > 0) {
        console.error('Details:', error.details);
      }
    }

    // 文件日志
    if (this.enableFileLog) {
      this.writeToLogFile(logMessage);
    }
  }

  /**
   * 写入日志文件
   */
  writeToLogFile(logMessage) {
    try {
      // 检查日志文件大小
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxLogSize) {
          // 备份旧日志文件
          const backupFile = `${this.logFile}.${Date.now()}`;
          fs.renameSync(this.logFile, backupFile);
        }
      }

      // 写入新日志条目
      fs.appendFileSync(this.logFile, logMessage + '\n\n');
    } catch (writeError) {
      // 如果写入日志失败，至少输出到控制台
      console.error('Failed to write to log file:', writeError.message);
    }
  }

  /**
   * 获取严重程度对应的颜色代码
   */
  getSeverityColor(severity) {
    const colors = {
      [ErrorSeverity.LOW]: '36',      // 青色
      [ErrorSeverity.MEDIUM]: '33',   // 黄色
      [ErrorSeverity.HIGH]: '31',     // 红色
      [ErrorSeverity.CRITICAL]: '35'  // 紫色
    };
    return colors[severity] || '37';  // 默认白色
  }

  /**
   * 更新错误计数
   */
  updateErrorCount(code) {
    this.errorCounts.set(code, (this.errorCounts.get(code) || 0) + 1);
  }

  /**
   * 获取错误统计
   */
  getErrorStats() {
    const stats = {
      totalErrors: 0,
      byCode: {},
      bySeverity: {
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0
      }
    };

    for (const [code, count] of this.errorCounts) {
      stats.totalErrors += count;
      stats.byCode[code] = count;
    }

    return stats;
  }

  /**
   * 清理错误统计
   */
  clearErrorStats() {
    this.errorCounts.clear();
  }

  /**
   * 验证输入参数
   */
  validateInput(value, type, name, required = true) {
    if (required && (value === undefined || value === null)) {
      throw this.createError(
        ErrorCodes.INVALID_CONFIG,
        `Required parameter '${name}' is missing`,
        { parameter: name, type: type },
        ErrorSeverity.HIGH
      );
    }

    if (value !== undefined && value !== null) {
      if (type === 'string' && typeof value !== 'string') {
        throw this.createError(
          ErrorCodes.INVALID_CONFIG,
          `Parameter '${name}' must be a string`,
          { parameter: name, expectedType: type, actualType: typeof value },
          ErrorSeverity.MEDIUM
        );
      }

      if (type === 'number' && typeof value !== 'number') {
        throw this.createError(
          ErrorCodes.INVALID_CONFIG,
          `Parameter '${name}' must be a number`,
          { parameter: name, expectedType: type, actualType: typeof value },
          ErrorSeverity.MEDIUM
        );
      }

      if (type === 'boolean' && typeof value !== 'boolean') {
        throw this.createError(
          ErrorCodes.INVALID_CONFIG,
          `Parameter '${name}' must be a boolean`,
          { parameter: name, expectedType: type, actualType: typeof value },
          ErrorSeverity.MEDIUM
        );
      }

      if (type === 'array' && !Array.isArray(value)) {
        throw this.createError(
          ErrorCodes.INVALID_CONFIG,
          `Parameter '${name}' must be an array`,
          { parameter: name, expectedType: type, actualType: typeof value },
          ErrorSeverity.MEDIUM
        );
      }

      if (type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
        throw this.createError(
          ErrorCodes.INVALID_CONFIG,
          `Parameter '${name}' must be an object`,
          { parameter: name, expectedType: type, actualType: typeof value },
          ErrorSeverity.MEDIUM
        );
      }
    }
  }
}

/**
 * 创建默认错误处理器实例
 */
const defaultErrorHandler = new ErrorHandler({
  enableConsoleLog: true,
  enableFileLog: true,
  logFile: 'diffsense-errors.log'
});

module.exports = {
  ErrorCodes,
  ErrorSeverity,
  DiffSenseError,
  ErrorHandler,
  defaultErrorHandler
}; 