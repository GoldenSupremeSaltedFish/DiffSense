package com.yourorg.gitimpact.test;

import com.yourorg.gitimpact.impact.MethodRef;
import spoon.Launcher;
import spoon.reflect.CtModel;
import spoon.reflect.declaration.CtMethod;
import spoon.reflect.declaration.CtType;
import spoon.reflect.visitor.filter.TypeFilter;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class TestMethodIdentifier {
    private final String sourceDir;

    public TestMethodIdentifier(String sourceDir) {
        this.sourceDir = sourceDir;
    }

    /**
     * 识别项目中的所有测试方法
     * @return 测试方法引用集合
     */
    public Set<MethodRef> identifyTestMethods() {
        Set<MethodRef> testMethods = new HashSet<>();
        
        Launcher launcher = new Launcher();
        launcher.addInputResource(sourceDir);
        launcher.getEnvironment().setComplianceLevel(17);
        launcher.buildModel();
        
        CtModel model = launcher.getModel();
        
        // 获取所有方法
        List<CtMethod<?>> methods = model.getElements(new TypeFilter<>(CtMethod.class));
        
        for (CtMethod<?> method : methods) {
            if (isTestMethod(method)) {
                CtType<?> declaringType = method.getDeclaringType();
                String className = declaringType != null ? declaringType.getQualifiedName() : "UnknownClass";
                testMethods.add(new MethodRef(className, method.getSimpleName()));
            }
        }
        
        return testMethods;
    }

    /**
     * 判断一个方法是否为测试方法
     */
    private boolean isTestMethod(CtMethod<?> method) {
        // 检查方法或类上是否有 @Test 注解
        boolean hasTestAnnotation = method.getAnnotations().stream()
            .anyMatch(annotation -> annotation.getAnnotationType().getSimpleName().equals("Test"));
            
        if (hasTestAnnotation) {
            return true;
        }

        // 检查类名是否符合测试类命名规范
        CtType<?> declaringType = method.getDeclaringType();
        if (declaringType != null) {
            String className = declaringType.getSimpleName();
            if (className.endsWith("Test") || className.endsWith("Tests") || className.startsWith("Test")) {
                // 检查方法名是否符合测试方法命名规范
                String methodName = method.getSimpleName();
                return methodName.startsWith("test") || 
                       methodName.contains("should") || 
                       methodName.contains("when") ||
                       methodName.contains("given");
            }
        }

        return false;
    }
} 