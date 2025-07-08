const path = require('path');
const fs = require('fs');

// 模拟VSCode插件调用node-analyzer的方式
async function testVSCodeIntegration() {
    console.log('开始VSCode插件集成测试...');
    
    // 模拟一个React组件文件的修改
    const testFile = path.join(__dirname, 'test-files', 'Component.tsx');
    const testDir = path.dirname(testFile);
    
    // 确保目录存在
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    
    // 创建测试文件
    const componentCode = `
import React, { useState, useEffect } from 'react';

interface Props {
    title: string;
    onLoad?: () => void;
}

export function TestComponent({ title, onLoad }: Props) {
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        if (onLoad) {
            onLoad();
        }
    }, [onLoad]);
    
    const handleClick = () => {
        setCount(prev => prev + 1);
    };
    
    return (
        <div className="test-component">
            <h1>{title}</h1>
            <p>Count: {count}</p>
            <button onClick={handleClick}>
                Increment
            </button>
            {loading && <div>Loading...</div>}
        </div>
    );
}`;
    
    fs.writeFileSync(testFile, componentCode);
    
    // 测试1: 使用FrontendAnalyzer进行完整项目分析
    console.log('\n测试1: 完整项目分析');
    const { FrontendAnalyzer } = require('../node-analyzer/analyze');
    const analyzer = new FrontendAnalyzer(testDir, {
        enableMicroserviceDetection: false,
        maxDepth: 5
    });
    
    try {
        const result = await analyzer.analyze();
        console.log('✅ 项目分析成功');
        console.log(`- 文件数: ${result.summary.totalFiles}`);
        console.log(`- 方法数: ${result.summary.totalMethods}`);
        
        if (result.summary.totalFiles === 0) {
            throw new Error('没有检测到任何文件');
        }
    } catch (error) {
        console.error('❌ 项目分析失败:', error.message);
        return false;
    }
    
    // 测试2: 使用granular analyze进行文件级别的细粒度分析
    console.log('\n测试2: 细粒度文件分析');
    const { analyze } = require('../node-analyzer/analyze');
    
    const oldCode = `
import React, { useState } from 'react';

export function TestComponent({ title }: { title: string }) {
    const [count, setCount] = useState(0);
    
    return (
        <div>
            <h1>{title}</h1>
            <p>{count}</p>
        </div>
    );
}`;
    
    try {
        const result = await analyze({
            oldContent: oldCode,
            newContent: componentCode,
            filePath: 'Component.tsx',
            includeTypeTags: true
        });
        
        console.log('✅ 细粒度分析成功');
        console.log(`- 检测到 ${result.changes.length} 个变更`);
        
        if (result.changes.length === 0) {
            throw new Error('没有检测到任何变更');
        }
        
        // 验证检测到的变更类型
        const changeTypes = result.changes.map(c => c.type);
        console.log(`- 变更类型: ${changeTypes.join(', ')}`);
        
        // 应该检测到Hook变更、Props变更、JSX结构变更等
        const expectedTypes = ['hook-change', 'component-props-change', 'jsx-structure-change'];
        const hasExpectedTypes = expectedTypes.some(type => changeTypes.includes(type));
        
        if (!hasExpectedTypes) {
            console.warn('⚠️ 没有检测到预期的变更类型');
        }
        
    } catch (error) {
        console.error('❌ 细粒度分析失败:', error.message);
        return false;
    }
    
    // 测试3: CLI适配器集成测试
    console.log('\n测试3: CLI适配器集成');
    const oldFile = path.join(testDir, 'old.tsx');
    const newFile = path.join(testDir, 'new.tsx');
    
    fs.writeFileSync(oldFile, oldCode);
    fs.writeFileSync(newFile, componentCode);
    
    const { exec } = require('child_process');
    const cliAdapterPath = path.resolve(__dirname, '../cli-adapter.js');
    
    return new Promise((resolve) => {
        const command = `node "${cliAdapterPath}" "${oldFile}" "${newFile}" --include-type-tags`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ CLI适配器测试失败:', error.message);
                resolve(false);
                return;
            }
            
            try {
                const result = JSON.parse(stdout);
                console.log('✅ CLI适配器集成成功');
                console.log(`- 检测到 ${result.changes.length} 个变更`);
                
                if (result.changes.length > 0 && result.includeTypeTags) {
                    console.log('\n🎉 所有集成测试通过！');
                    resolve(true);
                } else {
                    console.error('❌ CLI适配器输出不符合预期');
                    resolve(false);
                }
            } catch (parseError) {
                console.error('❌ CLI适配器输出解析失败:', parseError.message);
                resolve(false);
            }
        });
    });
}

// 运行测试
testVSCodeIntegration().then(success => {
    if (success) {
        console.log('\n✅ VSCode插件集成测试完成！');
        process.exit(0);
    } else {
        console.log('\n❌ VSCode插件集成测试失败！');
        process.exit(1);
    }
}).catch(error => {
    console.error('测试过程中发生错误:', error);
    process.exit(1);
}); 