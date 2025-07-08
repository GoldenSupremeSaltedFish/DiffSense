const { exec } = require('child_process');
const path = require('path');

const cliAdapterPath = path.resolve(__dirname, '../../ui/cli-adapter.js');
const oldFilePath = path.resolve(__dirname, 'test-files/old.js');
const newFilePath = path.resolve(__dirname, 'test-files/new.js');

const runCliTest = () => {
    const command = `node "${cliAdapterPath}" "${oldFilePath}" "${newFilePath}" --include-type-tags`;

    console.log(`执行命令: ${command}`);

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`执行出错: ${error.message}`);
            process.exit(1);
        }
        if (stderr) {
            console.error(`命令执行stderr: ${stderr}`);
        }

        console.log(`命令执行stdout: ${stdout}`);

        try {
            const result = JSON.parse(stdout);
            if (result && result.changes && result.changes.length > 0 && result.includeTypeTags) {
                console.log('CLI适配器测试通过！✅');
            } else {
                throw new Error('CLI适配器输出不符合预期');
            }
        } catch (e) {
            console.error(`解析输出失败: ${e.message}`);
            process.exit(1);
        }
    });
};

// 创建测试文件
const fs = require('fs');
const testFilesDir = path.resolve(__dirname, 'test-files');
if (!fs.existsSync(testFilesDir)) {
    fs.mkdirSync(testFilesDir);
}
fs.writeFileSync(oldFilePath, 'const a = 1;');
fs.writeFileSync(newFilePath, 'const a = 2;');


runCliTest(); 