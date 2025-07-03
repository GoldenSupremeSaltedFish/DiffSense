package com.yourorg.gitimpact.config;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 分析配置类
 * 支持微服务项目的增强配置
 */
public class AnalysisConfig {
    
    // 默认配置
    private static final int DEFAULT_MAX_DEPTH = 15; // 增加深度支持微服务项目
    private static final int DEFAULT_MAX_FILES = 1000; // 增加文件数量限制
    private static final int DEFAULT_TIMEOUT_SECONDS = 300; // 5分钟超时
    
    // 微服务项目检测配置
    private static final List<String> MICROSERVICE_PATTERNS = Arrays.asList(
        "*_service", "service_*", "*-service", "service-*",
        "*_api", "api_*", "*-api", "api-*",
        "*_gateway", "gateway_*", "*-gateway", "gateway-*",
        "*_config", "config_*", "*-config", "config-*",
        "*_registry", "registry_*", "*-registry", "registry-*"
    );
    
    // 构建工具检测配置
    private static final List<String> BUILD_TOOLS = Arrays.asList(
        "pom.xml", "build.gradle", "build.gradle.kts", "build.xml",
        "BUILD", "BUILD.bazel", "WORKSPACE", "WORKSPACE.bazel",
        "package.json", "package-lock.json", "yarn.lock",
        "Cargo.toml", "Cargo.lock", "go.mod", "go.sum",
        "requirements.txt", "Pipfile", "poetry.lock",
        "Dockerfile", "docker-compose.yml", "docker-compose.yaml"
    );
    
    // 微服务框架检测配置
    private static final Map<String, List<String>> FRAMEWORK_INDICATORS = new HashMap<>();
    static {
        // Spring Boot
        FRAMEWORK_INDICATORS.put("spring-boot", Arrays.asList(
            "spring-boot-starter", "spring-boot-maven-plugin",
            "@SpringBootApplication", "SpringApplication.run",
            "application.yml", "application.properties"
        ));
        
        // Spring Cloud
        FRAMEWORK_INDICATORS.put("spring-cloud", Arrays.asList(
            "spring-cloud-starter", "spring-cloud-dependencies",
            "@EnableEurekaServer", "@EnableDiscoveryClient",
            "@EnableConfigServer", "@EnableZuulProxy"
        ));
        
        // Micronaut
        FRAMEWORK_INDICATORS.put("micronaut", Arrays.asList(
            "micronaut", "io.micronaut",
            "@MicronautApplication", "micronaut.runtime"
        ));
        
        // Quarkus
        FRAMEWORK_INDICATORS.put("quarkus", Arrays.asList(
            "quarkus", "io.quarkus",
            "@QuarkusMain", "quarkus-maven-plugin"
        ));
        
        // Go Microservices
        FRAMEWORK_INDICATORS.put("go-micro", Arrays.asList(
            "github.com/micro/go-micro", "github.com/micro/micro",
            "go-micro", "micro.NewService"
        ));
        
        // Node.js Microservices
        FRAMEWORK_INDICATORS.put("node-micro", Arrays.asList(
            "express", "fastify", "koa", "hapi",
            "micro", "microservice", "service-discovery"
        ));
    }
    
    private Path targetDirectory;
    private OutputFormat outputFormat = OutputFormat.JSON;
    private int maxDepth = DEFAULT_MAX_DEPTH;
    private int maxFiles = DEFAULT_MAX_FILES;
    private int timeoutSeconds = DEFAULT_TIMEOUT_SECONDS;
    private boolean enableMicroserviceDetection = true;
    private boolean enableBuildToolDetection = true;
    private boolean enableFrameworkDetection = true;
    private List<String> customMicroservicePatterns;
    private List<String> customBuildTools;
    private Map<String, Object> microserviceConfig = new HashMap<>();
    
    public AnalysisConfig() {
        this.targetDirectory = Paths.get(".");
    }
    
    public AnalysisConfig(Path targetDirectory) {
        this.targetDirectory = targetDirectory;
    }
    
    // Getters and Setters
    public Path getTargetDirectory() {
        return targetDirectory;
    }
    
    public void setTargetDirectory(Path targetDirectory) {
        this.targetDirectory = targetDirectory;
    }
    
    public OutputFormat getOutputFormat() {
        return outputFormat;
    }
    
    public void setOutputFormat(OutputFormat outputFormat) {
        this.outputFormat = outputFormat;
    }
    
    public int getMaxDepth() {
        return maxDepth;
    }
    
    public void setMaxDepth(int maxDepth) {
        this.maxDepth = maxDepth;
    }
    
    public int getMaxFiles() {
        return maxFiles;
    }
    
    public void setMaxFiles(int maxFiles) {
        this.maxFiles = maxFiles;
    }
    
    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }
    
    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }
    
    public boolean isEnableMicroserviceDetection() {
        return enableMicroserviceDetection;
    }
    
    public void setEnableMicroserviceDetection(boolean enableMicroserviceDetection) {
        this.enableMicroserviceDetection = enableMicroserviceDetection;
    }
    
    public boolean isEnableBuildToolDetection() {
        return enableBuildToolDetection;
    }
    
    public void setEnableBuildToolDetection(boolean enableBuildToolDetection) {
        this.enableBuildToolDetection = enableBuildToolDetection;
    }
    
    public boolean isEnableFrameworkDetection() {
        return enableFrameworkDetection;
    }
    
    public void setEnableFrameworkDetection(boolean enableFrameworkDetection) {
        this.enableFrameworkDetection = enableFrameworkDetection;
    }
    
    public List<String> getCustomMicroservicePatterns() {
        return customMicroservicePatterns;
    }
    
    public void setCustomMicroservicePatterns(List<String> customMicroservicePatterns) {
        this.customMicroservicePatterns = customMicroservicePatterns;
    }
    
    public List<String> getCustomBuildTools() {
        return customBuildTools;
    }
    
    public void setCustomBuildTools(List<String> customBuildTools) {
        this.customBuildTools = customBuildTools;
    }
    
    public Map<String, Object> getMicroserviceConfig() {
        return microserviceConfig;
    }
    
    public void setMicroserviceConfig(Map<String, Object> microserviceConfig) {
        this.microserviceConfig = microserviceConfig;
    }
    
    // 微服务检测方法
    public List<String> getMicroservicePatterns() {
        if (customMicroservicePatterns != null && !customMicroservicePatterns.isEmpty()) {
            return customMicroservicePatterns;
        }
        return MICROSERVICE_PATTERNS;
    }
    
    public List<String> getBuildTools() {
        if (customBuildTools != null && !customBuildTools.isEmpty()) {
            return customBuildTools;
        }
        return BUILD_TOOLS;
    }
    
    public Map<String, List<String>> getFrameworkIndicators() {
        return FRAMEWORK_INDICATORS;
    }
    
    /**
     * 检测项目是否为微服务架构
     */
    public boolean isMicroserviceProject() {
        if (!enableMicroserviceDetection) {
            return false;
        }
        
        // 检查微服务配置
        Object isMicroservice = microserviceConfig.get("isMicroservice");
        if (isMicroservice instanceof Boolean) {
            return (Boolean) isMicroservice;
        }
        
        return false;
    }
    
    /**
     * 获取检测到的构建工具
     */
    public String getDetectedBuildTool() {
        if (!enableBuildToolDetection) {
            return "unknown";
        }
        
        Object buildTool = microserviceConfig.get("buildTool");
        if (buildTool instanceof String) {
            return (String) buildTool;
        }
        
        return "unknown";
    }
    
    /**
     * 获取检测到的微服务框架
     */
    public String getDetectedFramework() {
        if (!enableFrameworkDetection) {
            return "unknown";
        }
        
        Object framework = microserviceConfig.get("framework");
        if (framework instanceof String) {
            return (String) framework;
        }
        
        return "unknown";
    }
    
    /**
     * 检查是否需要JAR包分析
     */
    public boolean requiresJarAnalysis() {
        String buildTool = getDetectedBuildTool();
        String framework = getDetectedFramework();
        
        // 如果使用Maven/Gradle且是Spring Boot项目，通常需要JAR分析
        if (("maven".equals(buildTool) || "gradle".equals(buildTool)) && 
            "spring-boot".equals(framework)) {
            return true;
        }
        
        // 检查配置中的明确指示
        Object requiresJar = microserviceConfig.get("requiresJarAnalysis");
        if (requiresJar instanceof Boolean) {
            return (Boolean) requiresJar;
        }
        
        return false;
    }
    
    /**
     * 获取JAR包路径模式
     */
    public List<String> getJarPathPatterns() {
        String buildTool = getDetectedBuildTool();
        
        switch (buildTool) {
            case "maven":
                return Arrays.asList(
                    "target/*.jar",
                    "target/*-jar-with-dependencies.jar",
                    "target/*-exec.jar"
                );
            case "gradle":
                return Arrays.asList(
                    "build/libs/*.jar",
                    "build/libs/*-all.jar",
                    "build/libs/*-fat.jar"
                );
            default:
                return Arrays.asList("**/*.jar");
        }
    }
    
    public enum OutputFormat {
        JSON, XML, YAML, SUMMARY
    }
} 