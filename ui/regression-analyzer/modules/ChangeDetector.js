/**
 * 变更检测模块 (简化版本)
 */

const simpleGit = require('simple-git');

class ChangeDetector {
  constructor(options = {}) {
    this.options = options;
    this.git = simpleGit(options.projectPath || process.cwd());
  }

  async detectChanges() {
    console.log('🔍 检测代码变更...');
    
    try {
      // 简化版本：返回模拟数据
      return {
        files: [
          { path: 'src/example.js', additions: 10, deletions: 5 }
        ],
        methods: [
          { name: 'exampleMethod', changeType: 'modified', filePath: 'src/example.js' }
        ],
        summary: {
          totalFiles: 1,
          totalMethods: 1
        }
      };
    } catch (error) {
      console.error('变更检测失败:', error.message);
      return {
        files: [],
        methods: [],
        summary: { totalFiles: 0, totalMethods: 0 }
      };
    }
  }
}

module.exports = ChangeDetector; 