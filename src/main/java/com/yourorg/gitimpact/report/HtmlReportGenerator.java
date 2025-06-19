package com.yourorg.gitimpact.report;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.yourorg.gitimpact.classification.BackendChangeClassifier;
import com.yourorg.gitimpact.inspect.CommitImpact;

public class HtmlReportGenerator {
    private static final Logger logger = LoggerFactory.getLogger(HtmlReportGenerator.class);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public void generateReport(List<CommitImpact> impacts, Path outputPath) throws IOException {
        logger.info("开始生成 HTML 报告到: {}", outputPath);
        
        StringBuilder html = new StringBuilder();
        html.append(getHeader());
        html.append(generateOverviewPanel(impacts));
        html.append(generateClassificationPanel(impacts));
        html.append(generateCommitList(impacts));
        html.append(getFooter());
        
        Files.write(outputPath, html.toString().getBytes());
        logger.info("HTML 报告生成完成: {}", outputPath);
    }

    private String generateOverviewPanel(List<CommitImpact> impacts) {
        int totalCommits = impacts.size();
        int totalChangedFiles = impacts.stream().mapToInt(i -> i.getChangedFilesCount()).sum();
        int totalChangedMethods = impacts.stream().mapToInt(i -> i.getChangedMethodsCount()).sum();
        
        // 计算分类统计
        Map<String, Long> globalClassificationStats = impacts.stream()
            .flatMap(impact -> impact.getChangeClassifications().stream())
            .collect(Collectors.groupingBy(
                fc -> fc.getClassification().getCategory().getCode(),
                Collectors.counting()
            ));
        
        return String.format(
            "<div class=\"panel overview\">" +
            "    <h2>概览</h2>" +
            "    <div class=\"stats\">" +
            "        <div class=\"stat-item\">" +
            "            <div class=\"stat-value\">%d</div>" +
            "            <div class=\"stat-label\">提交数</div>" +
            "        </div>" +
            "        <div class=\"stat-item\">" +
            "            <div class=\"stat-value\">%d</div>" +
            "            <div class=\"stat-label\">变更文件</div>" +
            "        </div>" +
            "        <div class=\"stat-item\">" +
            "            <div class=\"stat-value\">%d</div>" +
            "            <div class=\"stat-label\">变更方法</div>" +
            "        </div>" +
            "        <div class=\"stat-item\">" +
            "            <div class=\"stat-value\">%d</div>" +
            "            <div class=\"stat-label\">分类文件</div>" +
            "        </div>" +
            "    </div>" +
            "    <div class=\"classification-overview\">" +
            "        <h3>变更类型分布</h3>" +
            "        <div class=\"classification-stats\">" +
            "            <div class=\"class-stat\">A1 业务逻辑: %d</div>" +
            "            <div class=\"class-stat\">A2 接口变更: %d</div>" +
            "            <div class=\"class-stat\">A3 数据结构: %d</div>" +
            "            <div class=\"class-stat\">A4 中间件框架: %d</div>" +
            "            <div class=\"class-stat\">A5 非功能性: %d</div>" +
            "        </div>" +
            "    </div>" +
            "</div>",
            totalCommits, 
            totalChangedFiles, 
            totalChangedMethods,
            globalClassificationStats.values().stream().mapToLong(Long::longValue).sum(),
            globalClassificationStats.getOrDefault("A1", 0L),
            globalClassificationStats.getOrDefault("A2", 0L),
            globalClassificationStats.getOrDefault("A3", 0L),
            globalClassificationStats.getOrDefault("A4", 0L),
            globalClassificationStats.getOrDefault("A5", 0L)
        );
    }

    private String generateClassificationPanel(List<CommitImpact> impacts) {
        // 筛选接口变更和业务逻辑变更（重要变更）
        List<CommitImpact> importantChanges = impacts.stream()
            .filter(i -> i.getChangeClassifications().stream()
                .anyMatch(fc -> fc.getClassification().getCategory().getCode().equals("A1") ||
                              fc.getClassification().getCategory().getCode().equals("A2")))
            .collect(Collectors.toList());
        
        StringBuilder html = new StringBuilder();
        html.append("<div class=\"panel classification\">");
        html.append("<h2>重要变更</h2>");
        html.append("<p>A1 业务逻辑变更和 A2 接口变更</p>");
        
        if (importantChanges.isEmpty()) {
            html.append("<p>没有发现重要变更</p>");
        } else {
            html.append("<ul class=\"classification-list\">");
            for (CommitImpact commit : importantChanges) {
                List<BackendChangeClassifier.FileClassification> importantFiles = commit.getChangeClassifications().stream()
                    .filter(fc -> fc.getClassification().getCategory().getCode().equals("A1") ||
                                 fc.getClassification().getCategory().getCode().equals("A2"))
                    .collect(Collectors.toList());
                
                for (BackendChangeClassifier.FileClassification fileClass : importantFiles) {
                    html.append(String.format(
                        "<li class=\"classification-item\">" +
                        "    <div class=\"class-badge %s\">%s</div>" +
                        "    <div class=\"class-info\">" +
                        "        <div class=\"class-commit\">%s</div>" +
                        "        <div class=\"class-file\">%s</div>" +
                        "        <div class=\"class-reason\">%s</div>" +
                        "        <div class=\"class-details\">" +
                        "            置信度: %.1f%% | 作者: %s" +
                        "        </div>" +
                        "    </div>" +
                        "</li>",
                        fileClass.getClassification().getCategory().getCode().toLowerCase(),
                        fileClass.getClassification().getCategory().getDisplayName(),
                        commit.getCommitId().substring(0, 7),
                        fileClass.getFilePath(),
                        fileClass.getClassification().getReason(),
                        fileClass.getClassification().getConfidence(),
                        commit.getAuthor().getName()
                    ));
                }
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
            // 获取主要分类
            String mainCategory = commit.getChangeClassifications().stream()
                .collect(Collectors.groupingBy(
                    fc -> fc.getClassification().getCategory().getCode(),
                    Collectors.counting()
                ))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("A5");
            
            html.append(String.format(
                "<div class=\"commit-item\">" +
                "    <div class=\"commit-header\">" +
                "        <span class=\"commit-hash\">%s</span>" +
                "        <span class=\"commit-author\">%s</span>" +
                "        <span class=\"commit-date\">%s</span>" +
                "        <span class=\"commit-category %s\">主要类型: %s</span>" +
                "    </div>" +
                "    <div class=\"commit-message\">%s</div>" +
                "    <div class=\"commit-stats\">" +
                "        <div>变更文件: %d</div>" +
                "        <div>变更方法: %d</div>" +
                "        <div>影响方法: %d</div>" +
                "        <div>影响测试: %d</div>" +
                "    </div>" +
                "    <div class=\"commit-classifications\">" +
                "        %s" +
                "    </div>" +
                "</div>",
                commit.getCommitId().substring(0, 7),
                commit.getAuthor().getName(),
                DATE_FORMATTER.format(commit.getTimestamp().atZone(java.time.ZoneId.systemDefault())),
                mainCategory.toLowerCase(),
                getDisplayNameForCategory(mainCategory),
                commit.getMessage(),
                commit.getChangedFilesCount(),
                commit.getChangedMethodsCount(),
                commit.getImpactedMethods().size(),
                commit.getImpactedTests().size(),
                generateClassificationDetails(commit.getChangeClassifications())
            ));
        }
        
        html.append("</div></div>");
        return html.toString();
    }
    
    private String getDisplayNameForCategory(String categoryCode) {
        switch (categoryCode) {
            case "A1": return "业务逻辑变更";
            case "A2": return "接口变更";
            case "A3": return "数据结构变更";
            case "A4": return "中间件/框架调整";
            case "A5": return "非功能性修改";
            default: return "未知类型";
        }
    }
    
    private String generateClassificationDetails(List<BackendChangeClassifier.FileClassification> classifications) {
        if (classifications.isEmpty()) {
            return "<div class=\"no-classifications\">无分类信息</div>";
        }
        
        StringBuilder details = new StringBuilder();
        details.append("<div class=\"classification-details\">");
        details.append("<h4>文件分类详情:</h4>");
        
        for (BackendChangeClassifier.FileClassification fc : classifications) {
            details.append(String.format(
                "<div class=\"file-classification\">" +
                "    <span class=\"file-path\">%s</span>" +
                "    <span class=\"file-category %s\">%s</span>" +
                "    <span class=\"file-confidence\">%.1f%%</span>" +
                "</div>",
                fc.getFilePath(),
                fc.getClassification().getCategory().getCode().toLowerCase(),
                fc.getClassification().getCategory().getDisplayName(),
                fc.getClassification().getConfidence()
            ));
        }
        
        details.append("</div>");
        return details.toString();
    }

    private String getHeader() {
        return "<!DOCTYPE html>\n" +
            "<html>\n" +
            "<head>\n" +
            "    <meta charset=\"UTF-8\">\n" +
            "    <title>DiffSense 后端变更分类报告</title>\n" +
            "    <style>\n" +
            "        body {\n" +
            "            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;\n" +
            "            line-height: 1.6;\n" +
            "            margin: 0;\n" +
            "            padding: 20px;\n" +
            "            background: #f5f5f5;\n" +
            "        }\n" +
            "        .panel {\n" +
            "            background: white;\n" +
            "            border-radius: 8px;\n" +
            "            padding: 20px;\n" +
            "            margin-bottom: 20px;\n" +
            "            box-shadow: 0 2px 4px rgba(0,0,0,0.1);\n" +
            "        }\n" +
            "        h2, h3, h4 {\n" +
            "            margin-top: 0;\n" +
            "            color: #333;\n" +
            "        }\n" +
            "        .stats {\n" +
            "            display: grid;\n" +
            "            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));\n" +
            "            gap: 20px;\n" +
            "            margin-bottom: 20px;\n" +
            "        }\n" +
            "        .stat-item {\n" +
            "            text-align: center;\n" +
            "        }\n" +
            "        .stat-value {\n" +
            "            font-size: 24px;\n" +
            "            font-weight: bold;\n" +
            "            color: #2196F3;\n" +
            "        }\n" +
            "        .stat-label {\n" +
            "            color: #666;\n" +
            "        }\n" +
            "        .classification-overview {\n" +
            "            margin-top: 20px;\n" +
            "        }\n" +
            "        .classification-stats {\n" +
            "            display: grid;\n" +
            "            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n" +
            "            gap: 10px;\n" +
            "        }\n" +
            "        .class-stat {\n" +
            "            padding: 10px;\n" +
            "            background: #f0f0f0;\n" +
            "            border-radius: 4px;\n" +
            "            text-align: center;\n" +
            "        }\n" +
            "        .classification-list {\n" +
            "            list-style: none;\n" +
            "            padding: 0;\n" +
            "        }\n" +
            "        .classification-item {\n" +
            "            display: flex;\n" +
            "            align-items: flex-start;\n" +
            "            padding: 15px;\n" +
            "            border-bottom: 1px solid #eee;\n" +
            "        }\n" +
            "        .class-badge {\n" +
            "            padding: 4px 8px;\n" +
            "            border-radius: 4px;\n" +
            "            font-size: 12px;\n" +
            "            font-weight: bold;\n" +
            "            color: white;\n" +
            "            margin-right: 15px;\n" +
            "            min-width: 80px;\n" +
            "            text-align: center;\n" +
            "        }\n" +
            "        .class-badge.a1 { background: #ff9800; }\n" +
            "        .class-badge.a2 { background: #f44336; }\n" +
            "        .class-badge.a3 { background: #9c27b0; }\n" +
            "        .class-badge.a4 { background: #3f51b5; }\n" +
            "        .class-badge.a5 { background: #4caf50; }\n" +
            "        .class-commit {\n" +
            "            font-family: monospace;\n" +
            "            color: #666;\n" +
            "            font-size: 12px;\n" +
            "        }\n" +
            "        .class-file {\n" +
            "            font-weight: bold;\n" +
            "            margin: 5px 0;\n" +
            "        }\n" +
            "        .class-reason {\n" +
            "            color: #666;\n" +
            "            font-size: 14px;\n" +
            "        }\n" +
            "        .commit-item {\n" +
            "            border-bottom: 1px solid #eee;\n" +
            "            padding: 15px 0;\n" +
            "        }\n" +
            "        .commit-header {\n" +
            "            display: flex;\n" +
            "            justify-content: space-between;\n" +
            "            align-items: center;\n" +
            "            margin-bottom: 10px;\n" +
            "            flex-wrap: wrap;\n" +
            "            gap: 10px;\n" +
            "        }\n" +
            "        .commit-hash {\n" +
            "            font-family: monospace;\n" +
            "            color: #666;\n" +
            "        }\n" +
            "        .commit-category {\n" +
            "            padding: 4px 8px;\n" +
            "            border-radius: 4px;\n" +
            "            font-size: 12px;\n" +
            "            color: white;\n" +
            "        }\n" +
            "        .commit-category.a1 { background: #ff9800; }\n" +
            "        .commit-category.a2 { background: #f44336; }\n" +
            "        .commit-category.a3 { background: #9c27b0; }\n" +
            "        .commit-category.a4 { background: #3f51b5; }\n" +
            "        .commit-category.a5 { background: #4caf50; }\n" +
            "        .commit-message {\n" +
            "            margin: 10px 0;\n" +
            "        }\n" +
            "        .commit-stats {\n" +
            "            display: flex;\n" +
            "            gap: 20px;\n" +
            "            color: #666;\n" +
            "            font-size: 14px;\n" +
            "            margin-bottom: 10px;\n" +
            "        }\n" +
            "        .classification-details {\n" +
            "            background: #f9f9f9;\n" +
            "            border-radius: 4px;\n" +
            "            padding: 10px;\n" +
            "        }\n" +
            "        .file-classification {\n" +
            "            display: flex;\n" +
            "            justify-content: space-between;\n" +
            "            align-items: center;\n" +
            "            padding: 5px 0;\n" +
            "            border-bottom: 1px solid #eee;\n" +
            "        }\n" +
            "        .file-category {\n" +
            "            padding: 2px 6px;\n" +
            "            border-radius: 3px;\n" +
            "            font-size: 11px;\n" +
            "            color: white;\n" +
            "        }\n" +
            "        .file-confidence {\n" +
            "            font-size: 12px;\n" +
            "            color: #666;\n" +
            "        }\n" +
            "    </style>\n" +
            "</head>\n" +
            "<body>\n" +
            "    <h1>🔍 DiffSense 后端变更分类报告</h1>";
    }

    private String getFooter() {
        return "\n</body>\n</html>";
    }
} 