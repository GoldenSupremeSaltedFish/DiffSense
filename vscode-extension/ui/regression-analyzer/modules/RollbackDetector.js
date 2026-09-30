/**
 * 功能回滚检测模块
 * 功能：精准定位功能是否被回滚（无还原）
 * 
 * 🎯 输入：文件路径 + 方法/组件名
 * 🚀 技术路径：
 *   1. 基于 git log -S 的字符串搜索
 *   2. 基于 git blame 定位删除责任人  
 *   3. AST Diff 精确方法结构比较
 */

const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class RollbackDetector {
  constructor(options = {}) {
    this.options = options;
    this.git = simpleGit(options.projectPath || process.cwd());
    this.projectPath = options.projectPath || process.cwd();
  }

  /**
   * 检测指定方法/组件的回滚情况
   * @param {Object} target - { filePath, methodName, codeSnippet? }
   * @returns {Object} 回滚检测结果
   */
  async detectRollback(target) {
    console.log(`🔍 检测功能回滚: ${target.methodName} in ${target.filePath}`);
    
    try {
      const results = {
        target: target,
        exists: false,
        rollbackDetected: false,
        deletionCommit: null,
        history: [],
        suggestions: []
      };

      // 1. 检查当前文件中是否存在目标方法
      results.exists = await this.checkMethodExists(target);
      
      // 2. 执行 git log -S 字符串搜索
      const logResults = await this.searchWithGitLogS(target);
      results.history = logResults;

      // 3. 如果方法不存在，尝试找到删除它的提交
      if (!results.exists && logResults.length > 0) {
        results.rollbackDetected = true;
        results.deletionCommit = await this.findDeletionCommit(target, logResults);
      }

      // 4. 使用 git blame 分析删除责任人
      if (results.rollbackDetected) {
        const blameInfo = await this.analyzeWithGitBlame(target, results.deletionCommit);
        results.deletionCommit = { ...results.deletionCommit, ...blameInfo };
      }

      // 5. AST Diff 分析（如果是支持的文件类型）
      if (this.supportsASTAnalysis(target.filePath)) {
        const astAnalysis = await this.performASTDiff(target, results.deletionCommit);
        results.astAnalysis = astAnalysis;
      }

      // 6. 生成建议
      results.suggestions = this.generateSuggestions(results);

      console.log(`✅ 回滚检测完成: ${results.rollbackDetected ? '发现回滚' : '未发现回滚'}`);
      return results;

    } catch (error) {
      throw new Error(`回滚检测失败: ${error.message}`);
    }
  }

  /**
   * 批量检测多个目标的回滚情况
   */
  async batchDetectRollbacks(targets) {
    console.log(`🔍 批量检测 ${targets.length} 个目标的回滚情况...`);
    
    const results = [];
    for (const target of targets) {
      try {
        const result = await this.detectRollback(target);
        results.push(result);
      } catch (error) {
        console.error(`❌ 检测失败 ${target.methodName}: ${error.message}`);
        results.push({
          target: target,
          error: error.message,
          rollbackDetected: false
        });
      }
    }

    return results;
  }

  /**
   * 检查方法是否在当前文件中存在
   */
  async checkMethodExists(target) {
    try {
      const filePath = path.join(this.projectPath, target.filePath);
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      
      // 基础字符串搜索
      if (content.includes(target.methodName)) {
        return true;
      }

      // 如果有代码片段，也检查代码片段
      if (target.codeSnippet && content.includes(target.codeSnippet)) {
        return true;
      }

      return false;
    } catch (error) {
      console.error(`检查方法存在性失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 使用 git log -S 搜索方法历史
   */
  async searchWithGitLogS(target) {
    try {
      const command = `git log -S "${target.methodName}" --pretty=format:"%H|%an|%ad|%s" --date=iso -- "${target.filePath}"`;
      const { stdout, stderr } = await execAsync(command, { cwd: this.projectPath });
      
      if (stderr && !stderr.includes('warning')) {
        console.warn(`Git log 警告: ${stderr}`);
      }

      const commits = [];
      if (stdout.trim()) {
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          const [hash, author, date, message] = line.split('|');
          commits.push({
            hash: hash,
            author: author,
            date: new Date(date),
            message: message,
            type: 'unknown' // 将在后续分析中确定是添加还是删除
          });
        }
      }

      // 分析每个提交是添加还是删除
      for (const commit of commits) {
        commit.type = await this.analyzeCommitType(target, commit.hash);
      }

      return commits.sort((a, b) => b.date - a.date); // 按时间倒序排列
    } catch (error) {
      console.error(`Git log -S 搜索失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 分析提交类型（添加/删除/修改）
   */
  async analyzeCommitType(target, commitHash) {
    try {
      // 获取该提交的diff
      const command = `git show --pretty="" --name-status ${commitHash} -- "${target.filePath}"`;
      const { stdout } = await execAsync(command, { cwd: this.projectPath });
      
      if (stdout.includes('D\t')) {
        return 'deleted_file';
      }
      if (stdout.includes('A\t')) {
        return 'added_file';
      }

      // 检查具体的代码变更
      const diffCommand = `git show ${commitHash} -- "${target.filePath}"`;
      const { stdout: diffOutput } = await execAsync(diffCommand, { cwd: this.projectPath });
      
      const addedLines = diffOutput.split('\n').filter(line => line.startsWith('+') && line.includes(target.methodName));
      const deletedLines = diffOutput.split('\n').filter(line => line.startsWith('-') && line.includes(target.methodName));
      
      if (deletedLines.length > addedLines.length) {
        return 'deleted';
      } else if (addedLines.length > deletedLines.length) {
        return 'added';
      } else {
        return 'modified';
      }
    } catch (error) {
      console.error(`分析提交类型失败: ${error.message}`);
      return 'unknown';
    }
  }

  /**
   * 找到删除该方法的提交
   */
  async findDeletionCommit(target, history) {
    // 找到最近的删除类型提交
    const deletionCommits = history.filter(commit => 
      commit.type === 'deleted' || commit.type === 'deleted_file'
    );

    if (deletionCommits.length > 0) {
      const latestDeletion = deletionCommits[0]; // 已按时间排序
      
      // 获取更详细的提交信息
      const detailedInfo = await this.getDetailedCommitInfo(latestDeletion.hash, target);
      
      return {
        ...latestDeletion,
        ...detailedInfo,
        reason: this.analyzeDeletionReason(latestDeletion.message)
      };
    }

    return null;
  }

  /**
   * 获取详细的提交信息
   */
  async getDetailedCommitInfo(commitHash, target) {
    try {
      // 获取提交详情
      const { stdout: commitInfo } = await execAsync(
        `git show --stat --pretty=fuller ${commitHash}`, 
        { cwd: this.projectPath }
      );

      // 获取具体的diff
      const { stdout: diffInfo } = await execAsync(
        `git show ${commitHash} -- "${target.filePath}"`, 
        { cwd: this.projectPath }
      );

      // 分析删除的代码行
      const deletedLines = diffInfo.split('\n')
        .filter(line => line.startsWith('-') && !line.startsWith('---'))
        .map(line => line.substring(1)); // 移除 '-' 前缀

      const targetMethodLines = deletedLines.filter(line => 
        line.includes(target.methodName)
      );

      return {
        commitInfo: commitInfo,
        deletedLines: targetMethodLines,
        deletedLinesCount: deletedLines.length,
        affectedFiles: this.extractAffectedFiles(commitInfo)
      };
    } catch (error) {
      console.error(`获取详细提交信息失败: ${error.message}`);
      return {};
    }
  }

  /**
   * 使用 git blame 分析删除责任人
   */
  async analyzeWithGitBlame(target, deletionCommit) {
    if (!deletionCommit) return {};

    try {
      // 获取删除前的版本进行blame分析
      const parentCommit = `${deletionCommit.hash}~1`;
      
      const command = `git blame -w --line-porcelain ${parentCommit} -- "${target.filePath}"`;
      const { stdout } = await execAsync(command, { cwd: this.projectPath });
      
      // 分析包含目标方法的行
      const lines = stdout.split('\n');
      const methodLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(target.methodName)) {
          // 找到对应的作者信息
          let j = i;
          while (j >= 0 && !lines[j].startsWith('author ')) {
            j--;
          }
          if (j >= 0) {
            const author = lines[j].replace('author ', '');
            methodLines.push({
              line: lines[i],
              author: author,
              originalCommit: lines[j-1] // 通常是commit hash
            });
          }
        }
      }

      return {
        originalAuthors: [...new Set(methodLines.map(l => l.author))],
        lastModifiedBy: methodLines.length > 0 ? methodLines[0].author : 'unknown',
        methodLines: methodLines.slice(0, 5) // 只保留前5行相关信息
      };
    } catch (error) {
      console.error(`Git blame 分析失败: ${error.message}`);
      return {};
    }
  }

  /**
   * 执行 AST Diff 分析
   */
  async performASTDiff(target, deletionCommit) {
    if (!deletionCommit) return null;

    try {
      const language = this.detectLanguage(target.filePath);
      
      if (!this.supportsASTAnalysis(target.filePath)) {
        return { error: '不支持该文件类型的AST分析' };
      }

      // 获取删除前后的文件内容
      const beforeContent = await this.getFileContentAtCommit(`${deletionCommit.hash}~1`, target.filePath);
      const afterContent = await this.getFileContentAtCommit(deletionCommit.hash, target.filePath);

      // 根据语言选择AST分析器
      const astAnalyzer = this.getASTAnalyzer(language);
      if (!astAnalyzer) {
        return { error: `不支持 ${language} 的AST分析` };
      }

      // 执行AST对比
      const beforeAST = await astAnalyzer.parse(beforeContent);
      const afterAST = await astAnalyzer.parse(afterContent);
      
      const diff = await astAnalyzer.diff(beforeAST, afterAST, target.methodName);

      return {
        language: language,
        beforeExists: beforeAST.hasMethod(target.methodName),
        afterExists: afterAST.hasMethod(target.methodName),
        structuralChanges: diff.changes,
        confidence: diff.confidence // 0-1，越高表示越确定是被删除
      };
    } catch (error) {
      console.error(`AST Diff 分析失败: ${error.message}`);
      return { error: error.message };
    }
  }

  /**
   * 生成建议和修复方案
   */
  generateSuggestions(results) {
    const suggestions = [];

    if (results.rollbackDetected) {
      suggestions.push({
        type: 'ROLLBACK_DETECTED',
        priority: 'HIGH',
        title: '🚨 检测到功能回滚',
        description: `方法 ${results.target.methodName} 在提交 ${results.deletionCommit?.hash?.substring(0, 7)} 中被删除`,
        actions: [
          '检查删除是否为意外操作',
          '如需恢复，可使用 git revert 或 cherry-pick',
          '联系相关开发人员确认删除原因'
        ]
      });

      if (results.deletionCommit) {
        suggestions.push({
          type: 'RECOVERY_OPTIONS',
          priority: 'MEDIUM',
          title: '🔧 恢复选项',
          description: '可以通过以下方式恢复被删除的功能',
          actions: [
            `git show ${results.deletionCommit.hash}:${results.target.filePath} > recovered_${path.basename(results.target.filePath)}`,
            `git checkout ${results.deletionCommit.hash}~1 -- ${results.target.filePath}`,
            '手动从历史版本中复制相关代码'
          ]
        });
      }
    } else if (!results.exists) {
      suggestions.push({
        type: 'METHOD_NOT_FOUND',
        priority: 'MEDIUM',
        title: '🔍 方法未找到',
        description: `在当前版本中未找到方法 ${results.target.methodName}`,
        actions: [
          '检查方法名是否正确',
          '确认文件路径是否正确',
          '检查是否被重命名'
        ]
      });
    } else {
      suggestions.push({
        type: 'METHOD_EXISTS',
        priority: 'LOW',
        title: '✅ 方法存在',
        description: `方法 ${results.target.methodName} 在当前版本中正常存在`,
        actions: []
      });
    }

    return suggestions;
  }

  // 辅助方法
  analyzeDeletionReason(commitMessage) {
    const reasons = {
      refactor: ['重构', 'refactor', 'restructure'],
      removal: ['删除', 'remove', 'delete'],
      merge: ['合并', 'merge', 'consolidate'],
      cleanup: ['清理', 'cleanup', 'clean up'],
      revert: ['回滚', 'revert', 'rollback']
    };

    for (const [type, keywords] of Object.entries(reasons)) {
      if (keywords.some(keyword => commitMessage.toLowerCase().includes(keyword))) {
        return type;
      }
    }

    return 'unknown';
  }

  extractAffectedFiles(commitInfo) {
    const lines = commitInfo.split('\n');
    const files = [];
    
    for (const line of lines) {
      if (line.includes('|') && (line.includes('+') || line.includes('-'))) {
        const fileName = line.split('|')[0].trim();
        if (fileName && !fileName.includes(' files changed')) {
          files.push(fileName);
        }
      }
    }
    
    return files;
  }

  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'javascript', 
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.java': 'java',
      '.go': 'go',
      '.py': 'python',
      '.rb': 'ruby',
      '.php': 'php'
    };
    
    return languageMap[ext] || 'unknown';
  }

  supportsASTAnalysis(filePath) {
    const supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.java', '.go'];
    const ext = path.extname(filePath).toLowerCase();
    return supportedExtensions.includes(ext);
  }

  getASTAnalyzer(language) {
    // 这里可以根据需要集成不同的AST分析器
    // 当前返回一个简化的模拟实现
    return {
      parse: async (content) => ({
        hasMethod: (methodName) => content.includes(methodName)
      }),
      diff: async (before, after, methodName) => ({
        changes: [],
        confidence: before.hasMethod(methodName) && !after.hasMethod(methodName) ? 0.9 : 0.1
      })
    };
  }

  async getFileContentAtCommit(commitHash, filePath) {
    try {
      const { stdout } = await execAsync(
        `git show ${commitHash}:"${filePath}"`, 
        { cwd: this.projectPath }
      );
      return stdout;
    } catch (error) {
      return '';
    }
  }

  /**
   * 从VSCode扩展获取目标信息
   */
  static parseVSCodeTarget(activeEditor, selection) {
    if (!activeEditor) {
      throw new Error('没有活动的编辑器');
    }

    const filePath = activeEditor.document.uri.fsPath;
    const selectedText = activeEditor.document.getText(selection);
    
    // 尝试提取方法名
    let methodName = selectedText.trim();
    
    // 如果选中的是完整方法，尝试提取方法名
    const functionMatch = selectedText.match(/(?:function\s+|const\s+|let\s+|var\s+)(\w+)|(\w+)\s*[=:]\s*(?:function|\(|async)/);
    if (functionMatch) {
      methodName = functionMatch[1] || functionMatch[2];
    }

    // 如果选中的是组件，尝试提取组件名
    const componentMatch = selectedText.match(/(?:function\s+|const\s+)(\w+)\s*\(/);
    if (componentMatch) {
      methodName = componentMatch[1];
    }

    return {
      filePath: path.relative(process.cwd(), filePath),
      methodName: methodName,
      codeSnippet: selectedText.length > 10 ? selectedText : null,
      line: selection ? selection.start.line + 1 : null
    };
  }
}

module.exports = RollbackDetector; 