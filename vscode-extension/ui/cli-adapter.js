#!/usr/bin/env node

/**
 * DiffSense Node.js CLI 适配器
 * 统一调用 Go/TypeScript/JavaScript 分析器的接口
 */

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

// 分析器模块
const { analyze: granularAnalyze } = require('./node-analyzer/analyze.js');
const FrontendAnalyzer = require('./node-analyzer/analyze.js');
const GolangAnalyzer = require('./golang-analyzer/analyze.js');
const RegressionAnalyzer = require('./regression-analyzer/index.js');

class CliAdapter {
    constructor() {
        this.analyzers = {
            ts: FrontendAnalyzer,
            js: FrontendAnalyzer,
            go: GolangAnalyzer,
            regression: RegressionAnalyzer
        };
        
        this.supportedCommands = [
            'analyze', 'impacted', 'callgraph', 'recommend-tests', 'regression'
        ];
    }

    /**
     * 执行分析命令
     */
    async execute(command, options) {
        try {
            this.validateCommand(command);
            this.validateOptions(options);
            
            console.error(`🔍 开始 ${command} 分析 (${options.lang})...`);
            
            switch (command) {
                case 'analyze':
                    return await this.analyze(options);
                case 'impacted':
                    return await this.getImpacted(options);
                case 'callgraph':
                    return await this.getCallGraph(options);
                case 'recommend-tests':
                    return await this.recommendTests(options);
                case 'regression':
                    return await this.regressionAnalysis(options);
                default:
                    throw new Error(`Unsupported command: ${command}`);
            }
        } catch (error) {
            console.error(`❌ 分析失败: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * 代码分析
     */
    async analyze(options) {
        const analyzer = this.getAnalyzer(options.lang);
        const standardOptions = this.normalizeOptions(options);
        
        let result;
        
        if (options.lang === 'go') {
            const goAnalyzer = new analyzer(standardOptions.targetDir, standardOptions);
            result = await goAnalyzer.analyze();
        } else if (options.lang === 'ts' || options.lang === 'js') {
            const frontendAnalyzer = new analyzer(standardOptions.targetDir, standardOptions);
            result = await frontendAnalyzer.analyze();
        } else {
            throw new Error(`Unsupported language for analyze: ${options.lang}`);
        }
        
        // 增强结果以符合统一格式
        const enhancedResult = this.enhanceResult(result, options);
        
        return this.formatOutput(enhancedResult, options.format);
    }

    /**
     * 影响分析
     */
    async getImpacted(options) {
        const analyzer = this.getAnalyzer(options.lang);
        const standardOptions = this.normalizeOptions(options);
        
        // 基于Git差异进行影响分析
        const gitDiff = await this.getGitDiff(options.from, options.to, standardOptions.targetDir);
        
        let result;
        if (options.lang === 'go') {
            result = await this.analyzeGoImpact(gitDiff, standardOptions);
        } else if (options.lang === 'ts' || options.lang === 'js') {
            result = await this.analyzeFrontendImpact(gitDiff, standardOptions);
        }
        
        return this.formatOutput(result, options.format);
    }

    /**
     * 调用图分析
     */
    async getCallGraph(options) {
        const analyzer = this.getAnalyzer(options.lang);
        const standardOptions = this.normalizeOptions(options);
        
        let result;
        
        if (options.lang === 'go') {
            const goAnalyzer = new analyzer(standardOptions.targetDir, standardOptions);
            const fullResult = await goAnalyzer.analyze();
            const callGraph = fullResult.callGraph || { nodes: [], edges: [] };
            result = {
                callGraph: callGraph,
                summary: {
                    totalNodes: callGraph.nodes ? callGraph.nodes.length : 0,
                    totalEdges: callGraph.edges ? callGraph.edges.length : 0
                }
            };
        } else if (options.lang === 'ts' || options.lang === 'js') {
            const frontendAnalyzer = new analyzer(standardOptions.targetDir, standardOptions);
            const fullResult = await frontendAnalyzer.analyze();
            const callGraph = fullResult.callGraph || { nodes: [], edges: [] };
            const dependencies = fullResult.dependencies || { circular: [] };
            result = {
                callGraph: callGraph,
                dependencies: dependencies,
                summary: {
                    totalNodes: callGraph.nodes ? callGraph.nodes.length : 0,
                    totalEdges: callGraph.edges ? callGraph.edges.length : 0,
                    circularDependencies: dependencies.circular ? dependencies.circular.length : 0
                }
            };
        }
        
        return this.formatOutput(result, options.format);
    }

    /**
     * 测试推荐
     */
    async recommendTests(options) {
        // 先获取影响分析结果
        const impactedResult = await this.getImpacted(options);
        
        // 基于影响分析结果推荐测试
        const recommendations = this.generateTestRecommendations(impactedResult, options);
        
        const result = {
            recommendedTests: recommendations,
            summary: {
                totalRecommendations: recommendations.length,
                highPriority: recommendations.filter(r => r.priority === 'high').length,
                mediumPriority: recommendations.filter(r => r.priority === 'medium').length,
                lowPriority: recommendations.filter(r => r.priority === 'low').length
            }
        };
        
        return this.formatOutput(result, options.format);
    }

    /**
     * 回归分析
     */
    async regressionAnalysis(options) {
        const regressionOptions = {
            projectPath: options.repo,
            commits: options.commits || 1,
            language: options.lang === 'ts' ? 'auto' : options.lang,
            outputFormat: options.format || 'json'
        };
        
        const analyzer = new RegressionAnalyzer(regressionOptions);
        const result = await analyzer.analyze();
        
        return this.formatOutput(result, options.format);
    }

    /**
     * 获取分析器
     */
    getAnalyzer(language) {
        const analyzer = this.analyzers[language];
        if (!analyzer) {
            throw new Error(`Unsupported language: ${language}`);
        }
        return analyzer;
    }

    /**
     * 标准化选项
     */
    normalizeOptions(options) {
        return {
            targetDir: options.repo || process.cwd(),
            maxDepth: parseInt(options.maxDepth) || 15,
            maxFiles: parseInt(options.maxFiles) || 1000,
            includeTypeTags: options.includeTypeTags === 'true' || options.includeTypeTags === true,
            includeTests: true,
            format: options.format || 'json',
            mode: options.mode || 'diff',
            fromCommit: options.from || 'HEAD~1',
            toCommit: options.to || 'HEAD'
        };
    }

    /**
     * 增强分析结果以符合统一格式
     */
    enhanceResult(result, options) {
        return {
            version: "1.0.0",
            timestamp: new Date().toISOString(),
            language: options.lang,
            mode: options.mode || 'full',
            repository: options.repo || process.cwd(),
            commits: {
                from: options.from || 'HEAD~1',
                to: options.to || 'HEAD'
            },
            summary: result.summary || {},
            ...result
        };
    }

    /**
     * 格式化输出
     */
    formatOutput(result, format) {
        switch (format) {
            case 'json':
                return JSON.stringify(result, null, 2);
            case 'summary':
                return this.generateSummary(result);
            case 'text':
                return this.generateTextOutput(result);
            default:
                return JSON.stringify(result, null, 2);
        }
    }

    /**
     * 生成摘要
     */
    generateSummary(result) {
        const summary = result.summary || {};
        let output = `📊 分析摘要\n`;
        output += `语言: ${result.language || 'Unknown'}\n`;
        output += `时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}\n`;
        
        if (summary.totalFiles) {
            output += `文件数: ${summary.totalFiles}\n`;
        }
        if (summary.totalMethods) {
            output += `方法数: ${summary.totalMethods}\n`;
        }
        if (summary.impactedMethods) {
            output += `受影响方法: ${summary.impactedMethods}\n`;
        }
        if (summary.testCoverage) {
            output += `测试覆盖率: ${summary.testCoverage.toFixed(1)}%\n`;
        }
        
        return output;
    }

    /**
     * 生成文本输出
     */
    generateTextOutput(result) {
        if (result.impactedMethods) {
            let output = `受影响的方法:\n`;
            result.impactedMethods.forEach(method => {
                output += `  - ${method.signature || method.name} (${method.file}:${method.line})\n`;
            });
            return output;
        }
        
        if (result.recommendedTests) {
            let output = `推荐的测试:\n`;
            result.recommendedTests.forEach(test => {
                output += `  - ${test.testClass}::${test.testMethod} [${test.priority}]\n`;
                output += `    原因: ${test.reason}\n`;
            });
            return output;
        }
        
        return this.generateSummary(result);
    }

    /**
     * 验证命令
     */
    validateCommand(command) {
        if (!this.supportedCommands.includes(command)) {
            throw new Error(`Unsupported command: ${command}. Supported: ${this.supportedCommands.join(', ')}`);
        }
    }

    /**
     * 验证选项
     */
    validateOptions(options) {
        if (!options.lang) {
            throw new Error('Language not specified. Use --lang <go|ts|js>');
        }
        
        if (!['go', 'ts', 'js'].includes(options.lang)) {
            throw new Error(`Unsupported language: ${options.lang}. Supported: go, ts, js`);
        }
        
        if (options.repo && !fs.existsSync(options.repo)) {
            throw new Error(`Repository path not found: ${options.repo}`);
        }
    }

    /**
     * 获取Git差异
     */
    async getGitDiff(from, to, repoPath) {
        const { execFile } = require('child_process');
        const { promisify } = require('util');
        const execFileAsync = promisify(execFile);
        
        try {
            const { stdout } = await execFileAsync('git', ['diff', '--name-only', `${from}..${to}`], {
                cwd: repoPath
            });
            
            return stdout.trim().split('\n').filter(line => line.length > 0);
        } catch (error) {
            console.warn(`Warning: Could not get git diff: ${error.message}`);
            return [];
        }
    }

    /**
     * 分析Go代码影响
     */
    async analyzeGoImpact(changedFiles, options) {
        const goFiles = changedFiles.filter(file => file.endsWith('.go'));
        
        if (goFiles.length === 0) {
            return { impactedMethods: [], summary: { impactedFiles: 0, impactedMethods: 0 } };
        }
        
        const analyzer = new GolangAnalyzer(options.targetDir, options);
        const fullResult = await analyzer.analyze();
        
        // 简化的影响分析 - 只返回变更文件中的方法
        const impactedMethods = [];
        goFiles.forEach(file => {
            const relativePath = file.replace(/\\/g, '/');
            if (fullResult.functions[relativePath]) {
                fullResult.functions[relativePath].forEach(func => {
                    impactedMethods.push({
                        signature: func.name,
                        file: relativePath,
                        line: func.line || 0,
                        changeType: 'modified',
                        riskLevel: func.complexity > 10 ? 'high' : 'medium'
                    });
                });
            }
        });
        
        return {
            impactedMethods,
            summary: {
                impactedFiles: goFiles.length,
                impactedMethods: impactedMethods.length
            }
        };
    }

    /**
     * 分析前端代码影响
     */
    async analyzeFrontendImpact(changedFiles, options) {
        const frontendFiles = changedFiles.filter(file => 
            file.endsWith('.ts') || file.endsWith('.tsx') || 
            file.endsWith('.js') || file.endsWith('.jsx')
        );
        
        if (frontendFiles.length === 0) {
            return { impactedMethods: [], summary: { impactedFiles: 0, impactedMethods: 0 } };
        }
        
        const analyzer = new FrontendAnalyzer(options.targetDir, options);
        const fullResult = await analyzer.analyze();
        
        const impactedMethods = [];
        frontendFiles.forEach(file => {
            const relativePath = file.replace(/\\/g, '/');
            if (fullResult.methods[relativePath]) {
                fullResult.methods[relativePath].forEach(method => {
                    impactedMethods.push({
                        signature: method.signature || method.name,
                        file: relativePath,
                        line: method.line || 0,
                        changeType: 'modified',
                        riskLevel: 'medium'
                    });
                });
            }
        });
        
        return {
            impactedMethods,
            summary: {
                impactedFiles: frontendFiles.length,
                impactedMethods: impactedMethods.length
            }
        };
    }

    /**
     * 生成测试推荐
     */
    generateTestRecommendations(impactedResult, options) {
        const recommendations = [];
        
        if (impactedResult.impactedMethods) {
            impactedResult.impactedMethods.forEach(method => {
                // 简化的测试推荐逻辑
                const testFile = this.guessTestFile(method.file, options.lang);
                const testMethod = this.guessTestMethod(method.signature || method.name);
                
                recommendations.push({
                    testClass: testFile,
                    testMethod: testMethod,
                    reason: `直接测试受影响方法: ${method.signature || method.name}`,
                    priority: method.riskLevel === 'high' ? 'high' : 'medium',
                    targetMethod: method.signature || method.name,
                    targetFile: method.file
                });
            });
        }
        
        return recommendations;
    }

    /**
     * 推测测试文件名
     */
    guessTestFile(sourceFile, language) {
        const baseName = path.basename(sourceFile, path.extname(sourceFile));
        
        if (language === 'go') {
            return sourceFile.replace('.go', '_test.go');
        } else {
            return `${baseName}.test.${language}`;
        }
    }

    /**
     * 推测测试方法名
     */
    guessTestMethod(methodName) {
        if (methodName.startsWith('Test') || methodName.startsWith('test')) {
            return methodName;
        }
        
        // 将方法名转换为测试方法名
        const cleanName = methodName.replace(/[^a-zA-Z0-9]/g, '');
        return `test${cleanName.charAt(0).toUpperCase()}${cleanName.slice(1)}`;
    }
}

// 命令行接口
async function main() {
    const program = new Command();

    // 检查是否为简单的文件比较模式
    if (process.argv.length >= 4 && fs.existsSync(process.argv[2]) && fs.existsSync(process.argv[3])) {
        const oldFile = process.argv[2];
        const newFile = process.argv[3];
        const includeTypeTags = process.argv.includes('--include-type-tags');

        try {
            const oldContent = fs.readFileSync(oldFile, 'utf-8');
            const newContent = fs.readFileSync(newFile, 'utf-8');

            const result = await granularAnalyze({
                oldContent,
                newContent,
                filePath: path.basename(newFile),
                includeTypeTags
            });

            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        } catch (error) {
            console.error(`File analysis failed: ${error.message}`);
            process.exit(1);
        }
        return; // 结束执行
    }


    program
        .name('cli-adapter')
        .description('DiffSense Node.js CLI 适配器')
        .version('1.0.0');

    // analyze 命令
    program
        .command('analyze')
        .description('代码分析')
        .requiredOption('--lang <language>', '目标语言 (go|ts|js)')
        .option('--mode <mode>', '分析模式', 'diff')
        .option('--from <commit>', '起始提交', 'HEAD~1')
        .option('--to <commit>', '结束提交', 'HEAD')
        .option('--repo <path>', '仓库路径', process.cwd())
        .option('--max-depth <n>', '最大深度', '15')
        .option('--max-files <n>', '最大文件数', '1000')
        .option('--format <format>', '输出格式', 'json')
        .option('--output <file>', '输出文件')
        .option('--include-type-tags', '是否包含细粒度修改类型标签', false)
        .action(async (options) => {
            const adapter = new CliAdapter();
            const result = await adapter.execute('analyze', options);
            
            if (options.output) {
                fs.writeFileSync(options.output, result);
                console.error(`结果已保存到: ${options.output}`);
            } else {
                console.log(result);
            }
        });

    // impacted 命令
    program
        .command('impacted')
        .description('影响分析')
        .requiredOption('--lang <language>', '目标语言 (go|ts|js)')
        .option('--from <commit>', '起始提交', 'HEAD~1')
        .option('--to <commit>', '结束提交', 'HEAD')
        .option('--repo <path>', '仓库路径', process.cwd())
        .option('--format <format>', '输出格式', 'json')
        .action(async (options) => {
            const adapter = new CliAdapter();
            const result = await adapter.execute('impacted', options);
            console.log(result);
        });

    // callgraph 命令
    program
        .command('callgraph')
        .description('调用图分析')
        .requiredOption('--lang <language>', '目标语言 (go|ts|js)')
        .option('--repo <path>', '仓库路径', process.cwd())
        .option('--max-depth <n>', '最大深度', '15')
        .option('--format <format>', '输出格式', 'json')
        .action(async (options) => {
            const adapter = new CliAdapter();
            const result = await adapter.execute('callgraph', options);
            console.log(result);
        });

    // recommend-tests 命令
    program
        .command('recommend-tests')
        .description('测试推荐')
        .requiredOption('--lang <language>', '目标语言 (go|ts|js)')
        .option('--from <commit>', '起始提交', 'HEAD~1')
        .option('--to <commit>', '结束提交', 'HEAD')
        .option('--repo <path>', '仓库路径', process.cwd())
        .option('--format <format>', '输出格式', 'json')
        .action(async (options) => {
            const adapter = new CliAdapter();
            const result = await adapter.execute('recommend-tests', options);
            console.log(result);
        });

    // regression 命令
    program
        .command('regression')
        .description('回归分析')
        .requiredOption('--lang <language>', '目标语言 (go|ts|js)')
        .option('--repo <path>', '仓库路径', process.cwd())
        .option('--commits <n>', '分析提交数', '1')
        .option('--format <format>', '输出格式', 'json')
        .action(async (options) => {
            const adapter = new CliAdapter();
            const result = await adapter.execute('regression', options);
            console.log(result);
        });

    await program.parseAsync();
}

// 如果直接执行此脚本
if (require.main === module) {
    main().catch(error => {
        console.error('CLI Adapter Error:', error.message);
        process.exit(1);
    });
}

module.exports = CliAdapter; 