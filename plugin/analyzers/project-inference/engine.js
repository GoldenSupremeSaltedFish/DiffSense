const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

// Import Providers
const DefaultProvider = require('./providers/default-provider');
const ViteProvider = require('./providers/vite-provider');
const NextProvider = require('./providers/next-provider');

class ProjectInferenceEngine {
    constructor(logger) {
        this.logger = logger || console;
        this.providers = [
            new NextProvider(),
            new ViteProvider(),
            new DefaultProvider()
        ];
        // ✅ 将 logger 传递给所有 providers
        this.providers.forEach(provider => {
            provider.logger = this.logger;
        });
    }

    /**
     * @param {string} rootDir - Absolute path to project root
     * @param {import('./types').FileTree} [preScannedFileTree] - Optional pre-scanned file tree
     * @param {function(string)} [onProgress] - Optional progress callback
     */
    async infer(rootDir, preScannedFileTree, onProgress) {
        this.logger.log(`[阶段 2] 开始项目推理: ${rootDir}`);
        
        // ✅ 阶段 2.1: 文件扫描（如果未提供）
        const fileTree = preScannedFileTree || await this.scanFilesAsync(rootDir, onProgress);
        const fileCount = fileTree.files ? fileTree.files.length : 0;
        this.logger.log(`[阶段 2.1] ✅ 文件扫描完成，共 ${fileCount} 个文件`);
        
        // ✅ 阶段 2.2: 检测 Providers
        this.logger.log(`[阶段 2.2] 开始检测项目类型提供者...`);
        const detectionResults = [];
        for (const provider of this.providers) {
            const score = await provider.detect(rootDir, fileTree);
            this.logger.log(`[阶段 2.2] Provider ${provider.name} 得分: ${score}`);
            if (score > 0) {
                detectionResults.push({ provider, score });
            }
        }
        this.logger.log(`[阶段 2.2] ✅ 检测完成，找到 ${detectionResults.length} 个匹配的提供者`);

        // ✅ 阶段 2.3: 选择最佳 Provider
        detectionResults.sort((a, b) => b.score - a.score);
        
        const bestMatch = detectionResults[0];
        let selectedProvider = this.providers.find(p => p.name === 'default-heuristic');
        
        if (bestMatch) {
            selectedProvider = bestMatch.provider;
            this.logger.log(`[阶段 2.3] 选择最佳提供者: ${selectedProvider.name} (得分: ${bestMatch.score})`);
        } else {
            this.logger.log(`[阶段 2.3] 使用默认提供者: ${selectedProvider.name}`);
        }

        // ✅ 阶段 2.4: 推断源根目录
        this.logger.log(`[阶段 2.4] 开始推断源根目录...`);
        const sourceRoots = await selectedProvider.inferSourceRoots(rootDir, fileTree);
        this.logger.log(`[阶段 2.4] ✅ 推断完成，找到 ${sourceRoots.length} 个源根目录: ${JSON.stringify(sourceRoots)}`);

        const result = {
            projectType: selectedProvider.name,
            sourceRoots,
            detectionDetails: detectionResults.map(d => ({ name: d.provider.name, score: d.score }))
        };
        
        this.logger.log(`[阶段 2] ✅ 项目推理完成`);
        return result;
    }

    async scanFilesAsync(rootDir, onProgress) {
        this.logger.log(`[阶段 1] 开始文件扫描: ${rootDir}`);
        const fileWorldModel = [];
        const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.idea', '.vscode', 'target', 'out']);
        let scannedCount = 0;
        let skippedCount = 0;

        const scanDir = async (dir) => {
            try {
                const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                const tasks = [];
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) {
                            skippedCount++;
                            continue;
                        }
                        tasks.push(scanDir(fullPath));
                    } else {
                        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
                        const ext = path.extname(fullPath).toLowerCase();
                        
                        // ✅ 检测 UI 信号（React/Vue 等）
                        const uiSignals = await this.detectUISignalsAsync(fullPath);

                        fileWorldModel.push({
                            path: relativePath,
                            ext,
                            languageType: this.getLanguageType(ext),
                            frameworkSignal: this.detectFrameworkSignals(entry.name),
                            uiSignals: uiSignals,
                            importGraph: []
                        });
                        
                        scannedCount++;
                        // ✅ 每 50 个文件报告一次进度
                        if (onProgress && scannedCount % 50 === 0) {
                             const msg = `[Scan] 已扫描 ${scannedCount} 个文件...`;
                             onProgress(msg);
                             this.logger.log(msg);
                        }
                    }
                }
                await Promise.all(tasks);
            } catch (error) {
                if (this.logger.error) {
                    this.logger.error(`Error scanning directory ${dir}: ${error}`);
                } else {
                    console.error(`Error scanning directory ${dir}: ${error}`);
                }
            }
        };

        await scanDir(rootDir);
        
        // ✅ 扫描完成，输出统计信息
        const fileCount = fileWorldModel.length;
        const langStats = {};
        fileWorldModel.forEach(file => {
            const lang = file.languageType || 'unknown';
            langStats[lang] = (langStats[lang] || 0) + 1;
        });
        const topLangs = Object.entries(langStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([lang, count]) => `${lang}: ${count}`)
            .join(', ');
        
        this.logger.log(`[阶段 1] ✅ 文件扫描完成`);
        this.logger.log(`[阶段 1] 统计: 共扫描 ${fileCount} 个文件，跳过 ${skippedCount} 个目录`);
        this.logger.log(`[阶段 1] 语言分布 (Top 5): ${topLangs}`);
        
        // ✅ 检测 React 信号
        const reactSignals = fileWorldModel.filter(f => 
            f.uiSignals && (f.uiSignals.includes('react') || f.uiSignals.includes('jsx'))
        ).length;
        if (reactSignals > 0) {
            this.logger.log(`[阶段 1] React 信号检测: 发现 ${reactSignals} 个文件包含 React 特征`);
        }
        
        if (onProgress) {
            onProgress(`[Scan] 扫描完成: ${fileCount} 个文件`);
        }
        
        return { files: fileWorldModel };
    }

    scanFiles(rootDir) {
        // Keeping synchronous version for backward compatibility if needed, 
        // but prefer scanFilesAsync
        const fileWorldModel = [];
        const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.idea', '.vscode', 'target', 'out']);
        
        const scanDir = (dir) => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
                        scanDir(fullPath);
                    } else {
                        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
                        const ext = path.extname(fullPath).toLowerCase();
                        fileWorldModel.push({
                            path: relativePath,
                            ext,
                            languageType: this.getLanguageType(ext),
                            frameworkSignal: this.detectFrameworkSignals(entry.name),
                            uiSignals: this.detectUISignals(fullPath),
                            importGraph: []
                        });
                    }
                }
            } catch (e) {
                // Ignore errors in sync mode
            }
        };

        scanDir(rootDir);
        return { files: fileWorldModel };
    }

    getLanguageType(ext) {
        if (['.tsx', '.jsx'].includes(ext)) return 'react';
        if (ext === '.vue') return 'vue';
        if (ext === '.ts') return 'ts';
        if (ext === '.js') return 'js';
        return 'other';
    }

    detectFrameworkSignals(fileName) {
        const signals = [];
        if (fileName.includes('vite.config')) signals.push('vite');
        if (fileName.includes('next.config')) signals.push('next');
        return signals;
    }

    detectUISignals(filePath) {
        try {
            if (fs.statSync(filePath).size > 100 * 1024) return [];
            const content = fs.readFileSync(filePath, 'utf-8');
            return this._analyzeContentForSignals(content);
        } catch (e) {
            return [];
        }
    }

    async detectUISignalsAsync(filePath) {
        try {
            const stats = await fsPromises.stat(filePath);
            if (stats.size > 100 * 1024) return [];
            const content = await fsPromises.readFile(filePath, 'utf-8');
            return this._analyzeContentForSignals(content);
        } catch (e) {
            return [];
        }
    }

    _analyzeContentForSignals(content) {
        const signals = [];
        if (content.includes('</div>') || content.includes('<span')) signals.push('html-tags');
        if (content.includes('className=') || content.includes('style={{')) signals.push('jsx-attributes');
        return signals;
    }
}


module.exports = ProjectInferenceEngine;
