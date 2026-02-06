/**
 * @typedef {Object} FileFeature
 * @property {string} path - Relative path
 * @property {string} ext - File extension
 * @property {number} size - File size
 * @property {string} languageType - js, ts, react, vue, etc.
 * @property {string[]} frameworkSignal - Framework indicators found
 * @property {boolean} isConfig - Is a configuration file
 * @property {boolean} isTest - Is a test file
 * @property {string[]} importGraph - Imported modules
 * @property {string[]} uiSignals - UI indicators found
 */

/**
 * @typedef {Object} FileTree
 * @property {FileFeature[]} files - List of all files with features
 * @property {Object.<string, FileFeature[]>} dirMap - Map of directory path to files
 */

/**
 * @typedef {Object} ProjectTypeProvider
 * @property {string} name - Unique name of the provider
 * @property {function(string, FileTree): Promise<number>} detect - Returns confidence score (0-100)
 * @property {function(string, FileTree): Promise<string[]>} inferSourceRoots - Returns list of source roots
 */

module.exports = {};
