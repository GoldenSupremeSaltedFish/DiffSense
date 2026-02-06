#!/usr/bin/env node

/**
 * DiffSense Merge Impact Analyzer
 *
 * 用法:
 *   node mergeImpact.js <baseCommit> [headCommit]
 *
 * headCommit 可省略，默认使用工作区当前状态。
 * 脚本会对比两个版本的前端组件快照，并输出变动 JSON 列表。
 */

const cp = require('child_process');
const execSync = (cmd, options) => {
  return cp.execSync(cmd, {
    maxBuffer: 1024 * 1024 * 50, // 50MB
    ...options
  });
};
const path = require('path');
const fs = require('fs');
const os = require('os');
const { extractSnapshotsForFile } = require('./snapshotExtractors');
const { diffSnapshots } = require('./snapshotDiff');

/** 获取仓库根目录 */
function getRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch (err) {
    console.error('⚠️  无法定位 git 仓库根目录，请确认当前目录在仓库内。');
    process.exit(1);
  }
}

/**
 * 获取指定 commit 对某文件的内容
 * @returns {string|null} 文件内容或 null（文件不存在）
 */
function getFileContentAtCommit(commit, filePath) {
  if (commit === 'WORKTREE') {
    // 读取工作区文件
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      return null;
    }
  }
  try {
    return execSync(`git show ${commit}:${filePath}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch (err) {
    return null; // 文件在该 commit 不存在
  }
}

/**
 * 列出 base 与 head 之间变动的文件集合
 */
function listChangedFiles(base, head) {
  const diffRange = head === 'WORKTREE' ? `${base}` : `${base} ${head}`;
  const cmd = head === 'WORKTREE'
    ? `git diff --name-only ${diffRange}`
    : `git diff --name-only ${diffRange}`; // 同命令，分开写便于理解
  const output = execSync(cmd, { encoding: 'utf-8' });
  return output.split(/\r?\n/).filter(Boolean);
}

const SUPPORTED_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.vue'];

/**
 * 提取某 commit 的组件快照（仅处理给定文件数组，若 content 为 null 跳过）
 */
function getSnapshotsAtCommit(commit, files, repoRoot) {
  const snapshots = [];
  files.forEach(file => {
    if (!SUPPORTED_EXTS.includes(path.extname(file))) return;
    const content = getFileContentAtCommit(commit, file);
    if (content == null) return;
    const absPath = path.join(repoRoot, file);
    const snaps = extractSnapshotsForFile(absPath, content);
    if (snaps && snaps.length) snapshots.push(...snaps);
  });
  return snapshots;
}

/**
 * 主函数：对比两个 commit 的快照差异
 */
function analyzeMergeImpact(baseCommit, headCommit = 'WORKTREE') {
  const repoRoot = getRepoRoot();

  console.error(`🔍 仓库根目录: ${repoRoot}`);
  console.error(`📌 Base Commit: ${baseCommit}`);
  console.error(`📌 Head Commit: ${headCommit === 'WORKTREE' ? '工作区' : headCommit}`);

  const changedFiles = listChangedFiles(baseCommit, headCommit);
  console.error(`📄 变动文件数: ${changedFiles.length}`);

  const baseSnapshots = getSnapshotsAtCommit(baseCommit, changedFiles, repoRoot);
  const headSnapshots = getSnapshotsAtCommit(headCommit, changedFiles, repoRoot);

  const changes = diffSnapshots(baseSnapshots, headSnapshots);
  return { changes, baseSnapshotsCount: baseSnapshots.length, headSnapshotsCount: headSnapshots.length };
}

/** CLI 入口 */
if (require.main === module) {
  const [,, base, head] = process.argv;
  if (!base) {
    console.error('用法: node mergeImpact.js <baseCommit> [headCommit]');
    process.exit(1);
  }

  try {
    const result = analyzeMergeImpact(base, head || 'WORKTREE');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('❌ 分析失败:', err.message);
    process.exit(1);
  }
}

module.exports = { analyzeMergeImpact }; 