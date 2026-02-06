package com.yourorg.gitimpact.cli;

import java.util.concurrent.Callable;

import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

/**
 * 调用图分析命令
 */
@Command(
    name = "callgraph",
    description = "生成和分析调用图",
    mixinStandardHelpOptions = true
)
public class CallGraphCommand implements Callable<Integer> {
    
    @Option(names = {"--lang"}, description = "目标语言", required = true)
    private String language;
    
    @Option(names = {"--repo"}, description = "仓库路径", defaultValue = ".")
    private String repoPath;
    
    @Option(names = {"--max-depth"}, description = "最大深度", defaultValue = "10")
    private Integer maxDepth;
    
    @Option(names = {"--format"}, description = "输出格式", defaultValue = "json")
    private String format;
    
    @Override
    public Integer call() throws Exception {
        System.err.println("📊 调用图分析命令执行中...");
        
        // 委托给相应的分析器
        ProcessBuilder pb = new ProcessBuilder("node", "ui/cli-adapter.js", "callgraph",
            "--lang", language, "--repo", repoPath, 
            "--max-depth", maxDepth.toString(), "--format", format);
        pb.inheritIO();
        Process process = pb.start();
        return process.waitFor();
    }
} 