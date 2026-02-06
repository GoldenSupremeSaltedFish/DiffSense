#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 清理VSIX包准备时复制的资源
 */
function cleanPackage() {
  console.log('🧹 清理VSIX包资源...');
  
  // 当前插件目录
  const pluginDir = process.cwd();
  console.log('📁 插件目录:', pluginDir);
  
  // 前端资源目标路径（插件内）
  const frontendDistDest = path.join(pluginDir, 'ui');
  
  if (fs.existsSync(frontendDistDest)) {
    console.log('🗑️ 删除复制的前端资源...');
    fs.rmSync(frontendDistDest, { recursive: true, force: true });
    console.log('✅ 清理完成');
  } else {
    console.log('ℹ️ 没有需要清理的资源');
  }
}

// 运行脚本
if (require.main === module) {
  try {
    cleanPackage();
  } catch (error) {
    console.error('❌ 清理失败:', error.message);
    process.exit(1);
  }
} 