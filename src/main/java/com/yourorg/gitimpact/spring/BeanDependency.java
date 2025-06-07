package com.yourorg.gitimpact.spring;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Bean依赖关系信息
 */
public class BeanDependency {
    
    @JsonProperty("fromBean")
    private String fromBean;
    
    @JsonProperty("toBean")
    private String toBean;
    
    @JsonProperty("fieldName")
    private String fieldName;
    
    @JsonProperty("dependencyType")
    private String dependencyType = "AUTOWIRED";
    
    // Constructors
    public BeanDependency() {
    }
    
    public BeanDependency(String fromBean, String toBean, String fieldName) {
        this.fromBean = fromBean;
        this.toBean = toBean;
        this.fieldName = fieldName;
    }
    
    // Getters and Setters
    public String getFromBean() {
        return fromBean;
    }
    
    public void setFromBean(String fromBean) {
        this.fromBean = fromBean;
    }
    
    public String getToBean() {
        return toBean;
    }
    
    public void setToBean(String toBean) {
        this.toBean = toBean;
    }
    
    public String getFieldName() {
        return fieldName;
    }
    
    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }
    
    public String getDependencyType() {
        return dependencyType;
    }
    
    public void setDependencyType(String dependencyType) {
        this.dependencyType = dependencyType;
    }
    
    @Override
    public String toString() {
        return String.format("BeanDependency{%s -> %s via %s}", fromBean, toBean, fieldName);
    }
} 