package com.yourorg.gitimpact.classification;

/**
 * 细粒度变更类型枚举
 * 用于描述具体的修改类型，支持一个提交包含多种修改类型
 */
public enum ModificationType {
    // 行为变更类
    BEHAVIOR_CHANGE("behavior-change", "行为变更", "修改了方法的核心逻辑或业务行为"),
    INTERFACE_CHANGE("interface-change", "接口变更", "修改了方法签名、参数或返回类型"),
    API_ENDPOINT_CHANGE("api-endpoint-change", "API端点变更", "修改了REST API的路径、方法或参数"),
    
    // 数据变更类
    DATA_STRUCTURE_CHANGE("data-structure-change", "数据结构变更", "修改了实体类、DTO或数据库结构"),
    CONFIG_CHANGE("config-change", "配置变更", "修改了配置文件、环境变量或系统参数"),
    
    // 代码质量类
    REFACTOR("refactor", "代码重构", "重构代码结构，不改变外部行为"),
    LOGGING_ADDED("logging-added", "日志增强", "添加或修改了日志记录"),
    LOGGING_REMOVED("logging-removed", "日志移除", "删除了日志记录"),
    COMMENT_CHANGE("comment-change", "注释变更", "仅修改了注释或文档"),
    
    // 测试相关
    TEST_ADDED("test-added", "测试新增", "添加了新的测试用例"),
    TEST_MODIFIED("test-modified", "测试修改", "修改了现有测试用例"),
    TEST_REMOVED("test-removed", "测试移除", "删除了测试用例"),
    
    // 依赖和框架
    DEPENDENCY_ADDED("dependency-added", "依赖新增", "添加了新的依赖项"),
    DEPENDENCY_REMOVED("dependency-removed", "依赖移除", "移除了依赖项"),
    DEPENDENCY_UPDATED("dependency-updated", "依赖更新", "更新了依赖版本"),
    
    // 性能和安全
    PERFORMANCE_OPTIMIZATION("performance-optimization", "性能优化", "优化了性能相关的代码"),
    SECURITY_ENHANCEMENT("security-enhancement", "安全增强", "增强了安全相关的功能"),
    
    // 其他
    FORMATTING_CHANGE("formatting-change", "格式调整", "仅调整了代码格式，无逻辑变更"),
    UNKNOWN("unknown", "未知类型", "无法识别的变更类型");
    
    private final String code;
    private final String displayName;
    private final String description;
    
    ModificationType(String code, String displayName, String description) {
        this.code = code;
        this.displayName = displayName;
        this.description = description;
    }
    
    public String getCode() { return code; }
    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
    
    /**
     * 根据代码获取枚举值
     */
    public static ModificationType fromCode(String code) {
        for (ModificationType type : values()) {
            if (type.code.equals(code)) {
                return type;
            }
        }
        return UNKNOWN;
    }
} 