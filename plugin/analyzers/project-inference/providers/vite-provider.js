const BaseProvider = require('./provider');
const path = require('path');

class ViteProvider extends BaseProvider {
    constructor() {
        super('vite');
    }

    async detect(dir, fileTree) {
        // Check for vite.config.js/ts
        const hasViteConfig = fileTree.files.some(f => f.path.includes('vite.config.'));
        return hasViteConfig ? 90 : 0;
    }

    async inferSourceRoots(dir, fileTree) {
        // Vite projects usually have 'src' or root as source
        // Find where vite.config is
        const configFiles = fileTree.files.filter(f => f.path.includes('vite.config.'));
        
        const roots = new Set();
        for (const config of configFiles) {
            const configDir = path.dirname(config.path);
            
            // Check for 'src' in that directory
            const hasSrc = fileTree.files.some(f => path.dirname(f.path) === path.join(configDir, 'src').replace(/\\/g, '/'));
            if (hasSrc) {
                roots.add(path.join(configDir, 'src').replace(/\\/g, '/'));
            } else {
                // If no src, assume configDir is root (e.g. small projects)
                roots.add(configDir === '.' ? '.' : configDir);
            }
        }
        return Array.from(roots);
    }
}

module.exports = ViteProvider;
