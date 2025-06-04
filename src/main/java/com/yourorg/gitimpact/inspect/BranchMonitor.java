package com.yourorg.gitimpact.inspect;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.Collectors;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.yourorg.gitimpact.ast.DiffToASTMapper;

public class BranchMonitor {
    private static final Logger logger = LoggerFactory.getLogger(BranchMonitor.class);
    private static final ObjectMapper objectMapper;
    
    static {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }
    
    private final InspectConfig config;
    private final Path projectRoot;
    private final CommitAnalyzer commitAnalyzer;
    private final ExecutorService executor;

    public BranchMonitor(InspectConfig config, Path projectRoot) {
        this.config = config;
        this.projectRoot = projectRoot;
        this.commitAnalyzer = new CommitAnalyzer(projectRoot, config.getDepth());
        this.executor = Executors.newFixedThreadPool(
            Math.max(1, Runtime.getRuntime().availableProcessors() - 1)
        );
    }

    /**
     * 分析分支上的提交
     */
    public List<CommitImpact> analyzeBranch() throws Exception {
        // 确保缓存目录存在
        Files.createDirectories(config.getCacheDir());
        
        // 打开 Git 仓库
        Repository repository = new FileRepositoryBuilder()
            .setGitDir(projectRoot.resolve(".git").toFile())
            .build();
        
        try (Git git = new Git(repository)) {
            // 获取需要分析的提交
            List<RevCommit> commits = getCommitsToAnalyze(git);
            logger.info("找到 {} 个需要分析的提交", commits.size());
            
            // 并行分析每个提交
            List<Future<CommitImpact>> futures = new ArrayList<>();
            for (RevCommit commit : commits) {
                futures.add(analyzeCommitAsync(commit, git));
            }
            
            // 收集结果
            List<CommitImpact> results = new ArrayList<>();
            for (Future<CommitImpact> future : futures) {
                try {
                    results.add(future.get());
                } catch (Exception e) {
                    logger.error("分析提交时发生错误", e);
                }
            }
            
            // 按时间排序
            results.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));
            
            return results;
        } finally {
            executor.shutdown();
        }
    }

    private List<RevCommit> getCommitsToAnalyze(Git git) throws Exception {
        // 首先尝试解析分支引用
        String branchName = config.getBranch();
        org.eclipse.jgit.lib.ObjectId branchId = git.getRepository().resolve(branchName);
        
        // 如果直接解析失败，尝试添加refs/heads/前缀
        if (branchId == null) {
            branchId = git.getRepository().resolve("refs/heads/" + branchName);
        }
        
        // 如果仍然失败，尝试远程分支
        if (branchId == null) {
            branchId = git.getRepository().resolve("refs/remotes/origin/" + branchName);
        }
        
        // 如果所有尝试都失败，抛出有意义的错误
        if (branchId == null) {
            throw new IllegalArgumentException(
                String.format("无法找到分支 '%s'。请检查分支名称是否正确。", branchName)
            );
        }
        
        logger.info("分析分支: {} (ObjectId: {})", branchName, branchId.getName());
        
        // 获取指定分支的提交
        Iterable<RevCommit> commits = git.log()
            .add(branchId)
            .call();
        
        List<RevCommit> filteredCommits = new ArrayList<>();
        for (RevCommit commit : commits) {
            // 如果指定了提交数量限制
            if (config.getCommits() != null && filteredCommits.size() >= config.getCommits()) {
                break;
            }
            
            // 如果指定了日期限制
            if (config.getSince() != null) {
                LocalDate commitDate = commit.getAuthorIdent().getWhen().toInstant()
                    .atZone(ZoneId.systemDefault())
                    .toLocalDate();
                if (commitDate.isBefore(config.getSince())) {
                    break;
                }
            }
            
            filteredCommits.add(commit);
        }
        
        logger.info("找到 {} 个符合条件的提交", filteredCommits.size());
        return filteredCommits;
    }

    private Future<CommitImpact> analyzeCommitAsync(RevCommit commit, Git git) {
        return executor.submit(() -> {
            // 暂时禁用缓存，直接进行分析
            // Path cacheFile = getCacheFilePath(commit);
            
            // 检查缓存
            // if (Files.exists(cacheFile)) {
            //     return objectMapper.readValue(cacheFile.toFile(), CommitImpact.class);
            // }
            
            // 分析提交
            List<DiffToASTMapper.ImpactedMethod> changedMethods = new ArrayList<>();
            if (commit.getParentCount() > 0) {
                DiffToASTMapper diffMapper = new DiffToASTMapper(git.getRepository());
                changedMethods = diffMapper.mapDiffToMethods(
                    commit.getParent(0),
                    commit
                );
            }
            
            List<Path> changedFiles = changedMethods.stream()
                .map(m -> Path.of(m.filePath))
                .distinct()
                .collect(Collectors.toList());
            
            // 执行分析
            CommitImpact impact = commitAnalyzer.analyzeCommit(commit, changedFiles, changedMethods);
            
            // 暂时不缓存结果
            // Files.createDirectories(cacheFile.getParent());
            // objectMapper.writeValue(cacheFile.toFile(), impact);
            
            return impact;
        });
    }

    private Path getCacheFilePath(RevCommit commit) {
        return config.getCacheDir()
            .resolve(commit.getName().substring(0, 7))
            .resolve("impact.json");
    }
} 