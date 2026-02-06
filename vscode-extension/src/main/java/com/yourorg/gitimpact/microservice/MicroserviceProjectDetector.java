package com.yourorg.gitimpact.microservice;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.yourorg.gitimpact.config.AnalysisConfig;

/**
 * 微服务项目检测器
 * 智能检测微服务项目的构建配置、框架类型和架构特征
 */
public class MicroserviceProjectDetector {
    
    private static final Logger logger = LoggerFactory.getLogger(MicroserviceProjectDetector.class);
    
    private final AnalysisConfig config;
    private final Path projectRoot;
    
    public MicroserviceProjectDetector(Path projectRoot, AnalysisConfig config) {
        this.projectRoot = projectRoot;
        this.config = config;
    }
    
    /**
     * 执行完整的微服务项目检测
     */
    public MicroserviceDetectionResult detect() {
        logger.info("🔍 开始微服务项目检测: {}", projectRoot);
        
        MicroserviceDetectionResult result = new MicroserviceDetectionResult();
        
        try {
            // 1. 检测构建工具
            result.setBuildTool(detectBuildTool());
            
            // 2. 检测微服务框架
            result.setFramework(detectFramework());
            
            // 3. 检测微服务架构特征
            result.setArchitectureFeatures(detectArchitectureFeatures());
            
            // 4. 检测服务类型
            result.setServiceTypes(detectServiceTypes());
            
            // 5. 检测部署配置
            result.setDeploymentConfig(detectDeploymentConfig());
            
            // 6. 判断是否为微服务项目
            result.setIsMicroservice(determineIfMicroservice(result));
            
            // 7. 检测是否需要JAR分析
            result.setRequiresJarAnalysis(determineJarAnalysisRequirement(result));
            
            logger.info("✅ 微服务项目检测完成: {}", result);
            
        } catch (Exception e) {
            logger.error("❌ 微服务项目检测失败", e);
            result.setError(e.getMessage());
        }
        
        return result;
    }
    
    /**
     * 检测构建工具
     */
    private String detectBuildTool() {
        logger.debug("🔧 检测构建工具...");
        
        List<String> buildTools = config.getBuildTools();
        
        for (String buildTool : buildTools) {
            Path buildFile = projectRoot.resolve(buildTool);
            if (Files.exists(buildFile)) {
                String tool = mapBuildFileToTool(buildTool);
                logger.info("🔧 检测到构建工具: {} (文件: {})", tool, buildTool);
                return tool;
            }
        }
        
        // 检查子目录中的构建文件
        try (Stream<Path> paths = Files.walk(projectRoot, 3)) {
            for (String buildTool : buildTools) {
                List<Path> foundFiles = paths
                    .filter(path -> path.getFileName().toString().equals(buildTool))
                    .collect(Collectors.toList());
                
                if (!foundFiles.isEmpty()) {
                    String tool = mapBuildFileToTool(buildTool);
                    logger.info("🔧 检测到构建工具: {} (文件: {})", tool, foundFiles.get(0));
                    return tool;
                }
            }
        } catch (IOException e) {
            logger.warn("无法搜索构建文件", e);
        }
        
        logger.warn("⚠️ 未检测到构建工具");
        return "unknown";
    }
    
    /**
     * 将构建文件名映射到工具名
     */
    private String mapBuildFileToTool(String fileName) {
        switch (fileName) {
            case "pom.xml":
                return "maven";
            case "build.gradle":
            case "build.gradle.kts":
                return "gradle";
            case "build.xml":
                return "ant";
            case "BUILD":
            case "BUILD.bazel":
            case "WORKSPACE":
            case "WORKSPACE.bazel":
                return "bazel";
            case "package.json":
                return "npm";
            case "Cargo.toml":
                return "cargo";
            case "go.mod":
                return "go";
            case "requirements.txt":
            case "Pipfile":
            case "poetry.lock":
                return "python";
            case "Dockerfile":
                return "docker";
            default:
                return "unknown";
        }
    }
    
    /**
     * 检测微服务框架
     */
    private String detectFramework() {
        logger.debug("🏗️ 检测微服务框架...");
        
        Map<String, List<String>> frameworkIndicators = config.getFrameworkIndicators();
        
        for (Map.Entry<String, List<String>> entry : frameworkIndicators.entrySet()) {
            String framework = entry.getKey();
            List<String> indicators = entry.getValue();
            
            if (hasFrameworkIndicators(indicators)) {
                logger.info("🏗️ 检测到微服务框架: {}", framework);
                return framework;
            }
        }
        
        logger.warn("⚠️ 未检测到微服务框架");
        return "unknown";
    }
    
    /**
     * 检查是否存在框架指示器
     */
    private boolean hasFrameworkIndicators(List<String> indicators) {
        try (Stream<Path> paths = Files.walk(projectRoot, config.getMaxDepth())) {
            return paths
                .filter(Files::isRegularFile)
                .anyMatch(path -> {
                    String fileName = path.getFileName().toString();
                    String relativePath = projectRoot.relativize(path).toString();
                    
                    // 检查文件名和路径
                    for (String indicator : indicators) {
                        if (fileName.contains(indicator) || relativePath.contains(indicator)) {
                            return true;
                        }
                    }
                    
                    // 检查文件内容（仅对特定文件类型）
                    if (isTextFile(fileName)) {
                        try {
                            String content = Files.readString(path);
                            for (String indicator : indicators) {
                                if (content.contains(indicator)) {
                                    return true;
                                }
                            }
                        } catch (IOException e) {
                            // 忽略读取错误
                        }
                    }
                    
                    return false;
                });
        } catch (IOException e) {
            logger.warn("无法搜索框架指示器", e);
            return false;
        }
    }
    
    /**
     * 检查是否为文本文件
     */
    private boolean isTextFile(String fileName) {
        String lowerName = fileName.toLowerCase();
        return lowerName.endsWith(".java") || lowerName.endsWith(".xml") ||
               lowerName.endsWith(".yml") || lowerName.endsWith(".yaml") ||
               lowerName.endsWith(".properties") || lowerName.endsWith(".json") ||
               lowerName.endsWith(".gradle") || lowerName.endsWith(".kts") ||
               lowerName.endsWith(".go") || lowerName.endsWith(".js") ||
               lowerName.endsWith(".ts") || lowerName.endsWith(".py");
    }
    
    /**
     * 检测微服务架构特征
     */
    private List<String> detectArchitectureFeatures() {
        logger.debug("🏛️ 检测微服务架构特征...");
        
        List<String> features = new ArrayList<>();
        
        // 检查微服务目录模式
        List<String> patterns = config.getMicroservicePatterns();
        try (Stream<Path> paths = Files.walk(projectRoot, config.getMaxDepth())) {
            Set<String> foundPatterns = paths
                .filter(Files::isDirectory)
                .map(path -> projectRoot.relativize(path).toString())
                .flatMap(relativePath -> patterns.stream()
                    .filter(pattern -> matchesPattern(relativePath, pattern)))
                .collect(Collectors.toSet());
            
            features.addAll(foundPatterns);
        } catch (IOException e) {
            logger.warn("无法搜索架构特征", e);
        }
        
        // 检查配置文件
        if (hasConfigFiles()) {
            features.add("config-management");
        }
        
        // 检查服务发现
        if (hasServiceDiscovery()) {
            features.add("service-discovery");
        }
        
        // 检查API网关
        if (hasApiGateway()) {
            features.add("api-gateway");
        }
        
        logger.info("🏛️ 检测到架构特征: {}", features);
        return features;
    }
    
    /**
     * 检查是否匹配微服务模式
     */
    private boolean matchesPattern(String path, String pattern) {
        String regex = pattern.replace("*", ".*");
        return Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(path).matches();
    }
    
    /**
     * 检查是否有配置文件
     */
    private boolean hasConfigFiles() {
        try (Stream<Path> paths = Files.walk(projectRoot, 3)) {
            return paths
                .filter(Files::isRegularFile)
                .anyMatch(path -> {
                    String fileName = path.getFileName().toString().toLowerCase();
                    return fileName.contains("config") || fileName.contains("application");
                });
        } catch (IOException e) {
            return false;
        }
    }
    
    /**
     * 检查是否有服务发现
     */
    private boolean hasServiceDiscovery() {
        try (Stream<Path> paths = Files.walk(projectRoot, config.getMaxDepth())) {
            return paths
                .filter(Files::isRegularFile)
                .anyMatch(path -> {
                    String fileName = path.getFileName().toString().toLowerCase();
                    String relativePath = projectRoot.relativize(path).toString().toLowerCase();
                    return fileName.contains("eureka") || fileName.contains("consul") ||
                           fileName.contains("zookeeper") || relativePath.contains("discovery") ||
                           relativePath.contains("registry");
                });
        } catch (IOException e) {
            return false;
        }
    }
    
    /**
     * 检查是否有API网关
     */
    private boolean hasApiGateway() {
        try (Stream<Path> paths = Files.walk(projectRoot, config.getMaxDepth())) {
            return paths
                .filter(Files::isRegularFile)
                .anyMatch(path -> {
                    String fileName = path.getFileName().toString().toLowerCase();
                    String relativePath = projectRoot.relativize(path).toString().toLowerCase();
                    return fileName.contains("gateway") || fileName.contains("zuul") ||
                           relativePath.contains("gateway") || relativePath.contains("proxy");
                });
        } catch (IOException e) {
            return false;
        }
    }
    
    /**
     * 检测服务类型
     */
    private List<String> detectServiceTypes() {
        logger.debug("🔧 检测服务类型...");
        
        List<String> serviceTypes = new ArrayList<>();
        
        try (Stream<Path> paths = Files.walk(projectRoot, config.getMaxDepth())) {
            Set<String> foundServices = paths
                .filter(Files::isDirectory)
                .map(path -> projectRoot.relativize(path).toString())
                .filter(path -> isServiceDirectory(path))
                .map(this::extractServiceType)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
            
            serviceTypes.addAll(foundServices);
        } catch (IOException e) {
            logger.warn("无法搜索服务类型", e);
        }
        
        logger.info("🔧 检测到服务类型: {}", serviceTypes);
        return serviceTypes;
    }
    
    /**
     * 检查是否为服务目录
     */
    private boolean isServiceDirectory(String path) {
        String lowerPath = path.toLowerCase();
        return lowerPath.contains("service") || lowerPath.contains("api") ||
               lowerPath.contains("gateway") || lowerPath.contains("config") ||
               lowerPath.contains("registry") || lowerPath.contains("auth");
    }
    
    /**
     * 提取服务类型
     */
    private String extractServiceType(String path) {
        String lowerPath = path.toLowerCase();
        if (lowerPath.contains("user") || lowerPath.contains("account")) {
            return "user-service";
        } else if (lowerPath.contains("order") || lowerPath.contains("payment")) {
            return "order-service";
        } else if (lowerPath.contains("product") || lowerPath.contains("catalog")) {
            return "product-service";
        } else if (lowerPath.contains("gateway")) {
            return "api-gateway";
        } else if (lowerPath.contains("config")) {
            return "config-service";
        } else if (lowerPath.contains("registry") || lowerPath.contains("discovery")) {
            return "registry-service";
        } else if (lowerPath.contains("auth") || lowerPath.contains("security")) {
            return "auth-service";
        } else {
            return "unknown-service";
        }
    }
    
    /**
     * 检测部署配置
     */
    private Map<String, Object> detectDeploymentConfig() {
        logger.debug("🚀 检测部署配置...");
        
        Map<String, Object> deployment = new HashMap<>();
        
        // 检查Docker配置
        if (hasDockerConfig()) {
            deployment.put("containerization", "docker");
        }
        
        // 检查Kubernetes配置
        if (hasKubernetesConfig()) {
            deployment.put("orchestration", "kubernetes");
        }
        
        // 检查云平台配置
        String cloudPlatform = detectCloudPlatform();
        if (!"unknown".equals(cloudPlatform)) {
            deployment.put("cloud-platform", cloudPlatform);
        }
        
        logger.info("🚀 检测到部署配置: {}", deployment);
        return deployment;
    }
    
    /**
     * 检查是否有Docker配置
     */
    private boolean hasDockerConfig() {
        try (Stream<Path> paths = Files.walk(projectRoot, 3)) {
            return paths
                .filter(Files::isRegularFile)
                .anyMatch(path -> {
                    String fileName = path.getFileName().toString().toLowerCase();
                    return fileName.equals("dockerfile") || fileName.contains("docker-compose");
                });
        } catch (IOException e) {
            return false;
        }
    }
    
    /**
     * 检查是否有Kubernetes配置
     */
    private boolean hasKubernetesConfig() {
        try (Stream<Path> paths = Files.walk(projectRoot, 3)) {
            return paths
                .filter(Files::isRegularFile)
                .anyMatch(path -> {
                    String fileName = path.getFileName().toString().toLowerCase();
                    return fileName.endsWith(".yaml") || fileName.endsWith(".yml") ||
                           fileName.contains("k8s") || fileName.contains("kubernetes");
                });
        } catch (IOException e) {
            return false;
        }
    }
    
    /**
     * 检测云平台
     */
    private String detectCloudPlatform() {
        try (Stream<Path> paths = Files.walk(projectRoot, config.getMaxDepth())) {
            return paths
                .filter(Files::isRegularFile)
                .filter(path -> isTextFile(path.getFileName().toString()))
                .anyMatch(path -> {
                    try {
                        String content = Files.readString(path).toLowerCase();
                        if (content.contains("aws") || content.contains("amazon")) {
                            return true;
                        } else if (content.contains("azure") || content.contains("microsoft")) {
                            return true;
                        } else if (content.contains("gcp") || content.contains("google")) {
                            return true;
                        }
                    } catch (IOException e) {
                        // 忽略读取错误
                    }
                    return false;
                }) ? "aws" : "unknown"; // 简化返回，实际应该返回具体平台
        } catch (IOException e) {
            return "unknown";
        }
    }
    
    /**
     * 判断是否为微服务项目
     */
    private boolean determineIfMicroservice(MicroserviceDetectionResult result) {
        // 如果有微服务架构特征，认为是微服务项目
        if (!result.getArchitectureFeatures().isEmpty()) {
            return true;
        }
        
        // 如果检测到多个服务类型，认为是微服务项目
        if (result.getServiceTypes().size() > 1) {
            return true;
        }
        
        // 如果使用Spring Cloud框架，认为是微服务项目
        if ("spring-cloud".equals(result.getFramework())) {
            return true;
        }
        
        // 如果有服务发现特征，认为是微服务项目
        if (result.getArchitectureFeatures().contains("service-discovery")) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 判断是否需要JAR分析
     */
    private boolean determineJarAnalysisRequirement(MicroserviceDetectionResult result) {
        String buildTool = result.getBuildTool();
        String framework = result.getFramework();
        
        // Spring Boot项目通常需要JAR分析
        if (("maven".equals(buildTool) || "gradle".equals(buildTool)) && 
            ("spring-boot".equals(framework) || "spring-cloud".equals(framework))) {
            return true;
        }
        
        // 检查是否有JAR文件
        try (Stream<Path> paths = Files.walk(projectRoot, 3)) {
            boolean hasJarFiles = paths
                .filter(Files::isRegularFile)
                .anyMatch(path -> path.getFileName().toString().endsWith(".jar"));
            
            if (hasJarFiles) {
                return true;
            }
        } catch (IOException e) {
            logger.warn("无法检查JAR文件", e);
        }
        
        return false;
    }
    
    /**
     * 微服务检测结果类
     */
    public static class MicroserviceDetectionResult {
        private String buildTool = "unknown";
        private String framework = "unknown";
        private List<String> architectureFeatures = new ArrayList<>();
        private List<String> serviceTypes = new ArrayList<>();
        private Map<String, Object> deploymentConfig = new HashMap<>();
        private boolean isMicroservice = false;
        private boolean requiresJarAnalysis = false;
        private String error;
        
        // Getters and Setters
        public String getBuildTool() { return buildTool; }
        public void setBuildTool(String buildTool) { this.buildTool = buildTool; }
        
        public String getFramework() { return framework; }
        public void setFramework(String framework) { this.framework = framework; }
        
        public List<String> getArchitectureFeatures() { return architectureFeatures; }
        public void setArchitectureFeatures(List<String> architectureFeatures) { this.architectureFeatures = architectureFeatures; }
        
        public List<String> getServiceTypes() { return serviceTypes; }
        public void setServiceTypes(List<String> serviceTypes) { this.serviceTypes = serviceTypes; }
        
        public Map<String, Object> getDeploymentConfig() { return deploymentConfig; }
        public void setDeploymentConfig(Map<String, Object> deploymentConfig) { this.deploymentConfig = deploymentConfig; }
        
        public boolean isMicroservice() { return isMicroservice; }
        public void setIsMicroservice(boolean microservice) { isMicroservice = microservice; }
        
        public boolean isRequiresJarAnalysis() { return requiresJarAnalysis; }
        public void setRequiresJarAnalysis(boolean requiresJarAnalysis) { this.requiresJarAnalysis = requiresJarAnalysis; }
        
        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
        
        @Override
        public String toString() {
            return String.format("MicroserviceDetectionResult{buildTool='%s', framework='%s', isMicroservice=%s, requiresJarAnalysis=%s, features=%s, services=%s}",
                               buildTool, framework, isMicroservice, requiresJarAnalysis, architectureFeatures, serviceTypes);
        }
    }
} 