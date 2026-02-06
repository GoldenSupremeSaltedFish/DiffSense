/**
 * Base class for project type providers
 */
class BaseProvider {
    constructor(name) {
        this.name = name;
    }

    /**
     * @param {string} dir - Root directory
     * @param {import('../types').FileTree} fileTree - File tree with features
     * @returns {Promise<number>} - Confidence score (0-100)
     */
    async detect(dir, fileTree) {
        return 0;
    }

    /**
     * @param {string} dir - Root directory
     * @param {import('../types').FileTree} fileTree - File tree with features
     * @returns {Promise<string[]>} - List of source roots
     */
    async inferSourceRoots(dir, fileTree) {
        return [];
    }
}

module.exports = BaseProvider;
