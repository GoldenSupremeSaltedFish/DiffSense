package com.yourorg.gitimpact.cli;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
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

/**
 * 统一代码分析命令
 * 支持 Java/Go/TypeScript/C++ 代码分析
 */
@Command(
    name = "analyze",
    description = "代码分析 - 支持多种语言和分析模式",
    mixinStandardHelpOptions = true
)
public class AnalyzeCommand implements Callable<Integer> {
    
    @Option(
        names = {"--lang"},
        description = "目标语言: java|go|ts|cpp",
        required = true
    )
    private String language;
    
    @Option(
        names = {"--mode"},
        description = "分析模式: diff|full|hybrid (默认: diff)",
        defaultValue = "diff"
    )
    private String mode;
    
    @Option(
        names = {"--from"},
        description = "起始提交 (默认: HEAD~1)",
        defaultValue = "HEAD~1"
    )
    private String fromCommit;
    
    @Option(
        names = {"--to"},
        description = "结束提交 (默认: HEAD)",
        defaultValue = "HEAD"
    )
    private String toCommit;
    
    @Option(
        names = {"--repo"},
        description = "仓库路径 (默认: .)",
        defaultValue = "."
    )
    private String repoPath;
    
    @Option(
        names = {"--scope"},
        description = "分析范围 (包名或目录)"
    )
    private String scope;
    
    @Option(
        names = {"--max-depth"},
        description = "调用链最大深度 (默认: 10)",
        defaultValue = "10"
    )
    private Integer maxDepth;
    
    @Option(
        names = {"--max-files"},
        description = "最大处理文件数 (默认: 1000)",
        defaultValue = "1000"
    )
    private Integer maxFiles;
    
    @Option(
        names = {"--format"},
        description = "输出格式: json|html|markdown (默认: json)",
        defaultValue = "json"
    )
    private String format;
    
    @Option(
        names = {"--include-type-tags"},
        description = "是否包含细粒度修改类型标签 (默认: false)",
        defaultValue = "false"
    )
    private boolean includeTypeTags;
    
    @Option(
        names = {"--output"},
        description = "输出文件路径"
    )
    private String outputFile;
    
    @Override
    public Integer call() throws Exception {
        // 验证语言支持
        if (!isLanguageSupported(language)) {
            System.err.println("错误: 不支持的语言 '" + language + "'");
            System.err.println("支持的语言: java, go, ts, cpp");
            return 1;
        }
        
        // 验证仓库路径
        Path repoDir = Paths.get(repoPath);
        if (!repoDir.toFile().exists()) {
            System.err.println("错误: 仓库路径不存在: " + repoPath);
            return 1;
        }
        
        try {
            switch (language.toLowerCase()) {
                case "java":
                    return analyzeJava();
                case "go":
                    return delegateToNodeAnalyzer();
                case "ts":
                    return delegateToNodeAnalyzer();
                case "cpp":
                    System.err.println("C++ 分析暂未实现");
                    return 1;
                default:
                    System.err.println("不支持的语言: " + language);
                    return 1;
            }
        } catch (Exception e) {
            System.err.println("分析失败: " + e.getMessage());
            return 1;
        }
    }
    
    /**
     * Java代码分析
     */
    private Integer analyzeJava() throws Exception {
        // 构建配置 - 适配现有的InspectCommand逻辑
        InspectConfig config = InspectConfig.builder()
            .branch("HEAD") // 使用当前分支
            .commits(1) // 分析最近1个提交
            .baseline(fromCommit)
            .reportPath(outputFile != null ? Paths.get(outputFile) : null)
            .depth(maxDepth)
            .includeTypeTags(includeTypeTags) // 添加细粒度分析参数
            .build();
        
        // 执行分析
        BranchMonitor monitor = new BranchMonitor(config, Paths.get(repoPath));
        List<CommitImpact> impacts = monitor.analyzeBranch();
        
        // 处理输出
        return outputResult(impacts);
    }
    
    /**
     * 委托给Node.js分析器处理非Java语言
     */
    private Integer delegateToNodeAnalyzer() throws Exception {
        ProcessBuilder pb = new ProcessBuilder();
        pb.command("node", 
            "ui/cli-adapter.js", 
            "analyze",
            "--lang", language,
            "--mode", mode,
            "--from", fromCommit,
            "--to", toCommit,
            "--repo", repoPath,
            "--max-depth", maxDepth.toString(),
            "--max-files", maxFiles.toString(),
            "--format", format
        );
        
        if (outputFile != null) {
            pb.command().add("--output");
            pb.command().add(outputFile);
        }
        
        pb.inheritIO(); // 继承输入输出流
        Process process = pb.start();
        return process.waitFor();
    }
    
    /**
     * 输出分析结果
     */
    private Integer outputResult(List<CommitImpact> impacts) throws IOException {
        if ("html".equalsIgnoreCase(format) && outputFile != null) {
            // 生成HTML报告
            HtmlReportGenerator generator = new HtmlReportGenerator();
            generator.generateReport(impacts, Paths.get(outputFile));
            System.err.println("分析完成，HTML报告已生成: " + outputFile);
        } else {
            // 输出JSON到stdout
            ObjectMapper mapper = new ObjectMapper();
            mapper.registerModule(new JavaTimeModule());
            
            // 构建统一输出格式
            UnifiedAnalysisResult result = new UnifiedAnalysisResult();
            result.setVersion("1.0.0");
            result.setTimestamp(java.time.Instant.now().toString());
            result.setLanguage("java");
            result.setMode(mode);
            result.setRepository(repoPath);
            result.setCommits(new UnifiedAnalysisResult.CommitRange(fromCommit, toCommit));
            result.setImpacts(impacts);
            
            String jsonOutput = mapper.writeValueAsString(result);
            
            if (outputFile != null) {
                java.nio.file.Files.write(Paths.get(outputFile), jsonOutput.getBytes());
                System.err.println("分析完成，结果已保存到: " + outputFile);
            } else {
                System.out.println(jsonOutput);
                System.err.println("分析完成，发现 " + impacts.size() + " 个提交影响");
            }
        }
        
        return 0;
    }
    
    /**
     * 检查语言是否支持
     */
    private boolean isLanguageSupported(String lang) {
        return List.of("java", "go", "ts", "js", "cpp").contains(lang.toLowerCase());
    }
    
    /**
     * 统一分析结果格式
     */
    public static class UnifiedAnalysisResult {
        private String version;
        private String timestamp;
        private String language;
        private String mode;
        private String repository;
        private CommitRange commits;
        private List<CommitImpact> impacts;
        
        // Getters and Setters
        public String getVersion() { return version; }
        public void setVersion(String version) { this.version = version; }
        
        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
        
        public String getLanguage() { return language; }
        public void setLanguage(String language) { this.language = language; }
        
        public String getMode() { return mode; }
        public void setMode(String mode) { this.mode = mode; }
        
        public String getRepository() { return repository; }
        public void setRepository(String repository) { this.repository = repository; }
        
        public CommitRange getCommits() { return commits; }
        public void setCommits(CommitRange commits) { this.commits = commits; }
        
        public List<CommitImpact> getImpacts() { return impacts; }
        public void setImpacts(List<CommitImpact> impacts) { this.impacts = impacts; }
        
        public static class CommitRange {
            private String from;
            private String to;
            
            public CommitRange() {}
            
            public CommitRange(String from, String to) {
                this.from = from;
                this.to = to;
            }
            
            public String getFrom() { return from; }
            public void setFrom(String from) { this.from = from; }
            
            public String getTo() { return to; }
            public void setTo(String to) { this.to = to; }
        }
    }
} 