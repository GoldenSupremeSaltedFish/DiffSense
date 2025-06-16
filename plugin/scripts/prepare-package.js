#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 复制目录及其内容
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️ 源目录不存在: ${src}`);
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 准备VSIX包的前端资源
 */
function preparePackage() {
  console.log('🔄 准备VSIX包...');
  
  // 当前插件目录
  const pluginDir = process.cwd();
  console.log('📁 插件目录:', pluginDir);
  
  // 前端构建产物源路径（优先使用环境变量）
  const frontendDistSrc = process.env.FRONTEND_DIST || path.join(pluginDir, 'dist');
  
  // 前端资源目标路径（插件内）
  const frontendDistDest = path.join(pluginDir, 'ui', 'diffsense-frontend');
  
  console.log('📦 检查前端构建产物...');
  console.log('  源路径:', frontendDistSrc);
  console.log('  目标路径:', frontendDistDest);
  
  if (!fs.existsSync(frontendDistSrc)) {
    console.error('❌ 前端构建产物不存在！');
    console.error('源目录内容:');
    try {
      console.error(fs.readdirSync(path.dirname(frontendDistSrc)));
    } catch (err) {
      console.error('无法读取源目录:', err.message);
    }
    process.exit(1);
  }
  
  // 检查必要文件
  const requiredFiles = ['index.html', 'assets'];
  for (const file of requiredFiles) {
    const filePath = path.join(frontendDistSrc, file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 必需文件不存在: ${filePath}`);
      process.exit(1);
    }
  }
  
  console.log('✅ 前端构建产物验证通过');
  
  // 复制前端资源到插件目录
  console.log('📁 复制前端资源...');
  
  // 清理目标目录
  if (fs.existsSync(frontendDistDest)) {
    fs.rmSync(frontendDistDest, { recursive: true, force: true });
  }
  
  // 创建目标目录
  fs.mkdirSync(frontendDistDest, { recursive: true });
  
  // 复制前端构建产物
  copyDir(frontendDistSrc, frontendDistDest);
  
  // 验证复制结果
  if (fs.existsSync(path.join(frontendDistDest, 'index.html'))) {
    console.log('✅ 前端资源复制成功');
    
    // 显示复制的文件统计
    const stats = getDirStats(frontendDistDest);
    console.log(`📊 复制统计: ${stats.files}个文件, ${stats.dirs}个目录, 总大小: ${(stats.size / 1024).toFixed(2)}KB`);
  } else {
    console.error('❌ 前端资源复制失败');
    process.exit(1);
  }
  
  console.log('🎉 VSIX包准备完成！');
}

/**
 * 获取目录统计信息
 */
function getDirStats(dir) {
  let files = 0;
  let dirs = 0;
  let size = 0;
  
  function scan(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        dirs++;
        scan(fullPath);
      } else {
        files++;
        size += fs.statSync(fullPath).size;
      }
    }
  }
  
  scan(dir);
  return { files, dirs, size };
}

// 运行脚本
if (require.main === module) {
  try {
    preparePackage();
  } catch (error) {
    console.error('❌ 准备失败:', error.message);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  }
} 