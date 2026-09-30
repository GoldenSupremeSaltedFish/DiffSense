package com.yourorg.gitimpact.cli;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.yourorg.gitimpact.config.AnalysisConfig;
import com.yourorg.gitimpact.spring.SpringEnhancedAnalyzer;

import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

/**
 * Spring分析命令
 * 专门用于分析Spring项目的注解、Bean、REST API等
 */
@Command(
    name = "spring-analyze",
    description = "Spring项目增强分析 - 分析Spring注解、Bean依赖、REST API路由",
    mixinStandardHelpOptions = true
)
public class SpringAnalyzeCommand implements Callable<Integer> {
    
    @Option(
        names = {"--project", "-p"},
        description = "Spring项目路径 (默认: .)",
        defaultValue = "."
    )
    private String projectPath;
    
    @Option(
        names = {"--output", "-o"},
        description = "输出文件路径 (默认: spring-analysis.json)"
    )
    private String outputFile;
    
    @Option(
        names = {"--format", "-f"},
        description = "输出格式: json|summary (默认: json)",
        defaultValue = "json"
    )
    private String format;
    
    @Option(
        names = {"--include-routes"},
        description = "包含HTTP路由分析 (默认: true)",
        defaultValue = "true"
    )
    private boolean includeRoutes;
    
    @Option(
        names = {"--include-transactions"},
        description = "包含事务分析 (默认: true)",
        defaultValue = "true"
    )
    private boolean includeTransactions;
    
    @Option(
        names = {"--include-dependencies"},
        description = "包含Bean依赖分析 (默认: true)",
        defaultValue = "true"
    )
    private boolean includeDependencies;
    
    @Option(
        names = {"--max-depth"},
        description = "分析深度限制 (默认: 15)",
        defaultValue = "15"
    )
    private Integer maxDepth;
    
    @Override
    public Integer call() throws Exception {
        try {
            System.err.println("🌱 开始Spring项目增强分析...");
            System.err.println("📁 项目路径: " + projectPath);
            
            // 构建分析配置
            AnalysisConfig config = AnalysisConfig.builder()
                .maxDepth(maxDepth)
                .maxFiles(1000)
                .build();
            
            // 查找Java源文件
            Path projectDir = Paths.get(projectPath).toAbsolutePath();
            List<Path> sourceFiles = findJavaSourceFiles(projectDir);
            
            if (sourceFiles.isEmpty()) {
                System.err.println("❌ 未找到Java源文件");
                return 1;
            }
            
            System.err.println("📄 找到 " + sourceFiles.size() + " 个Java源文件");
            
            // 执行Spring增强分析
            SpringEnhancedAnalyzer analyzer = new SpringEnhancedAnalyzer(sourceFiles, projectDir, config);
            SpringEnhancedAnalyzer.SpringEnhancedResult result = analyzer.analyzeSpringProject();
            
            if (result.getError() != null) {
                System.err.println("❌ 分析失败: " + result.getError());
                return 1;
            }
            
            // 输出结果
            outputResult(result);
            
            System.err.println("✅ Spring分析完成");
            return 0;
            
        } catch (Exception e) {
            System.err.println("❌ Spring分析失败: " + e.getMessage());
            e.printStackTrace();
            return 1;
        }
    }
    
    /**
     * 查找Java源文件
     */
    private List<Path> findJavaSourceFiles(Path projectDir) throws IOException {
        return Files.walk(projectDir)
            .filter(Files::isRegularFile)
            .filter(path -> path.toString().endsWith(".java"))
            .filter(path -> !path.toString().contains("/target/"))
            .filter(path -> !path.toString().contains("/build/"))
            .filter(path -> !path.toString().contains("/node_modules/"))
            .collect(Collectors.toList());
    }
    
    /**
     * 输出分析结果
     */
    private void outputResult(SpringEnhancedAnalyzer.SpringEnhancedResult result) throws Exception {
        if ("summary".equals(format)) {
            outputSummary(result);
        } else {
            outputJson(result);
        }
    }
    
    /**
     * 输出JSON格式结果
     */
    private void outputJson(SpringEnhancedAnalyzer.SpringEnhancedResult result) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);
        
        String json = mapper.writeValueAsString(result);
        
        if (outputFile != null) {
            Files.write(Paths.get(outputFile), json.getBytes());
            System.err.println("📄 结果已保存到: " + outputFile);
        } else {
            System.out.println(json);
        }
    }
    
    /**
     * 输出摘要格式结果
     */
    private void outputSummary(SpringEnhancedAnalyzer.SpringEnhancedResult result) {
        System.out.println("\n🌱 Spring项目分析报告");
        System.out.println("=" + "=".repeat(50));
        
        // Spring组件统计
        if (result.getSpringAnalysis() != null) {
            var springAnalysis = result.getSpringAnalysis();
            springAnalysis.updateSummary();
            var summary = springAnalysis.getSummary();
            
            System.out.println("\n📊 Spring组件统计:");
            System.out.println("  总Bean数量: " + summary.getTotalBeans());
            System.out.println("  REST端点数量: " + summary.getTotalRestEndpoints());
            System.out.println("  事务方法数量: " + summary.getTotalTransactionalMethods());
            System.out.println("  依赖注入数量: " + summary.getTotalDependencyInjections());
            
            // 组件类型分布
            if (!summary.getComponentTypeStats().isEmpty()) {
                System.out.println("\n🏗️  组件类型分布:");
                summary.getComponentTypeStats().forEach((type, count) -> 
                    System.out.println("  " + type + ": " + count));
            }
            
            // HTTP方法分布
            if (!summary.getHttpMethodStats().isEmpty()) {
                System.out.println("\n🌐 HTTP方法分布:");
                summary.getHttpMethodStats().forEach((method, count) -> 
                    System.out.println("  " + method + ": " + count));
            }
        }
        
        // HTTP路由列表
        if (includeRoutes && !result.getHttpRoutes().isEmpty()) {
            System.out.println("\n🚀 HTTP API路由:");
            result.getHttpRoutes().forEach(route -> {
                System.out.println("  " + route.getRouteSignature() + 
                    " -> " + route.getControllerClass() + "." + route.getControllerMethod());
                
                if (!route.getParameters().isEmpty()) {
                    route.getParameters().forEach(param -> 
                        System.out.println("    📝 " + param.getParameterType() + 
                            " " + param.getName() + ": " + param.getType() + 
                            (param.isRequired() ? " (必需)" : " (可选)")));
                }
            });
        }
        
        // Spring Context信息
        if (result.getSpringContext() != null) {
            var context = result.getSpringContext();
            
            // 循环依赖检测
            if (!context.getCircularDependencies().isEmpty()) {
                System.out.println("\n⚠️  检测到循环依赖:");
                context.getCircularDependencies().forEach(dep -> 
                    System.out.println("  " + dep));
            }
            
            // 事务类统计
            if (includeTransactions && !context.getTransactionalClasses().isEmpty()) {
                System.out.println("\n💾 事务类统计:");
                context.getTransactionalClasses().forEach((className, methods) -> 
                    System.out.println("  " + className + ": " + methods.size() + " 个事务方法"));
            }
        }
        
        // 潜在问题
        if (result.getAnalysisReport() != null && 
            !result.getAnalysisReport().getPotentialIssues().isEmpty()) {
            System.out.println("\n⚠️  潜在问题:");
            result.getAnalysisReport().getPotentialIssues().forEach(issue -> 
                System.out.println("  - " + issue));
        }
        
        System.out.println("\n✨ 分析完成!");
    }
} 