package com.yourorg.gitimpact.spring;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Spring组件（Bean）信息
 */
public class SpringComponent {
    
    @JsonProperty("className")
    private String className;
    
    @JsonProperty("simpleName")
    private String simpleName;
    
    @JsonProperty("componentType")
    private String componentType; // Service, Controller, Repository, etc.
    
    @JsonProperty("beanName")
    private String beanName;
    
    @JsonProperty("basePath")
    private String basePath; // for Controllers
    
    @JsonProperty("produces")
    private List<String> produces = new ArrayList<>();
    
    @JsonProperty("consumes")
    private List<String> consumes = new ArrayList<>();
    
    @JsonProperty("dependencies")
    private List<String> dependencies = new ArrayList<>();
    
    @JsonProperty("scope")
    private String scope = "singleton"; // singleton, prototype, etc.
    
    @JsonProperty("lazy")
    private boolean lazy = false;
    
    @JsonProperty("primary")
    private boolean primary = false;
    
    // Constructors
    public SpringComponent() {
    }
    
    public SpringComponent(String className, String componentType) {
        this.className = className;
        this.componentType = componentType;
        this.simpleName = className.substring(className.lastIndexOf('.') + 1);
    }
    
    // Getters and Setters
    public String getClassName() {
        return className;
    }
    
    public void setClassName(String className) {
        this.className = className;
    }
    
    public String getSimpleName() {
        return simpleName;
    }
    
    public void setSimpleName(String simpleName) {
        this.simpleName = simpleName;
    }
    
    public String getComponentType() {
        return componentType;
    }
    
    public void setComponentType(String componentType) {
        this.componentType = componentType;
    }
    
    public String getBeanName() {
        return beanName;
    }
    
    public void setBeanName(String beanName) {
        this.beanName = beanName;
    }
    
    public String getBasePath() {
        return basePath;
    }
    
    public void setBasePath(String basePath) {
        this.basePath = basePath;
    }
    
    public List<String> getProduces() {
        return produces;
    }
    
    public void setProduces(List<String> produces) {
        this.produces = produces;
    }
    
    public List<String> getConsumes() {
        return consumes;
    }
    
    public void setConsumes(List<String> consumes) {
        this.consumes = consumes;
    }
    
    public List<String> getDependencies() {
        return dependencies;
    }
    
    public void setDependencies(List<String> dependencies) {
        this.dependencies = dependencies;
    }
    
    public void addDependency(String dependency) {
        if (!this.dependencies.contains(dependency)) {
            this.dependencies.add(dependency);
        }
    }
    
    public String getScope() {
        return scope;
    }
    
    public void setScope(String scope) {
        this.scope = scope;
    }
    
    public boolean isLazy() {
        return lazy;
    }
    
    public void setLazy(boolean lazy) {
        this.lazy = lazy;
    }
    
    public boolean isPrimary() {
        return primary;
    }
    
    public void setPrimary(boolean primary) {
        this.primary = primary;
    }
    
    /**
     * 检查是否为控制器组件
     */
    public boolean isController() {
        return "Controller".equals(componentType) || "RestController".equals(componentType);
    }
    
    /**
     * 检查是否为服务组件
     */
    public boolean isService() {
        return "Service".equals(componentType);
    }
    
    /**
     * 检查是否为存储库组件
     */
    public boolean isRepository() {
        return "Repository".equals(componentType);
    }
    
    /**
     * 检查是否为配置组件
     */
    public boolean isConfiguration() {
        return "Configuration".equals(componentType);
    }
    
    @Override
    public String toString() {
        return String.format("SpringComponent{className='%s', componentType='%s', beanName='%s'}", 
                           className, componentType, beanName);
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SpringComponent that = (SpringComponent) o;
        return className != null ? className.equals(that.className) : that.className == null;
    }
    
    @Override
    public int hashCode() {
        return className != null ? className.hashCode() : 0;
    }
} 