package com.yourorg.gitimpact.impact;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;

import com.github.javaparser.ParseProblemException;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.expr.MethodCallExpr;
import com.github.javaparser.ast.visitor.VoidVisitorAdapter;
import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;

public class ImpactAnalyzer {
    private final String baseDir;
    private final Map<String, Set<String>> methodCallGraph = new HashMap<>();

    public ImpactAnalyzer(String baseDir) {
        this.baseDir = baseDir;
        // 配置 JavaParser 支持 Java 17 特性
        ParserConfiguration config = new ParserConfiguration();
        config.setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_17);
        StaticJavaParser.setConfiguration(config);
    }

    public void buildCallGraph() throws IOException {
        // 遍历所有 Java 文件
        Files.walk(Paths.get(baseDir))
            .filter(path -> path.toString().endsWith(".java"))
            .forEach(this::analyzeFile);
    }

    private void analyzeFile(Path path) {
        try {
            CompilationUnit cu = StaticJavaParser.parse(path.toFile());
            
            cu.accept(new VoidVisitorAdapter<Void>() {
                private String currentClassName = "";
                private String currentMethodName = "";

                @Override
                public void visit(ClassOrInterfaceDeclaration n, Void arg) {
                    String previousClassName = currentClassName;
                    currentClassName = n.getNameAsString();
                    super.visit(n, arg);
                    currentClassName = previousClassName;
                }

                @Override
                public void visit(MethodDeclaration n, Void arg) {
                    String previousMethodName = currentMethodName;
                    currentMethodName = currentClassName + "." + n.getNameAsString();
                    
                    // 确保方法在图中有一个入口
                    methodCallGraph.putIfAbsent(currentMethodName, new HashSet<>());
                    
                    super.visit(n, arg);
                    currentMethodName = previousMethodName;
                }

                @Override
                public void visit(MethodCallExpr n, Void arg) {
                    if (!currentMethodName.isEmpty()) {
                        // 简化处理：仅记录方法名的调用关系
                        String calledMethod = n.getNameAsString();
                        methodCallGraph.get(currentMethodName).add(calledMethod);
                    }
                    super.visit(n, arg);
                }
            }, null);
        } catch (ParseProblemException e) {
            System.err.println("警告: 解析文件 " + path + " 时出现语法问题，可能是使用了不支持的语言特性");
            System.err.println("详细信息: " + e.getMessage());
            // 继续处理其他文件，不中断整个分析过程
        } catch (IOException e) {
            System.err.println("警告: 无法读取文件 " + path + ": " + e.getMessage());
        }
    }

    public Set<String> findImpactedMethods(List<ImpactedMethod> changedMethods) {
        Set<String> impacted = new HashSet<>();
        Queue<String> toProcess = new LinkedList<>();

        // 初始化待处理队列
        for (ImpactedMethod method : changedMethods) {
            String methodKey = method.className + "." + method.methodName;
            toProcess.add(methodKey);
            impacted.add(methodKey);
        }

        // 广度优先搜索找出所有受影响的方法
        while (!toProcess.isEmpty()) {
            String current = toProcess.poll();
            
            // 查找调用当前方法的其他方法
            for (Map.Entry<String, Set<String>> entry : methodCallGraph.entrySet()) {
                if (entry.getValue().contains(current) && !impacted.contains(entry.getKey())) {
                    impacted.add(entry.getKey());
                    toProcess.add(entry.getKey());
                }
            }
        }

        return impacted;
    }
} 