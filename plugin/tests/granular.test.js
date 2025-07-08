const { analyze } = require('../analyzers/node-analyzer/analyze');
const { ModificationType } = require('../analyzers/node-analyzer/modificationType');

// 测试用例：组件行为类变更
const testBehaviorChanges = async () => {
    const oldCode = `
import React, { useEffect, useState } from 'react';

export function UserProfile({ userId }) {
    const [user, setUser] = useState(null);
    
    useEffect(() => {
        fetchUser(userId);
    }, [userId]);

    const fetchUser = async (id) => {
        const response = await fetch(\`/api/users/\${id}\`);
        const data = await response.json();
        setUser(data);
    };

    return <div>{user?.name}</div>;
}`;

    const newCode = `
import React, { useEffect, useState } from 'react';

export function UserProfile({ userId, onUserLoad }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        fetchUser(userId);
    }, [userId, onUserLoad]);

    const fetchUser = async (id) => {
        setLoading(true);
        try {
            const response = await fetch(\`/api/users/\${id}\`);
            const data = await response.json();
            setUser(data);
            onUserLoad?.(data);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Loading...</div>;
    return <div>{user?.name}</div>;
}`;

    const result = await analyze({
        oldContent: oldCode,
        newContent: newCode,
        filePath: 'UserProfile.tsx',
        includeTypeTags: true
    });

    console.log('组件行为类变更测试结果:', JSON.stringify(result, null, 2));

    // 验证是否检测到了相关变更
    const expectedTypes = [
        ModificationType.COMPONENT_LOGIC_CHANGE.code,
        ModificationType.STATE_MANAGEMENT_CHANGE.code,
        ModificationType.HOOK_CHANGE.code,
        ModificationType.API_CALL_CHANGE.code
    ];

    const hasExpectedChanges = expectedTypes.some(type =>
        result.changes.some(change => change.type === type)
    );

    if (!hasExpectedChanges) {
        throw new Error('没有正确检测到组件行为类的变更');
    }

    console.log('组件行为类变更测试通过！');
};

// 测试用例：UI结构类变更
const testUIStructureChanges = async () => {
    const oldCode = `
import React from 'react';
import styles from './Card.module.css';

export function Card({ title, content }) {
    return (
        <div className={styles.card}>
            <h2>{title}</h2>
            <p>{content}</p>
        </div>
    );
}`;

    const newCode = `
import React from 'react';
import styles from './Card.module.css';

export function Card({ title, content, footer }) {
    return (
        <div className={styles.card}>
            <header className={styles.header}>
                <h2>{title}</h2>
            </header>
            <main className={styles.content}>
                <p>{content}</p>
            </main>
            {footer && (
                <footer className={styles.footer}>
                    {footer}
                </footer>
            )}
        </div>
    );
}`;

    const result = await analyze({
        oldContent: oldCode,
        newContent: newCode,
        filePath: 'Card.tsx',
        includeTypeTags: true
    });

    console.log('UI结构类变更测试结果:', JSON.stringify(result, null, 2));

    // 验证是否检测到了相关变更
    const expectedTypes = [
        ModificationType.JSX_STRUCTURE_CHANGE.code,
        ModificationType.COMPONENT_PROPS_CHANGE.code
    ];

    const hasExpectedChanges = expectedTypes.some(type =>
        result.changes.some(change => change.type === type)
    );

    if (!hasExpectedChanges) {
        throw new Error('没有正确检测到UI结构类的变更');
    }

    console.log('UI结构类变更测试通过！');
};

// 运行所有测试
const runTests = async () => {
    try {
        console.log('开始运行细粒度分析测试...');
        
        await testBehaviorChanges();
        await testUIStructureChanges();
        
        console.log('所有测试通过！✅');
    } catch (error) {
        console.error('测试失败:', error.message);
        process.exit(1);
    }
};

runTests(); 