package com.yourorg.gitimpact.impact;

import com.yourorg.gitimpact.config.AnalysisConfig;
import com.yourorg.gitimpact.spoon.DiffBasedSpoonLauncher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import spoon.reflect.CtModel;
import spoon.reflect.code.CtInvocation;
import spoon.reflect.code.CtLambda;
import spoon.reflect.declaration.*;
import spoon.reflect.visitor.filter.TypeFilter;

import java.nio.file.Path;
import java.util.*;

public class CallGraphAnalyzer {
    private static final Logger logger = LoggerFactory.getLogger(CallGraphAnalyzer.class);
    
    private final List<Path> sourceFiles;
    private final Path baseDir;
    private final AnalysisConfig config;
    private final Map<MethodRef, Set<MethodRef>> callGraph = new HashMap<>();
    private int lambdaCounter = 0;
    private int anonymousCounter = 0;

    public CallGraphAnalyzer(List<Path> sourceFiles, Path baseDir, AnalysisConfig config) {
        this.sourceFiles = sourceFiles;
        this.baseDir = baseDir;
        this.config = config;
    }

    /**
     * 构建调用图
     * @return 方法调用关系图，key 是调用方，value 是被调用方集合
     */
    public Map<MethodRef, Set<MethodRef>> buildCallGraph() {
        // 使用增量加载器
        DiffBasedSpoonLauncher launcher = new DiffBasedSpoonLauncher(sourceFiles, baseDir, config);
        
        // 构建部分模型
        CtModel model = launcher.buildPartialModel();
        if (model == null) {
            return callGraph;
        }

        // 获取变更的类型
        Set<CtType<?>> changedTypes = launcher.getChangedTypes(model);
        
        // 处理变更的类型
        for (CtType<?> type : changedTypes) {
            // 处理常规方法
            List<CtMethod<?>> methods = type.getElements(new TypeFilter<>(CtMethod.class));
            for (CtMethod<?> method : methods) {
                processMethod(method);
            }
            
            // 处理 Lambda 表达式
            List<CtLambda<?>> lambdas = type.getElements(new TypeFilter<>(CtLambda.class));
            for (CtLambda<?> lambda : lambdas) {
                processLambda(lambda);
            }
            
            // 处理匿名类
            List<CtClass<?>> anonymousClasses = type.getElements(new TypeFilter<>(CtClass.class));
            for (CtClass<?> anonymousClass : anonymousClasses) {
                if (anonymousClass.isAnonymous()) {
                    processAnonymousClass(anonymousClass);
                }
            }
        }
        
        return callGraph;
    }

    private void processMethod(CtMethod<?> method) {
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

    private void processLambda(CtLambda<?> lambda) {
        MethodRef lambdaRef = createLambdaRef(lambda);
        
        List<CtInvocation<?>> invocations = lambda.getElements(new TypeFilter<>(CtInvocation.class));
        
        Set<MethodRef> calls = callGraph.computeIfAbsent(lambdaRef, k -> new HashSet<>());
        for (CtInvocation<?> invocation : invocations) {
            if (invocation.getExecutable() != null && invocation.getExecutable().getDeclaration() instanceof CtMethod<?>) {
                CtMethod<?> calledMethod = (CtMethod<?>) invocation.getExecutable().getDeclaration();
                calls.add(getMethodRef(calledMethod));
            }
        }
    }

    private void processAnonymousClass(CtClass<?> anonymousClass) {
        for (CtMethod<?> method : anonymousClass.getMethods()) {
            MethodRef methodRef = createAnonymousMethodRef(method);
            
            List<CtInvocation<?>> invocations = method.getElements(new TypeFilter<>(CtInvocation.class));
            
            Set<MethodRef> calls = callGraph.computeIfAbsent(methodRef, k -> new HashSet<>());
            for (CtInvocation<?> invocation : invocations) {
                if (invocation.getExecutable() != null && invocation.getExecutable().getDeclaration() instanceof CtMethod<?>) {
                    CtMethod<?> calledMethod = (CtMethod<?>) invocation.getExecutable().getDeclaration();
                    calls.add(getMethodRef(calledMethod));
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
     */
    public Set<MethodRef> getCallees(MethodRef methodRef) {
        return callGraph.getOrDefault(methodRef, new HashSet<>());
    }
} 