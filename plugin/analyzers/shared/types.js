/**
 * DiffSense 类型定义文件
 * 提供TypeScript类型定义和运行时类型验证
 */

/**
 * 文件信息类型
 */
class FileInfo {
  constructor(data = {}) {
    this.relativePath = data.relativePath || '';
    this.absolutePath = data.absolutePath || '';
    this.content = data.content || '';
    this.size = data.size || 0;
    this.modifiedTime = data.modifiedTime || new Date();
    this.methods = data.methods || [];
    this.classes = data.classes || [];
    this.imports = data.imports || [];
    this.exports = data.exports || [];
    this.dependencies = data.dependencies || [];
  }

  /**
   * 验证文件信息
   */
  static validate(fileInfo) {
    if (!fileInfo || typeof fileInfo !== 'object') {
      throw new Error('FileInfo must be an object');
    }
    
    if (typeof fileInfo.relativePath !== 'string') {
      throw new Error('relativePath must be a string');
    }
    
    if (typeof fileInfo.content !== 'string') {
      throw new Error('content must be a string');
    }
    
    if (!Array.isArray(fileInfo.methods)) {
      throw new Error('methods must be an array');
    }
    
    return true;
  }
}

/**
 * 方法信息类型
 */
class MethodInfo {
  constructor(data = {}) {
    this.name = data.name || '';
    this.startLine = data.startLine || 0;
    this.endLine = data.endLine || 0;
    this.parameters = data.parameters || [];
    this.returnType = data.returnType || '';
    this.modifiers = data.modifiers || [];
    this.annotations = data.annotations || [];
    this.calls = data.calls || [];
    this.complexity = data.complexity || 1;
  }

  /**
   * 验证方法信息
   */
  static validate(methodInfo) {
    if (!methodInfo || typeof methodInfo !== 'object') {
      throw new Error('MethodInfo must be an object');
    }
    
    if (typeof methodInfo.name !== 'string') {
      throw new Error('name must be a string');
    }
    
    if (typeof methodInfo.startLine !== 'number' || methodInfo.startLine < 0) {
      throw new Error('startLine must be a non-negative number');
    }
    
    if (typeof methodInfo.endLine !== 'number' || methodInfo.endLine < 0) {
      throw new Error('endLine must be a non-negative number');
    }
    
    if (!Array.isArray(methodInfo.parameters)) {
      throw new Error('parameters must be an array');
    }
    
    return true;
  }
}

/**
 * 分类结果类型
 */
class ClassificationResult {
  constructor(data = {}) {
    this.filePath = data.filePath || '';
    this.classification = {
      category: data.classification?.category || '',
      categoryName: data.classification?.categoryName || '',
      description: data.classification?.description || '',
      reason: data.classification?.reason || '',
      confidence: data.classification?.confidence || 0,
      indicators: data.classification?.indicators || []
    };
    this.changedMethods = data.changedMethods || [];
  }

  /**
   * 验证分类结果
   */
  static validate(classificationResult) {
    if (!classificationResult || typeof classificationResult !== 'object') {
      throw new Error('ClassificationResult must be an object');
    }
    
    if (typeof classificationResult.filePath !== 'string') {
      throw new Error('filePath must be a string');
    }
    
    if (!classificationResult.classification || typeof classificationResult.classification !== 'object') {
      throw new Error('classification must be an object');
    }
    
    if (typeof classificationResult.classification.confidence !== 'number' || 
        classificationResult.classification.confidence < 0 || 
        classificationResult.classification.confidence > 1) {
      throw new Error('confidence must be a number between 0 and 1');
    }
    
    if (!Array.isArray(classificationResult.classification.indicators)) {
      throw new Error('indicators must be an array');
    }
    
    return true;
  }
}

/**
 * 修改详情类型
 */
class ModificationDetail {
  constructor(data = {}) {
    this.type = data.type || '';
    this.description = data.description || '';
    this.file = data.file || '';
    this.method = data.method || null;
    this.confidence = data.confidence || 1.0;
    this.riskLevel = data.riskLevel || 'low';
    this.impact = data.impact || 'low';
    this.lineNumbers = data.lineNumbers || [];
    this.diffContent = data.diffContent || '';
  }

  /**
   * 验证修改详情
   */
  static validate(modificationDetail) {
    if (!modificationDetail || typeof modificationDetail !== 'object') {
      throw new Error('ModificationDetail must be an object');
    }
    
    if (typeof modificationDetail.type !== 'string') {
      throw new Error('type must be a string');
    }
    
    if (typeof modificationDetail.description !== 'string') {
      throw new Error('description must be a string');
    }
    
    if (typeof modificationDetail.confidence !== 'number' || 
        modificationDetail.confidence < 0 || 
        modificationDetail.confidence > 1) {
      throw new Error('confidence must be a number between 0 and 1');
    }
    
    if (!Array.isArray(modificationDetail.lineNumbers)) {
      throw new Error('lineNumbers must be an array');
    }
    
    return true;
  }
}

/**
 * 分析结果类型
 */
class AnalysisResult {
  constructor(data = {}) {
    this.files = data.files || [];
    this.classifications = data.classifications || [];
    this.modifications = data.modifications || [];
    this.dependencies = data.dependencies || [];
    this.callGraph = data.callGraph || {};
    this.summary = data.summary || {};
    this.performance = data.performance || {};
    this.errors = data.errors || [];
    this.warnings = data.warnings || [];
  }

  /**
   * 验证分析结果
   */
  static validate(analysisResult) {
    if (!analysisResult || typeof analysisResult !== 'object') {
      throw new Error('AnalysisResult must be an object');
    }
    
    if (!Array.isArray(analysisResult.files)) {
      throw new Error('files must be an array');
    }
    
    if (!Array.isArray(analysisResult.classifications)) {
      throw new Error('classifications must be an array');
    }
    
    if (!Array.isArray(analysisResult.modifications)) {
      throw new Error('modifications must be an array');
    }
    
    if (!Array.isArray(analysisResult.errors)) {
      throw new Error('errors must be an array');
    }
    
    return true;
  }
}

/**
 * 配置选项类型
 */
class AnalysisOptions {
  constructor(data = {}) {
    this.targetDir = data.targetDir || '';
    this.outputFormat = data.outputFormat || 'json';
    this.includeTests = data.includeTests !== false;
    this.includeDependencies = data.includeDependencies !== false;
    this.maxDepth = data.maxDepth || 15;
    this.maxFiles = data.maxFiles || 1000;
    this.parallelAnalysis = data.parallelAnalysis !== false;
    this.enableCaching = data.enableCaching !== false;
    this.verbose = data.verbose || false;
    this.timeout = data.timeout || 300000;
  }

  /**
   * 验证分析选项
   */
  static validate(options) {
    if (!options || typeof options !== 'object') {
      throw new Error('AnalysisOptions must be an object');
    }
    
    if (typeof options.targetDir !== 'string') {
      throw new Error('targetDir must be a string');
    }
    
    if (typeof options.maxDepth !== 'number' || options.maxDepth < 1) {
      throw new Error('maxDepth must be a positive number');
    }
    
    if (typeof options.maxFiles !== 'number' || options.maxFiles < 1) {
      throw new Error('maxFiles must be a positive number');
    }
    
    if (typeof options.timeout !== 'number' || options.timeout < 1000) {
      throw new Error('timeout must be at least 1000ms');
    }
    
    return true;
  }
}

/**
 * 运行时类型验证器
 */
class TypeValidator {
  /**
   * 验证字符串类型
   */
  static isString(value, name = 'value') {
    if (typeof value !== 'string') {
      throw new TypeError(`${name} must be a string, got ${typeof value}`);
    }
    return true;
  }

  /**
   * 验证数字类型
   */
  static isNumber(value, name = 'value') {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new TypeError(`${name} must be a valid number, got ${typeof value}`);
    }
    return true;
  }

  /**
   * 验证布尔类型
   */
  static isBoolean(value, name = 'value') {
    if (typeof value !== 'boolean') {
      throw new TypeError(`${name} must be a boolean, got ${typeof value}`);
    }
    return true;
  }

  /**
   * 验证数组类型
   */
  static isArray(value, name = 'value') {
    if (!Array.isArray(value)) {
      throw new TypeError(`${name} must be an array, got ${typeof value}`);
    }
    return true;
  }

  /**
   * 验证对象类型
   */
  static isObject(value, name = 'value') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new TypeError(`${name} must be an object, got ${typeof value}`);
    }
    return true;
  }

  /**
   * 验证函数类型
   */
  static isFunction(value, name = 'value') {
    if (typeof value !== 'function') {
      throw new TypeError(`${name} must be a function, got ${typeof value}`);
    }
    return true;
  }

  /**
   * 验证非空值
   */
  static isNotEmpty(value, name = 'value') {
    if (value === null || value === undefined || value === '') {
      throw new Error(`${name} cannot be empty`);
    }
    return true;
  }

  /**
   * 验证数值范围
   */
  static isInRange(value, min, max, name = 'value') {
    this.isNumber(value, name);
    if (value < min || value > max) {
      throw new Error(`${name} must be between ${min} and ${max}, got ${value}`);
    }
    return true;
  }

  /**
   * 验证字符串长度
   */
  static hasLength(value, minLength, maxLength, name = 'value') {
    this.isString(value, name);
    if (value.length < minLength || value.length > maxLength) {
      throw new Error(`${name} length must be between ${minLength} and ${maxLength}, got ${value.length}`);
    }
    return true;
  }

  /**
   * 验证文件路径
   */
  static isValidPath(value, name = 'path') {
    this.isString(value, name);
    this.isNotEmpty(value, name);
    
    // 基本路径验证
    if (value.includes('..') || value.includes('//')) {
      throw new Error(`${name} contains invalid path characters`);
    }
    
    return true;
  }

  /**
   * 验证文件扩展名
   */
  static hasValidExtension(value, allowedExtensions, name = 'file') {
    this.isString(value, name);
    
    const extension = value.toLowerCase().substring(value.lastIndexOf('.'));
    if (!allowedExtensions.includes(extension)) {
      throw new Error(`${name} has invalid extension ${extension}, allowed: ${allowedExtensions.join(', ')}`);
    }
    
    return true;
  }
}

module.exports = {
  FileInfo,
  MethodInfo,
  ClassificationResult,
  ModificationDetail,
  AnalysisResult,
  AnalysisOptions,
  TypeValidator
}; 