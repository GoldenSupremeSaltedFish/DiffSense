const fs = require('fs');
const path = require('path');

// Import Providers
const DefaultProvider = require('./providers/default-provider');
const ViteProvider = require('./providers/vite-provider');
const NextProvider = require('./providers/next-provider');

class ProjectInferenceEngine {
    constructor() {
        this.providers = [
            new NextProvider(),
            new ViteProvider(),
            new DefaultProvider()
        ];
    }

    /**
     * @param {string} rootDir - Absolute path to project root
     * @param {import('./types').FileTree} [preScannedFileTree] - Optional pre-scanned file tree
     */
    async infer(rootDir, preScannedFileTree) {
        console.log(`Starting project inference for ${rootDir}`);
        
        const fileTree = preScannedFileTree || this.scanFiles(rootDir);
        
        // 1. Detect Providers
        const detectionResults = [];
        for (const provider of this.providers) {
            const score = await provider.detect(rootDir, fileTree);
            console.log(`Provider ${provider.name} score: ${score}`);
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

        console.log(`Selected Provider: ${selectedProvider.name}`);

        // 3. Infer Roots
        const sourceRoots = await selectedProvider.inferSourceRoots(rootDir, fileTree);

        return {
            projectType: selectedProvider.name,
            sourceRoots,
            detectionDetails: detectionResults.map(d => ({ name: d.provider.name, score: d.score }))
        };
    }

    scanFiles(rootDir) {
        // Simple scan implementation similar to the script
        // In real integration, this might call the existing scanner
        const fileWorldModel = [];
        const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.idea', '.vscode', 'target', 'out']);
        
        const scanDir = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
                    scanDir(fullPath);
                } else {
                    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
                    const ext = path.extname(fullPath).toLowerCase();
                    // Basic feature extraction
                    fileWorldModel.push({
                        path: relativePath,
                        ext,
                        languageType: this.getLanguageType(ext),
                        frameworkSignal: this.detectFrameworkSignals(entry.name),
                        uiSignals: this.detectUISignals(fullPath), // Simplified: pass path, read content if needed
                        importGraph: [] // Simplified: skipping import parsing for this demo unless needed
                    });
                }
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
        // Lightweight check
        try {
            if (fs.statSync(filePath).size > 100 * 1024) return [];
            const content = fs.readFileSync(filePath, 'utf-8');
            const signals = [];
            if (content.includes('</div>') || content.includes('<span')) signals.push('html-tags');
            if (content.includes('className=') || content.includes('style={{')) signals.push('jsx-attributes');
            return signals;
        } catch (e) {
            return [];
        }
    }
}

module.exports = ProjectInferenceEngine;
