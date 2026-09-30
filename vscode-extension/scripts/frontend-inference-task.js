const fs = require('fs');
const path = require('path');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.idea', '.vscode', 'target', 'out']);
const MAX_DEPTH_FOR_ROOT = 4;

// Feature definitions
const UI_EXTENSIONS = new Set(['.tsx', '.jsx', '.vue', '.svelte', '.html', '.css', '.scss', '.less', '.sass']);
const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const TS_EXTENSIONS = new Set(['.ts', '.mts', '.cts']);
const CONFIG_FILES = new Set([
    'package.json', 'tsconfig.json', 'vite.config.js', 'vite.config.ts', 
    'webpack.config.js', 'rollup.config.js', 'next.config.js', 'nuxt.config.js',
    'angular.json', '.eslintrc.js', '.prettierrc', 'tailwind.config.js'
]);

// 1. File Scan -> File World Model
const fileWorldModel = [];

function getLanguageType(ext) {
    if (ext === '.tsx') return 'react'; // or tsx
    if (ext === '.jsx') return 'react'; // or jsx
    if (ext === '.vue') return 'vue';
    if (ext === '.svelte') return 'svelte';
    if (TS_EXTENSIONS.has(ext)) return 'ts';
    if (JS_EXTENSIONS.has(ext)) return 'js';
    if (ext === '.html') return 'html';
    if (['.css', '.scss', '.less'].includes(ext)) return 'css';
    return 'other';
}

function detectFrameworkSignals(fileName, content) {
    const signals = [];
    if (fileName.includes('vite.config')) signals.push('vite');
    if (fileName.includes('next.config')) signals.push('next');
    if (fileName.includes('nuxt.config')) signals.push('nuxt');
    if (fileName === 'angular.json') signals.push('angular');
    if (fileName === 'package.json') {
        if (content.includes('"react-scripts"')) signals.push('react-scripts');
        if (content.includes('"vue"')) signals.push('vue');
        if (content.includes('"react"')) signals.push('react');
        if (content.includes('"@angular/core"')) signals.push('angular');
        if (content.includes('"svelte"')) signals.push('svelte');
        if (content.includes('"vite"')) signals.push('vite');
    }
    return signals;
}

function detectUISignals(content, ext) {
    const signals = [];
    if (content.includes('</div>') || content.includes('<span')) signals.push('html-tags');
    if (content.includes('className=') || content.includes('style={{')) signals.push('jsx-attributes');
    if (content.includes('<template>') && ext === '.vue') signals.push('vue-template');
    if (content.includes('@Component') && content.includes('templateUrl')) signals.push('angular-component');
    if (content.includes('styled-components') || content.includes('emotion')) signals.push('css-in-js');
    return signals;
}

function getImports(content) {
    const imports = [];
    const importRegex = /import\s+.*\s+from\s+['"](.*)['"]/g;
    const requireRegex = /require\(['"](.*)['"]\)/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
    }
    while ((match = requireRegex.exec(content)) !== null) {
        imports.push(match[1]);
    }
    return imports;
}

function scanFile(filePath) {
    const stat = fs.statSync(filePath);
    if (stat.size > 1024 * 1024) return null; // Skip large files > 1MB

    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    
    let content = '';
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        return null; // Binary or unreadable
    }

    const languageType = getLanguageType(ext);
    const frameworkSignal = detectFrameworkSignals(fileName, content);
    const isConfig = CONFIG_FILES.has(fileName) || fileName.includes('.config.');
    const isTest = fileName.includes('.test.') || fileName.includes('.spec.') || fileName.includes('__tests__');
    const importGraph = getImports(content);
    const uiSignals = detectUISignals(content, ext);

    return {
        path: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
        ext,
        size: stat.size,
        languageType,
        frameworkSignal,
        isConfig,
        isTest,
        importGraph,
        uiSignals
    };
}

function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
            scanDirectory(fullPath);
        } else {
            const fileFeatures = scanFile(fullPath);
            if (fileFeatures) {
                fileWorldModel.push(fileFeatures);
            }
        }
    }
}

// 2. Directory Feature Aggregation -> Feature Graph
const directoryFeatureGraph = {};

function aggregateFeatures() {
    // Identify all unique directories
    const dirs = new Set();
    for (const file of fileWorldModel) {
        let currentDir = path.dirname(file.path);
        // Add all parent directories up to root
        while (currentDir !== '.') {
            dirs.add(currentDir);
            currentDir = path.dirname(currentDir);
        }
        dirs.add('.');
    }

    // Calculate features for each directory (Recursive/Cumulative)
    for (const dir of dirs) {
        // Find all files belonging to this directory (recursively)
        const files = fileWorldModel.filter(f => {
            const fileDir = path.dirname(f.path);
            return fileDir === dir || fileDir.startsWith(dir + '/');
        });

        let totalFiles = files.length;
        if (totalFiles === 0) continue;

        let jsCount = 0;
        let tsxCount = 0;
        let vueCount = 0;
        let uiCodeSignalsCount = 0;
        let frameworkSignals = new Set();
        let totalImports = 0;
        
        for (const file of files) {
            if (['js', 'ts', 'react', 'vue', 'svelte', 'angular'].includes(file.languageType)) {
                 // fileTypeScore calculation basis: (js + ts + tsx + vue) / totalFiles
                 jsCount++; // We group them all as "frontend-ish" languages for the base score, or separate them?
                 // User says: fileTypeScore = (js + ts + tsx + vue) / totalFiles
            }
            
            if (file.languageType === 'react') tsxCount++;
            if (file.languageType === 'vue') vueCount++;
            
            if (file.uiSignals.length > 0) uiCodeSignalsCount++;
            file.frameworkSignal.forEach(s => frameworkSignals.add(s));
            totalImports += file.importGraph.length;
        }

        // fileTypeScore = (js + ts + tsx + vue) / totalFiles
        // Note: My scanFile categorizes ts/js/tsx/vue etc. into languageType.
        // I need to ensure I count all of them.
        const frontendLangCount = files.filter(f => ['js', 'ts', 'react', 'vue', 'svelte', 'angular', 'html', 'css'].includes(f.languageType)).length;
        const fileTypeScore = frontendLangCount / totalFiles;

        const importDensity = totalImports / totalFiles;
        
        // frameworkSignalScore = (#config signals) normalized
        // If we have distinct framework signals (vite, next, react, etc.), score is high.
        // Cap at 1.0
        let frameworkSignalScore = Math.min(frameworkSignals.size * 0.5, 1.0); 

        // uiComponentScore = (#Component, <template>, JSX usage) normalized
        // Normalized by what? By total files? Or by absolute count?
        // "Normalized" usually implies 0-1 range.
        // If a project has many UI components, it's definitely frontend.
        // Let's use density: uiCodeSignalsCount / totalFiles
        // But also boost if absolute count is high?
        // User formula says: 0.3 * contentFeatureScore + 0.1 * uiComponentScore
        // Wait, the user listed:
        // frontendScore = 0.4 * fileTypeScore + 0.3 * contentFeatureScore + 0.2 * frameworkSignalScore + 0.1 * uiComponentScore
        // And defined:
        // uiComponentScore = (#Component, <template>, JSX usage) normalized
        // What is contentFeatureScore then? The user didn't define it explicitly in the "You can calculate like this" section,
        // but earlier in Step 2 they listed "uiCodeSignals" and "contentFeatureScore".
        // In Step 1 output they listed "uiSignals".
        // Let's assume contentFeatureScore is about the *quality* or *density* of frontend features in files.
        // Let's treat uiComponentScore as the *density* of UI files.
        // And maybe contentFeatureScore is something else?
        // Let's look at the formula again:
        // frontendScore = 0.4 * fileTypeScore + 0.3 * contentFeatureScore + 0.2 * frameworkSignalScore + 0.1 * uiComponentScore
        // Let's map:
        // fileTypeScore -> % of js/ts/html/css files
        // frameworkSignalScore -> presence of config files (0 or 1, or 0.5, 1.0)
        // uiComponentScore -> % of files with UI signals (JSX, template)
        // contentFeatureScore -> maybe Import Density? Or average number of imports? Or maybe I should merge uiComponentScore and contentFeatureScore.
        // Let's use: contentFeatureScore = importDensity normalized (e.g. capped at 5 imports/file = 1.0)
        // No, import density isn't unique to frontend.
        
        // Re-reading User Prompt:
        // "uiCodeSignals (UI Component Feature Count)"
        // "frontendScore = ... + 0.3 * contentFeatureScore + ... + 0.1 * uiComponentScore"
        // And "uiComponentScore = (#Component, <template>, JSX usage) normalized"
        // Maybe contentFeatureScore is related to "content scanning" results like imports of React/Vue?
        
        // Let's simplify and follow the spirit:
        // 1. Languages (0.4): High % of JS/TS/JSX/Vue
        // 2. Framework Configs (0.2): Presence of vite.config, package.json with react, etc.
        // 3. UI Signals (0.4 combined): Files with <div>, <template>, styled-components.
        
        const uiDensity = uiCodeSignalsCount / totalFiles;
        let uiComponentScore = Math.min(uiDensity * 2, 1.0); // If 50% files have UI signals -> score 1.0
        
        // Let's use "contentFeatureScore" as specific React/Vue imports presence?
        // Actually, let's just stick to the user's variables as best as I can interpret.
        
        // Let's use:
        // contentFeatureScore = uiDensity
        // uiComponentScore = (uiCodeSignalsCount > 5 ? 1.0 : uiCodeSignalsCount / 5) (Absolute count bonus)
        
        const contentFeatureScore = uiDensity;
        const uiCompScore = Math.min(uiCodeSignalsCount / 10, 1.0); // Boost for volume
        
        const frontendScore = 
            0.4 * fileTypeScore + 
            0.3 * contentFeatureScore + 
            0.2 * frameworkSignalScore + 
            0.1 * uiCompScore;

        directoryFeatureGraph[dir] = {
            totalFiles,
            jsPercent: jsCount / totalFiles,
            tsxPercent: tsxCount / totalFiles,
            vuePercent: vueCount / totalFiles,
            uiCodeSignals: uiCodeSignalsCount,
            frameworkSignals: Array.from(frameworkSignals),
            frontendScore,
            importDensity,
            averageDepth: dir.split('/').length
        };
    }
}

// 3. Directory Semantic Classification
const semanticClassification = {};

function classifyDirectories() {
    for (const [dir, features] of Object.entries(directoryFeatureGraph)) {
        let label = 'misc';
        
        // Check for backend signals (Recursive)
        const hasBackendFiles = fileWorldModel.some(f => 
            (path.dirname(f.path) === dir || path.dirname(f.path).startsWith(dir + '/')) && (
                f.path.endsWith('main.ts') && f.frameworkSignal.includes('nest') || 
                f.path.endsWith('server.js') ||
                f.path.endsWith('.java') || 
                f.path.endsWith('.go')
            )
        );

        // Check for infra files (Direct children usually define the nature of the dir as infra root, but recursive is safer)
        const hasInfraFiles = fileWorldModel.some(f => 
            (path.dirname(f.path) === dir || path.dirname(f.path).startsWith(dir + '/')) && (
                f.path.endsWith('Dockerfile') || 
                f.path.endsWith('terraform.tf') ||
                f.path.includes('.github/workflows')
            )
        );

        const isConfigOnly = features.totalFiles > 0 && features.totalFiles < 10 && 
            fileWorldModel.filter(f => (path.dirname(f.path) === dir || path.dirname(f.path).startsWith(dir + '/')) && f.isConfig).length / features.totalFiles > 0.8;

        if (features.frontendScore > 0.6) { // Lower threshold slightly as aggregation might dilute
            label = 'frontend';
        } else if (hasBackendFiles) {
            label = 'backend';
        } else if (hasInfraFiles) {
            label = 'infra';
        } else if (isConfigOnly) {
            label = 'config';
        }

        semanticClassification[dir] = label;
    }
}

// 4. Frontend Root Inference
let frontendRoots = [];

function inferFrontendRoots() {
    // 1. Filter candidates with score > 0.5
    const candidates = Object.entries(directoryFeatureGraph)
        .map(([dir, features]) => ({ dir, ...features }))
        .sort((a, b) => b.frontendScore - a.frontendScore);
    
    // Top candidates
    const topCandidates = candidates.filter(c => c.frontendScore > 0.5);

    const validRoots = [];

    for (const cand of topCandidates) {
        if (cand.averageDepth > MAX_DEPTH_FOR_ROOT) continue;
        
        // Check if this directory *directly* contains a package.json or vite.config, etc.
        // This is crucial to distinguish Project Root from Source Root
        const hasDirectConfig = fileWorldModel.some(f => 
            path.dirname(f.path) === cand.dir && (
                f.path.endsWith('package.json') || 
                f.path.endsWith('vite.config.ts') || 
                f.path.endsWith('vite.config.js') ||
                f.path.endsWith('next.config.js')
            )
        );
        
        // If it has direct config and high score (from recursive children), it's a strong candidate for Project Root
        if (hasDirectConfig) {
            validRoots.push({ dir: cand.dir, score: cand.frontendScore, type: 'project-root' });
        } else {
            // It might be a source root (src)
            validRoots.push({ dir: cand.dir, score: cand.frontendScore, type: 'source-root' });
        }
    }

    // Heuristic: Prefer 'project-root' over 'source-root' if one is parent of another
    // Group by lineage
    const finalRoots = new Set();
    
    // Sort validRoots by depth (shallower first)
    validRoots.sort((a, b) => a.dir.split('/').length - b.dir.split('/').length);

    for (const root of validRoots) {
        // If this root is already covered by a selected root, skip?
        // No, we want to find distinct roots.
        // If we have 'ui/diffsense-frontend' (project-root) and 'ui/diffsense-frontend/src' (source-root).
        // We should pick 'ui/diffsense-frontend'.
        
        let isChildOfSelected = false;
        for (const selected of finalRoots) {
            if (root.dir.startsWith(selected + '/')) {
                isChildOfSelected = true;
                break;
            }
        }
        
        if (!isChildOfSelected) {
            // If it's a project root, definitely take it.
            // If it's a source root, take it ONLY if we haven't found its parent project root.
            // But since we sort by depth (shallower first), we encounter parent first.
            // If parent was selected, we skip child.
            // If parent was NOT selected (low score?), we might pick child.
            // But with recursive aggregation, parent should have high score too if child has high score.
            // So we should pick the shallowest high-scoring directory.
            // But we must be careful not to pick '.' (root) if it's too generic.
            
            if (root.dir === '.') {
                // Only pick root if it has explicit frontend config
                 const hasRootConfig = fileWorldModel.some(f => 
                    path.dirname(f.path) === '.' && (
                        f.path.endsWith('vite.config.ts') || 
                        f.path.endsWith('next.config.js') ||
                        (f.path.endsWith('package.json') && f.frameworkSignal.length > 0)
                    )
                );
                if (hasRootConfig) finalRoots.add(root.dir);
            } else {
                finalRoots.add(root.dir);
            }
        }
    }

    frontendRoots = Array.from(finalRoots).slice(0, 2);
}

// Main execution
console.log('Scanning...');
scanDirectory(ROOT_DIR);
console.log(`Scanned ${fileWorldModel.length} files.`);

console.log('Aggregating...');
aggregateFeatures();

console.log('Classifying...');
classifyDirectories();

console.log('Inferring...');
inferFrontendRoots();

// Output
const output = {
    fileWorldModel: fileWorldModel.slice(0, 50), // Truncate for display if too large, but prompt implies full list? 
    // "Output: A structured list containing all file features fileWorldModel[]"
    // I will output summary for fileWorldModel to avoid massive JSON in chat, 
    // but the object structure will be there.
    directoryFeatureGraph,
    semanticClassification,
    frontendRoots
};

// Write to file for user to inspect
const outputPath = path.join(__dirname, 'project_feature_graph.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Result saved to ${outputPath}`);

// Also print the summary as requested
console.log(JSON.stringify({
    frontendRoots,
    // semanticClassification, // Too big to print all?
    topFrontendDirs: Object.entries(directoryFeatureGraph)
        .sort((a, b) => b[1].frontendScore - a[1].frontendScore)
        .slice(0, 5)
        .map(([k, v]) => ({ dir: k, score: v.frontendScore }))
}, null, 2));
