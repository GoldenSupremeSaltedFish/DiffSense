package com.yourorg.gitimpact.classification;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;

/**
 * 后端变更分类器 - 将修改分为5个明确类别
 */
public class BackendChangeClassifier {
    
    public enum ChangeCategory {
        A1_BUSINESS_LOGIC("A1", "业务逻辑变更", "修改 Controller / Service 中的处理逻辑"),
        A2_API_CHANGE("A2", "接口变更", "修改 API 方法签名 / 参数 / 返回结构"),
        A3_DATA_STRUCTURE("A3", "数据结构变更", "Entity / DTO / DB schema 变化"),
        A4_MIDDLEWARE_FRAMEWORK("A4", "中间件/框架调整", "引入新框架、改动配置文件、连接池参数修改"),
        A5_NON_FUNCTIONAL("A5", "非功能性修改", "注释、日志优化、格式整理、性能提升（无行为变化）");
        
        private final String code;
        private final String displayName;
        private final String description;
        
        ChangeCategory(String code, String displayName, String description) {
            this.code = code;
            this.displayName = displayName;
            this.description = description;
        }
        
        public String getCode() { return code; }
        public String getDisplayName() { return displayName; }
        public String getDescription() { return description; }
    }
    
    /**
     * 变更分类结果
     */
    public static class ClassificationResult {
        private final ChangeCategory category;
        private final String reason;
        private final double confidence;
        private final List<String> indicators;
        
        public ClassificationResult(ChangeCategory category, String reason, double confidence, List<String> indicators) {
            this.category = category;
            this.reason = reason;
            this.confidence = confidence;
            this.indicators = indicators;
        }
        
        public ChangeCategory getCategory() { return category; }
        public String getReason() { return reason; }
        public double getConfidence() { return confidence; }
        public List<String> getIndicators() { return indicators; }
        
        public Map<String, Object> toMap() {
            Map<String, Object> result = new HashMap<>();
            result.put("category", category.getCode());
            result.put("categoryName", category.getDisplayName());
            result.put("description", category.getDescription());
            result.put("reason", reason);
            result.put("confidence", confidence);
            result.put("indicators", indicators);
            return result;
        }
    }
    
    /**
     * 文件级别的分类结果
     */
    public static class FileClassification {
        private final String filePath;
        private final ClassificationResult classification;
        private final List<String> changedMethods;
        
        public FileClassification(String filePath, ClassificationResult classification, List<String> changedMethods) {
            this.filePath = filePath;
            this.classification = classification;
            this.changedMethods = changedMethods;
        }
        
        public String getFilePath() { return filePath; }
        public ClassificationResult getClassification() { return classification; }
        public List<String> getChangedMethods() { return changedMethods; }
        
        public Map<String, Object> toMap() {
            Map<String, Object> result = new HashMap<>();
            result.put("filePath", filePath);
            result.put("classification", classification.toMap());
            result.put("changedMethods", changedMethods);
            return result;
        }
    }
    
    /**
     * 分析变更的文件和方法，返回分类结果
     */
    public List<FileClassification> classifyChanges(List<Path> changedFiles, List<ImpactedMethod> changedMethods) {
        List<FileClassification> results = new ArrayList<>();
        
        // 按文件分组方法变更
        Map<String, List<ImpactedMethod>> methodsByFile = changedMethods.stream()
            .collect(Collectors.groupingBy(method -> method.filePath != null ? method.filePath : "unknown"));
        
        // 对每个文件进行分类
        for (Path file : changedFiles) {
            String filePath = file.toString().replace("\\", "/");
            List<ImpactedMethod> fileMethods = methodsByFile.getOrDefault(filePath, new ArrayList<>());
            
            ClassificationResult classification = classifyFile(filePath, fileMethods);
            List<String> methodNames = fileMethods.stream()
                .map(method -> method.methodName != null ? method.methodName : "unknown")
                .collect(Collectors.toList());
                
            results.add(new FileClassification(filePath, classification, methodNames));
        }
        
        return results;
    }
    
    /**
     * 对单个文件进行分类
     */
    private ClassificationResult classifyFile(String filePath, List<ImpactedMethod> methods) {
        List<String> indicators = new ArrayList<>();
        Map<ChangeCategory, Double> categoryScores = new HashMap<>();
        
        // 初始化分数
        for (ChangeCategory category : ChangeCategory.values()) {
            categoryScores.put(category, 0.0);
        }
        
        // A1: 业务逻辑变更检测
        double businessLogicScore = calculateBusinessLogicScore(filePath, methods, indicators);
        categoryScores.put(ChangeCategory.A1_BUSINESS_LOGIC, businessLogicScore);
        
        // A2: 接口变更检测
        double apiChangeScore = calculateApiChangeScore(filePath, methods, indicators);
        categoryScores.put(ChangeCategory.A2_API_CHANGE, apiChangeScore);
        
        // A3: 数据结构变更检测
        double dataStructureScore = calculateDataStructureScore(filePath, methods, indicators);
        categoryScores.put(ChangeCategory.A3_DATA_STRUCTURE, dataStructureScore);
        
        // A4: 中间件/框架调整检测
        double middlewareScore = calculateMiddlewareScore(filePath, methods, indicators);
        categoryScores.put(ChangeCategory.A4_MIDDLEWARE_FRAMEWORK, middlewareScore);
        
        // A5: 非功能性修改检测
        double nonFunctionalScore = calculateNonFunctionalScore(filePath, methods, indicators);
        categoryScores.put(ChangeCategory.A5_NON_FUNCTIONAL, nonFunctionalScore);
        
        // 选择得分最高的类别
        ChangeCategory bestCategory = categoryScores.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse(ChangeCategory.A5_NON_FUNCTIONAL);
            
        double confidence = categoryScores.get(bestCategory);
        String reason = buildReason(bestCategory, indicators);
        
        return new ClassificationResult(bestCategory, reason, confidence, indicators);
    }
    
    /**
     * 计算业务逻辑变更分数
     */
    private double calculateBusinessLogicScore(String filePath, List<ImpactedMethod> methods, List<String> indicators) {
        double score = 0.0;
        
        // 文件路径匹配
        if (filePath.contains("/controller/") || filePath.contains("/service/") || 
            filePath.contains("/business/") || filePath.contains("/logic/")) {
            score += 30.0;
            indicators.add("位于业务逻辑包路径");
        }
        
        // 类名匹配
        if (filePath.endsWith("Controller.java") || filePath.endsWith("Service.java") ||
            filePath.endsWith("BusinessLogic.java") || filePath.endsWith("Processor.java")) {
            score += 25.0;
            indicators.add("业务逻辑类名模式");
        }
        
        // 方法名模式
        for (ImpactedMethod method : methods) {
            String methodName = method.methodName != null ? method.methodName : "";
            if (methodName.startsWith("process") || methodName.startsWith("handle") ||
                methodName.startsWith("execute") || methodName.startsWith("calculate") ||
                methodName.startsWith("validate") || methodName.startsWith("transform")) {
                score += 15.0;
                indicators.add("业务处理方法: " + methodName);
            }
        }
        
        return Math.min(score, 100.0);
    }
    
    /**
     * 计算接口变更分数
     */
    private double calculateApiChangeScore(String filePath, List<ImpactedMethod> methods, List<String> indicators) {
        double score = 0.0;
        
        // 文件路径匹配
        if (filePath.contains("/controller/") || filePath.contains("/api/") || 
            filePath.contains("/rest/") || filePath.contains("/web/")) {
            score += 35.0;
            indicators.add("位于API接口包路径");
        }
        
        // 类名匹配
        if (filePath.endsWith("Controller.java") || filePath.endsWith("RestController.java") ||
            filePath.endsWith("Api.java") || filePath.endsWith("Endpoint.java")) {
            score += 30.0;
            indicators.add("API控制器类");
        }
        
        // 方法名模式 (REST动词)
        for (ImpactedMethod method : methods) {
            String methodName = method.methodName != null ? method.methodName : "";
            if (methodName.startsWith("get") || methodName.startsWith("post") ||
                methodName.startsWith("put") || methodName.startsWith("delete") ||
                methodName.startsWith("patch") || methodName.contains("Mapping")) {
                score += 20.0;
                indicators.add("REST API方法: " + methodName);
            }
        }
        
        // 注解检测 (需要通过AST分析)
        // TODO: 可以扩展检测 @RequestMapping, @GetMapping 等注解
        
        return Math.min(score, 100.0);
    }
    
    /**
     * 计算数据结构变更分数
     */
    private double calculateDataStructureScore(String filePath, List<ImpactedMethod> methods, List<String> indicators) {
        double score = 0.0;
        
        // 文件路径匹配
        if (filePath.contains("/entity/") || filePath.contains("/model/") || 
            filePath.contains("/dto/") || filePath.contains("/vo/") ||
            filePath.contains("/domain/") || filePath.contains("/pojo/")) {
            score += 40.0;
            indicators.add("位于数据模型包路径");
        }
        
        // 类名匹配
        if (filePath.endsWith("Entity.java") || filePath.endsWith("DTO.java") ||
            filePath.endsWith("VO.java") || filePath.endsWith("Model.java") ||
            filePath.endsWith("POJO.java") || filePath.endsWith("Domain.java")) {
            score += 35.0;
            indicators.add("数据模型类名模式");
        }
        
        // 配置文件
        if (filePath.endsWith(".sql") || filePath.endsWith("schema.sql") ||
            filePath.contains("migration") || filePath.contains("flyway")) {
            score += 50.0;
            indicators.add("数据库结构文件");
        }
        
        // 方法名模式 (getter/setter)
        long getterSetterCount = methods.stream()
            .mapToLong(method -> {
                String methodName = method.methodName != null ? method.methodName : "";
                return (methodName.startsWith("get") || methodName.startsWith("set") ||
                        methodName.startsWith("is")) ? 1 : 0;
            })
            .sum();
        
        if (getterSetterCount > 0) {
            score += getterSetterCount * 5.0;
            indicators.add("包含 " + getterSetterCount + " 个getter/setter方法");
        }
        
        return Math.min(score, 100.0);
    }
    
    /**
     * 计算中间件/框架调整分数
     */
    private double calculateMiddlewareScore(String filePath, List<ImpactedMethod> methods, List<String> indicators) {
        double score = 0.0;
        
        // 配置文件
        if (filePath.endsWith(".yml") || filePath.endsWith(".yaml") ||
            filePath.endsWith(".properties") || filePath.endsWith(".xml") ||
            filePath.endsWith(".json")) {
            score += 60.0;
            indicators.add("配置文件变更");
        }
        
        // 框架配置类
        if (filePath.contains("/config/") || filePath.contains("/configuration/")) {
            score += 45.0;
            indicators.add("位于配置包路径");
        }
        
        if (filePath.endsWith("Config.java") || filePath.endsWith("Configuration.java")) {
            score += 40.0;
            indicators.add("配置类");
        }
        
        // 中间件相关
        if (filePath.contains("redis") || filePath.contains("kafka") ||
            filePath.contains("rabbitmq") || filePath.contains("elasticsearch") ||
            filePath.contains("database") || filePath.contains("datasource")) {
            score += 35.0;
            indicators.add("中间件相关文件");
        }
        
        // 依赖管理
        if (filePath.endsWith("pom.xml") || filePath.endsWith("build.gradle") ||
            filePath.endsWith("requirements.txt") || filePath.endsWith("package.json")) {
            score += 50.0;
            indicators.add("依赖管理文件");
        }
        
        return Math.min(score, 100.0);
    }
    
    /**
     * 计算非功能性修改分数
     */
    private double calculateNonFunctionalScore(String filePath, List<ImpactedMethod> methods, List<String> indicators) {
        double score = 20.0; // 基础分数，作为兜底
        
        // 测试文件
        if (filePath.contains("/test/") || filePath.endsWith("Test.java") ||
            filePath.endsWith("Tests.java") || filePath.endsWith("TestCase.java")) {
            score += 30.0;
            indicators.add("测试文件");
        }
        
        // 文档文件
        if (filePath.endsWith(".md") || filePath.endsWith(".txt") ||
            filePath.endsWith(".doc") || filePath.endsWith("README")) {
            score += 40.0;
            indicators.add("文档文件");
        }
        
        // 工具类
        if (filePath.contains("/util/") || filePath.contains("/utils/") ||
            filePath.endsWith("Util.java") || filePath.endsWith("Utils.java") ||
            filePath.endsWith("Helper.java")) {
            score += 25.0;
            indicators.add("工具类文件");
        }
        
        // 静态资源
        if (filePath.endsWith(".css") || filePath.endsWith(".js") ||
            filePath.endsWith(".html") || filePath.endsWith(".png") ||
            filePath.endsWith(".jpg") || filePath.endsWith(".svg")) {
            score += 35.0;
            indicators.add("静态资源文件");
        }
        
        return Math.min(score, 100.0);
    }
    
    /**
     * 构建分类原因说明
     */
    private String buildReason(ChangeCategory category, List<String> indicators) {
        StringBuilder reason = new StringBuilder();
        reason.append("分类为 ").append(category.getDisplayName()).append("：");
        
        if (indicators.isEmpty()) {
            reason.append("基于默认规则判断");
        } else {
            reason.append(String.join("、", indicators));
        }
        
        return reason.toString();
    }
    
    /**
     * 生成分类统计摘要
     */
    public Map<String, Object> generateClassificationSummary(List<FileClassification> classifications) {
        Map<String, Object> summary = new HashMap<>();
        
        // 按类别统计
        Map<String, Long> categoryStats = classifications.stream()
            .collect(Collectors.groupingBy(
                fc -> fc.getClassification().getCategory().getCode(),
                Collectors.counting()
            ));
        
        summary.put("totalFiles", classifications.size());
        summary.put("categoryStats", categoryStats);
        
        // 置信度统计
        double avgConfidence = classifications.stream()
            .mapToDouble(fc -> fc.getClassification().getConfidence())
            .average()
            .orElse(0.0);
        
        summary.put("averageConfidence", avgConfidence);
        
        // 详细分类
        Map<String, List<Map<String, Object>>> detailedStats = new HashMap<>();
        for (ChangeCategory category : ChangeCategory.values()) {
            List<Map<String, Object>> categoryFiles = classifications.stream()
                .filter(fc -> fc.getClassification().getCategory() == category)
                .map(FileClassification::toMap)
                .collect(Collectors.toList());
            detailedStats.put(category.getCode(), categoryFiles);
        }
        
        summary.put("detailedClassifications", detailedStats);
        
        return summary;
    }
} 