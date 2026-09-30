package com.yourorg.gitimpact.cli;

import picocli.CommandLine;
import picocli.CommandLine.Command;
import picocli.CommandLine.HelpCommand;

/**
 * DiffSense 统一CLI主入口点
 * 支持多种分析命令和跨语言代码分析
 */
@Command(
    name = "diffsense-cli",
    description = "DiffSense 统一代码分析工具",
    mixinStandardHelpOptions = true,
    version = "1.0.0",
    subcommands = {
        HelpCommand.class,
        AnalyzeCommand.class,
        EnhancedAnalyzeCommand.class,
        ImpactedCommand.class,
        CallGraphCommand.class,
        RecommendTestsCommand.class,
        SpringAnalyzeCommand.class,
        CacheCommand.class,
        LangSupportCommand.class
    }
)
public class UnifiedCliMain {
    
    public static void main(String[] args) {
        int exitCode = new CommandLine(new UnifiedCliMain()).execute(args);
        System.exit(exitCode);
    }
} 