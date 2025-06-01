package com.yourorg.gitimpact.impact;

import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;
import java.io.IOException;
import java.util.*;

public class ImpactAnalyzer {
    private final String baseDir;
    private final CallGraphAnalyzer callGraphAnalyzer;
    private Map<MethodRef, Set<MethodRef>> callGraph;
    private Map<MethodRef, Set<MethodRef>> reverseCallGraph;

    public ImpactAnalyzer(String baseDir) {
        this.baseDir = baseDir;
        this.callGraphAnalyzer = new CallGraphAnalyzer(baseDir);
    }

    public void buildCallGraph() throws IOException {
        // 使用 Spoon 构建调用图
        this.callGraph = callGraphAnalyzer.buildCallGraph();
        // 构建反向调用图
        this.reverseCallGraph = CallGraphReverser.buildReverseCallGraph(callGraph);
    }

    public Set<String> findImpactedMethods(List<ImpactedMethod> changedMethods) {
        // 转换 ImpactedMethod 为 MethodRef
        Set<MethodRef> changedMethodRefs = new HashSet<>();
        for (ImpactedMethod method : changedMethods) {
            changedMethodRefs.add(new MethodRef(method.className, method.methodName));
        }

        // 使用反向调用图分析影响
        Set<MethodRef> impactedMethodRefs = CallGraphReverser.getTransitiveCallers(changedMethodRefs, reverseCallGraph);
        
        // 转换结果为字符串形式
        Set<String> impactedMethods = new HashSet<>();
        for (MethodRef methodRef : impactedMethodRefs) {
            impactedMethods.add(methodRef.toSignature());
        }
        
        return impactedMethods;
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
            reverseCallGraph
        );
        return convertMethodRefsToSignatures(allCallers);
    }

    private Set<String> convertMethodRefsToSignatures(Set<MethodRef> methodRefs) {
        Set<String> signatures = new HashSet<>();
        for (MethodRef methodRef : methodRefs) {
            signatures.add(methodRef.toSignature());
        }
        return signatures;
    }
} 