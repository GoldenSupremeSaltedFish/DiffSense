package com.yourorg.gitimpact.inspect;

import com.yourorg.gitimpact.impact.ImpactAnalyzer;
import com.yourorg.gitimpact.config.AnalysisConfig;
import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.revwalk.RevCommit;

import java.nio.file.Path;
import java.time.Instant;
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
            
            // 分析测试覆盖漏洞
            List<Map<String, Object>> testCoverageGaps = analyzer.analyzeTestCoverageGaps(changedMethods);
            
            // 获取测试覆盖统计信息
            Map<String, Object> testCoverageStats = analyzer.getTestCoverageStatistics(changedMethods);
            
            // 计算风险分数（包含测试覆盖风险）
            int riskScore = calculateRiskScore(changedFiles, changedMethods, impactedMethods, impactedTests, testCoverageGaps);
            
            return new CommitImpact(
                commit.getName(),
                commit.getFullMessage(),
                getAuthorInfo(commit.getAuthorIdent()),
                commit.getAuthorIdent().getWhen().toInstant(),
                changedFiles.size(),
                changedMethods.size(),
                impactedMethods,
                impactedTests,
                riskScore,
                testCoverageGaps,
                testCoverageStats
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
        Map<String, Set<String>> impactedTests,
        List<Map<String, Object>> testCoverageGaps
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
        
        // 6. 测试覆盖风险评分
        if (testCoverageGaps != null && !testCoverageGaps.isEmpty()) {
            for (Map<String, Object> gap : testCoverageGaps) {
                String riskLevel = (String) gap.get("riskLevel");
                switch (riskLevel) {
                    case "HIGH":
                        score += 15; // 高风险测试漏洞
                        break;
                    case "MEDIUM":
                        score += 8;  // 中风险测试漏洞
                        break;
                    case "LOW":
                        score += 3;  // 低风险测试漏洞
                        break;
                }
            }
        }
        
        return score;
    }
} 