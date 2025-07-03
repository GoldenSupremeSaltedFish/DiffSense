package com.yourorg.gitimpact.cli;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.yourorg.gitimpact.config.AnalysisConfig;
import com.yourorg.gitimpact.impact.ImpactAnalyzer;
import com.yourorg.gitimpact.microservice.MicroserviceProjectDetector;
import com.yourorg.gitimpact.microservice.MicroserviceProjectDetector.MicroserviceDetectionResult;

import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

/**
 * 增强分析命令
 * 集成微服务项目检测和智能分析
 */
@Command(
    name = "enhanced-analyze",
    description = "增强代码影响分析 - 支持微服务项目智能检测",
    mixinStandardHelpOptions = true
)
public class EnhancedAnalyzeCommand implements Callable<Integer> {
    
    @Option(
        names = {"--project", "-p"},
        description = "项目路径 (默认: .)",
        defaultValue = "."
    )
    private String projectPath;
    
    @Option(
        names = {"--output", "-o"},
        description = "输出文件路径 (默认: enhanced-analysis.json)"
    )
    private String outputFile;
    
    @Option(
        names = {"--format", "-f"},
        description = "输出格式: json|summary (默认: json)",
        defaultValue = "json"
    )
    private String format;
    
    @Option(
        names = {"--enable-microservice-detection"},
        description = "启用微服务项目检测 (默认: true)",
        defaultValue = "true"
    )
    private boolean enableMicroserviceDetection;
    
    @Option(
        names = {"--enable-build-tool-detection"},
        description = "启用构建工具检测 (默认: true)",
        defaultValue = "true"
    )
    private boolean enableBuildToolDetection;
    
    @Option(
        names = {"--enable-framework-detection"},
        description = "启用框架检测 (默认: true)",
        defaultValue = "true"
    )
    private boolean enableFrameworkDetection;
    
    @Option(
        names = {"--max-depth"},
        description = "分析深度限制 (默认: 15)",
        defaultValue = "15"
    )
    private Integer maxDepth;
    
    @Option(
        names = {"--timeout"},
        description = "分析超时时间(秒) (默认: 300)",
        defaultValue = "300"
    )
    private Integer timeoutSeconds;
    
    @Override
    public Integer call() throws Exception {
        System.out.println("🚀 DiffSense 增强分析器启动");
        System.out.println("📁 项目路径: " + projectPath);
        
        try {
            // 1. 验证项目路径
            Path projectDir = Paths.get(projectPath).toAbsolutePath();
            if (!Files.exists(projectDir)) {
                System.err.println("❌ 项目路径不存在: " + projectPath);
                return 1;
            }
            
            // 2. 创建分析配置
            AnalysisConfig config = createAnalysisConfig(projectDir);
            
            // 3. 执行微服务项目检测
            MicroserviceDetectionResult microserviceResult = null;
            if (enableMicroserviceDetection) {
                System.out.println("🔍 开始微服务项目检测...");
                MicroserviceProjectDetector detector = new MicroserviceProjectDetector(projectDir, config);
                microserviceResult = detector.detect();
                
                // 输出检测结果
                printMicroserviceDetectionResult(microserviceResult);
                
                // 更新配置
                updateConfigWithMicroserviceResult(config, microserviceResult);
            }
            
            // 4. 执行代码影响分析
            System.out.println("📊 开始代码影响分析...");
            
            // 收集源文件
            List<Path> sourceFiles = collectSourceFiles(projectDir);
            if (sourceFiles.isEmpty()) {
                System.err.println("❌ 未找到可分析的源文件");
                return 1;
            }
            
            ImpactAnalyzer analyzer = new ImpactAnalyzer(sourceFiles, projectDir, config);
            
            // 构建调用图
            analyzer.buildCallGraph();
            
            // 执行分析（这里需要提供变更的方法列表）
            // 由于这是一个示例，我们创建一个空的分析结果
            Map<String, Object> analysisResult = new HashMap<>();
            analysisResult.put("totalFiles", sourceFiles.size());
            analysisResult.put("totalMethods", 0);
            analysisResult.put("message", "分析器已初始化，需要提供具体的变更方法列表进行影响分析");
            
            // 5. 合并结果
            Map<String, Object> enhancedResult = new HashMap<>();
            enhancedResult.put("timestamp", java.time.Instant.now().toString());
            enhancedResult.put("projectPath", projectPath);
            enhancedResult.put("analysisResult", analysisResult);
            
            if (microserviceResult != null) {
                enhancedResult.put("microserviceDetection", convertToMap(microserviceResult));
            }
            
            // 6. 输出结果
            outputResult(enhancedResult);
            
            System.out.println("✅ 增强分析完成");
            return 0;
            
        } catch (Exception e) {
            System.err.println("❌ 分析失败: " + e.getMessage());
            e.printStackTrace();
            return 1;
        }
    }
    
    /**
     * 创建分析配置
     */
    private AnalysisConfig createAnalysisConfig(Path projectDir) {
        AnalysisConfig config = new AnalysisConfig(projectDir);
        config.setMaxDepth(maxDepth);
        config.setTimeoutSeconds(timeoutSeconds);
        config.setEnableMicroserviceDetection(enableMicroserviceDetection);
        config.setEnableBuildToolDetection(enableBuildToolDetection);
        config.setEnableFrameworkDetection(enableFrameworkDetection);
        
        // 设置输出格式
        switch (format.toLowerCase()) {
            case "summary":
                config.setOutputFormat(AnalysisConfig.OutputFormat.SUMMARY);
                break;
            case "json":
            default:
                config.setOutputFormat(AnalysisConfig.OutputFormat.JSON);
                break;
        }
        
        return config;
    }
    
    /**
     * 打印微服务检测结果
     */
    private void printMicroserviceDetectionResult(MicroserviceDetectionResult result) {
        System.out.println("\n🔍 微服务项目检测结果:");
        System.out.println("  📦 构建工具: " + result.getBuildTool());
        System.out.println("  🏗️ 框架: " + result.getFramework());
        System.out.println("  🏛️ 架构特征: " + result.getArchitectureFeatures());
        System.out.println("  🔧 服务类型: " + result.getServiceTypes());
        System.out.println("  🚀 部署配置: " + result.getDeploymentConfig());
        System.out.println("  ✅ 是否微服务: " + result.isMicroservice());
        System.out.println("  📦 需要JAR分析: " + result.isRequiresJarAnalysis());
        
        if (result.getError() != null) {
            System.out.println("  ❌ 检测错误: " + result.getError());
        }
        
        // 提供建议
        printAnalysisSuggestions(result);
    }
    
    /**
     * 打印分析建议
     */
    private void printAnalysisSuggestions(MicroserviceDetectionResult result) {
        System.out.println("\n💡 分析建议:");
        
        if (result.isMicroservice()) {
            System.out.println("  • 检测到微服务项目，建议使用分布式分析模式");
            
            if (result.isRequiresJarAnalysis()) {
                System.out.println("  • 项目需要JAR包分析，请确保已构建项目");
                System.out.println("  • 建议运行: mvn clean package -DskipTests");
            } else {
                System.out.println("  • 项目可能使用其他部署方式，跳过JAR分析");
            }
            
            if (!result.getServiceTypes().isEmpty()) {
                System.out.println("  • 检测到多个服务，建议分别分析各服务的影响");
            }
        } else {
            System.out.println("  • 未检测到微服务特征，使用标准分析模式");
        }
        
        if ("unknown".equals(result.getBuildTool())) {
            System.out.println("  ⚠️ 未检测到构建工具，可能影响分析准确性");
        }
        
        if ("unknown".equals(result.getFramework())) {
            System.out.println("  ⚠️ 未检测到框架，可能影响分析准确性");
        }
    }
    
    /**
     * 更新配置中的微服务检测结果
     */
    private void updateConfigWithMicroserviceResult(AnalysisConfig config, MicroserviceDetectionResult result) {
        Map<String, Object> microserviceConfig = new HashMap<>();
        microserviceConfig.put("isMicroservice", result.isMicroservice());
        microserviceConfig.put("buildTool", result.getBuildTool());
        microserviceConfig.put("framework", result.getFramework());
        microserviceConfig.put("requiresJarAnalysis", result.isRequiresJarAnalysis());
        microserviceConfig.put("architectureFeatures", result.getArchitectureFeatures());
        microserviceConfig.put("serviceTypes", result.getServiceTypes());
        microserviceConfig.put("deploymentConfig", result.getDeploymentConfig());
        
        config.setMicroserviceConfig(microserviceConfig);
    }
    
    /**
     * 将检测结果转换为Map
     */
    private Map<String, Object> convertToMap(MicroserviceDetectionResult result) {
        Map<String, Object> map = new HashMap<>();
        map.put("buildTool", result.getBuildTool());
        map.put("framework", result.getFramework());
        map.put("architectureFeatures", result.getArchitectureFeatures());
        map.put("serviceTypes", result.getServiceTypes());
        map.put("deploymentConfig", result.getDeploymentConfig());
        map.put("isMicroservice", result.isMicroservice());
        map.put("requiresJarAnalysis", result.isRequiresJarAnalysis());
        map.put("error", result.getError());
        return map;
    }
    
    /**
     * 输出分析结果
     */
    private void outputResult(Map<String, Object> result) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);
        
        String jsonResult = mapper.writeValueAsString(result);
        
        if (outputFile != null) {
            // 写入文件
            Path outputPath = Paths.get(outputFile);
            Files.writeString(outputPath, jsonResult);
            System.out.println("📄 结果已保存到: " + outputPath.toAbsolutePath());
        } else {
            // 输出到控制台
            if ("summary".equals(format)) {
                printSummary(result);
            } else {
                System.out.println("\n📊 分析结果:");
                System.out.println(jsonResult);
            }
        }
    }
    
    /**
     * 收集源文件
     */
    private List<Path> collectSourceFiles(Path projectDir) {
        List<Path> sourceFiles = new ArrayList<>();
        
        try (Stream<Path> paths = Files.walk(projectDir, maxDepth)) {
            sourceFiles = paths
                .filter(Files::isRegularFile)
                .filter(path -> {
                    String fileName = path.getFileName().toString().toLowerCase();
                    return fileName.endsWith(".java") || fileName.endsWith(".kt");
                })
                .filter(path -> {
                    String relativePath = projectDir.relativize(path).toString();
                    return !relativePath.contains("target") && 
                           !relativePath.contains("build") && 
                           !relativePath.contains("test") &&
                           !relativePath.contains("node_modules");
                })
                .collect(Collectors.toList());
        } catch (IOException e) {
            System.err.println("❌ 收集源文件失败: " + e.getMessage());
        }
        
        return sourceFiles;
    }
    
    /**
     * 打印摘要信息
     */
    private void printSummary(Map<String, Object> result) {
        System.out.println("\n📊 分析摘要:");
        
        @SuppressWarnings("unchecked")
        Map<String, Object> analysisResult = (Map<String, Object>) result.get("analysisResult");
        if (analysisResult != null) {
            System.out.println("  📁 分析文件数: " + analysisResult.getOrDefault("totalFiles", "未知"));
            System.out.println("  🔗 影响方法数: " + analysisResult.getOrDefault("totalMethods", "未知"));
        }
        
        @SuppressWarnings("unchecked")
        Map<String, Object> microserviceDetection = (Map<String, Object>) result.get("microserviceDetection");
        if (microserviceDetection != null) {
            System.out.println("  🏗️ 项目类型: " + (Boolean.TRUE.equals(microserviceDetection.get("isMicroservice")) ? "微服务" : "单体应用"));
            System.out.println("  📦 构建工具: " + microserviceDetection.get("buildTool"));
            System.out.println("  🏗️ 框架: " + microserviceDetection.get("framework"));
        }
    }
} 