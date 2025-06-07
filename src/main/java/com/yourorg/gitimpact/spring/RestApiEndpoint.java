package com.yourorg.gitimpact.spring;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;

/**
 * REST API端点信息
 */
public class RestApiEndpoint {
    
    @JsonProperty("className")
    private String className;
    
    @JsonProperty("methodName")
    private String methodName;
    
    @JsonProperty("httpMethod")
    private String httpMethod; // GET, POST, PUT, DELETE, etc.
    
    @JsonProperty("path")
    private String path;
    
    @JsonProperty("fullPath")
    private String fullPath; // basePath + path
    
    @JsonProperty("annotationType")
    private String annotationType; // RequestMapping, GetMapping, etc.
    
    @JsonProperty("produces")
    private List<String> produces = new ArrayList<>();
    
    @JsonProperty("consumes")
    private List<String> consumes = new ArrayList<>();
    
    @JsonProperty("parameters")
    private List<ApiParameter> parameters = new ArrayList<>();
    
    @JsonProperty("returnType")
    private String returnType;
    
    @JsonProperty("deprecated")
    private boolean deprecated = false;
    
    @JsonProperty("documented")
    private boolean documented = false;
    
    @JsonProperty("secured")
    private boolean secured = false;
    
    @JsonProperty("securityRoles")
    private List<String> securityRoles = new ArrayList<>();
    
    // Constructors
    public RestApiEndpoint() {
    }
    
    public RestApiEndpoint(String className, String methodName, String httpMethod, String path) {
        this.className = className;
        this.methodName = methodName;
        this.httpMethod = httpMethod;
        this.path = path;
    }
    
    // Getters and Setters
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
    
    public String getHttpMethod() {
        return httpMethod;
    }
    
    public void setHttpMethod(String httpMethod) {
        this.httpMethod = httpMethod;
    }
    
    public String getPath() {
        return path;
    }
    
    public void setPath(String path) {
        this.path = path;
    }
    
    public String getFullPath() {
        return fullPath;
    }
    
    public void setFullPath(String fullPath) {
        this.fullPath = fullPath;
    }
    
    public String getAnnotationType() {
        return annotationType;
    }
    
    public void setAnnotationType(String annotationType) {
        this.annotationType = annotationType;
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
    
    public List<ApiParameter> getParameters() {
        return parameters;
    }
    
    public void setParameters(List<ApiParameter> parameters) {
        this.parameters = parameters;
    }
    
    public void addParameter(ApiParameter parameter) {
        this.parameters.add(parameter);
    }
    
    public String getReturnType() {
        return returnType;
    }
    
    public void setReturnType(String returnType) {
        this.returnType = returnType;
    }
    
    public boolean isDeprecated() {
        return deprecated;
    }
    
    public void setDeprecated(boolean deprecated) {
        this.deprecated = deprecated;
    }
    
    public boolean isDocumented() {
        return documented;
    }
    
    public void setDocumented(boolean documented) {
        this.documented = documented;
    }
    
    public boolean isSecured() {
        return secured;
    }
    
    public void setSecured(boolean secured) {
        this.secured = secured;
    }
    
    public List<String> getSecurityRoles() {
        return securityRoles;
    }
    
    public void setSecurityRoles(List<String> securityRoles) {
        this.securityRoles = securityRoles;
    }
    
    /**
     * 构建完整路径（基础路径 + 方法路径）
     */
    public void buildFullPath(String basePath) {
        if (basePath != null && !basePath.isEmpty()) {
            String normalizedBasePath = basePath.startsWith("/") ? basePath : "/" + basePath;
            String normalizedPath = path != null ? path : "";
            
            if (!normalizedPath.startsWith("/") && !normalizedBasePath.endsWith("/")) {
                normalizedPath = "/" + normalizedPath;
            }
            
            this.fullPath = normalizedBasePath + normalizedPath;
        } else {
            this.fullPath = path != null ? path : "";
        }
        
        // 确保以/开头
        if (!this.fullPath.startsWith("/")) {
            this.fullPath = "/" + this.fullPath;
        }
    }
    
    /**
     * 获取API签名
     */
    public String getApiSignature() {
        return String.format("%s %s", httpMethod, fullPath != null ? fullPath : path);
    }
    
    /**
     * 获取方法签名
     */
    public String getMethodSignature() {
        return String.format("%s.%s", className, methodName);
    }
    
    /**
     * 检查是否为幂等操作
     */
    public boolean isIdempotent() {
        return "GET".equals(httpMethod) || "PUT".equals(httpMethod) || "DELETE".equals(httpMethod);
    }
    
    /**
     * 检查是否为安全操作（不改变服务器状态）
     */
    public boolean isSafe() {
        return "GET".equals(httpMethod) || "HEAD".equals(httpMethod) || "OPTIONS".equals(httpMethod);
    }
    
    /**
     * 检查参数中是否包含路径变量
     */
    public boolean hasPathVariables() {
        return parameters.stream().anyMatch(param -> "PathVariable".equals(param.getAnnotationType()));
    }
    
    /**
     * 检查参数中是否包含请求体
     */
    public boolean hasRequestBody() {
        return parameters.stream().anyMatch(param -> "RequestBody".equals(param.getAnnotationType()));
    }
    
    @Override
    public String toString() {
        return String.format("RestApiEndpoint{%s %s -> %s.%s}", 
                           httpMethod, fullPath != null ? fullPath : path, className, methodName);
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RestApiEndpoint that = (RestApiEndpoint) o;
        return className.equals(that.className) && 
               methodName.equals(that.methodName) && 
               httpMethod.equals(that.httpMethod) && 
               (path != null ? path.equals(that.path) : that.path == null);
    }
    
    @Override
    public int hashCode() {
        int result = className.hashCode();
        result = 31 * result + methodName.hashCode();
        result = 31 * result + httpMethod.hashCode();
        result = 31 * result + (path != null ? path.hashCode() : 0);
        return result;
    }
} 