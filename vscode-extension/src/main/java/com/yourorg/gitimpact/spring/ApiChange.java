package com.yourorg.gitimpact.spring;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * API变更信息
 */
public class ApiChange {
    
    public enum ChangeType {
        ADDED, REMOVED, MODIFIED, DEPRECATED
    }
    
    @JsonProperty("changeType")
    private ChangeType changeType;
    
    @JsonProperty("apiSignature")
    private String apiSignature; // HTTP Method + Path
    
    @JsonProperty("className")
    private String className;
    
    @JsonProperty("methodName")
    private String methodName;
    
    @JsonProperty("oldValue")
    private String oldValue;
    
    @JsonProperty("newValue")
    private String newValue;
    
    @JsonProperty("impactLevel")
    private String impactLevel = "MEDIUM"; // LOW, MEDIUM, HIGH, CRITICAL
    
    @JsonProperty("description")
    private String description;
    
    @JsonProperty("breakingChange")
    private boolean breakingChange = false;
    
    // Constructors
    public ApiChange() {
    }
    
    public ApiChange(ChangeType changeType, String apiSignature, String className, String methodName) {
        this.changeType = changeType;
        this.apiSignature = apiSignature;
        this.className = className;
        this.methodName = methodName;
    }
    
    // Getters and Setters
    public ChangeType getChangeType() {
        return changeType;
    }
    
    public void setChangeType(ChangeType changeType) {
        this.changeType = changeType;
    }
    
    public String getApiSignature() {
        return apiSignature;
    }
    
    public void setApiSignature(String apiSignature) {
        this.apiSignature = apiSignature;
    }
    
    public String getClassName() {
        return className;
    }
    
    public void setClassName(String className) {
        this.className = className;
    }
    
    public String getMethodName() {
        return methodName;
    }
    
    public void setMethodName(String methodName) {
        this.methodName = methodName;
    }
    
    public String getOldValue() {
        return oldValue;
    }
    
    public void setOldValue(String oldValue) {
        this.oldValue = oldValue;
    }
    
    public String getNewValue() {
        return newValue;
    }
    
    public void setNewValue(String newValue) {
        this.newValue = newValue;
    }
    
    public String getImpactLevel() {
        return impactLevel;
    }
    
    public void setImpactLevel(String impactLevel) {
        this.impactLevel = impactLevel;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public boolean isBreakingChange() {
        return breakingChange;
    }
    
    public void setBreakingChange(boolean breakingChange) {
        this.breakingChange = breakingChange;
    }
    
    @Override
    public String toString() {
        return String.format("ApiChange{%s: %s -> %s.%s}", 
                           changeType, apiSignature, className, methodName);
    }
} 