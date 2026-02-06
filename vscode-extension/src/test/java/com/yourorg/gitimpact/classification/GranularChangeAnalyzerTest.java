package com.yourorg.gitimpact.classification;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;

/**
 * 细粒度变更分析器测试
 */
public class GranularChangeAnalyzerTest {
    
    private GranularChangeAnalyzer analyzer;
    
    @BeforeEach
    void setUp() {
        analyzer = new GranularChangeAnalyzer();
    }
    
    @Test
    void testConfigFileDetection() {
        // 测试配置文件检测
        Path configFile = Paths.get("src/main/resources/application.yml");
        List<ImpactedMethod> methods = new ArrayList<>();
        
        List<ModificationDetail> modifications = analyzer.analyzeFileChanges(configFile, methods, null);
        
        assertFalse(modifications.isEmpty());
        assertTrue(modifications.stream()
            .anyMatch(m -> m.getType() == ModificationType.CONFIG_CHANGE));
    }
    
    @Test
    void testDependencyFileDetection() {
        // 测试依赖文件检测
        Path pomFile = Paths.get("pom.xml");
        List<ImpactedMethod> methods = new ArrayList<>();
        
        List<ModificationDetail> modifications = analyzer.analyzeFileChanges(pomFile, methods, null);
        
        assertFalse(modifications.isEmpty());
        assertTrue(modifications.stream()
            .anyMatch(m -> m.getType() == ModificationType.DEPENDENCY_UPDATED));
    }
    
    @Test
    void testTestFileDetection() {
        // 测试测试文件检测
        Path testFile = Paths.get("src/test/java/TestClass.java");
        List<ImpactedMethod> methods = new ArrayList<>();
        
        List<ModificationDetail> modifications = analyzer.analyzeFileChanges(testFile, methods, null);
        
        assertFalse(modifications.isEmpty());
        assertTrue(modifications.stream()
            .anyMatch(m -> m.getType() == ModificationType.TEST_MODIFIED));
    }
    
    @Test
    void testApiEndpointDetection() {
        // 测试API端点检测
        Path controllerFile = Paths.get("src/main/java/com/example/UserController.java");
        List<ImpactedMethod> methods = new ArrayList<>();
        methods.add(new ImpactedMethod(
            "src/main/java/com/example/UserController.java",
            "getUser",
            "public User getUser(Long id)",
            "UserController",
            "com.example"
        ));
        
        List<ModificationDetail> modifications = analyzer.analyzeFileChanges(controllerFile, methods, null);
        
        assertFalse(modifications.isEmpty());
        assertTrue(modifications.stream()
            .anyMatch(m -> m.getType() == ModificationType.API_ENDPOINT_CHANGE));
    }
    
    @Test
    void testDataStructureDetection() {
        // 测试数据结构检测
        Path entityFile = Paths.get("src/main/java/com/example/User.java");
        List<ImpactedMethod> methods = new ArrayList<>();
        methods.add(new ImpactedMethod(
            "src/main/java/com/example/User.java",
            "getName",
            "public String getName()",
            "User",
            "com.example"
        ));
        
        List<ModificationDetail> modifications = analyzer.analyzeFileChanges(entityFile, methods, null);
        
        assertFalse(modifications.isEmpty());
        assertTrue(modifications.stream()
            .anyMatch(m -> m.getType() == ModificationType.DATA_STRUCTURE_CHANGE));
    }
    
    @Test
    void testLoggingDetection() {
        // 测试日志变更检测
        Path serviceFile = Paths.get("src/main/java/com/example/UserService.java");
        List<ImpactedMethod> methods = new ArrayList<>();
        String diffContent = "+ log.info(\"User created: {}\", user.getName());";
        
        List<ModificationDetail> modifications = analyzer.analyzeFileChanges(serviceFile, methods, diffContent);
        
        assertFalse(modifications.isEmpty());
        assertTrue(modifications.stream()
            .anyMatch(m -> m.getType() == ModificationType.LOGGING_ADDED));
    }
} 