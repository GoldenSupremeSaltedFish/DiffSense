const BaseProvider = require('./provider');
const path = require('path');

class DefaultProvider extends BaseProvider {
    constructor() {
        super('default-heuristic');
    }

    async detect(dir, fileTree) {
        // Always return a low score to act as fallback
        return 10;
    }

    async inferSourceRoots(dir, fileTree) {
        // ✅ 阶段 2.4.1: 特征聚合
        if (this.logger && this.logger.log) {
            this.logger.log(`[阶段 2.4.1] 开始特征聚合...`);
        }
        const directoryFeatureGraph = this.aggregateFeatures(fileTree);
        const dirCount = Object.keys(directoryFeatureGraph).length;
        if (this.logger && this.logger.log) {
            this.logger.log(`[阶段 2.4.1] ✅ 特征聚合完成，分析了 ${dirCount} 个目录`);
        }
        
        // ✅ 阶段 2.4.2: 语义分类（内部步骤）
        // We really just need to find the top frontend directories
        
        // ✅ 阶段 2.4.3: 根目录推断
        if (this.logger && this.logger.log) {
            this.logger.log(`[阶段 2.4.3] 开始推断前端根目录...`);
        }
        const roots = this.inferRootsFromGraph(directoryFeatureGraph);
        if (this.logger && this.logger.log) {
            this.logger.log(`[阶段 2.4.3] ✅ 推断完成，找到 ${roots.length} 个候选根目录`);
        }
        return roots;
    }

    aggregateFeatures(fileTree) {
        const directoryFeatureGraph = {};
        const files = fileTree.files;

        // Identify all unique directories
        const dirs = new Set();
        for (const file of files) {
            let currentDir = path.dirname(file.path);
            while (currentDir !== '.' && currentDir !== '/') {
                dirs.add(currentDir);
                currentDir = path.dirname(currentDir);
            }
            dirs.add('.');
        }

        for (const dir of dirs) {
            // Find all files belonging to this directory (recursively)
            // Note: This O(N*M) can be slow for large repos. 
            // Optimization: Pre-calculate directory tree or use cumulative sums up the tree.
            // For now, keeping it simple as per Plan C prototype.
            
            const dirFiles = files.filter(f => {
                const fileDir = path.dirname(f.path);
                return fileDir === dir || fileDir.startsWith(dir + '/');
            });

            if (dirFiles.length === 0) continue;

            let totalFiles = dirFiles.length;
            let jsCount = 0;
            let tsxCount = 0;
            let vueCount = 0;
            let uiCodeSignalsCount = 0;
            let frameworkSignals = new Set();
            let totalImports = 0;

            for (const file of dirFiles) {
                if (['js', 'ts', 'react', 'vue', 'svelte', 'angular'].includes(file.languageType)) {
                    jsCount++;
                }
                if (file.languageType === 'react') tsxCount++;
                if (file.languageType === 'vue') vueCount++;
                
                if (file.uiSignals && file.uiSignals.length > 0) uiCodeSignalsCount++;
                if (file.frameworkSignal) file.frameworkSignal.forEach(s => frameworkSignals.add(s));
                if (file.importGraph) totalImports += file.importGraph.length;
            }

            const frontendLangCount = dirFiles.filter(f => ['js', 'ts', 'react', 'vue', 'svelte', 'angular', 'html', 'css'].includes(f.languageType)).length;
            const fileTypeScore = frontendLangCount / totalFiles;
            const importDensity = totalImports / totalFiles;

            // Framework Signal Score (0.0 - 1.0)
            let frameworkSignalScore = Math.min(frameworkSignals.size * 0.5, 1.0);

            // UI Component Score
            const uiDensity = uiCodeSignalsCount / totalFiles;
            let uiComponentScore = Math.min(uiCodeSignalsCount / 10, 1.0); // Volume bonus

            // Content Feature Score (UI Density)
            const contentFeatureScore = uiDensity;

            const frontendScore = 
                0.4 * fileTypeScore + 
                0.3 * contentFeatureScore + 
                0.2 * frameworkSignalScore + 
                0.1 * uiComponentScore;

            directoryFeatureGraph[dir] = {
                totalFiles,
                frontendScore,
                averageDepth: dir.split('/').length
            };
        }

        return directoryFeatureGraph;
    }

    inferRootsFromGraph(graph) {
        const candidates = Object.entries(graph)
            .map(([dir, features]) => ({ dir, ...features }))
            .sort((a, b) => b.frontendScore - a.frontendScore);
        
        const topCandidates = candidates.slice(0, 10);
        const MAX_DEPTH = 4;
        const validRoots = [];

        // ✅ 记录候选目录信息
        if (this.logger && this.logger.log && topCandidates.length > 0) {
            const top3 = topCandidates.slice(0, 3).map(c => 
                `${c.dir} (score: ${c.frontendScore.toFixed(2)})`
            ).join(', ');
            this.logger.log(`[阶段 2.4.3] Top 3 候选目录: ${top3}`);
        }

        for (const cand of topCandidates) {
            if (cand.averageDepth > MAX_DEPTH) {
                if (this.logger && this.logger.log) {
                    this.logger.log(`[阶段 2.4.3] 跳过 ${cand.dir}: 深度 ${cand.averageDepth} > ${MAX_DEPTH}`);
                }
                continue;
            }
            if (cand.frontendScore > 0.5) {
                validRoots.push(cand.dir);
                if (this.logger && this.logger.log) {
                    this.logger.log(`[阶段 2.4.3] 有效根目录: ${cand.dir} (score: ${cand.frontendScore.toFixed(2)})`);
                }
            }
        }

        // Filter children
        const finalRoots = [];
        for (const root of validRoots) {
            let isChild = false;
            for (const other of validRoots) {
                if (root !== other && root.startsWith(other + '/')) {
                    isChild = true;
                    break;
                }
            }
            if (!isChild) {
                finalRoots.push(root);
            }
        }

        const result = [...new Set(finalRoots)].slice(0, 2);
        if (this.logger && this.logger.log) {
            this.logger.log(`[阶段 2.4.3] 最终根目录 (过滤子目录后): ${JSON.stringify(result)}`);
        }
        return result;
    }
}

module.exports = DefaultProvider;
