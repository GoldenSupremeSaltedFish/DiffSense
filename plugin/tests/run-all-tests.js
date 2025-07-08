const { exec } = require('child_process');
const path = require('path');

const tests = [
    { name: '基础功能测试', file: 'basic.test.js' },
    { name: '细粒度分析测试', file: 'granular.test.js' },
    { name: 'CLI适配器测试', file: 'cli.test.js' },
    { name: '集成测试', file: 'integration.test.js' }
];

async function runTest(testFile) {
    return new Promise((resolve) => {
        const command = `node ${testFile}`;
        console.log(`\n🧪 开始运行: ${testFile}`);
        
        exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ ${testFile} 失败:`);
                console.error(error.message);
                resolve(false);
            } else {
                console.log(`✅ ${testFile} 通过`);
                if (stdout) {
                    console.log('输出:', stdout.substring(0, 200) + (stdout.length > 200 ? '...' : ''));
                }
                resolve(true);
            }
        });
    });
}

async function runAllTests() {
    console.log('🚀 开始运行DiffSense Plugin完整测试套件...');
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        const success = await runTest(test.file);
        if (success) {
            passed++;
        } else {
            failed++;
        }
    }
    
    console.log('\n📊 测试结果汇总:');
    console.log(`✅ 通过: ${passed}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`📈 总计: ${passed + failed}`);
    
    if (failed === 0) {
        console.log('\n🎉 所有测试通过！Plugin功能测试完成！');
        process.exit(0);
    } else {
        console.log('\n💥 有测试失败，请检查上述错误信息');
        process.exit(1);
    }
}

runAllTests(); 