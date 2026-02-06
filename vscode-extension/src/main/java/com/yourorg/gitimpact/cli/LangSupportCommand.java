package com.yourorg.gitimpact.cli;

import java.util.concurrent.Callable;

import picocli.CommandLine.Command;

/**
 * 语言支持信息命令
 */
@Command(
    name = "lang-support",
    description = "显示支持的编程语言信息",
    mixinStandardHelpOptions = true
)
public class LangSupportCommand implements Callable<Integer> {
    
    @Override
    public Integer call() throws Exception {
        showLanguageSupport();
        return 0;
    }
    
    private void showLanguageSupport() {
        System.out.println("DiffSense 支持的编程语言:\n");
        
        System.out.println("✅ Java       - 完整支持 (Spoon AST + JGit)");
        System.out.println("✅ Go         - 完整支持 (go/parser + go/types)");
        System.out.println("✅ TypeScript - 完整支持 (ts-morph + madge)");
        System.out.println("⚠️  JavaScript - 部分支持 (Babel parser)");
        System.out.println("⚠️  C++       - 基础支持 (ctags/clangd)\n");
        
        System.out.println("功能支持矩阵:");
        System.out.println("           | Java | Go | TS | JS | C++ |");
        System.out.println("-----------|------|----|----|----|----|");
        System.out.println("基础分析   |  ✅  | ✅ | ✅ | ✅ | ⚠️  |");
        System.out.println("调用图     |  ✅  | ✅ | ✅ | ⚠️  | ⚠️  |");
        System.out.println("测试推荐   |  ✅  | ✅ | ✅ | ❌ | ❌ |");
        System.out.println("回归分析   |  ✅  | ⚠️  | ⚠️  | ❌ | ❌ |\n");
        
        System.out.println("注: ✅ 完整支持, ⚠️ 部分支持, ❌ 不支持");
    }
} 