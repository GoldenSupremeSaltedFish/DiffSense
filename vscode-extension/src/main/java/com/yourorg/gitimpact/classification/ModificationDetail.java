package com.yourorg.gitimpact.classification;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 细粒度修改详情
 * 描述一个具体的修改，包含类型、描述、文件路径等信息
 */
public class ModificationDetail {
    
    @JsonProperty("type")
    private final ModificationType type;
    
    @JsonProperty("description")
    private final String description;
    
    @JsonProperty("file")
    private final String file;
    
    @JsonProperty("line")
    private final Integer line;
    
    @JsonProperty("method")
    private final String method;
    
    @JsonProperty("confidence")
    private final Double confidence;
    
    @JsonProperty("indicators")
    private final String[] indicators;
    
    @JsonCreator
    public ModificationDetail(
        @JsonProperty("type") ModificationType type,
        @JsonProperty("description") String description,
        @JsonProperty("file") String file,
        @JsonProperty("line") Integer line,
        @JsonProperty("method") String method,
        @JsonProperty("confidence") Double confidence,
        @JsonProperty("indicators") String[] indicators
    ) {
        this.type = type;
        this.description = description;
        this.file = file;
        this.line = line;
        this.method = method;
        this.confidence = confidence != null ? confidence : 1.0;
        this.indicators = indicators != null ? indicators : new String[0];
    }
    
    // 简化构造函数
    public ModificationDetail(ModificationType type, String description, String file) {
        this(type, description, file, null, null, 1.0, new String[0]);
    }
    
    public ModificationDetail(ModificationType type, String description, String file, String method) {
        this(type, description, file, null, method, 1.0, new String[0]);
    }
    
    public ModificationDetail(ModificationType type, String description, String file, String method, Double confidence) {
        this(type, description, file, null, method, confidence, new String[0]);
    }
    
    // Getter方法
    public ModificationType getType() { return type; }
    public String getDescription() { return description; }
    public String getFile() { return file; }
    public Integer getLine() { return line; }
    public String getMethod() { return method; }
    public Double getConfidence() { return confidence; }
    public String[] getIndicators() { return indicators; }
    
    /**
     * 转换为Map格式，用于JSON序列化
     */
    public java.util.Map<String, Object> toMap() {
        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("type", type.getCode());
        result.put("typeName", type.getDisplayName());
        result.put("description", description);
        result.put("file", file);
        result.put("line", line);
        result.put("method", method);
        result.put("confidence", confidence);
        result.put("indicators", indicators);
        return result;
    }
    
    @Override
    public String toString() {
        return String.format("ModificationDetail{type=%s, description='%s', file='%s', method='%s'}", 
            type.getCode(), description, file, method);
    }
} 