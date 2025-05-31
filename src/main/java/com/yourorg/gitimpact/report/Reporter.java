package com.yourorg.gitimpact.report;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;
import com.yourorg.gitimpact.suggest.TestSuggester.TestSuggestion;

public class Reporter {
    private final ReportModel report;

    public Reporter(ReportModel report) {
        this.report = report;
    }

    public void writeJsonReport(String outputPath) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);
        mapper.writeValue(new File(outputPath), report);
    }

    public void writeMarkdownReport(String outputPath) throws IOException {
        try (PrintWriter writer = new PrintWriter(new FileWriter(outputPath))) {
            writer.println("# 代码变更影响分析报告\n");

            // 直接影响的方法
            writer.println("## 直接修改的方法\n");
            for (ImpactedMethod method : report.getDirectlyImpactedMethods()) {
                writer.printf("- `%s.%s` (%s)\n", 
                    method.className, method.methodName, method.filePath);
            }
            writer.println();

            // 间接影响的方法
            writer.println("## 间接影响的方法\n");
            for (String method : report.getIndirectlyImpactedMethods()) {
                writer.printf("- `%s`\n", method);
            }
            writer.println();

            // 建议的测试
            writer.println("## 建议运行的测试\n");
            for (TestSuggestion suggestion : report.getSuggestedTests()) {
                writer.printf("### %s\n", suggestion.testClassName);
                for (String testMethod : suggestion.testMethods) {
                    writer.printf("- `%s`\n", testMethod);
                }
                writer.println();
            }
        }
    }
} 