#!/usr/bin/env node

/**
 * VSIX 打包脚本
 * 修复 undici File API 兼容性问题
 * 
 * 问题：undici 在打包时尝试使用 File API，但在某些环境下可能不可用
 * 解决：在加载 undici 之前确保 File API 可用
 */

// 在加载任何模块之前，确保 File API 可用
// Node.js 18+ 应该已经有 File，但为了兼容性，我们提供一个 fallback
if (typeof globalThis.File === 'undefined') {
  // 创建一个简单的 File polyfill
  // 注意：这只是一个占位符，实际使用时会由 Node.js 18+ 的原生 File 替代
  globalThis.File = class File {
    constructor(blobParts, filename, options) {
      // 这是一个最小化的实现，仅用于避免 undici 的错误
      this.name = filename || 'file';
      this.lastModified = options?.lastModified || Date.now();
      this.size = 0;
      this.type = options?.type || '';
    }
  };
  console.log('⚠️  已创建 File API polyfill');
}

// 设置环境变量以避免警告
if (!process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = '--no-warnings';
} else if (!process.env.NODE_OPTIONS.includes('--no-warnings')) {
  process.env.NODE_OPTIONS += ' --no-warnings';
}

// 使用 execSync 执行命令，更简单可靠
const { execSync } = require('child_process');
const path = require('path');

const vsceArgs = process.argv.slice(2);
if (!vsceArgs.includes('package')) {
  vsceArgs.unshift('package');
}
if (!vsceArgs.includes('--no-yarn')) {
  vsceArgs.push('--no-yarn');
}

console.log('📦 开始打包 VSIX...');
console.log('📋 参数:', vsceArgs.join(' '));
console.log('🔧 Node.js 版本:', process.version);

try {
  // 使用 npx 运行 vsce
  execSync(`npx --yes @vscode/vsce ${vsceArgs.join(' ')}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env
  });
  console.log('✅ VSIX 打包成功！');
} catch (error) {
  console.error('❌ VSIX 打包失败:', error.message);
  process.exit(error.status || 1);
}

