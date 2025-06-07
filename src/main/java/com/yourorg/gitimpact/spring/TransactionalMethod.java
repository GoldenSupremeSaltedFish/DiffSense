package com.yourorg.gitimpact.spring;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 事务方法信息
 */
public class TransactionalMethod {
    
    @JsonProperty("className")
    private String className;
    
    @JsonProperty("methodName")
    private String methodName;
    
    @JsonProperty("propagation")
    private String propagation = "REQUIRED";
    
    @JsonProperty("isolation")
    private String isolation = "DEFAULT";
    
    @JsonProperty("readOnly")
    private boolean readOnly = false;
    
    @JsonProperty("timeout")
    private int timeout = -1;
    
    @JsonProperty("rollbackFor")
    private String rollbackFor;
    
    @JsonProperty("noRollbackFor")
    private String noRollbackFor;
    
    // Constructors
    public TransactionalMethod() {
    }
    
    public TransactionalMethod(String className, String methodName) {
        this.className = className;
        this.methodName = methodName;
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
    
    public String getPropagation() {
        return propagation;
    }
    
    public void setPropagation(String propagation) {
        this.propagation = propagation;
    }
    
    public String getIsolation() {
        return isolation;
    }
    
    public void setIsolation(String isolation) {
        this.isolation = isolation;
    }
    
    public boolean isReadOnly() {
        return readOnly;
    }
    
    public void setReadOnly(boolean readOnly) {
        this.readOnly = readOnly;
    }
    
    public int getTimeout() {
        return timeout;
    }
    
    public void setTimeout(int timeout) {
        this.timeout = timeout;
    }
    
    public String getRollbackFor() {
        return rollbackFor;
    }
    
    public void setRollbackFor(String rollbackFor) {
        this.rollbackFor = rollbackFor;
    }
    
    public String getNoRollbackFor() {
        return noRollbackFor;
    }
    
    public void setNoRollbackFor(String noRollbackFor) {
        this.noRollbackFor = noRollbackFor;
    }
    
    @Override
    public String toString() {
        return String.format("TransactionalMethod{%s.%s, propagation=%s, readOnly=%s}", 
                           className, methodName, propagation, readOnly);
    }
} 