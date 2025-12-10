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
        // Implement Plan C logic here
        // 1. Feature Aggregation
        const directoryFeatureGraph = this.aggregateFeatures(fileTree);
        
        // 2. Semantic Classification (Internal Step)
        // We really just need to find the top frontend directories
        
        // 3. Root Inference
        const roots = this.inferRootsFromGraph(directoryFeatureGraph);
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

        for (const cand of topCandidates) {
            if (cand.averageDepth > MAX_DEPTH) continue;
            if (cand.frontendScore > 0.5) {
                validRoots.push(cand.dir);
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

        return [...new Set(finalRoots)].slice(0, 2);
    }
}

module.exports = DefaultProvider;
