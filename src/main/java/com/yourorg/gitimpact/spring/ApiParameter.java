package com.yourorg.gitimpact.spring;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * API参数信息
 */
public class ApiParameter {
    
    @JsonProperty("name")
    private String name;
    
    @JsonProperty("type")
    private String type;
    
    @JsonProperty("annotationType")
    private String annotationType; // RequestParam, PathVariable, RequestBody, etc.
    
    @JsonProperty("value")
    private String value; // 注解的value属性
    
    @JsonProperty("required")
    private boolean required = true;
    
    @JsonProperty("defaultValue")
    private String defaultValue;
    
    @JsonProperty("description")
    private String description;
    
    // Constructors
    public ApiParameter() {
    }
    
    public ApiParameter(String name, String type, String annotationType) {
        this.name = name;
        this.type = type;
        this.annotationType = annotationType;
    }
    
    // Getters and Setters
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public String getType() {
        return type;
    }
    
    public void setType(String type) {
        this.type = type;
    }
    
    public String getAnnotationType() {
        return annotationType;
    }
    
    public void setAnnotationType(String annotationType) {
        this.annotationType = annotationType;
    }
    
    public String getValue() {
        return value;
    }
    
    public void setValue(String value) {
        this.value = value;
    }
    
    public boolean isRequired() {
        return required;
    }
    
    public void setRequired(boolean required) {
        this.required = required;
    }
    
    public String getDefaultValue() {
        return defaultValue;
    }
    
    public void setDefaultValue(String defaultValue) {
        this.defaultValue = defaultValue;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    @Override
    public String toString() {
        return String.format("ApiParameter{name='%s', type='%s', annotation='%s'}", 
                           name, type, annotationType);
    }
} 