package com.yourorg.gitimpact.report;

import com.yourorg.gitimpact.inspect.CommitImpact;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class HtmlReportGenerator {
    private static final Logger logger = LoggerFactory.getLogger(HtmlReportGenerator.class);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public void generateReport(List<CommitImpact> impacts, Path outputPath) throws IOException {
        StringBuilder html = new StringBuilder();
        html.append(getHeader());
        
        // 添加概览面板
        html.append(generateOverviewPanel(impacts));
        
        // 添加风险改动列表
        html.append(generateRiskPanel(impacts));
        
        // 添加提交详情列表
        html.append(generateCommitList(impacts));
        
        html.append(getFooter());
        
        // 写入文件
        Files.writeString(outputPath, html.toString());
        logger.info("报告已生成: {}", outputPath);
    }

    private String generateOverviewPanel(List<CommitImpact> impacts) {
        int totalCommits = impacts.size();
        int totalChangedFiles = impacts.stream().mapToInt(i -> i.getChangedFilesCount()).sum();
        int totalChangedMethods = impacts.stream().mapToInt(i -> i.getChangedMethodsCount()).sum();
        double avgRiskScore = impacts.stream().mapToInt(i -> i.getRiskScore()).average().orElse(0.0);
        
        return String.format("""
            <div class="panel overview">
                <h2>概览</h2>
                <div class="stats">
                    <div class="stat-item">
                        <div class="stat-value">%d</div>
                        <div class="stat-label">提交数</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">%d</div>
                        <div class="stat-label">变更文件</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">%d</div>
                        <div class="stat-label">变更方法</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">%.1f</div>
                        <div class="stat-label">平均风险分</div>
                    </div>
                </div>
            </div>
            """,
            totalCommits, totalChangedFiles, totalChangedMethods, avgRiskScore
        );
    }

    private String generateRiskPanel(List<CommitImpact> impacts) {
        // 筛选高风险提交（风险分 > 20）
        List<CommitImpact> highRiskCommits = impacts.stream()
            .filter(i -> i.getRiskScore() > 20)
            .collect(Collectors.toList());
        
        StringBuilder html = new StringBuilder();
        html.append("<div class=\"panel risk\">");
        html.append("<h2>高风险改动</h2>");
        
        if (highRiskCommits.isEmpty()) {
            html.append("<p>没有发现高风险改动</p>");
        } else {
            html.append("<ul class=\"risk-list\">");
            for (CommitImpact commit : highRiskCommits) {
                html.append(String.format("""
                    <li class="risk-item">
                        <div class="risk-score">%d</div>
                        <div class="risk-info">
                            <div class="risk-commit">%s</div>
                            <div class="risk-message">%s</div>
                            <div class="risk-details">
                                变更: %d 文件, %d 方法 | 作者: %s
                            </div>
                        </div>
                    </li>
                    """,
                    commit.getRiskScore(),
                    commit.getCommitId().substring(0, 7),
                    commit.getMessage(),
                    commit.getChangedFilesCount(),
                    commit.getChangedMethodsCount(),
                    commit.getAuthor().getName()
                ));
            }
            html.append("</ul>");
        }
        
        html.append("</div>");
        return html.toString();
    }

    private String generateCommitList(List<CommitImpact> impacts) {
        StringBuilder html = new StringBuilder();
        html.append("<div class=\"panel commits\">");
        html.append("<h2>提交详情</h2>");
        html.append("<div class=\"commit-list\">");
        
        for (CommitImpact commit : impacts) {
            html.append(String.format("""
                <div class="commit-item">
                    <div class="commit-header">
                        <span class="commit-hash">%s</span>
                        <span class="commit-author">%s</span>
                        <span class="commit-date">%s</span>
                        <span class="commit-risk">风险分: %d</span>
                    </div>
                    <div class="commit-message">%s</div>
                    <div class="commit-stats">
                        <div>变更文件: %d</div>
                        <div>变更方法: %d</div>
                        <div>影响方法: %d</div>
                        <div>影响测试: %d</div>
                    </div>
                </div>
                """,
                commit.getCommitId().substring(0, 7),
                commit.getAuthor().getName(),
                DATE_FORMATTER.format(commit.getTimestamp().atZone(java.time.ZoneId.systemDefault())),
                commit.getRiskScore(),
                commit.getMessage(),
                commit.getChangedFilesCount(),
                commit.getChangedMethodsCount(),
                commit.getImpactedMethods().size(),
                commit.getImpactedTests().size()
            ));
        }
        
        html.append("</div></div>");
        return html.toString();
    }

    private String getHeader() {
        return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Git Impact 分析报告</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                        line-height: 1.6;
                        margin: 0;
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    .panel {
                        background: white;
                        border-radius: 8px;
                        padding: 20px;
                        margin-bottom: 20px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    h2 {
                        margin-top: 0;
                        color: #333;
                    }
                    .stats {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 20px;
                    }
                    .stat-item {
                        text-align: center;
                    }
                    .stat-value {
                        font-size: 24px;
                        font-weight: bold;
                        color: #2196F3;
                    }
                    .stat-label {
                        color: #666;
                    }
                    .risk-list {
                        list-style: none;
                        padding: 0;
                    }
                    .risk-item {
                        display: flex;
                        align-items: center;
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .risk-score {
                        font-size: 24px;
                        font-weight: bold;
                        color: #f44336;
                        margin-right: 20px;
                    }
                    .risk-commit {
                        font-family: monospace;
                        color: #666;
                    }
                    .commit-item {
                        border-bottom: 1px solid #eee;
                        padding: 15px 0;
                    }
                    .commit-header {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 10px;
                    }
                    .commit-hash {
                        font-family: monospace;
                        color: #666;
                    }
                    .commit-message {
                        margin: 10px 0;
                    }
                    .commit-stats {
                        display: flex;
                        gap: 20px;
                        color: #666;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <h1>Git Impact 分析报告</h1>
            """;
    }

    private String getFooter() {
        return """
            </body>
            </html>
            """;
    }
} 