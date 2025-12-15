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
    }

    /**
     * @param {string} rootDir - Absolute path to project root
     * @param {import('./types').FileTree} [preScannedFileTree] - Optional pre-scanned file tree
     * @param {function(string)} [onProgress] - Optional progress callback
     */
    async infer(rootDir, preScannedFileTree, onProgress) {
        this.logger.log(`Starting project inference for ${rootDir}`);
        
        const fileTree = preScannedFileTree || await this.scanFilesAsync(rootDir, onProgress);
        
        // 1. Detect Providers
        const detectionResults = [];
        for (const provider of this.providers) {
            const score = await provider.detect(rootDir, fileTree);
            this.logger.log(`Provider ${provider.name} score: ${score}`);
            if (score > 0) {
                detectionResults.push({ provider, score });
            }
        }

        // 2. Select Best Provider
        // Sort by score descending
        detectionResults.sort((a, b) => b.score - a.score);
        
        const bestMatch = detectionResults[0];
        let selectedProvider = this.providers.find(p => p.name === 'default-heuristic');
        
        if (bestMatch) {
            selectedProvider = bestMatch.provider;
        }

        this.logger.log(`Selected Provider: ${selectedProvider.name}`);

        // 3. Infer Roots
        const sourceRoots = await selectedProvider.inferSourceRoots(rootDir, fileTree);

        return {
            projectType: selectedProvider.name,
            sourceRoots,
            detectionDetails: detectionResults.map(d => ({ name: d.provider.name, score: d.score }))
        };
    }

    async scanFilesAsync(rootDir, onProgress) {
        const fileWorldModel = [];
        const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.idea', '.vscode', 'target', 'out']);
        let scannedCount = 0;

        const scanDir = async (dir) => {
            try {
                const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                const tasks = [];
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
                        tasks.push(scanDir(fullPath));
                    } else {
                        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
                        const ext = path.extname(fullPath).toLowerCase();
                        
                        // Async processing
                        // We push a promise to tasks if we want to parallelize file reading too, 
                        // but let's keep it simple for now to avoid too many open files.
                        // Actually, reading files in parallel might hit ulimit.
                        // So we await file reading here, but directories are scanned in parallel.
                        
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
                        if (onProgress && scannedCount % 50 === 0) {
                             onProgress(`Scanned ${scannedCount} files...`);
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
