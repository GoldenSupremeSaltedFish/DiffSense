package com.yourorg.gitimpact.cli;

import picocli.CommandLine;

/**
 * GitImpact CLI应用程序的主入口点
 */
public class Main {
    public static void main(String[] args) {
        // 创建CommandLine实例，绑定InspectCommand
        CommandLine commandLine = new CommandLine(new InspectCommand());
        
        // 执行命令并获取退出代码
        int exitCode = commandLine.execute(args);
        
        // 使用退出代码退出程序
        System.exit(exitCode);
    }
} 