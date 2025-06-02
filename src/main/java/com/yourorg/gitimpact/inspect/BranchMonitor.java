package com.yourorg.gitimpact.inspect;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourorg.gitimpact.ast.DiffToASTMapper;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

public class BranchMonitor {
    private static final Logger logger = LoggerFactory.getLogger(BranchMonitor.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();
    
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
            results.sort((a, b) -> b.timestamp.compareTo(a.timestamp));
            
            return results;
        } finally {
            executor.shutdown();
        }
    }

    private List<RevCommit> getCommitsToAnalyze(Git git) throws Exception {
        // 获取指定分支的提交
        Iterable<RevCommit> commits = git.log()
            .add(git.getRepository().resolve(config.getBranch()))
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
        
        return filteredCommits;
    }

    private Future<CommitImpact> analyzeCommitAsync(RevCommit commit, Git git) {
        return executor.submit(() -> {
            Path cacheFile = getCacheFilePath(commit);
            
            // 检查缓存
            if (Files.exists(cacheFile)) {
                return objectMapper.readValue(cacheFile.toFile(), CommitImpact.class);
            }
            
            // 分析提交
            DiffToASTMapper diffMapper = new DiffToASTMapper(git.getRepository());
            List<DiffToASTMapper.ImpactedMethod> changedMethods = diffMapper.mapDiffToMethods(
                commit.getParent(0),
                commit
            );
            
            List<Path> changedFiles = changedMethods.stream()
                .map(m -> Path.of(m.filePath))
                .distinct()
                .collect(Collectors.toList());
            
            // 执行分析
            CommitImpact impact = commitAnalyzer.analyzeCommit(commit, changedFiles, changedMethods);
            
            // 缓存结果
            objectMapper.writeValue(cacheFile.toFile(), impact);
            
            return impact;
        });
    }

    private Path getCacheFilePath(RevCommit commit) {
        return config.getCacheDir()
            .resolve(commit.getName().substring(0, 7))
            .resolve("impact.json");
    }
} 