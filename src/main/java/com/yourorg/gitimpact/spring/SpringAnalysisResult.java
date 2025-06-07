package com.yourorg.gitimpact.spring;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

/**
 * Spring分析结果
 * 包含所有Spring相关的分析信息：Bean、REST API、事务方法、依赖注入等
 */
public class SpringAnalysisResult {
    
    @JsonProperty("springBeans")
    private List<SpringComponent> springBeans = new ArrayList<>();
    
    @JsonProperty("restEndpoints")
    private List<RestApiEndpoint> restEndpoints = new ArrayList<>();
    
    @JsonProperty("transactionalMethods")
    private List<TransactionalMethod> transactionalMethods = new ArrayList<>();
    
    @JsonProperty("dependencyInjections")
    private List<DependencyInjection> dependencyInjections = new ArrayList<>();
    
    @JsonProperty("beanDependencies")
    private List<BeanDependency> beanDependencies = new ArrayList<>();
    
    @JsonProperty("apiChanges")
    private List<ApiChange> apiChanges = new ArrayList<>();
    
    @JsonProperty("summary")
    private SpringAnalysisSummary summary = new SpringAnalysisSummary();
    
    // Getters and Setters
    public List<SpringComponent> getSpringBeans() {
        return springBeans;
    }
    
    public void setSpringBeans(List<SpringComponent> springBeans) {
        this.springBeans = springBeans;
    }
    
    public void addSpringBean(SpringComponent bean) {
        this.springBeans.add(bean);
    }
    
    public List<RestApiEndpoint> getRestEndpoints() {
        return restEndpoints;
    }
    
    public void setRestEndpoints(List<RestApiEndpoint> restEndpoints) {
        this.restEndpoints = restEndpoints;
    }
    
    public void addRestEndpoint(RestApiEndpoint endpoint) {
        this.restEndpoints.add(endpoint);
    }
    
    public List<TransactionalMethod> getTransactionalMethods() {
        return transactionalMethods;
    }
    
    public void setTransactionalMethods(List<TransactionalMethod> transactionalMethods) {
        this.transactionalMethods = transactionalMethods;
    }
    
    public void addTransactionalMethod(TransactionalMethod method) {
        this.transactionalMethods.add(method);
    }
    
    public List<DependencyInjection> getDependencyInjections() {
        return dependencyInjections;
    }
    
    public void setDependencyInjections(List<DependencyInjection> dependencyInjections) {
        this.dependencyInjections = dependencyInjections;
    }
    
    public void addDependencyInjection(DependencyInjection injection) {
        this.dependencyInjections.add(injection);
    }
    
    public List<BeanDependency> getBeanDependencies() {
        return beanDependencies;
    }
    
    public void setBeanDependencies(List<BeanDependency> beanDependencies) {
        this.beanDependencies = beanDependencies;
    }
    
    public void addBeanDependency(BeanDependency dependency) {
        this.beanDependencies.add(dependency);
    }
    
    public List<ApiChange> getApiChanges() {
        return apiChanges;
    }
    
    public void setApiChanges(List<ApiChange> apiChanges) {
        this.apiChanges = apiChanges;
    }
    
    public void addApiChange(ApiChange change) {
        this.apiChanges.add(change);
    }
    
    public SpringAnalysisSummary getSummary() {
        return summary;
    }
    
    public void setSummary(SpringAnalysisSummary summary) {
        this.summary = summary;
    }
    
    /**
     * 计算并更新汇总信息
     */
    public void updateSummary() {
        summary.setTotalBeans(springBeans.size());
        summary.setTotalRestEndpoints(restEndpoints.size());
        summary.setTotalTransactionalMethods(transactionalMethods.size());
        summary.setTotalDependencyInjections(dependencyInjections.size());
        
        // 按组件类型分组统计
        Map<String, Integer> componentTypeCount = new HashMap<>();
        for (SpringComponent bean : springBeans) {
            componentTypeCount.merge(bean.getComponentType(), 1, Integer::sum);
        }
        summary.setComponentTypeStats(componentTypeCount);
        
        // 按HTTP方法分组统计API
        Map<String, Integer> httpMethodCount = new HashMap<>();
        for (RestApiEndpoint endpoint : restEndpoints) {
            httpMethodCount.merge(endpoint.getHttpMethod(), 1, Integer::sum);
        }
        summary.setHttpMethodStats(httpMethodCount);
        
        // 统计API变更类型
        Map<String, Integer> apiChangeTypeCount = new HashMap<>();
        for (ApiChange change : apiChanges) {
            apiChangeTypeCount.merge(change.getChangeType().toString(), 1, Integer::sum);
        }
        summary.setApiChangeStats(apiChangeTypeCount);
    }
    
    /**
     * Spring分析汇总信息
     */
    public static class SpringAnalysisSummary {
        @JsonProperty("totalBeans")
        private int totalBeans;
        
        @JsonProperty("totalRestEndpoints")
        private int totalRestEndpoints;
        
        @JsonProperty("totalTransactionalMethods")
        private int totalTransactionalMethods;
        
        @JsonProperty("totalDependencyInjections")
        private int totalDependencyInjections;
        
        @JsonProperty("componentTypeStats")
        private Map<String, Integer> componentTypeStats = new HashMap<>();
        
        @JsonProperty("httpMethodStats")
        private Map<String, Integer> httpMethodStats = new HashMap<>();
        
        @JsonProperty("apiChangeStats")
        private Map<String, Integer> apiChangeStats = new HashMap<>();
        
        // Getters and Setters
        public int getTotalBeans() {
            return totalBeans;
        }
        
        public void setTotalBeans(int totalBeans) {
            this.totalBeans = totalBeans;
        }
        
        public int getTotalRestEndpoints() {
            return totalRestEndpoints;
        }
        
        public void setTotalRestEndpoints(int totalRestEndpoints) {
            this.totalRestEndpoints = totalRestEndpoints;
        }
        
        public int getTotalTransactionalMethods() {
            return totalTransactionalMethods;
        }
        
        public void setTotalTransactionalMethods(int totalTransactionalMethods) {
            this.totalTransactionalMethods = totalTransactionalMethods;
        }
        
        public int getTotalDependencyInjections() {
            return totalDependencyInjections;
        }
        
        public void setTotalDependencyInjections(int totalDependencyInjections) {
            this.totalDependencyInjections = totalDependencyInjections;
        }
        
        public Map<String, Integer> getComponentTypeStats() {
            return componentTypeStats;
        }
        
        public void setComponentTypeStats(Map<String, Integer> componentTypeStats) {
            this.componentTypeStats = componentTypeStats;
        }
        
        public Map<String, Integer> getHttpMethodStats() {
            return httpMethodStats;
        }
        
        public void setHttpMethodStats(Map<String, Integer> httpMethodStats) {
            this.httpMethodStats = httpMethodStats;
        }
        
        public Map<String, Integer> getApiChangeStats() {
            return apiChangeStats;
        }
        
        public void setApiChangeStats(Map<String, Integer> apiChangeStats) {
            this.apiChangeStats = apiChangeStats;
        }
    }
} 