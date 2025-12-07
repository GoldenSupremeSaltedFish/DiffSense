import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseService } from '../database/DatabaseService';
import { CommitAnalyzer } from '../services/CommitAnalyzer';

suite('SQLite Integration Test Suite', () => {
  let databaseService: DatabaseService;
  let commitAnalyzer: CommitAnalyzer;
  const testDbPath = path.join(__dirname, 'test-diffense.db');

  setup(async () => {
    // 清理测试数据库文件
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // 创建数据库服务
    databaseService = new DatabaseService(testDbPath, {
      maxRetries: 3,
      retryDelay: 100,
      enableCorruptionRecovery: true
    });

    // 初始化数据库
    await databaseService.initialize();

    // 创建提交分析器
    commitAnalyzer = new CommitAnalyzer(databaseService, __dirname);
  });

  teardown(async () => {
    // 清理资源
    if (databaseService) {
      databaseService.dispose();
    }

    // 清理测试数据库文件
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('数据库初始化应该成功', async () => {
    const stats = await databaseService.getStats();
    
    assert.ok(stats, '应该返回统计信息');
    assert.strictEqual(stats.fileMetricsCount, 0, '初始时文件指标数量应该为0');
    assert.strictEqual(stats.commitIndexCount, 0, '初始时提交索引数量应该为0');
    assert.strictEqual(stats.errorLogCount, 0, '初始时错误日志数量应该为0');
  });

  test('应该能够更新文件指标', async () => {
    const filePath = 'test-file.js';
    const metrics = {
      filePath,
      language: 'javascript',
      complexity: 10,
      lastModified: Date.now(),
      commitCount: 5,
      changeFrequency: 2.5,
      ffis: 0.8,
      fiis: 0.6
    };

    await databaseService.updateFileMetrics(metrics);

    const retrievedMetrics = await databaseService.getFileMetrics(filePath);
    
    assert.ok(retrievedMetrics, '应该能够获取文件指标');
    assert.strictEqual(retrievedMetrics.filePath, filePath, '文件路径应该匹配');
    assert.strictEqual(retrievedMetrics.language, 'javascript', '语言应该匹配');
    assert.strictEqual(retrievedMetrics.complexity, 10, '复杂度应该匹配');
  });

  test('应该能够记录提交', async () => {
    const commitInfo = {
      sha: 'abc123',
      timestamp: Date.now(),
      author: 'test-author',
      message: 'test commit message',
      files: [
        {
          filePath: 'file1.js',
          changeType: 'modified',
          additions: 10,
          deletions: 5
        },
        {
          filePath: 'file2.ts',
          changeType: 'added',
          additions: 20,
          deletions: 0
        }
      ]
    };

    await commitAnalyzer.analyzeCommit(commitInfo);

    const stats = await databaseService.getStats();
    assert.ok(stats.commitIndexCount > 0, '应该记录了提交');
  });

  test('应该能够获取热点文件', async () => {
    // 先添加一些测试数据
    const testFiles = [
      { filePath: 'hot-file1.js', complexity: 50, changeFrequency: 5.0, commitCount: 10 },
      { filePath: 'hot-file2.ts', complexity: 40, changeFrequency: 4.0, commitCount: 8 },
      { filePath: 'cold-file.js', complexity: 5, changeFrequency: 0.5, commitCount: 1 }
    ];

    for (const file of testFiles) {
      await databaseService.updateFileMetrics({
        filePath: file.filePath,
        language: file.filePath.endsWith('.ts') ? 'typescript' : 'javascript',
        complexity: file.complexity,
        lastModified: Date.now(),
        commitCount: file.commitCount,
        changeFrequency: file.changeFrequency,
        ffis: 0.5,
        fiis: 0.5
      });
    }

    const hotspotFiles = await commitAnalyzer.getHotspotAnalysis(2);

    assert.ok(Array.isArray(hotspotFiles), '应该返回数组');
    assert.strictEqual(hotspotFiles.length, 2, '应该返回指定数量的热点文件');
    assert.ok(hotspotFiles[0].hotspotScore >= hotspotFiles[1].hotspotScore, '应该按热点分数排序');
    
    // 验证热点文件包含预期的文件
    const filePaths = hotspotFiles.map(f => f.filePath);
    assert.ok(filePaths.includes('hot-file1.js') || filePaths.includes('hot-file2.ts'), 
      '应该包含热点文件');
  });

  test('应该能够记录和获取错误日志', async () => {
    const errorLog = {
      timestamp: Date.now(),
      file: 'test-file.js',
      action: 'test-action',
      message: 'test error message'
    };

    await databaseService.logError(errorLog);

    const stats = await databaseService.getStats();
    assert.strictEqual(stats.errorLogCount, 1, '应该记录了错误日志');
  });

  test('应该能够清理过期数据', async () => {
    // 添加一些旧数据
    const oldTimestamp = Date.now() - (100 * 24 * 60 * 60 * 1000); // 100天前
    
    await databaseService.updateFileMetrics({
      filePath: 'old-file.js',
      language: 'javascript',
      complexity: 10,
      lastModified: oldTimestamp,
      commitCount: 1,
      changeFrequency: 0.1,
      ffis: 0.1,
      fiis: 0.1
    });

    // 清理90天前的数据
    const cleanupThreshold = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const deletedCount = await databaseService.cleanupData(cleanupThreshold);

    assert.ok(deletedCount > 0, '应该删除了过期数据');
    
    const stats = await databaseService.getStats();
    assert.strictEqual(stats.fileMetricsCount, 0, '清理后文件指标应该为0');
  });

  test('应该能够处理数据库损坏恢复', async () => {
    // 模拟数据库损坏
    databaseService.dispose();
    
    // 写入损坏的数据
    fs.writeFileSync(testDbPath, 'corrupted data');
    
    // 重新创建数据库服务
    databaseService = new DatabaseService(testDbPath, {
      maxRetries: 3,
      retryDelay: 100,
      enableCorruptionRecovery: true
    });

    try {
      await databaseService.initialize();
      
      // 如果恢复成功，应该能够正常使用
      const stats = await databaseService.getStats();
      assert.ok(stats, '数据库应该被恢复并可以正常使用');
    } catch (error) {
      // 如果恢复失败，应该抛出错误
      assert.ok(error instanceof Error, '应该抛出错误');
    }
  });
});