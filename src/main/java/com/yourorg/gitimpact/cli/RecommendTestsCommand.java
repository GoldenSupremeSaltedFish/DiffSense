package com.yourorg.gitimpact.cli;

import java.util.concurrent.Callable;

import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

/**
 * 测试推荐命令
 */
@Command(
    name = "recommend-tests",
    description = "基于代码变更推荐需要运行的测试",
    mixinStandardHelpOptions = true
)
public class RecommendTestsCommand implements Callable<Integer> {
    
    @Option(names = {"--lang"}, description = "目标语言", required = true)
    private String language;
    
    @Option(names = {"--from"}, description = "起始提交", defaultValue = "HEAD~1")
    private String fromCommit;
    
    @Option(names = {"--to"}, description = "结束提交", defaultValue = "HEAD")
    private String toCommit;
    
    @Option(names = {"--repo"}, description = "仓库路径", defaultValue = ".")
    private String repoPath;
    
    @Option(names = {"--format"}, description = "输出格式", defaultValue = "json")
    private String format;
    
    @Override
    public Integer call() throws Exception {
        System.err.println("🧪 测试推荐命令执行中...");
        
        // 委托给相应的分析器
        ProcessBuilder pb = new ProcessBuilder("node", "ui/cli-adapter.js", "recommend-tests",
            "--lang", language, "--from", fromCommit, "--to", toCommit,
            "--repo", repoPath, "--format", format);
        pb.inheritIO();
        Process process = pb.start();
        return process.waitFor();
    }
}