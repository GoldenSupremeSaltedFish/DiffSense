#!/usr/bin/env node

/**
 * 测试安全分支切换器的错误处理
 */

const SafeBranchSwitcher = require('./plugin/analyzers/shared/SafeBranchSwitcher');
const path = require('path');
const fs = require('fs');

async function testErrorHandling() {
    console.log('🧪 测试安全分支切换器的错误处理...');
    
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
    
    // 测试1: 不存在的分支
    console.log('\n🧪 测试1: 尝试切换到不存在的分支...');
    try {
        await branchSwitcher.safeBranchOperation('non-existent-branch-12345', async () => {
            console.log('❌ 不应该到达这里');
            return { success: false };
        });
    } catch (error) {
        console.log(`✅ 正确处理了不存在的分支: ${error.message}`);
    }
    
    // 测试2: 脏工作区（创建临时文件）
    console.log('\n🧪 测试2: 测试脏工作区检测...');
    const testFile = path.join(repoRoot, 'test-dirty-file.txt');
    fs.writeFileSync(testFile, 'test content');
    
    try {
        await branchSwitcher.safeBranchOperation('main', async () => {
            console.log('❌ 不应该到达这里');
            return { success: false };
        });
    } catch (error) {
        console.log(`✅ 正确检测了脏工作区: ${error.message}`);
    } finally {
        // 清理测试文件
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    }
    
    // 测试3: 正常分支切换
    console.log('\n🧪 测试3: 正常分支切换...');
    try {
        const result = await branchSwitcher.safeBranchOperation('main', async () => {
            console.log('✅ 成功切换到main分支');
            const currentBranch = branchSwitcher.execGit('git rev-parse --abbrev-ref HEAD');
            return { 
                success: true, 
                branch: currentBranch,
                message: '正常执行操作'
            };
        });
        console.log(`✅ 正常分支切换完成:`, result);
    } catch (error) {
        console.log(`❌ 正常分支切换失败: ${error.message}`);
    }
    
    console.log('\n🎉 所有错误处理测试完成！');
}

// 运行测试
if (require.main === module) {
    testErrorHandling().catch(console.error);
}

module.exports = { testErrorHandling };