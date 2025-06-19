package com.yourorg.gitimpact.inspect;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.revwalk.RevCommit;

import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;
import com.yourorg.gitimpact.config.AnalysisConfig;
import com.yourorg.gitimpact.impact.ImpactAnalyzer;
import com.yourorg.gitimpact.classification.BackendChangeClassifier;

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
        
        // 初始化变更分类器
        BackendChangeClassifier classifier = new BackendChangeClassifier();
        
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
            
            // 使用分类器分析变更类型（替代风险分计算）
            List<BackendChangeClassifier.FileClassification> changeClassifications = 
                classifier.classifyChanges(changedFiles, changedMethods);
            
            // 生成分类摘要
            Map<String, Object> classificationSummary = classifier.generateClassificationSummary(changeClassifications);
            
            return new CommitImpact(
                commit.getName(),
                commit.getFullMessage(),
                getAuthorInfo(commit.getAuthorIdent()),
                commit.getAuthorIdent().getWhen().toInstant(),
                changedFiles.size(),
                changedMethods.size(),
                impactedMethods,
                impactedTests,
                changeClassifications,
                classificationSummary,
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
} 