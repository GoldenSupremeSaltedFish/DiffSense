#!/usr/bin/env node

/**
 * 测试安全分支切换器
 */

const SafeBranchSwitcher = require('./plugin/analyzers/shared/SafeBranchSwitcher');
const path = require('path');
const fs = require('fs');

async function testSafeBranchSwitcher() {
    console.log('🧪 测试安全分支切换器...');
    
    // 获取当前Git仓库根目录
    let repoRoot = process.cwd();
    let foundGit = false;
    while (repoRoot !== path.dirname(repoRoot)) {
        if (fs.existsSync(path.join(repoRoot, '.git'))) {
            foundGit = true;
            break;
        }
        repoRoot = path.dirname(repoRoot);
    }
    
    if (!foundGit) {
        console.error('❌ 未找到Git仓库');
        return;
    }
    
    console.log(`📁 测试仓库: ${repoRoot}`);
    
    const branchSwitcher = new SafeBranchSwitcher(repoRoot);
    
    try {
        // 测试切换到main/master分支
        const targetBranch = 'main'; // 或者 'master'
        
        console.log(`🔄 测试切换到分支: ${targetBranch}`);
        
        const result = await branchSwitcher.safeBranchOperation(targetBranch, async () => {
            console.log('✅ 成功切换到目标分支');
            
            // 执行一些Git操作来验证我们在正确的分支上
            const currentBranch = branchSwitcher.execGit('git rev-parse --abbrev-ref HEAD');
            console.log(`📍 当前分支: ${currentBranch}`);
            
            const logOutput = branchSwitcher.execGit(`git log --oneline -5`);
            console.log('📋 最近5个提交:');
            console.log(logOutput);
            
            return {
                success: true,
                branch: currentBranch,
                commits: logOutput.split('\n').length
            };
        });
        
        console.log('✅ 测试完成:', result);
        
        // 验证我们已经回到原始分支
        const finalBranch = branchSwitcher.execGit('git rev-parse --abbrev-ref HEAD');
        console.log(`🏠 恢复后的分支: ${finalBranch}`);
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

// 运行测试
if (require.main === module) {
    testSafeBranchSwitcher().catch(console.error);
}

module.exports = { testSafeBranchSwitcher };