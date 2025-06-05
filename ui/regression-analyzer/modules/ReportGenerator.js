/**
 * 报告生成模块
 * 功能：生成多格式的智能回归分析报告 + 功能回滚检测报告
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class ReportGenerator {
  constructor(options = {}) {
    this.options = options;
    this.outputDir = options.outputDir || './regression-reports';
    this.ensureOutputDir();
  }

  async generateReport(data) {
    console.log('📄 生成智能回归分析报告...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reports = {};

    try {
      // 根据输出格式生成报告
      switch (this.options.outputFormat) {
        case 'html':
          reports.html = await this.generateHTMLReport(data, timestamp);
          break;
        case 'markdown':
          reports.markdown = await this.generateMarkdownReport(data, timestamp);
          break;
        case 'json':
          reports.json = await this.generateJSONReport(data, timestamp);
          break;
        default:
          // 默认生成HTML报告
          reports.html = await this.generateHTMLReport(data, timestamp);
      }

      return {
        success: true,
        outputPath: reports.html || reports.markdown || reports.json,
        reports: reports,
        timestamp: timestamp
      };

    } catch (error) {
      throw new Error(`报告生成失败: ${error.message}`);
    }
  }

  async generateHTMLReport(data, timestamp) {
    console.log('🌐 生成HTML格式报告...');
    
    const fileName = `regression-report-${timestamp}.html`;
    const filePath = path.join(this.outputDir, fileName);
    
    const html = this.buildHTMLContent(data);
    fs.writeFileSync(filePath, html, 'utf-8');
    
    console.log(`✅ HTML报告已生成: ${filePath}`);
    return filePath;
  }

  async generateMarkdownReport(data, timestamp) {
    console.log('📝 生成Markdown格式报告...');
    
    const fileName = `regression-report-${timestamp}.md`;
    const filePath = path.join(this.outputDir, fileName);
    
    const markdown = this.buildMarkdownContent(data);
    fs.writeFileSync(filePath, markdown, 'utf-8');
    
    console.log(`✅ Markdown报告已生成: ${filePath}`);
    return filePath;
  }

  async generateJSONReport(data, timestamp) {
    console.log('📋 生成JSON格式报告...');
    
    const fileName = `regression-report-${timestamp}.json`;
    const filePath = path.join(this.outputDir, fileName);
    
    const jsonData = {
      reportType: 'regression-analysis',
      timestamp: timestamp,
      summary: this.buildSummary(data),
      ...data
    };
    
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf-8');
    
    console.log(`✅ JSON报告已生成: ${filePath}`);
    return filePath;
  }

  buildHTMLContent(data) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>智能回归分析报告</title>
    <style>
        ${this.getHTMLStyles()}
    </style>
</head>
<body>
    <div class="container">
        ${this.buildHTMLHeader(data)}
        ${this.buildHTMLSummary(data)}
        ${this.buildHTMLRollbackSection(data)}
        ${this.buildHTMLRiskSection(data)}
        ${this.buildHTMLScoreSection(data)}
        ${this.buildHTMLRecommendations(data)}
        ${this.buildHTMLDetails(data)}
        ${this.buildHTMLFooter(data)}
    </div>
    
    <script>
        ${this.getHTMLScripts()}
    </script>
</body>
</html>`;
  }

  buildHTMLHeader(data) {
    return `
    <header class="report-header">
        <h1>🔍 智能回归分析报告</h1>
        <div class="report-meta">
            <span class="timestamp">⏰ 生成时间: ${new Date(data.metadata.timestamp).toLocaleString('zh-CN')}</span>
            <span class="analysis-time">⚡ 分析耗时: ${Math.round(data.metadata.analysisTime / 1000)}秒</span>
            <span class="version">📦 版本: ${data.metadata.version}</span>
        </div>
    </header>`;
  }

  buildHTMLSummary(data) {
    const summary = this.buildSummary(data);
    
    return `
    <section class="summary-section">
        <h2>📊 分析总览</h2>
        <div class="summary-grid">
            <div class="summary-card overall-score ${summary.overallRisk.level.toLowerCase()}">
                <h3>总体风险评分</h3>
                <div class="score">${summary.overallRisk.score}/10</div>
                <div class="level">${summary.overallRisk.level}</div>
            </div>
            <div class="summary-card">
                <h3>变更文件</h3>
                <div class="count">${summary.changes.files}</div>
                <div class="detail">个文件发生变更</div>
            </div>
            <div class="summary-card">
                <h3>变更方法</h3>
                <div class="count">${summary.changes.methods}</div>
                <div class="detail">个方法被修改</div>
            </div>
            <div class="summary-card">
                <h3>高风险项</h3>
                <div class="count">${summary.risks.high}</div>
                <div class="detail">需要重点关注</div>
            </div>
        </div>
    </section>`;
  }

  buildHTMLRollbackSection(data) {
    if (!data.rollbackDetection || data.rollbackDetection.length === 0) {
      return '';
    }

    let rollbackHTML = `
    <section class="rollback-section">
        <h2>🚨 功能回滚检测</h2>
        <div class="rollback-alerts">`;

    const rollbackDetected = data.rollbackDetection.filter(r => r.rollbackDetected);
    
    if (rollbackDetected.length > 0) {
      rollbackHTML += `
        <div class="alert alert-danger">
            <h3>⚠️ 检测到 ${rollbackDetected.length} 个功能回滚</h3>
            <p>以下功能可能已被意外删除或回滚，请立即检查：</p>
        </div>`;
      
      for (const rollback of rollbackDetected) {
        rollbackHTML += this.buildRollbackCard(rollback);
      }
    } else {
      rollbackHTML += `
        <div class="alert alert-success">
            <h3>✅ 未检测到功能回滚</h3>
            <p>所有检查的功能都正常存在。</p>
        </div>`;
    }

    rollbackHTML += `
        </div>
    </section>`;

    return rollbackHTML;
  }

  buildRollbackCard(rollback) {
    const commit = rollback.deletionCommit;
    
    return `
    <div class="rollback-card">
        <div class="rollback-header">
            <h4>🔴 ${rollback.target.methodName}</h4>
            <span class="file-path">${rollback.target.filePath}</span>
        </div>
        
        ${commit ? `
        <div class="deletion-info">
            <div class="commit-info">
                <span class="commit-hash">${commit.hash.substring(0, 7)}</span>
                <span class="author">👤 ${commit.author}</span>
                <span class="date">📅 ${new Date(commit.date).toLocaleString('zh-CN')}</span>
            </div>
            <div class="commit-message">"${commit.message}"</div>
            <div class="deletion-reason">原因分类: ${this.translateDeletionReason(commit.reason)}</div>
        </div>
        ` : ''}

        <div class="rollback-suggestions">
            <h5>💡 建议操作:</h5>
            <ul>
                ${rollback.suggestions.map(s => `<li class="suggestion ${s.priority.toLowerCase()}">${s.description}</li>`).join('')}
            </ul>
        </div>

        ${commit ? `
        <div class="recovery-commands">
            <h5>🔧 恢复命令:</h5>
            <code>git show ${commit.hash}:${rollback.target.filePath} > recovered_${path.basename(rollback.target.filePath)}</code>
            <code>git checkout ${commit.hash}~1 -- ${rollback.target.filePath}</code>
        </div>
        ` : ''}
    </div>`;
  }

  buildHTMLRiskSection(data) {
    return `
    <section class="risk-section">
        <h2>⚠️ 风险分析</h2>
        <div class="risk-grid">
            <div class="risk-column high-risk">
                <h3>🔴 高风险 (${data.risks.highRisk.length})</h3>
                ${this.buildRiskList(data.risks.highRisk)}
            </div>
            <div class="risk-column medium-risk">
                <h3>🟡 中风险 (${data.risks.mediumRisk.length})</h3>
                ${this.buildRiskList(data.risks.mediumRisk)}
            </div>
            <div class="risk-column low-risk">
                <h3>🟢 低风险 (${data.risks.lowRisk.length})</h3>
                ${this.buildRiskList(data.risks.lowRisk)}
            </div>
        </div>
    </section>`;
  }

  buildRiskList(risks) {
    if (risks.length === 0) {
      return '<p class="no-risks">无风险项</p>';
    }

    return `
    <ul class="risk-list">
        ${risks.slice(0, 10).map(risk => `
            <li class="risk-item">
                <div class="risk-title">${this.translateRiskType(risk.type)}</div>
                <div class="risk-description">${risk.description}</div>
                ${risk.method ? `<div class="risk-method">方法: ${risk.method.name}</div>` : ''}
            </li>
        `).join('')}
        ${risks.length > 10 ? `<li class="more-risks">... 还有 ${risks.length - 10} 个风险项</li>` : ''}
    </ul>`;
  }

  buildHTMLScoreSection(data) {
    if (!data.scores || !data.scores.methods) {
      return '';
    }

    const methodScores = Object.entries(data.scores.methods)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 10);

    return `
    <section class="score-section">
        <h2>📈 风险评分详情</h2>
        
        <div class="score-overview">
            <h3>整体评分: ${data.scores.overall.score}/10 (${data.scores.overall.level})</h3>
            <p>${data.scores.overall.summary}</p>
        </div>

        <div class="dimension-scores">
            <h3>各维度评分</h3>
            <div class="dimensions-grid">
                ${Object.entries(data.scores.dimensions).map(([dim, score]) => `
                    <div class="dimension-card">
                        <h4>${this.translateDimension(dim)}</h4>
                        <div class="dimension-score">${score.average}/10</div>
                        <div class="dimension-range">范围: ${score.min} - ${score.max}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="method-scores">
            <h3>高风险方法排名</h3>
            <table class="score-table">
                <thead>
                    <tr>
                        <th>方法名</th>
                        <th>评分</th>
                        <th>风险等级</th>
                        <th>主要问题</th>
                    </tr>
                </thead>
                <tbody>
                    ${methodScores.map(([methodName, score]) => `
                        <tr class="score-row ${score.level.toLowerCase()}">
                            <td>${methodName}</td>
                            <td>${score.score}</td>
                            <td><span class="level-badge ${score.level.toLowerCase()}">${score.level}</span></td>
                            <td>${score.factors.slice(0, 2).join(', ')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </section>`;
  }

  buildHTMLRecommendations(data) {
    const rollbackRec = data.scores?.riskAnalysis?.rollbackRecommendation;
    const strategies = data.scores?.riskAnalysis?.mitigationStrategies || [];

    return `
    <section class="recommendations-section">
        <h2>💡 建议与策略</h2>
        
        ${rollbackRec ? `
        <div class="rollback-recommendation ${rollbackRec.urgency.toLowerCase()}">
            <h3>${this.getActionIcon(rollbackRec.action)} ${this.translateAction(rollbackRec.action)}</h3>
            <p><strong>原因:</strong> ${rollbackRec.reason}</p>
            <p><strong>紧急程度:</strong> ${rollbackRec.urgency}</p>
        </div>
        ` : ''}

        <div class="mitigation-strategies">
            <h3>🛡️ 缓解策略</h3>
            ${strategies.map(strategy => `
                <div class="strategy-card ${strategy.priority.toLowerCase()}">
                    <h4>${strategy.action}</h4>
                    <p>${strategy.description}</p>
                </div>
            `).join('')}
        </div>
    </section>`;
  }

  buildHTMLDetails(data) {
    return `
    <section class="details-section">
        <h2>📋 详细信息</h2>
        
        <details class="details-card">
            <summary>变更文件详情 (${data.changes.files.length})</summary>
            <ul>
                ${data.changes.files.map(file => `
                    <li>
                        <strong>${file.path}</strong>
                        <span class="file-stats">+${file.additions || 0} -${file.deletions || 0}</span>
                    </li>
                `).join('')}
            </ul>
        </details>

        <details class="details-card">
            <summary>变更方法详情 (${data.changes.methods.length})</summary>
            <ul>
                ${data.changes.methods.slice(0, 20).map(method => `
                    <li>
                        <strong>${method.name}</strong> 
                        <span class="method-type">${method.changeType}</span>
                        <span class="method-file">${method.filePath}</span>
                    </li>
                `).join('')}
                ${data.changes.methods.length > 20 ? `<li>... 还有 ${data.changes.methods.length - 20} 个方法</li>` : ''}
            </ul>
        </details>
    </section>`;
  }

  buildHTMLFooter(data) {
    return `
    <footer class="report-footer">
        <p>📊 报告由 DiffSense 智能回归分析器生成</p>
        <p>🔧 如有问题，请联系开发团队</p>
    </footer>`;
  }

  buildMarkdownContent(data) {
    const summary = this.buildSummary(data);
    
    return `# 🔍 智能回归分析报告

## 📊 分析总览

- **总体风险评分**: ${summary.overallRisk.score}/10 (${summary.overallRisk.level})
- **变更文件数**: ${summary.changes.files}
- **变更方法数**: ${summary.changes.methods}
- **高风险项**: ${summary.risks.high}
- **生成时间**: ${new Date(data.metadata.timestamp).toLocaleString('zh-CN')}

${this.buildMarkdownRollbackSection(data)}

## ⚠️ 风险分析

### 🔴 高风险 (${data.risks.highRisk.length})
${this.buildMarkdownRiskList(data.risks.highRisk)}

### 🟡 中风险 (${data.risks.mediumRisk.length})
${this.buildMarkdownRiskList(data.risks.mediumRisk)}

### 🟢 低风险 (${data.risks.lowRisk.length})
${this.buildMarkdownRiskList(data.risks.lowRisk)}

${this.buildMarkdownScoreSection(data)}

## 💡 建议与策略

${data.scores?.riskAnalysis?.rollbackRecommendation ? `
### ${this.translateAction(data.scores.riskAnalysis.rollbackRecommendation.action)}
**原因**: ${data.scores.riskAnalysis.rollbackRecommendation.reason}
**紧急程度**: ${data.scores.riskAnalysis.rollbackRecommendation.urgency}
` : ''}

---
*报告由 DiffSense 智能回归分析器生成*`;
  }

  buildMarkdownRollbackSection(data) {
    if (!data.rollbackDetection || data.rollbackDetection.length === 0) {
      return '';
    }

    const rollbackDetected = data.rollbackDetection.filter(r => r.rollbackDetected);
    
    if (rollbackDetected.length === 0) {
      return `## ✅ 功能回滚检测

未检测到功能回滚，所有检查的功能都正常存在。

`;
    }

    let markdown = `## 🚨 功能回滚检测

⚠️ **检测到 ${rollbackDetected.length} 个功能回滚**

`;

    for (const rollback of rollbackDetected) {
      const commit = rollback.deletionCommit;
      markdown += `### 🔴 ${rollback.target.methodName}
- **文件**: \`${rollback.target.filePath}\`
${commit ? `- **删除提交**: ${commit.hash.substring(0, 7)} by ${commit.author}
- **删除时间**: ${new Date(commit.date).toLocaleString('zh-CN')}
- **提交信息**: "${commit.message}"
- **删除原因**: ${this.translateDeletionReason(commit.reason)}

**恢复命令**:
\`\`\`bash
git show ${commit.hash}:${rollback.target.filePath} > recovered_${path.basename(rollback.target.filePath)}
git checkout ${commit.hash}~1 -- ${rollback.target.filePath}
\`\`\`
` : ''}

`;
    }

    return markdown;
  }

  buildMarkdownRiskList(risks) {
    if (risks.length === 0) {
      return '无风险项\n';
    }

    return risks.slice(0, 10).map(risk => 
      `- **${this.translateRiskType(risk.type)}**: ${risk.description}${risk.method ? ` (方法: ${risk.method.name})` : ''}`
    ).join('\n') + '\n';
  }

  buildMarkdownScoreSection(data) {
    if (!data.scores || !data.scores.methods) {
      return '';
    }

    const methodScores = Object.entries(data.scores.methods)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 10);

    return `## 📈 风险评分详情

**整体评分**: ${data.scores.overall.score}/10 (${data.scores.overall.level})

### 高风险方法排名

| 方法名 | 评分 | 风险等级 | 主要问题 |
|--------|------|----------|----------|
${methodScores.map(([methodName, score]) => 
  `| ${methodName} | ${score.score} | ${score.level} | ${score.factors.slice(0, 2).join(', ')} |`
).join('\n')}

`;
  }

  buildSummary(data) {
    return {
      overallRisk: data.scores?.overall || { score: 0, level: 'UNKNOWN' },
      changes: {
        files: data.changes?.summary?.totalFiles || 0,
        methods: data.changes?.summary?.totalMethods || 0
      },
      risks: {
        high: data.risks?.highRisk?.length || 0,
        medium: data.risks?.mediumRisk?.length || 0,
        low: data.risks?.lowRisk?.length || 0
      },
      rollbacks: {
        detected: data.rollbackDetection?.filter(r => r.rollbackDetected)?.length || 0,
        total: data.rollbackDetection?.length || 0
      }
    };
  }

  // 趋势分析报告
  async generateTrendReport(trends) {
    console.log('📈 生成风险趋势报告...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `trend-report-${timestamp}.html`;
    const filePath = path.join(this.outputDir, fileName);
    
    const html = this.buildTrendHTML(trends);
    fs.writeFileSync(filePath, html, 'utf-8');
    
    console.log(`✅ 趋势报告已生成: ${filePath}`);
    return filePath;
  }

  buildTrendHTML(trends) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>风险趋势分析</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>${this.getHTMLStyles()}</style>
</head>
<body>
    <div class="container">
        <h1>📈 风险趋势分析</h1>
        <canvas id="trendChart" width="800" height="400"></canvas>
        <script>
            const ctx = document.getElementById('trendChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [${trends.map((_, i) => `'HEAD~${i}'`).join(', ')}],
                    datasets: [{
                        label: '风险评分',
                        data: [${trends.map(t => t.score).join(', ')}],
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 10
                        }
                    }
                }
            });
        </script>
    </div>
</body>
</html>`;
  }

  // 工具方法
  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  translateRiskType(type) {
    const translations = {
      'COVERAGE_GAP': '测试覆盖空洞',
      'HIGH_COUPLING': '高耦合风险',
      'CROSS_MODULE_DEPENDENCY': '跨模块依赖',
      'UNHANDLED_EXCEPTIONS': '未处理异常',
      'DEEP_NESTING': '深度嵌套',
      'HIGH_COMPLEXITY': '高复杂度',
      'SENSITIVE_API_USAGE': '敏感API使用',
      'CONCURRENT_MODIFICATION': '并发修改风险',
      'NULL_POINTER_RISK': '空指针风险',
      'RACE_CONDITION': '竞态条件',
      'DEADLOCK_RISK': '死锁风险'
    };
    
    return translations[type] || type;
  }

  translateDimension(dimension) {
    const translations = {
      'coverage': '测试覆盖',
      'coupling': '耦合度',
      'callDepth': '调用深度',
      'sensitiveAPI': '敏感API',
      'commitFreq': '提交频率',
      'complexity': '复杂度'
    };
    
    return translations[dimension] || dimension;
  }

  translateAction(action) {
    const translations = {
      'BLOCK_RELEASE': '🚫 阻止发布',
      'REQUIRE_REVIEW': '🔍 需要Review',
      'ENHANCE_TESTING': '🧪 增强测试',
      'PROCEED': '✅ 可以发布'
    };
    
    return translations[action] || action;
  }

  translateDeletionReason(reason) {
    const translations = {
      'refactor': '代码重构',
      'removal': '功能删除',
      'merge': '代码合并',
      'cleanup': '代码清理',
      'revert': '提交回滚',
      'unknown': '未知原因'
    };
    
    return translations[reason] || reason;
  }

  getActionIcon(action) {
    const icons = {
      'BLOCK_RELEASE': '🚫',
      'REQUIRE_REVIEW': '🔍',
      'ENHANCE_TESTING': '🧪',
      'PROCEED': '✅'
    };
    
    return icons[action] || '❓';
  }

  getHTMLStyles() {
    return `
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .report-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .report-header h1 { margin: 0; font-size: 2.5em; }
        .report-meta { margin-top: 15px; opacity: 0.9; }
        .report-meta span { margin-right: 20px; }
        
        .summary-section, .rollback-section, .risk-section, .score-section, .recommendations-section, .details-section { padding: 30px; border-bottom: 1px solid #eee; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .summary-card.high { border-left-color: #dc3545; }
        .summary-card.medium { border-left-color: #ffc107; }
        .summary-card.low { border-left-color: #28a745; }
        .summary-card h3 { margin: 0 0 10px 0; color: #666; font-size: 0.9em; text-transform: uppercase; }
        .summary-card .count, .summary-card .score { font-size: 2.5em; font-weight: bold; color: #333; margin: 10px 0; }
        .summary-card .detail, .summary-card .level { color: #666; font-size: 0.9em; }

        .rollback-section { background: #fef2f2; }
        .alert { padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .alert-danger { background: #fee; border: 1px solid #fcc; color: #c33; }
        .alert-success { background: #efe; border: 1px solid #cfc; color: #3c3; }
        .rollback-card { background: white; border: 1px solid #fcc; border-radius: 8px; padding: 20px; margin-bottom: 15px; }
        .rollback-header h4 { margin: 0; color: #c33; }
        .file-path { background: #f1f3f4; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
        .deletion-info { margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 4px; }
        .commit-info { margin-bottom: 10px; }
        .commit-hash { background: #333; color: white; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
        .rollback-suggestions h5 { margin: 15px 0 10px 0; color: #333; }
        .suggestion.high { color: #c33; font-weight: bold; }
        .recovery-commands { margin-top: 15px; }
        .recovery-commands code { display: block; background: #f1f3f4; padding: 8px; border-radius: 4px; font-family: monospace; margin: 5px 0; }

        .risk-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .risk-column { background: #f8f9fa; padding: 20px; border-radius: 8px; }
        .risk-column.high-risk { border-left: 4px solid #dc3545; }
        .risk-column.medium-risk { border-left: 4px solid #ffc107; }
        .risk-column.low-risk { border-left: 4px solid #28a745; }
        .risk-list { list-style: none; padding: 0; }
        .risk-item { padding: 10px; border-bottom: 1px solid #eee; }
        .risk-title { font-weight: bold; color: #333; }
        .risk-description { color: #666; font-size: 0.9em; margin: 5px 0; }
        .risk-method { color: #007bff; font-size: 0.8em; font-family: monospace; }

        .dimensions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .dimension-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .dimension-score { font-size: 1.8em; font-weight: bold; color: #007bff; }
        .score-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .score-table th, .score-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        .score-table th { background: #f8f9fa; font-weight: bold; }
        .score-row.high { background: #fef2f2; }
        .score-row.medium { background: #fefcf0; }
        .score-row.low { background: #f0f9f0; }
        .level-badge { padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; }
        .level-badge.high { background: #dc3545; color: white; }
        .level-badge.medium { background: #ffc107; color: black; }
        .level-badge.low { background: #28a745; color: white; }

        .rollback-recommendation { padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .rollback-recommendation.critical { background: #fef2f2; border: 2px solid #dc3545; }
        .rollback-recommendation.high { background: #fefcf0; border: 2px solid #ffc107; }
        .rollback-recommendation.medium { background: #f0f9f0; border: 2px solid #28a745; }
        .rollback-recommendation.low { background: #f8f9fa; border: 2px solid #6c757d; }
        .strategy-card { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px; }
        .strategy-card.high { border-left: 4px solid #dc3545; }

        .details-card { background: #f8f9fa; border-radius: 8px; margin-bottom: 15px; }
        .details-card summary { padding: 15px; cursor: pointer; font-weight: bold; }
        .details-card ul { padding: 0 15px 15px 35px; }
        .file-stats, .method-type, .method-file { font-size: 0.8em; color: #666; margin-left: 10px; }

        .report-footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; border-radius: 0 0 8px 8px; }

        @media (max-width: 768px) {
            .container { margin: 10px; }
            .summary-grid, .risk-grid, .dimensions-grid { grid-template-columns: 1fr; }
            .report-header { padding: 20px; }
            .report-header h1 { font-size: 2em; }
        }
    `;
  }

  getHTMLScripts() {
    return `
        function toggleDetails(element) {
            const content = element.nextElementSibling;
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
        }
        
        // 添加交互功能
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DiffSense 回归分析报告已加载');
        });
    `;
  }
}

module.exports = ReportGenerator; 