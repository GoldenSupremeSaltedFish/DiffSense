package com.yourorg.gitimpact.spring;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.yourorg.gitimpact.config.AnalysisConfig;
import com.yourorg.gitimpact.spoon.DiffBasedSpoonLauncher;

import spoon.reflect.CtModel;

/**
 * Spring增强分析器
 * 整合所有Spring相关的分析功能：
 * - Spring注解分析
 * - REST API路由提取
 * - 事务方法识别
 * - Bean依赖分析
 * - HTTP API路由变更检测
 */
public class SpringEnhancedAnalyzer {
    private static final Logger logger = LoggerFactory.getLogger(SpringEnhancedAnalyzer.class);
    
    private final List<Path> sourceFiles;
    private final Path baseDir;
    private final AnalysisConfig config;
    
    public SpringEnhancedAnalyzer(List<Path> sourceFiles, Path baseDir, AnalysisConfig config) {
        this.sourceFiles = sourceFiles;
        this.baseDir = baseDir;
        this.config = config;
    }
    
    /**
     * 执行完整的Spring增强分析
     */
    public SpringEnhancedResult analyzeSpringProject() {
        logger.info("开始Spring项目增强分析...");
        
        SpringEnhancedResult result = new SpringEnhancedResult();
        
        try {
            // 构建Spoon模型
            DiffBasedSpoonLauncher launcher = new DiffBasedSpoonLauncher(sourceFiles, baseDir, config);
            CtModel model = launcher.buildPartialModel();
            
            if (model == null) {
                logger.warn("无法构建Spoon模型，跳过Spring分析");
                return result;
            }
            
            // 执行Spring注解分析
            SpringAnnotationAnalyzer annotationAnalyzer = new SpringAnnotationAnalyzer(model, config);
            SpringAnalysisResult springAnalysis = annotationAnalyzer.analyze();
            result.setSpringAnalysis(springAnalysis);
            
            // 提取HTTP API路由信息
            extractHttpApiRoutes(springAnalysis, result);
            
            // 分析Spring Context信息
            analyzeSpringContext(springAnalysis, result);
            
            // 生成Spring分析报告
            generateSpringReport(result);
            
            logger.info("Spring项目增强分析完成");
            
        } catch (Exception e) {
            logger.error("Spring增强分析失败", e);
            result.setError("Spring分析失败: " + e.getMessage());
        }
        
        return result;
    }
    
    /**
     * 提取HTTP API路由信息
     */
    private void extractHttpApiRoutes(SpringAnalysisResult springAnalysis, SpringEnhancedResult result) {
        logger.info("提取HTTP API路由信息...");
        
        List<HttpRoute> routes = new ArrayList<>();
        
        for (RestApiEndpoint endpoint : springAnalysis.getRestEndpoints()) {
            HttpRoute route = new HttpRoute();
            route.setMethod(endpoint.getHttpMethod());
            route.setPath(endpoint.getFullPath() != null ? endpoint.getFullPath() : endpoint.getPath());
            route.setControllerClass(endpoint.getClassName());
            route.setControllerMethod(endpoint.getMethodName());
            route.setProduces(endpoint.getProduces());
            route.setConsumes(endpoint.getConsumes());
            route.setParameters(convertToRouteParameters(endpoint.getParameters()));
            route.setSecured(endpoint.isSecured());
            route.setDeprecated(endpoint.isDeprecated());
            
            routes.add(route);
        }
        
        result.setHttpRoutes(routes);
        logger.info("提取到{}个HTTP路由", routes.size());
    }
    
    /**
     * 转换API参数为路由参数
     */
    private List<RouteParameter> convertToRouteParameters(List<ApiParameter> apiParameters) {
        List<RouteParameter> routeParams = new ArrayList<>();
        
        for (ApiParameter apiParam : apiParameters) {
            RouteParameter routeParam = new RouteParameter();
            routeParam.setName(apiParam.getName());
            routeParam.setType(apiParam.getType());
            routeParam.setParameterType(apiParam.getAnnotationType());
            routeParam.setRequired(apiParam.isRequired());
            routeParam.setDefaultValue(apiParam.getDefaultValue());
            
            routeParams.add(routeParam);
        }
        
        return routeParams;
    }
    
    /**
     * 分析Spring Context信息
     */
    private void analyzeSpringContext(SpringAnalysisResult springAnalysis, SpringEnhancedResult result) {
        logger.info("分析Spring Context信息...");
        
        SpringContextInfo contextInfo = new SpringContextInfo();
        
        // 统计各类型Bean
        Map<String, Integer> beanTypeStats = new HashMap<>();
        for (SpringComponent bean : springAnalysis.getSpringBeans()) {
            beanTypeStats.merge(bean.getComponentType(), 1, Integer::sum);
        }
        contextInfo.setBeanTypeStatistics(beanTypeStats);
        
        // 分析Bean依赖关系
        List<String> circularDependencies = detectCircularDependencies(springAnalysis.getBeanDependencies());
        contextInfo.setCircularDependencies(circularDependencies);
        
        // 分析事务配置
        Map<String, List<String>> transactionalClasses = new HashMap<>();
        for (TransactionalMethod txMethod : springAnalysis.getTransactionalMethods()) {
            transactionalClasses.computeIfAbsent(txMethod.getClassName(), k -> new ArrayList<>())
                              .add(txMethod.getMethodName());
        }
        contextInfo.setTransactionalClasses(transactionalClasses);
        
        result.setSpringContext(contextInfo);
    }
    
    /**
     * 检测循环依赖
     */
    private List<String> detectCircularDependencies(List<BeanDependency> dependencies) {
        // 简化的循环依赖检测逻辑
        Map<String, List<String>> dependencyGraph = new HashMap<>();
        
        for (BeanDependency dep : dependencies) {
            dependencyGraph.computeIfAbsent(dep.getFromBean(), k -> new ArrayList<>())
                          .add(dep.getToBean());
        }
        
        List<String> circularDeps = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        Set<String> visiting = new HashSet<>();
        
        for (String bean : dependencyGraph.keySet()) {
            if (!visited.contains(bean)) {
                detectCircularDependenciesRecursive(bean, dependencyGraph, visited, visiting, circularDeps);
            }
        }
        
        return circularDeps;
    }
    
    /**
     * 递归检测循环依赖
     */
    private void detectCircularDependenciesRecursive(String bean, 
                                                   Map<String, List<String>> graph, 
                                                   Set<String> visited, 
                                                   Set<String> visiting, 
                                                   List<String> circularDeps) {
        visiting.add(bean);
        
        List<String> dependencies = graph.get(bean);
        if (dependencies != null) {
            for (String dep : dependencies) {
                if (visiting.contains(dep)) {
                    circularDeps.add(bean + " -> " + dep);
                } else if (!visited.contains(dep)) {
                    detectCircularDependenciesRecursive(dep, graph, visited, visiting, circularDeps);
                }
            }
        }
        
        visiting.remove(bean);
        visited.add(bean);
    }
    
    /**
     * 生成Spring分析报告
     */
    private void generateSpringReport(SpringEnhancedResult result) {
        logger.info("生成Spring分析报告...");
        
        SpringAnalysisReport report = new SpringAnalysisReport();
        
        SpringAnalysisResult springAnalysis = result.getSpringAnalysis();
        if (springAnalysis != null) {
            springAnalysis.updateSummary();
            report.setSummary(springAnalysis.getSummary());
            
            // 生成关键指标
            report.setTotalBeans(springAnalysis.getSpringBeans().size());
            report.setTotalRestEndpoints(springAnalysis.getRestEndpoints().size());
            report.setTotalTransactionalMethods(springAnalysis.getTransactionalMethods().size());
            
            // 分析潜在问题
            List<String> potentialIssues = new ArrayList<>();
            
            // 检查未使用的Bean
            // TODO: 实现未使用Bean检测
            
            // 检查缺少事务的数据库操作
            // TODO: 实现事务遗漏检测
            
            // 检查API安全配置
            long unsecuredApiCount = springAnalysis.getRestEndpoints().stream()
                .mapToLong(endpoint -> endpoint.isSecured() ? 0 : 1)
                .sum();
            
            if (unsecuredApiCount > 0) {
                potentialIssues.add("发现" + unsecuredApiCount + "个未配置安全的API端点");
            }
            
            report.setPotentialIssues(potentialIssues);
        }
        
        result.setAnalysisReport(report);
    }
    
    /**
     * Spring增强分析结果
     */
    public static class SpringEnhancedResult {
        private SpringAnalysisResult springAnalysis;
        private List<HttpRoute> httpRoutes = new ArrayList<>();
        private SpringContextInfo springContext;
        private SpringAnalysisReport analysisReport;
        private String error;
        
        // Getters and Setters
        public SpringAnalysisResult getSpringAnalysis() { return springAnalysis; }
        public void setSpringAnalysis(SpringAnalysisResult springAnalysis) { this.springAnalysis = springAnalysis; }
        
        public List<HttpRoute> getHttpRoutes() { return httpRoutes; }
        public void setHttpRoutes(List<HttpRoute> httpRoutes) { this.httpRoutes = httpRoutes; }
        
        public SpringContextInfo getSpringContext() { return springContext; }
        public void setSpringContext(SpringContextInfo springContext) { this.springContext = springContext; }
        
        public SpringAnalysisReport getAnalysisReport() { return analysisReport; }
        public void setAnalysisReport(SpringAnalysisReport analysisReport) { this.analysisReport = analysisReport; }
        
        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
    }
    
    /**
     * HTTP路由信息
     */
    public static class HttpRoute {
        private String method;
        private String path;
        private String controllerClass;
        private String controllerMethod;
        private List<String> produces = new ArrayList<>();
        private List<String> consumes = new ArrayList<>();
        private List<RouteParameter> parameters = new ArrayList<>();
        private boolean secured;
        private boolean deprecated;
        
        // Getters and Setters
        public String getMethod() { return method; }
        public void setMethod(String method) { this.method = method; }
        
        public String getPath() { return path; }
        public void setPath(String path) { this.path = path; }
        
        public String getControllerClass() { return controllerClass; }
        public void setControllerClass(String controllerClass) { this.controllerClass = controllerClass; }
        
        public String getControllerMethod() { return controllerMethod; }
        public void setControllerMethod(String controllerMethod) { this.controllerMethod = controllerMethod; }
        
        public List<String> getProduces() { return produces; }
        public void setProduces(List<String> produces) { this.produces = produces; }
        
        public List<String> getConsumes() { return consumes; }
        public void setConsumes(List<String> consumes) { this.consumes = consumes; }
        
        public List<RouteParameter> getParameters() { return parameters; }
        public void setParameters(List<RouteParameter> parameters) { this.parameters = parameters; }
        
        public boolean isSecured() { return secured; }
        public void setSecured(boolean secured) { this.secured = secured; }
        
        public boolean isDeprecated() { return deprecated; }
        public void setDeprecated(boolean deprecated) { this.deprecated = deprecated; }
        
        public String getRouteSignature() {
            return method + " " + path;
        }
    }
    
    /**
     * 路由参数信息
     */
    public static class RouteParameter {
        private String name;
        private String type;
        private String parameterType; // RequestParam, PathVariable, etc.
        private boolean required;
        private String defaultValue;
        
        // Getters and Setters
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        
        public String getParameterType() { return parameterType; }
        public void setParameterType(String parameterType) { this.parameterType = parameterType; }
        
        public boolean isRequired() { return required; }
        public void setRequired(boolean required) { this.required = required; }
        
        public String getDefaultValue() { return defaultValue; }
        public void setDefaultValue(String defaultValue) { this.defaultValue = defaultValue; }
    }
    
    /**
     * Spring Context信息
     */
    public static class SpringContextInfo {
        private Map<String, Integer> beanTypeStatistics = new HashMap<>();
        private List<String> circularDependencies = new ArrayList<>();
        private Map<String, List<String>> transactionalClasses = new HashMap<>();
        
        // Getters and Setters
        public Map<String, Integer> getBeanTypeStatistics() { return beanTypeStatistics; }
        public void setBeanTypeStatistics(Map<String, Integer> stats) { this.beanTypeStatistics = stats; }
        
        public List<String> getCircularDependencies() { return circularDependencies; }
        public void setCircularDependencies(List<String> deps) { this.circularDependencies = deps; }
        
        public Map<String, List<String>> getTransactionalClasses() { return transactionalClasses; }
        public void setTransactionalClasses(Map<String, List<String>> classes) { this.transactionalClasses = classes; }
    }
    
    /**
     * Spring分析报告
     */
    public static class SpringAnalysisReport {
        private SpringAnalysisResult.SpringAnalysisSummary summary;
        private int totalBeans;
        private int totalRestEndpoints;
        private int totalTransactionalMethods;
        private List<String> potentialIssues = new ArrayList<>();
        
        // Getters and Setters
        public SpringAnalysisResult.SpringAnalysisSummary getSummary() { return summary; }
        public void setSummary(SpringAnalysisResult.SpringAnalysisSummary summary) { this.summary = summary; }
        
        public int getTotalBeans() { return totalBeans; }
        public void setTotalBeans(int totalBeans) { this.totalBeans = totalBeans; }
        
        public int getTotalRestEndpoints() { return totalRestEndpoints; }
        public void setTotalRestEndpoints(int totalRestEndpoints) { this.totalRestEndpoints = totalRestEndpoints; }
        
        public int getTotalTransactionalMethods() { return totalTransactionalMethods; }
        public void setTotalTransactionalMethods(int totalTransactionalMethods) { this.totalTransactionalMethods = totalTransactionalMethods; }
        
        public List<String> getPotentialIssues() { return potentialIssues; }
        public void setPotentialIssues(List<String> potentialIssues) { this.potentialIssues = potentialIssues; }
    }
} 