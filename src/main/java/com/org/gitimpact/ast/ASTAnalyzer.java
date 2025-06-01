package com.org.gitimpact.ast;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.ArrayList;
import java.util.List;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.visitor.VoidVisitorAdapter;

public class ASTAnalyzer {
    public ASTAnalyzer() {
        // 配置 JavaParser 支持 Java 17 特性
        ParserConfiguration config = new ParserConfiguration();
        config.setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_17);
        StaticJavaParser.setConfiguration(config);
    }

    public static class MethodInfo {
        public final String className;
        public final String methodName;
        public final int startLine;
        public final int endLine;

        public MethodInfo(String className, String methodName, int startLine, int endLine) {
            this.className = className;
            this.methodName = methodName;
            this.startLine = startLine;
            this.endLine = endLine;
        }
    }

    public List<MethodInfo> analyzeFile(String filePath) throws FileNotFoundException {
        CompilationUnit cu = StaticJavaParser.parse(new File(filePath));
        List<MethodInfo> methods = new ArrayList<>();

        cu.accept(new VoidVisitorAdapter<Void>() {
            private String currentClassName = "";

            @Override
            public void visit(ClassOrInterfaceDeclaration n, Void arg) {
                String previousClassName = currentClassName;
                currentClassName = n.getNameAsString();
                super.visit(n, arg);
                currentClassName = previousClassName;
            }

            @Override
            public void visit(MethodDeclaration n, Void arg) {
                methods.add(new MethodInfo(
                    currentClassName,
                    n.getNameAsString(),
                    n.getBegin().get().line,
                    n.getEnd().get().line
                ));
                super.visit(n, arg);
            }
        }, null);

        return methods;
    }
} 