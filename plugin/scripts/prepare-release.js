#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 清理和创建目录的函数
function cleanAndCreateDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

// 复制文件或目录的函数
function copyRecursive(src, dest, {clearDest = true} = {}) {
  if (!fs.existsSync(src)) {
    console.warn(`警告: 源路径不存在: ${src}`);
    return;
  }

  if (fs.statSync(src).isDirectory()) {
    if (clearDest) {
      cleanAndCreateDir(dest);
    } else {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
    }
    for (const file of fs.readdirSync(src)) {
      const srcFile = path.join(src, file);
      const destFile = path.join(dest, file);
      copyRecursive(srcFile, destFile, { clearDest: false });
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 主函数
async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const releaseDir = path.join(rootDir, 'release');
  const distDir = path.join(releaseDir, 'dist');
  const analyzersDir = path.join(releaseDir, 'analyzers');
  const uiDir = path.join(releaseDir, 'ui');

  try {
    console.log('🚀 开始准备发布版本...');

    // 1. 清理并创建发布目录
    console.log('📁 创建发布目录结构...');
    cleanAndCreateDir(releaseDir);
    cleanAndCreateDir(distDir);
    cleanAndCreateDir(analyzersDir);
    cleanAndCreateDir(uiDir);

    // 2. 编译TypeScript代码
    console.log('🔨 编译TypeScript代码...');
    execSync('npm run compile', { stdio: 'inherit', cwd: rootDir });

    // 3. 复制必要文件
    console.log('📋 复制必要文件...');
    
    // 复制编译后的JavaScript文件
    copyRecursive(path.join(rootDir, 'dist'), distDir);
    
    // ---------------- 分析器复制 ----------------
    const localAnalyzersSrc = path.join(rootDir, 'analyzers');
    if (fs.existsSync(localAnalyzersSrc)) {
      copyRecursive(localAnalyzersSrc, analyzersDir);
    } else {
      // 尝试从工作区根目录查找构建产物
      const workspaceRoot = path.resolve(rootDir, '..');
      // Java JAR
      const targetDir = path.join(workspaceRoot, 'target');
      if (fs.existsSync(targetDir)) {
        for (const file of fs.readdirSync(targetDir)) {
          if (file.endsWith('.jar')) {
            copyRecursive(path.join(targetDir, file), path.join(analyzersDir, file));
          }
        }
      }
      // Node/Golang 分析器
      copyRecursive(path.join(workspaceRoot, 'ui', 'node-analyzer'), path.join(analyzersDir, 'node-analyzer'));
      copyRecursive(path.join(workspaceRoot, 'ui', 'golang-analyzer'), path.join(analyzersDir, 'golang-analyzer'));
    }

    // ---------------- 前端 UI 构建产物 ----------------
    const frontendDistSrcRoot = path.join(rootDir, 'ui', 'diffsense-frontend', 'dist');
    const workspaceFrontendDist = path.join(rootDir, '..', 'ui', 'diffsense-frontend', 'dist');
    const distSourceToCopy = fs.existsSync(frontendDistSrcRoot) ? frontendDistSrcRoot : workspaceFrontendDist;
    copyRecursive(distSourceToCopy, distDir, { clearDest: false });

    // 不再复制完整 UI 文件夹，减少 VSIX 体积（已包含 dist 所需资源）

    // 复制基础文件
    const baseFiles = ['package.json', 'package-lock.json', 'README.md', 'LICENSE.txt', 'icon.png'];
    for (const file of baseFiles) {
      if (fs.existsSync(path.join(rootDir, file))) {
        fs.copyFileSync(path.join(rootDir, file), path.join(releaseDir, file));
      }
    }

    // 4. 安装生产依赖
    console.log('📦 安装生产依赖...');
    execSync('npm ci --only=production', { stdio: 'inherit', cwd: releaseDir });

    // 5. 创建新的.vscodeignore
    console.log('📝 创建.vscodeignore...');
    const vscodeignore = `
# Development files
.vscode/**
.vscode-test/**
scripts/**
**/*.ts
**/*.map
tsconfig.json
webpack.config.js
.eslintrc.json
.gitignore

# Dependencies
node_modules/**
!node_modules/glob/**

# Build intermediate files
.nyc_output
coverage

# Runtime test files
**/*.test.*
**/*.spec.*

# Source maps
**/*.js.map

# Logs
*.log

# Temporary files
.DS_Store
Thumbs.db

# Don't exclude frontend build files
!dist/**

# Include all analyzers
!analyzers/**

# Exclude test files from analyzers
analyzers/node-analyzer/**/test/**
analyzers/node-analyzer/**/tests/**
analyzers/node-analyzer/**/__tests__/**
analyzers/golang-analyzer/**/test/**
analyzers/golang-analyzer/**/tests/**
analyzers/golang-analyzer/**/__tests__/**
`.trim();

    fs.writeFileSync(path.join(releaseDir, '.vscodeignore'), vscodeignore);

    console.log('✅ 发布版本准备完成！');
    console.log(`📦 发布文件位于: ${releaseDir}`);
    
  } catch (error) {
    console.error('❌ 准备发布版本时出错:', error);
    process.exit(1);
  }
}

main().catch(console.error); 