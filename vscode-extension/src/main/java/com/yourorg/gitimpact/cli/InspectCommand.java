package com.yourorg.gitimpact.cli;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Callable;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.yourorg.gitimpact.inspect.BranchMonitor;
import com.yourorg.gitimpact.inspect.CommitImpact;
import com.yourorg.gitimpact.inspect.InspectConfig;
import com.yourorg.gitimpact.report.HtmlReportGenerator;

import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

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
        description = "输出报告的路径（可选，如果指定则生成HTML文件）",
        required = false
    )
    private Path reportPath;

    @Option(
        names = {"--output"},
        description = "输出格式: json|html（默认: json）",
        required = false
    )
    private String outputFormat = "json";

    @Option(
        names = {"--depth"},
        description = "分析调用链的最大深度（默认: 10）",
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
            .depth(depth != null ? depth : 10)
            .build();

        // 执行分析
        BranchMonitor monitor = new BranchMonitor(config, Path.of("."));
        List<CommitImpact> impacts = monitor.analyzeBranch();

        // 根据输出格式处理结果
        if ("html".equalsIgnoreCase(outputFormat) && reportPath != null) {
            // 生成HTML报告文件
            HtmlReportGenerator generator = new HtmlReportGenerator();
            generator.generateReport(impacts, reportPath);
            System.err.println("分析完成，HTML报告已生成: " + reportPath);
        } else {
            // 输出JSON到stdout
            ObjectMapper mapper = new ObjectMapper();
            mapper.registerModule(new JavaTimeModule());
            String jsonOutput = mapper.writeValueAsString(impacts);
            System.out.println(jsonOutput);
            System.err.println("分析完成，发现 " + impacts.size() + " 个提交");
        }

        return 0;
    }
} 