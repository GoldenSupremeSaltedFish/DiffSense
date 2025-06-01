package com.yourorg.gitimpact.impact;

import spoon.Launcher;
import spoon.reflect.CtModel;
import spoon.reflect.code.CtInvocation;
import spoon.reflect.code.CtLambda;
import spoon.reflect.declaration.*;
import spoon.reflect.visitor.filter.TypeFilter;
import spoon.support.reflect.declaration.CtMethodImpl;

import java.util.*;

public class CallGraphAnalyzer {
    private final String sourceDir;
    private final Map<MethodRef, Set<MethodRef>> callGraph = new HashMap<>();
    private int lambdaCounter = 0;
    private int anonymousCounter = 0;

    public CallGraphAnalyzer(String sourceDir) {
        this.sourceDir = sourceDir;
    }

    /**
     * 构建调用图
     * @return 方法调用关系图，key 是调用方，value 是被调用方集合
     */
    public Map<MethodRef, Set<MethodRef>> buildCallGraph() {
        Launcher launcher = new Launcher();
        launcher.addInputResource(sourceDir);
        launcher.getEnvironment().setComplianceLevel(17); // 设置 Java 版本
        launcher.buildModel();
        
        CtModel model = launcher.getModel();
        
        // 处理所有常规方法
        processRegularMethods(model);
        
        // 处理 Lambda 表达式
        processLambdas(model);
        
        // 处理匿名类
        processAnonymousClasses(model);
        
        return callGraph;
    }

    private void processRegularMethods(CtModel model) {
        // 获取所有方法
        List<CtMethod<?>> methods = model.getElements(new TypeFilter<>(CtMethod.class));
        
        for (CtMethod<?> method : methods) {
            MethodRef methodRef = getMethodRef(method);
            
            // 获取方法中的所有调用
            List<CtInvocation<?>> invocations = method.getElements(new TypeFilter<>(CtInvocation.class));
            
            // 记录调用关系
            Set<MethodRef> calls = callGraph.computeIfAbsent(methodRef, k -> new HashSet<>());
            for (CtInvocation<?> invocation : invocations) {
                if (invocation.getExecutable() != null && invocation.getExecutable().getDeclaration() instanceof CtMethod<?>) {
                    CtMethod<?> calledMethod = (CtMethod<?>) invocation.getExecutable().getDeclaration();
                    calls.add(getMethodRef(calledMethod));
                }
            }
        }
    }

    private void processLambdas(CtModel model) {
        List<CtLambda<?>> lambdas = model.getElements(new TypeFilter<>(CtLambda.class));
        
        for (CtLambda<?> lambda : lambdas) {
            // 为 Lambda 创建虚拟签名
            MethodRef lambdaRef = createLambdaRef(lambda);
            
            // 获取 Lambda 中的所有调用
            List<CtInvocation<?>> invocations = lambda.getElements(new TypeFilter<>(CtInvocation.class));
            
            // 记录调用关系
            Set<MethodRef> calls = callGraph.computeIfAbsent(lambdaRef, k -> new HashSet<>());
            for (CtInvocation<?> invocation : invocations) {
                if (invocation.getExecutable() != null && invocation.getExecutable().getDeclaration() instanceof CtMethod<?>) {
                    CtMethod<?> calledMethod = (CtMethod<?>) invocation.getExecutable().getDeclaration();
                    calls.add(getMethodRef(calledMethod));
                }
            }
        }
    }

    private void processAnonymousClasses(CtModel model) {
        List<CtClass<?>> anonymousClasses = model.getElements(new TypeFilter<>(CtClass.class));
        
        for (CtClass<?> anonymousClass : anonymousClasses) {
            if (anonymousClass.isAnonymous()) {
                for (CtMethod<?> method : anonymousClass.getMethods()) {
                    // 为匿名类方法创建虚拟签名
                    MethodRef methodRef = createAnonymousMethodRef(method);
                    
                    // 获取方法中的所有调用
                    List<CtInvocation<?>> invocations = method.getElements(new TypeFilter<>(CtInvocation.class));
                    
                    // 记录调用关系
                    Set<MethodRef> calls = callGraph.computeIfAbsent(methodRef, k -> new HashSet<>());
                    for (CtInvocation<?> invocation : invocations) {
                        if (invocation.getExecutable() != null && invocation.getExecutable().getDeclaration() instanceof CtMethod<?>) {
                            CtMethod<?> calledMethod = (CtMethod<?>) invocation.getExecutable().getDeclaration();
                            calls.add(getMethodRef(calledMethod));
                        }
                    }
                }
            }
        }
    }

    private MethodRef getMethodRef(CtMethod<?> method) {
        CtType<?> declaringType = method.getDeclaringType();
        String className = declaringType != null ? declaringType.getQualifiedName() : "UnknownClass";
        return new MethodRef(className, method.getSimpleName());
    }

    private MethodRef createLambdaRef(CtLambda<?> lambda) {
        CtMethod<?> containingMethod = lambda.getParent(CtMethod.class);
        String containingClass = lambda.getParent(CtType.class).getQualifiedName();
        String containingMethodName = containingMethod != null ? containingMethod.getSimpleName() : "unknown";
        return new MethodRef(containingClass, containingMethodName + "$lambda$" + (++lambdaCounter));
    }

    private MethodRef createAnonymousMethodRef(CtMethod<?> method) {
        CtClass<?> anonymousClass = method.getParent(CtClass.class);
        CtType<?> enclosingType = anonymousClass.getParent(CtType.class);
        String enclosingClassName = enclosingType != null ? enclosingType.getQualifiedName() : "UnknownClass";
        return new MethodRef(enclosingClassName + "$Anonymous" + (++anonymousCounter), method.getSimpleName());
    }

    /**
     * 获取某个方法的所有调用者
     * @param methodRef 方法引用
     * @return 调用该方法的所有方法引用集合
     */
    public Set<MethodRef> getCallers(MethodRef methodRef) {
        Set<MethodRef> callers = new HashSet<>();
        for (Map.Entry<MethodRef, Set<MethodRef>> entry : callGraph.entrySet()) {
            if (entry.getValue().contains(methodRef)) {
                callers.add(entry.getKey());
            }
        }
        return callers;
    }

    /**
     * 获取某个方法调用的所有方法
     * @param methodRef 方法引用
     * @return 该方法调用的所有方法引用集合
     */
    public Set<MethodRef> getCallees(MethodRef methodRef) {
        return callGraph.getOrDefault(methodRef, new HashSet<>());
    }
} 