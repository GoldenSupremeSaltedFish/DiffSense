const BaseProvider = require('./provider');
const path = require('path');

class NextProvider extends BaseProvider {
    constructor() {
        super('nextjs');
    }

    async detect(dir, fileTree) {
        const hasNextConfig = fileTree.files.some(f => f.path.includes('next.config.'));
        return hasNextConfig ? 95 : 0;
    }

    async inferSourceRoots(dir, fileTree) {
        const configFiles = fileTree.files.filter(f => f.path.includes('next.config.'));
        const roots = new Set();
        
        for (const config of configFiles) {
            const configDir = path.dirname(config.path);
            
            // Next.js structure: pages or app dir, potentially under src
            const potentialDirs = ['pages', 'app', 'src/pages', 'src/app'];
            
            for (const p of potentialDirs) {
                const checkPath = configDir === '.' ? p : path.join(configDir, p).replace(/\\/g, '/');
                // Check if any file starts with this path
                const exists = fileTree.files.some(f => f.path.startsWith(checkPath));
                if (exists) {
                    // Return the parent of pages/app as source root? 
                    // Usually we want the root containing components etc.
                    // If src exists, return src.
                    if (p.startsWith('src')) {
                         roots.add(configDir === '.' ? 'src' : path.join(configDir, 'src').replace(/\\/g, '/'));
                    } else {
                         roots.add(configDir === '.' ? '.' : configDir);
                    }
                }
            }
        }
        
        return Array.from(roots);
    }
}

module.exports = NextProvider;
