package com.yourorg.gitimpact.utils;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.Status;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.lib.Ref;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

/**
 * 安全的分支切换工具类
 * 采用临时分支方案，不污染用户工作区
 */
public class SafeBranchSwitcher {
    private static final Logger logger = LoggerFactory.getLogger(SafeBranchSwitcher.class);
    
    private final Repository repository;
    private final Git git;
    private String originalBranch;
    private String originalSha;
    private String temporaryBranch;
    private boolean isDetachedHead = false;
    
    public SafeBranchSwitcher(Repository repository) {
        this.repository = repository;
        this.git = new Git(repository);
    }
    
    /**
     * 安全地切换到目标分支并执行操作
     * @param targetBranch 目标分支名
     * @param operation 要执行的操作
     * @return 操作结果
     * @throws Exception 如果操作失败
     */
    public <T> T safeBranchOperation(String targetBranch, BranchOperation<T> operation) throws Exception {
        try {
            // 1. 保存当前环境
            saveCurrentEnvironment();
            
            // 2. 检查工作区是否干净
            checkCleanWorkingDirectory();
            
            // 3. 获取目标分支
            fetchAndCheckoutBranch(targetBranch);
            
            // 4. 执行操作
            return operation.execute();
            
        } finally {
            // 5. 恢复环境
            restoreEnvironment();
        }
    }
    
    /**
     * 保存当前分支环境
     */
    private void saveCurrentEnvironment() throws Exception {
        // 获取当前分支名
        String currentBranch = repository.getBranch();
        if ("HEAD".equals(currentBranch)) {
            // HEAD detached状态
            isDetachedHead = true;
            originalSha = repository.resolve("HEAD").getName();
            originalBranch = "HEAD";
            logger.info("当前处于detached HEAD状态，SHA: {}", originalSha);
        } else {
            // 正常分支状态
            isDetachedHead = false;
            originalBranch = currentBranch;
            originalSha = repository.resolve("HEAD").getName();
            logger.info("当前分支: {}, SHA: {}", originalBranch, originalSha);
        }
    }
    
    /**
     * 检查工作区是否干净
     */
    private void checkCleanWorkingDirectory() throws Exception {
        try {
            Status status = git.status().call();
            boolean hasUncommittedChanges = !status.isClean();
            
            if (hasUncommittedChanges) {
                String message = "工作区有未提交修改，请先提交或 stash 后再分析目标分支。";
                logger.error(message);
                throw new IllegalStateException(message);
            }
            
            logger.info("工作区干净，可以继续操作");
        } catch (Exception e) {
            logger.error("检查工作区状态时发生错误", e);
            throw new RuntimeException("无法检查工作区状态: " + e.getMessage(), e);
        }
    }
    
    /**
     * 获取并切换到目标分支
     */
    private void fetchAndCheckoutBranch(String targetBranch) throws Exception {
        // 1. 尝试获取远程分支
        try {
            logger.info("正在获取远程分支: origin/{}", targetBranch);
            git.fetch()
                .setRemote("origin")
                .setRefSpecs("+refs/heads/" + targetBranch + ":refs/remotes/origin/" + targetBranch)
                .setRemoveDeletedRefs(true)
                .setTimeout(30)
                .call();
            logger.info("成功获取远程分支: origin/{}", targetBranch);
        } catch (Exception e) {
            logger.error("获取远程分支失败: {}", e.getMessage());
            throw new RuntimeException("获取远程分支失败，请检查网络连接和分支名称是否正确: " + e.getMessage(), e);
        }
        
        // 2. 验证远程分支是否存在
        Ref remoteBranchRef = repository.findRef("refs/remotes/origin/" + targetBranch);
        if (remoteBranchRef == null) {
            String message = String.format("远程分支 origin/%s 不存在，请确认分支名称是否正确", targetBranch);
            logger.error(message);
            throw new IllegalArgumentException(message);
        }
        
        // 3. 创建临时分支并切换
        temporaryBranch = String.format("diffsense-temp-%s-%d", 
            targetBranch.replace("/", "-"), 
            System.currentTimeMillis());
        
        try {
            logger.info("创建临时分支: {} -> {}", temporaryBranch, remoteBranchRef.getObjectId().getName());
            git.checkout()
                .setCreateBranch(true)
                .setName(temporaryBranch)
                .setStartPoint(remoteBranchRef.getObjectId().getName())
                .call();
            
            logger.info("成功切换到临时分支: {}", temporaryBranch);
        } catch (Exception e) {
            logger.error("创建临时分支失败: {}", e.getMessage());
            throw new RuntimeException("创建临时分支失败: " + e.getMessage(), e);
        }
    }
    
    /**
     * 恢复原始环境
     */
    private void restoreEnvironment() {
        try {
            // 1. 切换回原始分支
            if (isDetachedHead) {
                logger.info("恢复到detached HEAD状态: {}", originalSha);
                git.checkout()
                    .setName(originalSha)
                    .call();
            } else {
                logger.info("切换回原始分支: {}", originalBranch);
                git.checkout()
                    .setName(originalBranch)
                    .call();
            }
            
            // 2. 删除临时分支
            if (temporaryBranch != null) {
                logger.info("删除临时分支: {}", temporaryBranch);
                try {
                    git.branchDelete()
                        .setBranchNames(temporaryBranch)
                        .setForce(true)
                        .call();
                    logger.info("成功删除临时分支: {}", temporaryBranch);
                } catch (Exception e) {
                    logger.warn("删除临时分支失败: {}", e.getMessage());
                }
            }
            
        } catch (Exception e) {
            logger.error("恢复环境失败: {}", e.getMessage(), e);
            // 给出手动恢复建议
            if (temporaryBranch != null) {
                logger.warn("请手动删除临时分支: git branch -D {}", temporaryBranch);
            }
            if (isDetachedHead && originalSha != null) {
                logger.warn("请手动恢复到detached HEAD状态: git checkout {}", originalSha);
            } else if (originalBranch != null) {
                logger.warn("请手动切换回原始分支: git checkout {}", originalBranch);
            }
        }
    }
    
    /**
     * 分支操作接口
     */
    @FunctionalInterface
    public interface BranchOperation<T> {
        T execute() throws Exception;
    }
}