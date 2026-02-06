package com.yourorg.gitimpact.inspect;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.revwalk.RevCommit;

import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;
import com.yourorg.gitimpact.classification.BackendChangeClassifier;
import com.yourorg.gitimpact.classification.GranularChangeAnalyzer;
import com.yourorg.gitimpact.config.AnalysisConfig;
import com.yourorg.gitimpact.impact.ImpactAnalyzer;

public class CommitAnalyzer {
    private final Path projectRoot;
    private final AnalysisConfig analysisConfig;
    private final boolean includeTypeTags;

    public CommitAnalyzer(Path projectRoot, int depth) {
        this(projectRoot, depth, false);
    }
    
    public CommitAnalyzer(Path projectRoot, int depth, boolean includeTypeTags) {
        this.projectRoot = projectRoot;
        this.analysisConfig = new AnalysisConfig();
        this.analysisConfig.setMaxDepth(depth);
        this.includeTypeTags = includeTypeTags;
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
            
            // 执行细粒度分析（仅在启用时）
            List<com.yourorg.gitimpact.classification.ModificationDetail> modifications = new ArrayList<>();
            if (includeTypeTags) {
                GranularChangeAnalyzer granularAnalyzer = new GranularChangeAnalyzer();
                
                // 为每个文件分析细粒度变更
                for (Path filePath : changedFiles) {
                    List<ImpactedMethod> fileMethods = changedMethods.stream()
                        .filter(method -> method.filePath != null && method.filePath.equals(filePath.toString()))
                        .collect(java.util.stream.Collectors.toList());
                    
                    // 这里暂时传入null作为diffContent，实际实现中需要获取真实的diff内容
                    List<com.yourorg.gitimpact.classification.ModificationDetail> fileModifications = 
                        granularAnalyzer.analyzeFileChanges(filePath, fileMethods, null);
                    modifications.addAll(fileModifications);
                }
            }
            
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
                testCoverageStats,
                modifications
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