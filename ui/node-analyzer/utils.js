/**
 * 前端分析器工具类
 */

const path = require('path');
const fs = require('fs');

class AnalyzerUtils {
  /**
   * 标准化文件路径
   */
  static normalizePath(filePath, basePath = '') {
    const relativePath = basePath ? path.relative(basePath, filePath) : filePath;
    return relativePath.replace(/\\/g, '/');
  }

  /**
   * 检查文件是否应该被分析
   */
  static shouldAnalyzeFile(filePath, options = {}) {
    const {
      includeExtensions = ['.js', '.jsx', '.ts', '.tsx'],
      excludePatterns = ['node_modules', 'dist', 'build', '.test.', '.spec.']
    } = options;

    const ext = path.extname(filePath);
    
    // 检查扩展名
    if (!includeExtensions.includes(ext)) {
      return false;
    }

    // 检查排除模式
    for (const pattern of excludePatterns) {
      if (filePath.includes(pattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 从代码中提取函数/方法签名
   */
  static extractSignature(code, functionName) {
    // 简化的签名提取逻辑
    const patterns = [
      // function declaration
      new RegExp(`function\\s+${functionName}\\s*\\([^)]*\\)`, 'g'),
      // arrow function
      new RegExp(`(?:const|let|var)\\s+${functionName}\\s*=\\s*\\([^)]*\\)\\s*=>`, 'g'),
      // method in object/class
      new RegExp(`${functionName}\\s*:\\s*function\\s*\\([^)]*\\)`, 'g'),
      new RegExp(`${functionName}\\s*\\([^)]*\\)\\s*{`, 'g')
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(code);
      if (match) {
        return match[0];
      }
    }

    return `${functionName}()`;
  }

  /**
   * 分析代码复杂度 (简化版)
   */
  static analyzeComplexity(code) {
    const metrics = {
      lines: code.split('\n').length,
      functions: 0,
      classes: 0,
      conditionals: 0,
      loops: 0,
      complexity: 1 // 基础复杂度
    };

    // 计算函数数量
    metrics.functions = (code.match(/function\s+\w+|=>\s*{|:\s*function/g) || []).length;
    
    // 计算类数量
    metrics.classes = (code.match(/class\s+\w+/g) || []).length;
    
    // 计算条件语句
    metrics.conditionals = (code.match(/\b(if|else|switch|case|\?|\:)\b/g) || []).length;
    
    // 计算循环
    metrics.loops = (code.match(/\b(for|while|do)\b/g) || []).length;
    
    // 简化的圈复杂度计算
    metrics.complexity += metrics.conditionals + metrics.loops;

    return metrics;
  }

  /**
   * 检测代码模式和最佳实践
   */
  static detectPatterns(code) {
    const patterns = {
      hasESModules: /\b(import|export)\b/.test(code),
      hasCommonJS: /\b(require|module\.exports)\b/.test(code),
      hasAsyncAwait: /\b(async|await)\b/.test(code),
      hasPromises: /\b(Promise|\.then|\.catch)\b/.test(code),
      hasJSX: /<[A-Z][\w]*/.test(code),
      hasTypeScript: /:\s*\w+\s*[=;,)]/.test(code),
      hasReactHooks: /\buse[A-Z]\w*/.test(code),
      hasTestCode: /\b(describe|test|it|expect)\b/.test(code)
    };

    return patterns;
  }

  /**
   * 生成依赖关系图的DOT格式
   */
  static generateDotGraph(dependencies, options = {}) {
    const { direction = 'TB', includeNodeModules = false } = options;
    
    let dot = `digraph Dependencies {\n`;
    dot += `  rankdir=${direction};\n`;
    dot += `  node [shape=box, style=rounded];\n\n`;

    const processedNodes = new Set();
    
    Object.entries(dependencies).forEach(([file, deps]) => {
      if (!includeNodeModules && file.includes('node_modules')) {
        return;
      }

      const fileName = path.basename(file, path.extname(file));
      
      if (!processedNodes.has(fileName)) {
        dot += `  "${fileName}" [label="${fileName}"];\n`;
        processedNodes.add(fileName);
      }

      deps.forEach(dep => {
        if (!includeNodeModules && dep.includes('node_modules')) {
          return;
        }

        const depName = path.basename(dep, path.extname(dep));
        
        if (!processedNodes.has(depName)) {
          dot += `  "${depName}" [label="${depName}"];\n`;
          processedNodes.add(depName);
        }
        
        dot += `  "${fileName}" -> "${depName}";\n`;
      });
    });

    dot += `}\n`;
    return dot;
  }

  /**
   * 计算文件影响评分
   */
  static calculateImpactScore(fileInfo, dependencies) {
    let score = 0;
    
    // 基于方法数量
    score += (fileInfo.methods?.length || 0) * 2;
    
    // 基于文件大小 (每1000行+1分)
    score += Math.floor((fileInfo.lines || 0) / 1000);
    
    // 基于依赖数量 (被依赖越多分数越高)
    const dependentFiles = Object.entries(dependencies).filter(([_, deps]) =>
      deps.some(dep => dep.includes(fileInfo.relativePath))
    );
    score += dependentFiles.length * 3;
    
    // 基于复杂度
    if (fileInfo.complexity) {
      score += Math.floor(fileInfo.complexity.complexity / 5);
    }

    return Math.min(score, 100); // 最高100分
  }

  /**
   * 格式化分析结果为表格
   */
  static formatAsTable(data, columns) {
    if (!Array.isArray(data) || data.length === 0) {
      return '无数据';
    }

    const table = [];
    
    // 表头
    const header = columns.map(col => col.header || col.key);
    table.push(header.join(' | '));
    table.push(header.map(() => '---').join(' | '));
    
    // 数据行
    data.forEach(item => {
      const row = columns.map(col => {
        const value = item[col.key];
        if (col.formatter && typeof col.formatter === 'function') {
          return col.formatter(value);
        }
        return String(value || '');
      });
      table.push(row.join(' | '));
    });

    return table.join('\n');
  }

  /**
   * 深度合并对象
   */
  static deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * 生成唯一ID
   */
  static generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = AnalyzerUtils; 