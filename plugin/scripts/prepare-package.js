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
 * 准备VSIX包的前端资源和分析器
 */
function preparePackage() {
  console.log('🔄 准备VSIX包...');
  
  // 当前插件目录
  const pluginDir = process.cwd();
  console.log('📁 插件目录:', pluginDir);
  
  // ============ 1. 准备前端构建产物 ============
  // 前端构建产物源路径（优先使用环境变量）
  const frontendDistSrc = process.env.FRONTEND_DIST || path.join(pluginDir, 'dist');
  
  // 前端资源目标路径（插件内），统一放在 plugin/dist
  const frontendDistDest = path.join(pluginDir, 'dist');
  
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
  
  if (path.resolve(frontendDistSrc) !== path.resolve(frontendDistDest)) {
    // 若源 != 目标，则先清理再复制
    if (fs.existsSync(frontendDistDest)) {
      fs.rmSync(frontendDistDest, { recursive: true, force: true });
    }
    fs.mkdirSync(frontendDistDest, { recursive: true });
    copyDir(frontendDistSrc, frontendDistDest);
  } else {
    console.log('📂 构建产物已位于目标目录，跳过复制');
  }
  
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

  // ============ 2. 准备分析器到analyzers目录 ============
  console.log('🔧 准备分析器...');
  
  const workspaceRoot = path.resolve(pluginDir, '..');
  const analyzersDestDir = path.join(pluginDir, 'analyzers');
  
  // 确保analyzers目录存在
  if (!fs.existsSync(analyzersDestDir)) {
    fs.mkdirSync(analyzersDestDir, { recursive: true });
  }
  
  // 复制Node.js分析器
  const nodeAnalyzerSrc = path.join(workspaceRoot, 'ui', 'node-analyzer');
  const nodeAnalyzerDest = path.join(analyzersDestDir, 'node-analyzer');
  
  if (fs.existsSync(nodeAnalyzerSrc)) {
    console.log('📦 复制Node.js分析器...');
    copyDir(nodeAnalyzerSrc, nodeAnalyzerDest);
    console.log('✅ Node.js分析器复制完成');
  } else {
    console.warn('⚠️ Node.js分析器源目录不存在:', nodeAnalyzerSrc);
  }
  
  // 复制Golang分析器
  const golangAnalyzerSrc = path.join(workspaceRoot, 'ui', 'golang-analyzer');
  const golangAnalyzerDest = path.join(analyzersDestDir, 'golang-analyzer');
  
  if (fs.existsSync(golangAnalyzerSrc)) {
    console.log('📦 复制Golang分析器...');
    copyDir(golangAnalyzerSrc, golangAnalyzerDest);
    console.log('✅ Golang分析器复制完成');
  } else {
    console.warn('⚠️ Golang分析器源目录不存在:', golangAnalyzerSrc);
  }
  
  // 复制Java JAR文件
  const targetDir = path.join(workspaceRoot, 'target');
  if (fs.existsSync(targetDir)) {
    console.log('📦 复制Java分析器...');
    const jarFiles = fs.readdirSync(targetDir).filter(file => file.endsWith('.jar'));
    
    for (const jarFile of jarFiles) {
      const jarSrc = path.join(targetDir, jarFile);
      const jarDest = path.join(analyzersDestDir, jarFile);
      fs.copyFileSync(jarSrc, jarDest);
      console.log(`✅ 复制JAR文件: ${jarFile}`);
    }
  } else {
    console.warn('⚠️ Java target目录不存在:', targetDir);
  }
  
  // 验证analyzers目录
  if (fs.existsSync(analyzersDestDir)) {
    const analyzersContents = fs.readdirSync(analyzersDestDir);
    console.log('📁 analyzers目录内容:', analyzersContents);
    
    const analyzerStats = getDirStats(analyzersDestDir);
    console.log(`📊 分析器统计: ${analyzerStats.files}个文件, ${analyzerStats.dirs}个目录, 总大小: ${(analyzerStats.size / 1024 / 1024).toFixed(2)}MB`);
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