package com.org.gitimpact.cli;

import java.util.List;

import com.org.gitimpact.git.GitDiffAnalyzer;
import com.org.gitimpact.git.GitService;
import com.org.gitimpact.impact.ImpactAnalyzer;
import com.org.gitimpact.report.ReportModel;
import com.org.gitimpact.report.Reporter;
import com.org.gitimpact.suggest.TestSuggester;
import com.org.gitimpact.ast.DiffToASTMapper;

import picocli.CommandLine;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

@Command(
    name = "gitimpact",
    mixinStandardHelpOptions = true,
    version = "1.0",
    description = "分析 Git 代码变更影响范围的工具"
)
public class Main implements Runnable {
    @Option(names = {"-r", "--repo"}, description = "Git 仓库路径", required = true)
    private String repoPath;

    @Option(names = {"-b", "--base"}, description = "基准 commit/tag", required = true)
    private String baseRef;

    @Option(names = {"-t", "--target"}, description = "目标 commit/tag", required = true)
    private String targetRef;

    @Option(names = {"-f", "--format"}, description = "输出格式 (json/markdown)", defaultValue = "markdown")
    private String outputFormat;

    @Option(names = {"-o", "--output"}, description = "输出文件路径", required = true)
    private String outputPath;

    @Override
    public void run() {
        try {
            // 1. 分析 Git 差异
            GitService gitService = new GitService(repoPath);
            GitDiffAnalyzer diffAnalyzer = new GitDiffAnalyzer(gitService);
            List<GitDiffAnalyzer.DiffResult> diffResults = diffAnalyzer.analyzeDiff(baseRef, targetRef);

            // 2. 映射差异到 AST 节点
            DiffToASTMapper astMapper = new DiffToASTMapper(repoPath);
            List<DiffToASTMapper.ImpactedMethod> impactedMethods = astMapper.mapDiffToMethods(diffResults);

            // 3. 分析影响范围
            ImpactAnalyzer impactAnalyzer = new ImpactAnalyzer(repoPath);
            impactAnalyzer.buildCallGraph();
            var indirectlyImpactedMethods = impactAnalyzer.findImpactedMethods(impactedMethods);

            // 4. 寻找相关测试
            TestSuggester testSuggester = new TestSuggester(repoPath);
            testSuggester.scanTestClasses();
            var testSuggestions = testSuggester.suggestTests(indirectlyImpactedMethods);

            // 5. 生成报告
            ReportModel reportModel = new ReportModel(
                impactedMethods,
                indirectlyImpactedMethods,
                testSuggestions
            );
            
            Reporter reporter = new Reporter(reportModel);
            if ("json".equalsIgnoreCase(outputFormat)) {
                reporter.writeJsonReport(outputPath);
            } else {
                reporter.writeMarkdownReport(outputPath);
            }

            System.out.println("分析完成，报告已生成: " + outputPath);
            
        } catch (Exception e) {
            System.err.println("错误: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    public static void main(String[] args) {
        int exitCode = new CommandLine(new Main()).execute(args);
        System.exit(exitCode);
    }
} 