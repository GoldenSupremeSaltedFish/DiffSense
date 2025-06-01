package com.yourorg.gitimpact.impact;

import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;
import com.yourorg.gitimpact.test.TestMethodIdentifier;
import com.yourorg.gitimpact.test.TestImpactAnalyzer;
import com.yourorg.gitimpact.config.AnalysisConfig;
import java.io.IOException;
import java.nio.file.Path;
import java.util.*;

public class ImpactAnalyzer {
    private final List<Path> sourceFiles;
    private final AnalysisConfig config;
    private final CallGraphAnalyzer callGraphAnalyzer;
    private final TestMethodIdentifier testMethodIdentifier;
    private Map<MethodRef, Set<MethodRef>> callGraph;
    private Map<MethodRef, Set<MethodRef>> reverseCallGraph;
    private Set<MethodRef> testMethods;
    private TestImpactAnalyzer testImpactAnalyzer;

    public ImpactAnalyzer(List<Path> sourceFiles) {
        this(sourceFiles, AnalysisConfig.getDefault());
    }

    public ImpactAnalyzer(List<Path> sourceFiles, AnalysisConfig config) {
        this.sourceFiles = sourceFiles;
        this.config = config;
        this.callGraphAnalyzer = new CallGraphAnalyzer(sourceFiles, config);
        this.testMethodIdentifier = new TestMethodIdentifier(sourceFiles, config);
    }

    public void buildCallGraph() throws IOException {
        // 使用 Spoon 构建调用图
        this.callGraph = callGraphAnalyzer.buildCallGraph();
        // 构建反向调用图
        this.reverseCallGraph = CallGraphReverser.buildReverseCallGraph(callGraph);
        // 识别所有测试方法
        this.testMethods = testMethodIdentifier.identifyTestMethods();
        // 初始化测试影响分析器
        this.testImpactAnalyzer = new TestImpactAnalyzer(testMethods, reverseCallGraph);
    }

    public Set<String> findImpactedMethods(List<ImpactedMethod> changedMethods) {
        // 转换 ImpactedMethod 为 MethodRef
        Set<MethodRef> changedMethodRefs = new HashSet<>();
        for (ImpactedMethod method : changedMethods) {
            changedMethodRefs.add(new MethodRef(method.className, method.methodName));
        }

        // 使用反向调用图分析影响
        Set<MethodRef> impactedMethodRefs = CallGraphReverser.getTransitiveCallers(
            changedMethodRefs,
            reverseCallGraph,
            config
        );
        
        // 转换结果为字符串形式
        Set<String> impactedMethods = new HashSet<>();
        for (MethodRef methodRef : impactedMethodRefs) {
            impactedMethods.add(methodRef.toSignature());
        }
        
        return impactedMethods;
    }

    /**
     * 获取受影响的测试方法
     */
    public Map<String, Set<String>> findImpactedTests(List<ImpactedMethod> changedMethods) {
        return testImpactAnalyzer.getImpactedTestsByClass(changedMethods);
    }

    /**
     * 获取方法的直接调用者
     */
    public Set<String> getDirectCallers(String methodSignature) {
        MethodRef methodRef = MethodRef.fromSignature(methodSignature);
        Set<MethodRef> callers = callGraphAnalyzer.getCallers(methodRef);
        return convertMethodRefsToSignatures(callers);
    }

    /**
     * 获取方法直接调用的其他方法
     */
    public Set<String> getDirectCallees(String methodSignature) {
        MethodRef methodRef = MethodRef.fromSignature(methodSignature);
        Set<MethodRef> callees = callGraphAnalyzer.getCallees(methodRef);
        return convertMethodRefsToSignatures(callees);
    }

    /**
     * 获取方法的所有间接调用者
     */
    public Set<String> getAllCallers(String methodSignature) {
        MethodRef methodRef = MethodRef.fromSignature(methodSignature);
        Set<MethodRef> allCallers = CallGraphReverser.getTransitiveCallers(
            Collections.singleton(methodRef),
            reverseCallGraph,
            config
        );
        return convertMethodRefsToSignatures(allCallers);
    }

    /**
     * 获取方法的相关测试
     */
    public Set<String> getRelatedTests(String methodSignature) {
        MethodRef methodRef = MethodRef.fromSignature(methodSignature);
        Set<MethodRef> relatedTests = testImpactAnalyzer.getRelatedTests(methodRef);
        return convertMethodRefsToSignatures(relatedTests);
    }

    private Set<String> convertMethodRefsToSignatures(Set<MethodRef> methodRefs) {
        Set<String> signatures = new HashSet<>();
        for (MethodRef methodRef : methodRefs) {
            signatures.add(methodRef.toSignature());
        }
        return signatures;
    }
} 