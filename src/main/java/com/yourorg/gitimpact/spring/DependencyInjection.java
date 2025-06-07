package com.yourorg.gitimpact.spring;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 依赖注入信息
 */
public class DependencyInjection {
    
    @JsonProperty("ownerClass")
    private String ownerClass;
    
    @JsonProperty("fieldName")
    private String fieldName;
    
    @JsonProperty("fieldType")
    private String fieldType;
    
    @JsonProperty("injectionType")
    private String injectionType; // Autowired, Resource, etc.
    
    @JsonProperty("qualifier")
    private String qualifier;
    
    @JsonProperty("configValue")
    private String configValue; // for @Value
    
    @JsonProperty("required")
    private boolean required = true;
    
    @JsonProperty("lazy")
    private boolean lazy = false;
    
    // Constructors
    public DependencyInjection() {
    }
    
    public DependencyInjection(String ownerClass, String fieldName, String fieldType, String injectionType) {
        this.ownerClass = ownerClass;
        this.fieldName = fieldName;
        this.fieldType = fieldType;
        this.injectionType = injectionType;
    }
    
    // Getters and Setters
    public String getOwnerClass() {
        return ownerClass;
    }
    
    public void setOwnerClass(String ownerClass) {
        this.ownerClass = ownerClass;
    }
    
    public String getFieldName() {
        return fieldName;
    }
    
    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }
    
    public String getFieldType() {
        return fieldType;
    }
    
    public void setFieldType(String fieldType) {
        this.fieldType = fieldType;
    }
    
    public String getInjectionType() {
        return injectionType;
    }
    
    public void setInjectionType(String injectionType) {
        this.injectionType = injectionType;
    }
    
    public String getQualifier() {
        return qualifier;
    }
    
    public void setQualifier(String qualifier) {
        this.qualifier = qualifier;
    }
    
    public String getConfigValue() {
        return configValue;
    }
    
    public void setConfigValue(String configValue) {
        this.configValue = configValue;
    }
    
    public boolean isRequired() {
        return required;
    }
    
    public void setRequired(boolean required) {
        this.required = required;
    }
    
    public boolean isLazy() {
        return lazy;
    }
    
    public void setLazy(boolean lazy) {
        this.lazy = lazy;
    }
    
    @Override
    public String toString() {
        return String.format("DependencyInjection{%s.%s -> %s (%s)}", 
                           ownerClass, fieldName, fieldType, injectionType);
    }
} 