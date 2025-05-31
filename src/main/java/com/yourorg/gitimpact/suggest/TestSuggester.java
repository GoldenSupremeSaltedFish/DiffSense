package com.yourorg.gitimpact.suggest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.visitor.VoidVisitorAdapter;

public class TestSuggester {
    private final String baseDir;
    private final Map<String, Set<String>> classToTestMap = new HashMap<>();

    public TestSuggester(String baseDir) {
        this.baseDir = baseDir;
    }

    public void scanTestClasses() throws IOException {
        Files.walk(Paths.get(baseDir))
            .filter(path -> path.toString().endsWith("Test.java"))
            .forEach(this::analyzeTestFile);
    }

    private void analyzeTestFile(Path path) {
        try {
            CompilationUnit cu = StaticJavaParser.parse(path.toFile());
            
            cu.accept(new VoidVisitorAdapter<Void>() {
                @Override
                public void visit(ClassOrInterfaceDeclaration n, Void arg) {
                    String testClassName = n.getNameAsString();
                    String targetClassName = testClassName.replace("Test", "");
                    
                    Set<String> testMethods = new HashSet<>();
                    n.getMethods().stream()
                        .filter(m -> m.getAnnotations().stream()
                            .anyMatch(a -> a.getNameAsString().equals("Test")))
                        .forEach(m -> testMethods.add(m.getNameAsString()));
                    
                    if (!testMethods.isEmpty()) {
                        classToTestMap.put(targetClassName, testMethods);
                    }
                    
                    super.visit(n, arg);
                }
            }, null);
        } catch (IOException e) {
            System.err.println("警告: 无法分析测试文件 " + path + ": " + e.getMessage());
        }
    }

    public static class TestSuggestion {
        public final String testClassName;
        public final Set<String> testMethods;

        public TestSuggestion(String testClassName, Set<String> testMethods) {
            this.testClassName = testClassName;
            this.testMethods = testMethods;
        }
    }

    public List<TestSuggestion> suggestTests(Set<String> impactedClasses) {
        List<TestSuggestion> suggestions = new ArrayList<>();
        
        for (String className : impactedClasses) {
            Set<String> testMethods = classToTestMap.get(className);
            if (testMethods != null && !testMethods.isEmpty()) {
                suggestions.add(new TestSuggestion(className + "Test", testMethods));
            }
        }
        
        return suggestions;
    }
} 