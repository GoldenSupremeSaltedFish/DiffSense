const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 安全的分支切换工具类
 * 采用临时分支方案，不污染用户工作区
 */
class SafeBranchSwitcher {
    constructor(repoPath) {
        this.repoPath = repoPath;
        this.originalBranch = null;
        this.originalSha = null;
        this.temporaryBranch = null;
        this.isDetachedHead = false;
    }

    /**
     * 安全地切换到目标分支并执行操作
     * @param {string} targetBranch - 目标分支名
     * @param {Function} operation - 要执行的操作
     * @returns {Promise<any>} 操作结果
     */
    async safeBranchOperation(targetBranch, operation) {
        try {
            // 1. 保存当前环境
            this.saveCurrentEnvironment();
            
            // 2. 检查工作区是否干净
            this.checkCleanWorkingDirectory();
            
            // 3. 获取目标分支
            await this.fetchAndCheckoutBranch(targetBranch);
            
            // 4. 执行操作
            return await operation();
            
        } finally {
            // 5. 恢复环境
            await this.restoreEnvironment();
        }
    }

    /**
     * 执行Git命令
     * @param {string} cmd - Git命令
     * @param {Object} options - 额外选项
     * @returns {string} 命令输出
     */
    execGit(cmd, options = {}) {
        const execOptions = {
            cwd: this.repoPath,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            maxBuffer: 1024 * 1024 * 50 // 50MB
        };
        
        try {
            return execSync(cmd, execOptions).trim();
        } catch (error) {
            if (options.ignoreErrors) {
                return '';
            }
            throw new Error(`Git命令失败: ${cmd}\n错误: ${error.message}`);
        }
    }

    /**
     * 保存当前分支环境
     */
    saveCurrentEnvironment() {
        try {
            // 获取当前分支名
            const currentBranch = this.execGit('git rev-parse --abbrev-ref HEAD');
            const currentSha = this.execGit('git rev-parse HEAD');
            
            if (currentBranch === 'HEAD') {
                // HEAD detached状态
                this.isDetachedHead = true;
                this.originalSha = currentSha;
                this.originalBranch = 'HEAD';
                console.log(`当前处于detached HEAD状态，SHA: ${this.originalSha}`);
            } else {
                // 正常分支状态
                this.isDetachedHead = false;
                this.originalBranch = currentBranch;
                this.originalSha = currentSha;
                console.log(`当前分支: ${this.originalBranch}, SHA: ${this.originalSha}`);
            }
        } catch (error) {
            throw new Error(`保存当前环境失败: ${error.message}`);
        }
    }

    /**
     * 检查工作区是否干净
     */
    checkCleanWorkingDirectory() {
        try {
            const statusOutput = this.execGit('git status --porcelain', { ignoreErrors: true });
            const hasUncommittedChanges = statusOutput.length > 0;
            
            if (hasUncommittedChanges) {
                const message = '工作区有未提交修改，请先提交或 stash 后再分析目标分支。';
                throw new Error(message);
            }
            
            console.log('工作区干净，可以继续操作');
        } catch (error) {
            if (error.message.includes('工作区有未提交修改')) {
                throw error;
            }
            throw new Error(`无法检查工作区状态: ${error.message}`);
        }
    }

    /**
     * 获取并切换到目标分支
     */
    async fetchAndCheckoutBranch(targetBranch) {
        // 1. 尝试获取远程分支
        try {
            console.log(`正在获取远程分支: origin/${targetBranch}`);
            const fetchCmd = `git fetch --no-tags --prune origin +refs/heads/${targetBranch}:refs/remotes/origin/${targetBranch}`;
            this.execGit(fetchCmd);
            console.log(`成功获取远程分支: origin/${targetBranch}`);
        } catch (error) {
            console.error(`获取远程分支失败: ${error.message}`);
            throw new Error(`获取远程分支失败，请检查网络连接和分支名称是否正确: ${error.message}`);
        }
        
        // 2. 验证远程分支是否存在
        try {
            this.execGit(`git show-ref --verify --quiet refs/remotes/origin/${targetBranch}`);
        } catch (error) {
            const message = `远程分支 origin/${targetBranch} 不存在，请确认分支名称是否正确`;
            throw new Error(message);
        }
        
        // 3. 创建临时分支并切换
        this.temporaryBranch = `diffsense-temp-${targetBranch.replace(/[/\\]/g, '-')}-${Date.now()}`;
        
        try {
            console.log(`创建临时分支: ${this.temporaryBranch}`);
            const checkoutCmd = `git switch -C ${this.temporaryBranch} origin/${targetBranch}`;
            this.execGit(checkoutCmd);
            console.log(`成功切换到临时分支: ${this.temporaryBranch}`);
        } catch (error) {
            throw new Error(`创建临时分支失败: ${error.message}`);
        }
    }

    /**
     * 恢复原始环境
     */
    async restoreEnvironment() {
        try {
            // 1. 切换回原始分支
            if (this.isDetachedHead) {
                console.log(`恢复到detached HEAD状态: ${this.originalSha}`);
                this.execGit(`git switch --detach ${this.originalSha}`);
            } else {
                console.log(`切换回原始分支: ${this.originalBranch}`);
                this.execGit(`git switch ${this.originalBranch}`);
            }
            
            // 2. 删除临时分支
            if (this.temporaryBranch) {
                console.log(`删除临时分支: ${this.temporaryBranch}`);
                try {
                    this.execGit(`git branch -D ${this.temporaryBranch}`);
                    console.log(`成功删除临时分支: ${this.temporaryBranch}`);
                } catch (error) {
                    console.warn(`删除临时分支失败: ${error.message}`);
                }
            }
            
        } catch (error) {
            console.error(`恢复环境失败: ${error.message}`);
            // 给出手动恢复建议
            if (this.temporaryBranch) {
                console.warn(`请手动删除临时分支: git branch -D ${this.temporaryBranch}`);
            }
            if (this.isDetachedHead && this.originalSha) {
                console.warn(`请手动恢复到detached HEAD状态: git checkout ${this.originalSha}`);
            } else if (this.originalBranch) {
                console.warn(`请手动切换回原始分支: git checkout ${this.originalBranch}`);
            }
        }
    }
}

module.exports = SafeBranchSwitcher;