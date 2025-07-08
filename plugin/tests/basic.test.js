const path = require('path');
const { analyze } = require('../analyzers/node-analyzer/analyze');

// 测试用例：简单的React组件修改
const testSimpleComponentChange = async () => {
    const oldCode = `
import React from 'react';

export function Button({ text }) {
    return <button>{text}</button>;
}`;

    const newCode = `
import React from 'react';

export function Button({ text, onClick }) {
    return <button onClick={onClick}>{text}</button>;
}`;

    const result = await analyze({
        oldContent: oldCode,
        newContent: newCode,
        filePath: 'Button.tsx',
        includeTypeTags: true
    });

    console.log('测试结果:', JSON.stringify(result, null, 2));
    
    // 验证分析结果
    if (!result || !result.changes || result.changes.length === 0) {
        throw new Error('分析结果为空或没有检测到变更');
    }

    // 验证是否检测到了props的变化
    const hasPropsChange = result.changes.some(change => 
        change.type === 'component-props-change' || 
        change.description.includes('Props')
    );

    if (!hasPropsChange) {
        throw new Error('没有正确检测到props的变化');
    }

    console.log('基本功能测试通过！');
};

// 测试用例：验证文件路径处理
const testFilePathHandling = async () => {
    const code = `
import React from 'react';

export function Test() {
    return <div>Test</div>;
}`;

    const result = await analyze({
        oldContent: code,
        newContent: code,
        filePath: path.join('src', 'components', 'Test.tsx'),
        includeTypeTags: true
    });

    if (!result) {
        throw new Error('分析结果为空');
    }

    console.log('文件路径处理测试通过！');
};

// 运行所有测试
const runTests = async () => {
    try {
        console.log('开始运行基础功能测试...');
        
        await testSimpleComponentChange();
        await testFilePathHandling();
        
        console.log('所有测试通过！✅');
    } catch (error) {
        console.error('测试失败:', error.message);
        process.exit(1);
    }
};

runTests(); 