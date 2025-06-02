package com.yourorg.gitimpact.cli;

import com.yourorg.gitimpact.inspect.BranchMonitor;
import com.yourorg.gitimpact.inspect.CommitImpact;
import com.yourorg.gitimpact.inspect.InspectConfig;
import com.yourorg.gitimpact.report.HtmlReportGenerator;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Callable;

@Command(
    name = "inspect",
    description = "分析分支上的提交趋势",
    mixinStandardHelpOptions = true
)
public class InspectCommand implements Callable<Integer> {
    @Option(
        names = {"--branch"},
        description = "要分析的分支名称",
        required = true
    )
    private String branch;

    @Option(
        names = {"--commits"},
        description = "分析最近的 N 个提交",
        required = false
    )
    private Integer commits;

    @Option(
        names = {"--since"},
        description = "分析从指定日期开始的提交 (格式: yyyy-MM-dd)",
        required = false
    )
    private LocalDate since;

    @Option(
        names = {"--baseline"},
        description = "用于对比的基准分支（默认: main）",
        required = false
    )
    private String baseline;

    @Option(
        names = {"--report"},
        description = "输出报告的路径",
        required = true
    )
    private Path reportPath;

    @Option(
        names = {"--depth"},
        description = "分析调用链的最大深度（默认: 5）",
        required = false
    )
    private Integer depth;

    @Override
    public Integer call() throws Exception {
        // 验证参数
        if (commits == null && since == null) {
            System.err.println("错误: 必须指定 --commits 或 --since 参数之一");
            return 1;
        }

        // 构建配置
        InspectConfig config = InspectConfig.builder()
            .branch(branch)
            .commits(commits)
            .since(since)
            .baseline(baseline)
            .reportPath(reportPath)
            .depth(depth != null ? depth : 5)
            .build();

        // 执行分析
        BranchMonitor monitor = new BranchMonitor(config, Path.of("."));
        List<CommitImpact> impacts = monitor.analyzeBranch();

        // 生成报告
        HtmlReportGenerator generator = new HtmlReportGenerator();
        generator.generateReport(impacts, reportPath);

        System.out.println("分析完成，报告已生成: " + reportPath);
        return 0;
    }
} 