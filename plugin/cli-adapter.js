#!/usr/bin/env node

/**
 * DiffSense Node.js CLI 适配器
 * 统一调用 Go/TypeScript/JavaScript 分析器的接口
 */

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

// 分析器模块 - 使用相对于plugin目录的路径
const FrontendAnalyzer = require('./analyzers/node-analyzer/analyze.js');
const GolangAnalyzer = require('./analyzers/golang-analyzer/analyze.js');

class CliAdapter {
    constructor() {
        this.analyzers = {
            ts: FrontendAnalyzer,
            js: FrontendAnalyzer,
            go: GolangAnalyzer
        };
        
        this.supportedCommands = [
            'analyze', 'impacted', 'callgraph', 'recommend-tests'
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
            file.endsWith('.js') || file.endsWith('.jsx') || 
            file.endsWith('.ts') || file.endsWith('.tsx') || 
            file.endsWith('.vue')
        );
        
        if (frontendFiles.length === 0) {
            return { impactedMethods: [], summary: { impactedFiles: 0, impactedMethods: 0 } };
        }
        
        const analyzer = new FrontendAnalyzer(options.targetDir, options);
        const fullResult = await analyzer.analyze();
        
        // 简化的影响分析 - 只返回变更文件中的方法
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
                        riskLevel: method.complexity > 10 ? 'high' : 'medium'
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
        if (!impactedResult.impactedMethods) {
            return [];
        }
        
        const recommendations = [];
        
        impactedResult.impactedMethods.forEach(method => {
            const testFile = this.guessTestFile(method.file, options.lang);
            const testMethod = this.guessTestMethod(method.signature);
            
            recommendations.push({
                testClass: testFile,
                testMethod: testMethod,
                sourceMethod: method.signature,
                sourceFile: method.file,
                priority: method.riskLevel === 'high' ? 'high' : 'medium',
                reason: `方法 ${method.signature} 发生了变更，建议运行相关测试`
            });
        });
        
        return recommendations;
    }

    /**
     * 猜测测试文件
     */
    guessTestFile(sourceFile, language) {
        const baseName = path.basename(sourceFile, path.extname(sourceFile));
        
        if (language === 'go') {
            return `${baseName}_test.go`;
        } else {
            return `${baseName}.test.${path.extname(sourceFile).substring(1)}`;
        }
    }

    /**
     * 猜测测试方法
     */
    guessTestMethod(methodName) {
        if (methodName.startsWith('Test')) {
            return methodName;
        }
        return `Test${methodName.charAt(0).toUpperCase()}${methodName.slice(1)}`;
    }
}

// 命令行接口
async function main() {
    const program = new Command();
    
    program
        .version('1.0.0')
        .description('DiffSense CLI 适配器');
    
    program
        .command('analyze')
        .description('分析代码')
        .option('--lang <language>', '编程语言 (go|ts|js)', 'ts')
        .option('--repo <path>', '代码仓库路径', process.cwd())
        .option('--format <format>', '输出格式 (json|summary|text)', 'json')
        .option('--max-depth <number>', '最大分析深度', '15')
        .option('--max-files <number>', '最大文件数', '1000')
        .option('--include-type-tags', '包含细粒度类型标签', false)
        .action(async (options) => {
            const adapter = new CliAdapter();
            const result = await adapter.execute('analyze', options);
            console.log(result);
        });
    
    program
        .command('impacted')
        .description('分析影响的代码')
        .option('--lang <language>', '编程语言 (go|ts|js)', 'ts')
        .option('--repo <path>', '代码仓库路径', process.cwd())
        .option('--from <commit>', '起始提交', 'HEAD~1')
        .option('--to <commit>', '结束提交', 'HEAD')
        .option('--format <format>', '输出格式 (json|summary|text)', 'json')
        .action(async (options) => {
            const adapter = new CliAdapter();
            const result = await adapter.execute('impacted', options);
            console.log(result);
        });
    
    program
        .command('callgraph')
        .description('生成调用图')
        .option('--lang <language>', '编程语言 (go|ts|js)', 'ts')
        .option('--repo <path>', '代码仓库路径', process.cwd())
        .option('--format <format>', '输出格式 (json|summary)', 'json')
        .action(async (options) => {
            const adapter = new CliAdapter();
            const result = await adapter.execute('callgraph', options);
            console.log(result);
        });
    
    program
        .command('recommend-tests')
        .description('推荐测试')
        .option('--lang <language>', '编程语言 (go|ts|js)', 'ts')
        .option('--repo <path>', '代码仓库路径', process.cwd())
        .option('--from <commit>', '起始提交', 'HEAD~1')
        .option('--to <commit>', '结束提交', 'HEAD')
        .option('--format <format>', '输出格式 (json|summary|text)', 'json')
        .action(async (options) => {
            const adapter = new CliAdapter();
            const result = await adapter.execute('recommend-tests', options);
            console.log(result);
        });
    
    program.parse();
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(error => {
        console.error('CLI适配器执行失败:', error.message);
        process.exit(1);
    });
}

module.exports = CliAdapter; 