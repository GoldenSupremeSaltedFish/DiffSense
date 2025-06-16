import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const sourceDir = resolve(__dirname, '../../../plugin/dist');
const targetDir = resolve(__dirname, '../../../plugin/diffsense-frontend');

// 确保目标目录存在
try {
    mkdirSync(targetDir, { recursive: true });
} catch (err) {
    if (err.code !== 'EEXIST') {
        console.error('创建目标目录失败:', err);
        process.exit(1);
    }
}

// 递归复制文件
function copyDir(src, dest) {
    const entries = readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);

        if (entry.isDirectory()) {
            mkdirSync(destPath, { recursive: true });
            copyDir(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}

// 执行复制
try {
    copyDir(sourceDir, targetDir);
    console.log('构建产物已成功复制到 plugin/diffsense-frontend 目录');
} catch (err) {
    console.error('复制文件时出错:', err);
    process.exit(1);
} 