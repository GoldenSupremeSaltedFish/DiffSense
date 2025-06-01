package com.org.gitimpact.report;

import java.io.BufferedWriter;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.org.gitimpact.suggest.TestSuggester;
import com.org.gitimpact.ast.DiffToASTMapper.ImpactedMethod;

public class Reporter {
    private final ReportModel report;

    public Reporter(ReportModel report) {
        this.report = report;
    }

    public void writeJsonReport(String outputPath) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);
        
        // 使用 UTF-8 编码写入 JSON 文件
        try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(
                new FileOutputStream(outputPath), StandardCharsets.UTF_8))) {
            mapper.writeValue(writer, report);
        }
    }

    public void writeMarkdownReport(String outputPath) throws IOException {
        // 使用 UTF-8 编码写入 Markdown 文件
        try (PrintWriter writer = new PrintWriter(new OutputStreamWriter(
                new FileOutputStream(outputPath), StandardCharsets.UTF_8))) {
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
            for (TestSuggester.TestSuggestion suggestion : report.getSuggestedTests()) {
                writer.printf("### %s\n", suggestion.testClassName);
                for (String testMethod : suggestion.testMethods) {
                    writer.printf("- `%s`\n", testMethod);
                }
                writer.println();
            }
        }
    }
} 