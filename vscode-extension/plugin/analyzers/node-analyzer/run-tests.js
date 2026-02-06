#!/usr/bin/env node

/**
 * DiffSense 测试运行脚本
 * 运行所有测试并生成报告
 */

const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const execSync = (cmd, options) => {
  return cp.execSync(cmd, {
    maxBuffer: 1024 * 1024 * 50, // 50MB
    ...options
  });
};
const { defaultErrorHandler, ErrorCodes } = require('./errorHandler');

/**
 * 测试运行器类
 */
class TestRunner {
  constructor(options = {}) {
    this.testDir = options.testDir || path.join(__dirname, 'tests');
    this.outputDir = options.outputDir || path.join(__dirname, 'test-results');
    this.verbose = options.verbose || false;
    this.coverage = options.coverage !== false;
    this.timeout = options.timeout || 30000;
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    try {
      console.log('🚀 开始运行 DiffSense 测试套件...\n');

      // 创建输出目录
      this.ensureOutputDir();

      // 检查测试文件
      const testFiles = this.findTestFiles();
      if (testFiles.length === 0) {
        console.log('⚠️  未找到测试文件');
        return { success: false, message: '未找到测试文件' };
      }

      console.log(`📁 找到 ${testFiles.length} 个测试文件:`);
      testFiles.forEach(file => console.log(`   - ${path.basename(file)}`));
      console.log('');

      // 运行测试
      const results = await this.runTests(testFiles);

      // 生成报告
      const report = this.generateReport(results);

      // 保存报告
      this.saveReport(report);

      // 输出结果
      this.printResults(report);

      return report;

    } catch (error) {
      return defaultErrorHandler.handleError(error, {
        operation: 'runAllTests',
        testDir: this.testDir
      });
    }
  }

  /**
   * 查找测试文件
   */
  findTestFiles() {
    const testFiles = [];
    
    if (fs.existsSync(this.testDir)) {
      const files = fs.readdirSync(this.testDir);
      files.forEach(file => {
        if (file.endsWith('.test.js') || file.endsWith('.spec.js')) {
          testFiles.push(path.join(this.testDir, file));
        }
      });
    }

    return testFiles;
  }

  /**
   * 运行测试文件
   */
  async runTests(testFiles) {
    const results = {
      total: testFiles.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      details: []
    };

    for (const testFile of testFiles) {
      try {
        console.log(`🧪 运行测试: ${path.basename(testFile)}`);
        
        const result = await this.runSingleTest(testFile);
        results.details.push(result);

        if (result.success) {
          results.passed++;
          console.log(`   ✅ 通过 (${result.duration}ms)`);
        } else {
          results.failed++;
          console.log(`   ❌ 失败: ${result.error}`);
        }

      } catch (error) {
        results.failed++;
        results.errors.push({
          file: testFile,
          error: error.message
        });
        console.log(`   💥 错误: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * 运行单个测试文件
   */
  async runSingleTest(testFile) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      try {
        // 使用 Node.js 的 require 运行测试
        const testModule = require(testFile);
        
        // 简单的测试执行器
        const testResults = this.executeTestModule(testModule);
        
        const duration = Date.now() - startTime;
        
        resolve({
          file: testFile,
          success: testResults.success,
          duration: duration,
          tests: testResults.tests,
          error: testResults.error
        });

      } catch (error) {
        const duration = Date.now() - startTime;
        resolve({
          file: testFile,
          success: false,
          duration: duration,
          error: error.message
        });
      }
    });
  }

  /**
   * 执行测试模块
   */
  executeTestModule(testModule) {
    const results = {
      success: true,
      tests: [],
      error: null
    };

    try {
      // 查找 describe 和 test 函数
      if (typeof testModule === 'function') {
        // 如果模块导出一个函数，直接执行
        testModule();
      } else if (typeof testModule === 'object') {
        // 如果模块导出对象，查找测试函数
        Object.keys(testModule).forEach(key => {
          if (typeof testModule[key] === 'function') {
            try {
              testModule[key]();
              results.tests.push({ name: key, success: true });
            } catch (error) {
              results.tests.push({ name: key, success: false, error: error.message });
              results.success = false;
            }
          }
        });
      }
    } catch (error) {
      results.success = false;
      results.error = error.message;
    }

    return results;
  }

  /**
   * 生成测试报告
   */
  generateReport(results) {
    const timestamp = new Date().toISOString();
    const summary = {
      timestamp: timestamp,
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      skipped: results.skipped,
      successRate: results.total > 0 ? (results.passed / results.total * 100).toFixed(2) : 0,
      duration: results.details.reduce((sum, detail) => sum + detail.duration, 0)
    };

    return {
      summary: summary,
      details: results.details,
      errors: results.errors
    };
  }

  /**
   * 保存测试报告
   */
  saveReport(report) {
    const reportFile = path.join(this.outputDir, `test-report-${Date.now()}.json`);
    
    try {
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
      console.log(`📄 测试报告已保存: ${reportFile}`);
    } catch (error) {
      console.error(`❌ 保存报告失败: ${error.message}`);
    }
  }

  /**
   * 输出测试结果
   */
  printResults(report) {
    console.log('\n📊 测试结果摘要:');
    console.log('='.repeat(50));
    console.log(`总测试文件: ${report.summary.total}`);
    console.log(`通过: ${report.summary.passed} ✅`);
    console.log(`失败: ${report.summary.failed} ❌`);
    console.log(`跳过: ${report.summary.skipped} ⏭️`);
    console.log(`成功率: ${report.summary.successRate}%`);
    console.log(`总耗时: ${report.summary.duration}ms`);
    console.log('='.repeat(50));

    if (report.summary.failed > 0) {
      console.log('\n❌ 失败的测试:');
      report.details.forEach(detail => {
        if (!detail.success) {
          console.log(`   - ${path.basename(detail.file)}: ${detail.error}`);
        }
      });
    }

    if (report.errors.length > 0) {
      console.log('\n💥 测试执行错误:');
      report.errors.forEach(error => {
        console.log(`   - ${path.basename(error.file)}: ${error.error}`);
      });
    }

    if (report.summary.successRate === 100) {
      console.log('\n🎉 所有测试通过！');
    } else {
      console.log('\n⚠️  部分测试失败，请检查代码。');
    }
  }

  /**
   * 确保输出目录存在
   */
  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    coverage: !args.includes('--no-coverage'),
    timeout: 30000
  };

  // 解析超时参数
  const timeoutIndex = args.indexOf('--timeout');
  if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
    options.timeout = parseInt(args[timeoutIndex + 1]) || 30000;
  }

  const runner = new TestRunner(options);
  const result = await runner.runAllTests();

  // 根据测试结果设置退出码
  process.exit(result.summary?.failed > 0 ? 1 : 0);
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('测试运行失败:', error.message);
    process.exit(1);
  });
}

module.exports = TestRunner; 