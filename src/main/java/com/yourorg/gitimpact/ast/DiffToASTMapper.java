package com.yourorg.gitimpact.ast;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.visitor.VoidVisitorAdapter;

import java.io.FileNotFoundException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class DiffToASTMapper {
    public static class ImpactedMethod {
        public final String className;
        public final String methodName;
        public final String filePath;

        public ImpactedMethod(String className, String methodName, String filePath) {
            this.className = className;
            this.methodName = methodName;
            this.filePath = filePath;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            ImpactedMethod that = (ImpactedMethod) o;
            return Objects.equals(className, that.className) &&
                   Objects.equals(methodName, that.methodName) &&
                   Objects.equals(filePath, that.filePath);
        }

        @Override
        public int hashCode() {
            return Objects.hash(className, methodName, filePath);
        }
    }
} 