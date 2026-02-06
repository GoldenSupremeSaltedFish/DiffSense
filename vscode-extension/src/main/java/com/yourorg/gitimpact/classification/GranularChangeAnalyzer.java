package com.yourorg.gitimpact.classification;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;

/**
 * 细粒度变更分析器
 * 分析具体的修改类型，支持一个提交包含多种修改类型
 */
public class GranularChangeAnalyzer {
    
    // 日志相关的正则表达式
    private static final Pattern LOG_PATTERN = Pattern.compile(
        "\\b(log\\.(debug|info|warn|error)|logger\\.(debug|info|warn|error)|System\\.out|System\\.err)\\b"
    );
    
    // 配置相关的文件扩展名
    private static final String[] CONFIG_EXTENSIONS = {
        ".yml", ".yaml", ".properties", ".xml", ".json", ".conf", ".cfg", ".ini"
    };
    
    // 测试相关的文件模式
    private static final Pattern TEST_FILE_PATTERN = Pattern.compile(
        ".*Test\\.java$|.*Tests\\.java$|.*Spec\\.java$|.*IT\\.java$"
    );
    
    // 依赖相关的文件
    private static final String[] DEPENDENCY_FILES = {
        "pom.xml", "build.gradle", "package.json", "go.mod", "requirements.txt"
    };
    
    /**
     * 分析文件变更，返回细粒度的修改详情列表
     */
    public List<ModificationDetail> analyzeFileChanges(Path filePath, List<ImpactedMethod> methods, String diffContent) {
        List<ModificationDetail> modifications = new ArrayList<>();
        String filePathStr = filePath.toString().replace("\\", "/");
        
        // 分析配置变更
        if (isConfigFile(filePathStr)) {
            modifications.add(new ModificationDetail(
                ModificationType.CONFIG_CHANGE,
                "配置文件变更: " + filePath.getFileName(),
                filePathStr
            ));
        }
        
        // 分析依赖变更
        if (isDependencyFile(filePathStr)) {
            modifications.add(new ModificationDetail(
                ModificationType.DEPENDENCY_UPDATED,
                "依赖文件变更: " + filePath.getFileName(),
                filePathStr
            ));
        }
        
        // 分析测试文件变更
        if (isTestFile(filePathStr)) {
            modifications.add(new ModificationDetail(
                ModificationType.TEST_MODIFIED,
                "测试文件变更: " + filePath.getFileName(),
                filePathStr
            ));
        }
        
        // 分析方法级别的变更
        for (ImpactedMethod method : methods) {
            modifications.addAll(analyzeMethodChanges(filePathStr, method, diffContent));
        }
        
        // 如果没有具体的方法变更，但有文件变更，进行整体分析
        if (methods.isEmpty() && diffContent != null) {
            modifications.addAll(analyzeGeneralChanges(filePathStr, diffContent));
        }
        
        return modifications;
    }
    
    /**
     * 分析方法级别的变更
     */
    private List<ModificationDetail> analyzeMethodChanges(String filePath, ImpactedMethod method, String diffContent) {
        List<ModificationDetail> modifications = new ArrayList<>();
        String methodName = method.methodName != null ? method.methodName : "unknown";
        
        // 分析API端点变更
        if (isApiEndpoint(filePath, methodName)) {
            modifications.add(new ModificationDetail(
                ModificationType.API_ENDPOINT_CHANGE,
                "API端点变更: " + methodName,
                filePath,
                methodName,
                0.9
            ));
        }
        
        // 分析接口变更 - 基于方法签名变化检测
        if (diffContent != null && containsSignatureChange(diffContent, methodName)) {
            modifications.add(new ModificationDetail(
                ModificationType.INTERFACE_CHANGE,
                "方法签名变更: " + methodName,
                filePath,
                methodName,
                0.95
            ));
        }
        
        // 分析行为变更 - 基于方法体变化检测
        if (diffContent != null && containsBodyChange(diffContent, methodName)) {
            modifications.add(new ModificationDetail(
                ModificationType.BEHAVIOR_CHANGE,
                "方法逻辑变更: " + methodName,
                filePath,
                methodName,
                0.85
            ));
        }
        
        // 分析日志变更
        if (diffContent != null && containsLogChanges(diffContent)) {
            modifications.add(new ModificationDetail(
                ModificationType.LOGGING_ADDED,
                "日志记录变更: " + methodName,
                filePath,
                methodName,
                0.8
            ));
        }
        
        // 分析数据结构变更
        if (isDataStructure(filePath, methodName)) {
            modifications.add(new ModificationDetail(
                ModificationType.DATA_STRUCTURE_CHANGE,
                "数据结构变更: " + methodName,
                filePath,
                methodName,
                0.9
            ));
        }
        
        return modifications;
    }
    
    /**
     * 分析一般性变更（无具体方法信息时）
     */
    private List<ModificationDetail> analyzeGeneralChanges(String filePath, String diffContent) {
        List<ModificationDetail> modifications = new ArrayList<>();
        
        // 分析日志变更
        if (containsLogChanges(diffContent)) {
            modifications.add(new ModificationDetail(
                ModificationType.LOGGING_ADDED,
                "添加或修改了日志记录",
                filePath
            ));
        }
        
        // 分析注释变更
        if (isCommentOnlyChange(diffContent)) {
            modifications.add(new ModificationDetail(
                ModificationType.COMMENT_CHANGE,
                "仅修改了注释或文档",
                filePath
            ));
        }
        
        // 分析格式变更
        if (isFormattingChange(diffContent)) {
            modifications.add(new ModificationDetail(
                ModificationType.FORMATTING_CHANGE,
                "仅调整了代码格式",
                filePath
            ));
        }
        
        return modifications;
    }
    
    /**
     * 判断是否为配置文件
     */
    private boolean isConfigFile(String filePath) {
        String lowerPath = filePath.toLowerCase();
        for (String ext : CONFIG_EXTENSIONS) {
            if (lowerPath.endsWith(ext)) {
                return true;
            }
        }
        return lowerPath.contains("/config/") || lowerPath.contains("/conf/") || 
               lowerPath.contains("application.") || lowerPath.contains("bootstrap.");
    }
    
    /**
     * 判断是否为依赖文件
     */
    private boolean isDependencyFile(String filePath) {
        String fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
        for (String depFile : DEPENDENCY_FILES) {
            if (fileName.equals(depFile)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * 判断是否为测试文件
     */
    private boolean isTestFile(String filePath) {
        return TEST_FILE_PATTERN.matcher(filePath).matches() || 
               filePath.contains("/test/") || filePath.contains("/tests/");
    }
    
    /**
     * 判断是否为API端点
     */
    private boolean isApiEndpoint(String filePath, String methodName) {
        return filePath.contains("/controller/") || filePath.contains("/api/") ||
               methodName.startsWith("get") || methodName.startsWith("post") ||
               methodName.startsWith("put") || methodName.startsWith("delete");
    }
    
    /**
     * 判断是否为数据结构
     */
    private boolean isDataStructure(String filePath, String methodName) {
        return filePath.contains("/entity/") || filePath.contains("/dto/") ||
               filePath.contains("/model/") || filePath.contains("/pojo/") ||
               methodName.startsWith("get") || methodName.startsWith("set") ||
               methodName.startsWith("toString") || methodName.startsWith("equals");
    }
    
    /**
     * 检查是否包含日志变更
     */
    private boolean containsLogChanges(String diffContent) {
        return LOG_PATTERN.matcher(diffContent).find();
    }
    
    /**
     * 检查是否仅为注释变更
     */
    private boolean isCommentOnlyChange(String diffContent) {
        String[] lines = diffContent.split("\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty() && !trimmed.startsWith("//") && !trimmed.startsWith("/*") && 
                !trimmed.startsWith("*") && !trimmed.startsWith("*/") && !trimmed.startsWith("<!--")) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * 检查是否仅为格式变更
     */
    private boolean isFormattingChange(String diffContent) {
        // 简单的格式变更检测：只包含空格、换行、缩进等变化
        String normalized = diffContent.replaceAll("\\s+", " ").trim();
        return normalized.isEmpty() || normalized.length() < 10;
    }
    
    /**
     * 检查是否包含方法签名变更
     */
    private boolean containsSignatureChange(String diffContent, String methodName) {
        // 检测方法签名变更的简单模式
        String[] lines = diffContent.split("\n");
        for (String line : lines) {
            if (line.contains(methodName) && 
                (line.contains("public") || line.contains("private") || line.contains("protected")) &&
                line.contains("(") && line.contains(")")) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * 检查是否包含方法体变更
     */
    private boolean containsBodyChange(String diffContent, String methodName) {
        // 检测方法体变更的简单模式
        String[] lines = diffContent.split("\n");
        boolean inMethod = false;
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.contains(methodName) && trimmed.contains("(") && trimmed.contains(")")) {
                inMethod = true;
                continue;
            }
            if (inMethod && (trimmed.startsWith("+") || trimmed.startsWith("-")) && 
                !trimmed.startsWith("+//") && !trimmed.startsWith("-//")) {
                return true;
            }
            if (inMethod && trimmed.equals("}")) {
                break;
            }
        }
        return false;
    }
} 