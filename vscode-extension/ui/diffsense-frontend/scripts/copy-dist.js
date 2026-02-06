import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// 使用环境变量或计算相对路径
const sourceDir = process.env.FRONTEND_DIST || resolve(__dirname, '../dist');

// 目标路径：优先使用环境变量，否则寻找 plugin 目录
let targetDir = process.env.FRONTEND_TARGET;
if (!targetDir) {
  // 从当前脚本位置向上查找 plugin 目录
  let searchDir = resolve(__dirname, '..');
  let pluginDir = null;
  
  // 最多向上查找3级目录
  for (let i = 0; i < 3; i++) {
    const candidatePluginDir = resolve(searchDir, '..', 'plugin');
    if (existsSync(candidatePluginDir) && existsSync(join(candidatePluginDir, 'package.json'))) {
      pluginDir = candidatePluginDir;
      break;
    }
    searchDir = resolve(searchDir, '..');
  }
  
  if (pluginDir) {
    targetDir = join(pluginDir, 'dist');
  } else {
    // 回退到默认相对路径
    targetDir = resolve(__dirname, '../../../plugin/dist');
  }
}

function ensureDir(dirPath) {
  try {
    mkdirSync(dirPath, { recursive: true });
    console.log('✓ 目标目录已创建/确认', dirPath);
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.error('创建目录失败:', err);
      process.exit(1);
    }
  }
}

// 确保目标目录存在
ensureDir(targetDir);

console.log('复制前端构建产物:');
console.log('- 源目录:', sourceDir);
console.log('- 目标目录:', targetDir);

// 检查源目录是否存在
if (!existsSync(sourceDir)) {
    console.error('错误: 源目录不存在:', sourceDir);
    console.error('当前目录结构:');
    try {
        console.error(readdirSync(resolve(__dirname, '..')));
    } catch (err) {
        console.error('无法读取当前目录:', err);
    }
    process.exit(1);
}

// 递归复制文件
function copyDir(src, dest) {
    console.log(`复制目录: ${src} -> ${dest}`);
    const entries = readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);

        if (entry.isDirectory()) {
            mkdirSync(destPath, { recursive: true });
            copyDir(srcPath, destPath);
        } else {
            try {
                copyFileSync(srcPath, destPath);
                console.log(`✓ 复制文件: ${entry.name}`);
            } catch (err) {
                console.error(`× 复制文件失败 ${entry.name}:`, err);
                throw err;
            }
        }
    }
}

// 执行复制
try {
    copyDir(sourceDir, targetDir);
    console.log('✅ 构建产物已成功复制到目标目录');
    
    // 验证复制结果
    const files = readdirSync(targetDir);
    console.log('目标目录内容:', files);
} catch (err) {
    console.error('❌ 复制文件时出错:', err);
    process.exit(1);
} 