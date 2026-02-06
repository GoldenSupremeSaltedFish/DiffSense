#!/usr/bin/env node

/**
 * DiffSense 智能回归分析器
 * 功能：最近提交是否引入潜在问题 + 回退风险评分 + 功能回滚检测
 * 
 * 五大核心模块：
 * 1. 变更识别 - Git diff + AST 分析
 * 2. 潜在风险识别 - 未测试路径、危险API检测
 * 3. 回退风险评分 - 基于调用图的影响范围评估  
 * 4. 功能回滚检测 - 精准定位功能是否被回滚（无还原）
 * 5. 分数报告 + 建议 - 智能回归报告生成
 */

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const { Command } = require('commander');

// 核心分析器模块
const ChangeDetector = require('./modules/ChangeDetector');
const RiskIdentifier = require('./modules/RiskIdentifier');
const RollbackScorer = require('./modules/RollbackScorer');
const RollbackDetector = require('./modules/RollbackDetector');
const ReportGenerator = require('./modules/ReportGenerator');

class RegressionAnalyzer {
  constructor(options = {}) {
    this.options = {
      projectPath: process.cwd(),
      commits: 1, // 分析最近几次提交
      language: 'auto', // java, go, auto
      outputFormat: 'html', // html, markdown, json
      configPath: './regression-config.yaml',
      ...options
    };

    // 初始化核心模块
    this.changeDetector = new ChangeDetector(this.options);
    this.riskIdentifier = new RiskIdentifier(this.options);
    this.rollbackScorer = new RollbackScorer(this.options);
    this.rollbackDetector = new RollbackDetector(this.options);
    this.reportGenerator = new ReportGenerator(this.options);
  }

  async analyze() {
    console.log(chalk.blue('🔍 开始智能回归风险分析...'));
    console.log(chalk.gray(`项目路径: ${this.options.projectPath}`));
    console.log(chalk.gray(`分析提交数: ${this.options.commits}`));
    
    try {
      const startTime = Date.now();
      
      // 第一步：变更识别
      console.log(chalk.yellow('\n📊 第一步：提取变更信息...'));
      const changes = await this.changeDetector.detectChanges();
      console.log(chalk.green(`✅ 发现 ${changes.files.length} 个变更文件，${changes.methods.length} 个变更方法`));

      // 第二步：潜在风险识别
      console.log(chalk.yellow('\n🚨 第二步：识别潜在风险...'));
      const risks = await this.riskIdentifier.identifyRisks(changes);
      console.log(chalk.green(`✅ 识别出 ${risks.highRisk.length} 个高风险项，${risks.mediumRisk.length} 个中风险项`));

      // 第三步：回退风险评分
      console.log(chalk.yellow('\n📈 第三步：计算回退风险评分...'));
      const scores = await this.rollbackScorer.calculateScores(changes, risks);
      console.log(chalk.green(`✅ 总体风险评分: ${scores.overall.score}/10 (${scores.overall.level})`));

      // 第四步：功能回滚检测（可选）
      let rollbackDetection = [];
      if (this.options.detectRollback && this.options.rollbackTargets) {
        console.log(chalk.yellow('\n🚨 第四步：检测功能回滚...'));
        rollbackDetection = await this.rollbackDetector.batchDetectRollbacks(this.options.rollbackTargets);
        const rollbackCount = rollbackDetection.filter(r => r.rollbackDetected).length;
        console.log(chalk.green(`✅ 回滚检测完成: 发现 ${rollbackCount} 个功能回滚`));
      }

      // 第五步：生成报告
      console.log(chalk.yellow('\n📄 第五步：生成智能回归报告...'));
      const report = await this.reportGenerator.generateReport({
        changes,
        risks,
        scores,
        rollbackDetection,
        metadata: {
          analysisTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

      console.log(chalk.green(`\n✅ 回归分析完成！报告已生成: ${report.outputPath}`));
      console.log(chalk.blue(`⏱️  分析耗时: ${Math.round((Date.now() - startTime) / 1000)}秒`));

      return {
        success: true,
        changes,
        risks, 
        scores,
        rollbackDetection,
        report
      };

    } catch (error) {
      console.error(chalk.red(`❌ 回归分析失败: ${error.message}`));
      console.error(chalk.gray(error.stack));
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 功能回滚检测
  async detectRollback(targets) {
    console.log(chalk.blue('🚨 功能回滚检测模式...'));
    
    try {
      const results = await this.rollbackDetector.batchDetectRollbacks(targets);
      
      const rollbackCount = results.filter(r => r.rollbackDetected).length;
      const totalCount = results.length;
      
      console.log(chalk.yellow(`\n📊 回滚检测结果:`));
      console.log(`检测目标: ${totalCount} 个`);
      console.log(`发现回滚: ${rollbackCount} 个`);
      console.log(`正常存在: ${totalCount - rollbackCount} 个`);

      // 显示回滚详情
      for (const result of results) {
        if (result.rollbackDetected) {
          console.log(chalk.red(`🔴 ${result.target.methodName} 在 ${result.target.filePath} 中被回滚`));
          if (result.deletionCommit) {
            console.log(chalk.gray(`   删除提交: ${result.deletionCommit.hash.substring(0, 7)} by ${result.deletionCommit.author}`));
            console.log(chalk.gray(`   删除时间: ${new Date(result.deletionCommit.date).toLocaleString('zh-CN')}`));
          }
        } else if (result.exists) {
          console.log(chalk.green(`✅ ${result.target.methodName} 正常存在`));
        } else {
          console.log(chalk.yellow(`❓ ${result.target.methodName} 未找到（可能从未存在）`));
        }
      }

      return results;

    } catch (error) {
      console.error(chalk.red(`❌ 回滚检测失败: ${error.message}`));
      return [];
    }
  }

  // 快速风险检查 (轻量版本)
  async quickCheck() {
    console.log(chalk.blue('⚡ 快速风险检查模式...'));
    
    const changes = await this.changeDetector.detectChanges();
    const quickRisks = await this.riskIdentifier.quickRiskCheck(changes);
    
    console.log(chalk.yellow(`\n📊 快速风险评估结果:`));
    console.log(`高风险文件: ${quickRisks.highRiskFiles}`);
    console.log(`未测试方法: ${quickRisks.untestedMethods}`);
    console.log(`危险API调用: ${quickRisks.dangerousAPIs}`);
    console.log(`建议操作: ${quickRisks.recommendations.join(', ')}`);

    return quickRisks;
  }

  // 历史风险趋势分析
  async trendAnalysis(commitCount = 10) {
    console.log(chalk.blue(`📈 分析最近 ${commitCount} 次提交的风险趋势...`));
    
    const trends = [];
    for (let i = 0; i < commitCount; i++) {
      try {
        const tempOptions = { ...this.options, commits: 1, startCommit: `HEAD~${i}` };
        const tempAnalyzer = new RegressionAnalyzer(tempOptions);
        const result = await tempAnalyzer.analyze();
        
        if (result.success) {
          trends.push({
            commit: i,
            score: result.scores.overall.score,
            riskLevel: result.scores.overall.level,
            changeCount: result.changes.methods.length
          });
        }
      } catch (error) {
        console.log(chalk.gray(`⚠️  跳过提交 HEAD~${i}: ${error.message}`));
      }
    }

    return this.reportGenerator.generateTrendReport(trends);
  }

  // 批量检测预设的重要功能
  async batchRollbackCheck(configFile = './rollback-targets.json') {
    console.log(chalk.blue('📋 批量功能回滚检测...'));
    
    try {
      if (!fs.existsSync(configFile)) {
        console.log(chalk.yellow(`⚠️  配置文件不存在: ${configFile}`));
        console.log(chalk.blue('💡 创建示例配置文件...'));
        
        const exampleConfig = [
          {
            filePath: "src/components/Button.tsx",
            methodName: "handleClick",
            description: "按钮点击处理函数"
          },
          {
            filePath: "src/pages/order.tsx", 
            methodName: "submitOrder",
            description: "订单提交功能"
          },
          {
            filePath: "src/utils/api.ts",
            methodName: "fetchUserData",
            description: "用户数据获取API"
          }
        ];
        
        fs.writeFileSync(configFile, JSON.stringify(exampleConfig, null, 2));
        console.log(chalk.green(`✅ 示例配置已创建: ${configFile}`));
        console.log(chalk.gray('请编辑配置文件添加需要检测的功能，然后重新运行命令'));
        return [];
      }

      const targets = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      console.log(chalk.gray(`从配置文件加载 ${targets.length} 个检测目标`));
      
      const results = await this.detectRollback(targets);
      
      // 生成回滚检测报告
      const report = await this.reportGenerator.generateReport({
        changes: { files: [], methods: [], summary: { totalFiles: 0, totalMethods: 0 } },
        risks: { highRisk: [], mediumRisk: [], lowRisk: [] },
        scores: { overall: { score: 0, level: 'UNKNOWN' } },
        rollbackDetection: results,
        metadata: {
          analysisTime: 0,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

      console.log(chalk.green(`\n📄 回滚检测报告已生成: ${report.outputPath}`));
      
      return results;

    } catch (error) {
      console.error(chalk.red(`❌ 批量回滚检测失败: ${error.message}`));
      return [];
    }
  }
}

// 命令行接口
async function main() {
  const program = new Command();
  
  program
    .name('regression-analyzer')
    .description('DiffSense 智能回归风险分析器')
    .version('1.0.0');

  program
    .command('analyze')
    .description('完整回归风险分析')
    .option('-p, --project <path>', '项目路径', process.cwd())
    .option('-c, --commits <number>', '分析提交数量', '1')
    .option('-l, --language <lang>', '代码语言 (java/go/auto)', 'auto')
    .option('-f, --format <format>', '输出格式 (html/markdown/json)', 'html')
    .option('--config <path>', '配置文件路径', './regression-config.yaml')
    .option('--detect-rollback', '同时执行功能回滚检测')
    .option('--rollback-config <path>', '回滚检测配置文件', './rollback-targets.json')
    .action(async (options) => {
      if (options.detectRollback) {
        try {
          const targetsFile = options.rollbackConfig;
          if (fs.existsSync(targetsFile)) {
            options.rollbackTargets = JSON.parse(fs.readFileSync(targetsFile, 'utf-8'));
          }
        } catch (error) {
          console.warn(chalk.yellow(`⚠️  加载回滚检测配置失败: ${error.message}`));
        }
      }
      
      const analyzer = new RegressionAnalyzer(options);
      await analyzer.analyze();
    });

  program
    .command('quick')
    .description('快速风险检查')
    .option('-p, --project <path>', '项目路径', process.cwd())
    .action(async (options) => {
      const analyzer = new RegressionAnalyzer(options);
      await analyzer.quickCheck();
    });

  program
    .command('trend')
    .description('历史风险趋势分析')
    .option('-p, --project <path>', '项目路径', process.cwd())
    .option('-n, --number <count>', '分析提交数量', '10')
    .action(async (options) => {
      const analyzer = new RegressionAnalyzer(options);
      await analyzer.trendAnalysis(parseInt(options.number));
    });

  // 新增功能回滚检测命令
  program
    .command('detect-rollback')
    .description('🚨 功能回滚检测 - 精准定位功能是否被回滚')
    .option('-p, --project <path>', '项目路径', process.cwd())
    .option('-f, --file <path>', '目标文件路径（相对于项目根目录）')
    .option('-m, --method <name>', '目标方法/组件名')
    .option('-c, --config <path>', '批量检测配置文件', './rollback-targets.json')
    .option('--format <format>', '输出格式 (html/markdown/json)', 'html')
    .action(async (options) => {
      const analyzer = new RegressionAnalyzer(options);
      
      if (options.file && options.method) {
        // 单个目标检测
        const target = {
          filePath: options.file,
          methodName: options.method
        };
        console.log(chalk.blue(`🎯 检测单个目标: ${options.method} in ${options.file}`));
        await analyzer.detectRollback([target]);
      } else {
        // 批量检测
        await analyzer.batchRollbackCheck(options.config);
      }
    });

  // 新增VSCode集成命令 
  program
    .command('vscode-rollback')
    .description('🔧 VSCode集成 - 检测当前选中的方法是否被回滚')
    .option('-p, --project <path>', '项目路径', process.cwd()) 
    .option('--file <path>', '当前文件路径')
    .option('--selection <text>', '选中的代码或方法名')
    .option('--line <number>', '当前行号')
    .action(async (options) => {
      if (!options.file || !options.selection) {
        console.error(chalk.red('❌ VSCode集成需要提供 --file 和 --selection 参数'));
        process.exit(1);
      }

      const analyzer = new RegressionAnalyzer(options);
      
      // 解析VSCode提供的信息
      const target = {
        filePath: path.relative(options.project, options.file),
        methodName: options.selection.trim(),
        line: options.line ? parseInt(options.line) : null
      };

      console.log(chalk.blue(`🔧 VSCode回滚检测: ${target.methodName}`));
      const results = await analyzer.detectRollback([target]);
      
      // 输出JSON格式以便VSCode解析
      console.log(JSON.stringify(results[0], null, 2));
    });

  program.parse();
}

// 如果直接运行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = RegressionAnalyzer; 