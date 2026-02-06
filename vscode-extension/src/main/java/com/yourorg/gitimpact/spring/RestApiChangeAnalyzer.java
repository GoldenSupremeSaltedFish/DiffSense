package com.yourorg.gitimpact.spring;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.yourorg.gitimpact.config.AnalysisConfig;

import spoon.reflect.CtModel;

/**
 * REST API路由变更分析器
 * 专门分析Spring REST API的变更，包括：
 * - 新增/删除的API端点
 * - API路径变更
 * - HTTP方法变更
 * - 参数变更
 * - 响应类型变更
 */
public class RestApiChangeAnalyzer {
    private static final Logger logger = LoggerFactory.getLogger(RestApiChangeAnalyzer.class);
    
    private final AnalysisConfig config;
    
    public RestApiChangeAnalyzer(AnalysisConfig config) {
        this.config = config;
    }
    
    /**
     * 分析API变更
     * @param oldModel 旧版本的Spoon模型
     * @param newModel 新版本的Spoon模型
     * @return API变更分析结果
     */
    public ApiChangeAnalysisResult analyzeApiChanges(CtModel oldModel, CtModel newModel) {
        logger.info("开始分析REST API变更...");
        
        ApiChangeAnalysisResult result = new ApiChangeAnalysisResult();
        
        // 分析旧版本和新版本的API
        SpringAnnotationAnalyzer oldAnalyzer = new SpringAnnotationAnalyzer(oldModel, config);
        SpringAnnotationAnalyzer newAnalyzer = new SpringAnnotationAnalyzer(newModel, config);
        
        SpringAnalysisResult oldAnalysis = oldAnalyzer.analyze();
        SpringAnalysisResult newAnalysis = newAnalyzer.analyze();
        
        // 构建API签名映射
        Map<String, RestApiEndpoint> oldApis = buildApiSignatureMap(oldAnalysis.getRestEndpoints());
        Map<String, RestApiEndpoint> newApis = buildApiSignatureMap(newAnalysis.getRestEndpoints());
        
        // 分析API变更
        analyzeAddedApis(oldApis, newApis, result);
        analyzeRemovedApis(oldApis, newApis, result);
        analyzeModifiedApis(oldApis, newApis, result);
        
        // 分析破坏性变更
        analyzeBreakingChanges(result);
        
        // 计算汇总信息
        result.updateSummary();
        
        logger.info("REST API变更分析完成，发现{}个变更", result.getApiChanges().size());
        return result;
    }
    
    /**
     * 构建API签名映射
     */
    private Map<String, RestApiEndpoint> buildApiSignatureMap(List<RestApiEndpoint> endpoints) {
        Map<String, RestApiEndpoint> apiMap = new HashMap<>();
        
        for (RestApiEndpoint endpoint : endpoints) {
            String signature = endpoint.getApiSignature();
            apiMap.put(signature, endpoint);
        }
        
        return apiMap;
    }
    
    /**
     * 分析新增的API
     */
    private void analyzeAddedApis(Map<String, RestApiEndpoint> oldApis, 
                                 Map<String, RestApiEndpoint> newApis, 
                                 ApiChangeAnalysisResult result) {
        for (Map.Entry<String, RestApiEndpoint> entry : newApis.entrySet()) {
            String signature = entry.getKey();
            RestApiEndpoint endpoint = entry.getValue();
            
            if (!oldApis.containsKey(signature)) {
                ApiChange change = new ApiChange(
                    ApiChange.ChangeType.ADDED,
                    signature,
                    endpoint.getClassName(),
                    endpoint.getMethodName()
                );
                change.setNewValue(signature);
                change.setDescription("新增API端点");
                change.setImpactLevel("LOW");
                change.setBreakingChange(false);
                
                result.addApiChange(change);
                result.addAddedApi(endpoint);
            }
        }
    }
    
    /**
     * 分析删除的API
     */
    private void analyzeRemovedApis(Map<String, RestApiEndpoint> oldApis, 
                                   Map<String, RestApiEndpoint> newApis, 
                                   ApiChangeAnalysisResult result) {
        for (Map.Entry<String, RestApiEndpoint> entry : oldApis.entrySet()) {
            String signature = entry.getKey();
            RestApiEndpoint endpoint = entry.getValue();
            
            if (!newApis.containsKey(signature)) {
                ApiChange change = new ApiChange(
                    ApiChange.ChangeType.REMOVED,
                    signature,
                    endpoint.getClassName(),
                    endpoint.getMethodName()
                );
                change.setOldValue(signature);
                change.setDescription("删除API端点");
                change.setImpactLevel("HIGH");
                change.setBreakingChange(true);
                
                result.addApiChange(change);
                result.addRemovedApi(endpoint);
            }
        }
    }
    
    /**
     * 分析修改的API
     */
    private void analyzeModifiedApis(Map<String, RestApiEndpoint> oldApis, 
                                    Map<String, RestApiEndpoint> newApis, 
                                    ApiChangeAnalysisResult result) {
        // 按类名和方法名匹配，而不是完整签名
        Map<String, RestApiEndpoint> oldMethodMap = buildMethodSignatureMap(oldApis.values());
        Map<String, RestApiEndpoint> newMethodMap = buildMethodSignatureMap(newApis.values());
        
        for (Map.Entry<String, RestApiEndpoint> entry : newMethodMap.entrySet()) {
            String methodSignature = entry.getKey();
            RestApiEndpoint newEndpoint = entry.getValue();
            RestApiEndpoint oldEndpoint = oldMethodMap.get(methodSignature);
            
            if (oldEndpoint != null && !oldEndpoint.getApiSignature().equals(newEndpoint.getApiSignature())) {
                // API签名发生变更
                analyzeSpecificApiChanges(oldEndpoint, newEndpoint, result);
            }
        }
    }
    
    /**
     * 构建方法签名映射
     */
    private Map<String, RestApiEndpoint> buildMethodSignatureMap(Collection<RestApiEndpoint> endpoints) {
        Map<String, RestApiEndpoint> methodMap = new HashMap<>();
        
        for (RestApiEndpoint endpoint : endpoints) {
            String methodSignature = endpoint.getMethodSignature();
            methodMap.put(methodSignature, endpoint);
        }
        
        return methodMap;
    }
    
    /**
     * 分析具体的API变更
     */
    private void analyzeSpecificApiChanges(RestApiEndpoint oldEndpoint, 
                                          RestApiEndpoint newEndpoint, 
                                          ApiChangeAnalysisResult result) {
        // HTTP方法变更
        if (!oldEndpoint.getHttpMethod().equals(newEndpoint.getHttpMethod())) {
            ApiChange change = new ApiChange(
                ApiChange.ChangeType.MODIFIED,
                newEndpoint.getApiSignature(),
                newEndpoint.getClassName(),
                newEndpoint.getMethodName()
            );
            change.setOldValue(oldEndpoint.getHttpMethod());
            change.setNewValue(newEndpoint.getHttpMethod());
            change.setDescription("HTTP方法变更");
            change.setImpactLevel("HIGH");
            change.setBreakingChange(true);
            
            result.addApiChange(change);
        }
        
        // 路径变更
        if (!Objects.equals(oldEndpoint.getPath(), newEndpoint.getPath())) {
            ApiChange change = new ApiChange(
                ApiChange.ChangeType.MODIFIED,
                newEndpoint.getApiSignature(),
                newEndpoint.getClassName(),
                newEndpoint.getMethodName()
            );
            change.setOldValue(oldEndpoint.getPath());
            change.setNewValue(newEndpoint.getPath());
            change.setDescription("API路径变更");
            change.setImpactLevel("HIGH");
            change.setBreakingChange(true);
            
            result.addApiChange(change);
        }
        
        // 参数变更
        analyzeParameterChanges(oldEndpoint, newEndpoint, result);
        
        // 响应类型变更
        if (!Objects.equals(oldEndpoint.getProduces(), newEndpoint.getProduces())) {
            ApiChange change = new ApiChange(
                ApiChange.ChangeType.MODIFIED,
                newEndpoint.getApiSignature(),
                newEndpoint.getClassName(),
                newEndpoint.getMethodName()
            );
            change.setOldValue(String.join(", ", oldEndpoint.getProduces()));
            change.setNewValue(String.join(", ", newEndpoint.getProduces()));
            change.setDescription("响应类型变更");
            change.setImpactLevel("MEDIUM");
            change.setBreakingChange(false);
            
            result.addApiChange(change);
        }
        
        // 请求类型变更
        if (!Objects.equals(oldEndpoint.getConsumes(), newEndpoint.getConsumes())) {
            ApiChange change = new ApiChange(
                ApiChange.ChangeType.MODIFIED,
                newEndpoint.getApiSignature(),
                newEndpoint.getClassName(),
                newEndpoint.getMethodName()
            );
            change.setOldValue(String.join(", ", oldEndpoint.getConsumes()));
            change.setNewValue(String.join(", ", newEndpoint.getConsumes()));
            change.setDescription("请求类型变更");
            change.setImpactLevel("MEDIUM");
            change.setBreakingChange(true);
            
            result.addApiChange(change);
        }
        
        result.addModifiedApi(new ModifiedApiEndpoint(oldEndpoint, newEndpoint));
    }
    
    /**
     * 分析参数变更
     */
    private void analyzeParameterChanges(RestApiEndpoint oldEndpoint, 
                                        RestApiEndpoint newEndpoint, 
                                        ApiChangeAnalysisResult result) {
        Map<String, ApiParameter> oldParams = oldEndpoint.getParameters().stream()
            .collect(Collectors.toMap(ApiParameter::getName, p -> p));
        
        Map<String, ApiParameter> newParams = newEndpoint.getParameters().stream()
            .collect(Collectors.toMap(ApiParameter::getName, p -> p));
        
        // 检查删除的参数
        for (String paramName : oldParams.keySet()) {
            if (!newParams.containsKey(paramName)) {
                ApiChange change = new ApiChange(
                    ApiChange.ChangeType.MODIFIED,
                    newEndpoint.getApiSignature(),
                    newEndpoint.getClassName(),
                    newEndpoint.getMethodName()
                );
                change.setOldValue("参数: " + paramName);
                change.setDescription("删除API参数: " + paramName);
                change.setImpactLevel("HIGH");
                change.setBreakingChange(true);
                
                result.addApiChange(change);
            }
        }
        
        // 检查新增的参数
        for (String paramName : newParams.keySet()) {
            if (!oldParams.containsKey(paramName)) {
                ApiParameter newParam = newParams.get(paramName);
                ApiChange change = new ApiChange(
                    ApiChange.ChangeType.MODIFIED,
                    newEndpoint.getApiSignature(),
                    newEndpoint.getClassName(),
                    newEndpoint.getMethodName()
                );
                change.setNewValue("参数: " + paramName);
                change.setDescription("新增API参数: " + paramName);
                change.setImpactLevel(newParam.isRequired() ? "MEDIUM" : "LOW");
                change.setBreakingChange(newParam.isRequired());
                
                result.addApiChange(change);
            }
        }
        
        // 检查修改的参数
        for (String paramName : oldParams.keySet()) {
            if (newParams.containsKey(paramName)) {
                ApiParameter oldParam = oldParams.get(paramName);
                ApiParameter newParam = newParams.get(paramName);
                
                // 参数类型变更
                if (!oldParam.getType().equals(newParam.getType())) {
                    ApiChange change = new ApiChange(
                        ApiChange.ChangeType.MODIFIED,
                        newEndpoint.getApiSignature(),
                        newEndpoint.getClassName(),
                        newEndpoint.getMethodName()
                    );
                    change.setOldValue(paramName + ": " + oldParam.getType());
                    change.setNewValue(paramName + ": " + newParam.getType());
                    change.setDescription("参数类型变更: " + paramName);
                    change.setImpactLevel("HIGH");
                    change.setBreakingChange(true);
                    
                    result.addApiChange(change);
                }
                
                // 参数必要性变更
                if (oldParam.isRequired() != newParam.isRequired()) {
                    ApiChange change = new ApiChange(
                        ApiChange.ChangeType.MODIFIED,
                        newEndpoint.getApiSignature(),
                        newEndpoint.getClassName(),
                        newEndpoint.getMethodName()
                    );
                    change.setOldValue(paramName + " required: " + oldParam.isRequired());
                    change.setNewValue(paramName + " required: " + newParam.isRequired());
                    change.setDescription("参数必要性变更: " + paramName);
                    change.setImpactLevel("MEDIUM");
                    change.setBreakingChange(newParam.isRequired() && !oldParam.isRequired());
                    
                    result.addApiChange(change);
                }
            }
        }
    }
    
    /**
     * 分析破坏性变更
     */
    private void analyzeBreakingChanges(ApiChangeAnalysisResult result) {
        long breakingChangesCount = result.getApiChanges().stream()
            .mapToLong(change -> change.isBreakingChange() ? 1 : 0)
            .sum();
        
        result.setBreakingChangesCount((int) breakingChangesCount);
        
        // 设置整体风险级别
        if (breakingChangesCount > 0) {
            result.setOverallRiskLevel("HIGH");
        } else if (result.getApiChanges().size() > 5) {
            result.setOverallRiskLevel("MEDIUM");
        } else {
            result.setOverallRiskLevel("LOW");
        }
    }
    
    /**
     * API变更分析结果
     */
    public static class ApiChangeAnalysisResult {
        private List<ApiChange> apiChanges = new ArrayList<>();
        private List<RestApiEndpoint> addedApis = new ArrayList<>();
        private List<RestApiEndpoint> removedApis = new ArrayList<>();
        private List<ModifiedApiEndpoint> modifiedApis = new ArrayList<>();
        private int breakingChangesCount = 0;
        private String overallRiskLevel = "LOW";
        
        // Getters and setters
        public List<ApiChange> getApiChanges() { return apiChanges; }
        public void addApiChange(ApiChange change) { this.apiChanges.add(change); }
        
        public List<RestApiEndpoint> getAddedApis() { return addedApis; }
        public void addAddedApi(RestApiEndpoint api) { this.addedApis.add(api); }
        
        public List<RestApiEndpoint> getRemovedApis() { return removedApis; }
        public void addRemovedApi(RestApiEndpoint api) { this.removedApis.add(api); }
        
        public List<ModifiedApiEndpoint> getModifiedApis() { return modifiedApis; }
        public void addModifiedApi(ModifiedApiEndpoint api) { this.modifiedApis.add(api); }
        
        public int getBreakingChangesCount() { return breakingChangesCount; }
        public void setBreakingChangesCount(int count) { this.breakingChangesCount = count; }
        
        public String getOverallRiskLevel() { return overallRiskLevel; }
        public void setOverallRiskLevel(String level) { this.overallRiskLevel = level; }
        
        public void updateSummary() {
            // 统计各种类型的变更
        }
    }
    
    /**
     * 修改的API端点
     */
    public static class ModifiedApiEndpoint {
        private RestApiEndpoint oldEndpoint;
        private RestApiEndpoint newEndpoint;
        
        public ModifiedApiEndpoint(RestApiEndpoint oldEndpoint, RestApiEndpoint newEndpoint) {
            this.oldEndpoint = oldEndpoint;
            this.newEndpoint = newEndpoint;
        }
        
        public RestApiEndpoint getOldEndpoint() { return oldEndpoint; }
        public RestApiEndpoint getNewEndpoint() { return newEndpoint; }
    }
} 