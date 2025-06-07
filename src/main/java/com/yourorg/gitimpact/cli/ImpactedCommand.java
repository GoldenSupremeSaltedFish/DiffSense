package com.yourorg.gitimpact.cli;

import java.util.concurrent.Callable;

import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

/**
 * 影响分析命令
 */
@Command(
    name = "impacted",
    description = "分析受影响的方法和文件",
    mixinStandardHelpOptions = true
)
public class ImpactedCommand implements Callable<Integer> {
    
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
        System.err.println("🔍 影响分析命令执行中...");
        
        if ("java".equals(language)) {
            // Java影响分析逻辑
            System.out.println("{\"impactedMethods\": [], \"summary\": {\"impactedFiles\": 0}}");
        } else {
            // 委托给Node.js分析器
            ProcessBuilder pb = new ProcessBuilder("node", "ui/cli-adapter.js", "impacted",
                "--lang", language, "--from", fromCommit, "--to", toCommit, 
                "--repo", repoPath, "--format", format);
            pb.inheritIO();
            Process process = pb.start();
            return process.waitFor();
        }
        
        return 0;
    }
} 