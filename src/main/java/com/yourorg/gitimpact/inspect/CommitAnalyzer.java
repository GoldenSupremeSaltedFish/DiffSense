package com.yourorg.gitimpact.inspect;

import com.yourorg.gitimpact.impact.ImpactAnalyzer;
import com.yourorg.gitimpact.config.AnalysisConfig;
import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.revwalk.RevCommit;

import java.nio.file.Path;
import java.util.*;

public class CommitAnalyzer {
    private final Path projectRoot;
    private final AnalysisConfig analysisConfig;

    public CommitAnalyzer(Path projectRoot, int depth) {
        this.projectRoot = projectRoot;
        this.analysisConfig = AnalysisConfig.builder()
            .maxDepth(depth)
            .build();
    }

    /**
     * 分析单个提交的影响
     */
    public CommitImpact analyzeCommit(RevCommit commit, List<Path> changedFiles, List<ImpactedMethod> changedMethods) {
        // 初始化影响分析器
        ImpactAnalyzer analyzer = new ImpactAnalyzer(changedFiles, projectRoot, analysisConfig);
        
        try {
            analyzer.buildCallGraph();
            
            // 获取影响的方法
            Set<String> impactedMethods = analyzer.findImpactedMethods(changedMethods);
            
            // 获取影响的测试
            Map<String, Set<String>> impactedTests = analyzer.findImpactedTests(changedMethods);
            
            // 计算风险分数
            int riskScore = calculateRiskScore(changedFiles, changedMethods, impactedMethods, impactedTests);
            
            return new CommitImpact(
                commit.getName(),
                commit.getFullMessage(),
                getAuthorInfo(commit.getAuthorIdent()),
                commit.getAuthorIdent().getWhen().toInstant(),
                changedFiles.size(),
                changedMethods.size(),
                impactedMethods,
                impactedTests,
                riskScore
            );
        } catch (Exception e) {
            throw new RuntimeException("分析提交时发生错误: " + commit.getName(), e);
        }
    }

    private AuthorInfo getAuthorInfo(PersonIdent author) {
        return new AuthorInfo(
            author.getName(),
            author.getEmailAddress()
        );
    }

    private int calculateRiskScore(
        List<Path> changedFiles,
        List<ImpactedMethod> changedMethods,
        Set<String> impactedMethods,
        Map<String, Set<String>> impactedTests
    ) {
        int score = 0;
        
        // 1. 文件变更数量（每个文件 1 分）
        score += changedFiles.size();
        
        // 2. 方法变更数量（每个方法 2 分）
        score += changedMethods.size() * 2;
        
        // 3. 影响范围（每个受影响方法 3 分）
        score += impactedMethods.size() * 3;
        
        // 4. 无测试覆盖（如果没有影响测试，加 10 分）
        if (impactedTests.isEmpty()) {
            score += 10;
        }
        
        // 5. 公共工具类改动（如果改动包含 util、common 等，加 5 分）
        boolean hasUtilChanges = changedFiles.stream()
            .anyMatch(f -> f.toString().toLowerCase().contains("util") ||
                         f.toString().toLowerCase().contains("common"));
        if (hasUtilChanges) {
            score += 5;
        }
        
        return score;
    }
}

public class CommitImpact {
    @JsonProperty("commitId")
    private final String commitId;
    
    @JsonProperty("message")
    private final String message;
    
    @JsonProperty("author")
    private final AuthorInfo author;
    
    @JsonProperty("timestamp")
    private final Instant timestamp;
    
    @JsonProperty("changedFilesCount")
    private final int changedFilesCount;
    
    @JsonProperty("changedMethodsCount")
    private final int changedMethodsCount;
    
    @JsonProperty("impactedMethods")
    private final Set<String> impactedMethods;
    
    @JsonProperty("impactedTests")
    private final Map<String, Set<String>> impactedTests;
    
    @JsonProperty("riskScore")
    private final int riskScore;

    public CommitImpact(
        String commitId,
        String message,
        AuthorInfo author,
        Instant timestamp,
        int changedFilesCount,
        int changedMethodsCount,
        Set<String> impactedMethods,
        Map<String, Set<String>> impactedTests,
        int riskScore
    ) {
        this.commitId = commitId;
        this.message = message;
        this.author = author;
        this.timestamp = timestamp;
        this.changedFilesCount = changedFilesCount;
        this.changedMethodsCount = changedMethodsCount;
        this.impactedMethods = impactedMethods;
        this.impactedTests = impactedTests;
        this.riskScore = riskScore;
    }

    // Getters
    public String getCommitId() { return commitId; }
    public String getMessage() { return message; }
    public AuthorInfo getAuthor() { return author; }
    public Instant getTimestamp() { return timestamp; }
    public int getChangedFilesCount() { return changedFilesCount; }
    public int getChangedMethodsCount() { return changedMethodsCount; }
    public Set<String> getImpactedMethods() { return impactedMethods; }
    public Map<String, Set<String>> getImpactedTests() { return impactedTests; }
    public int getRiskScore() { return riskScore; }
}

public class AuthorInfo {
    @JsonProperty("name")
    private final String name;
    
    @JsonProperty("email")
    private final String email;

    public AuthorInfo(String name, String email) {
        this.name = name;
        this.email = email;
    }

    public String getName() { return name; }
    public String getEmail() { return email; }
} 