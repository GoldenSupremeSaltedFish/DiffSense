package com.yourorg.gitimpact.test;

import com.yourorg.gitimpact.impact.MethodRef;
import com.yourorg.gitimpact.impact.CallGraphReverser;
import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;

import java.util.*;

public class TestImpactAnalyzer {
    private final Set<MethodRef> testMethods;
    private final Map<MethodRef, Set<MethodRef>> reverseCallGraph;

    public TestImpactAnalyzer(
        Set<MethodRef> testMethods,
        Map<MethodRef, Set<MethodRef>> reverseCallGraph
    ) {
        this.testMethods = testMethods;
        this.reverseCallGraph = reverseCallGraph;
    }

    /**
     * 找出受影响的测试方法
     * @param changedMethods 变更的方法列表
     * @return 需要运行的测试方法
     */
    public Set<MethodRef> findImpactedTests(List<ImpactedMethod> changedMethods) {
        // 转换变更方法为 MethodRef
        Set<MethodRef> changedMethodRefs = new HashSet<>();
        for (ImpactedMethod method : changedMethods) {
            changedMethodRefs.add(new MethodRef(method.className, method.methodName));
        }

        // 获取所有受影响的方法（包括直接和间接调用）
        Set<MethodRef> allImpactedMethods = CallGraphReverser.getTransitiveCallers(
            changedMethodRefs,
            reverseCallGraph
        );

        // 找出受影响方法中的测试方法
        Set<MethodRef> impactedTests = new HashSet<>();
        for (MethodRef method : allImpactedMethods) {
            if (testMethods.contains(method)) {
                impactedTests.add(method);
            }
        }

        // 添加直接测试这些变更方法的测试
        for (MethodRef changedMethod : changedMethodRefs) {
            Set<MethodRef> directCallers = reverseCallGraph.getOrDefault(changedMethod, Collections.emptySet());
            for (MethodRef caller : directCallers) {
                if (testMethods.contains(caller)) {
                    impactedTests.add(caller);
                }
            }
        }

        return impactedTests;
    }

    /**
     * 按测试类分组返回受影响的测试方法
     */
    public Map<String, Set<String>> getImpactedTestsByClass(List<ImpactedMethod> changedMethods) {
        Set<MethodRef> impactedTests = findImpactedTests(changedMethods);
        Map<String, Set<String>> testsByClass = new HashMap<>();

        for (MethodRef test : impactedTests) {
            testsByClass.computeIfAbsent(test.getClassName(), k -> new HashSet<>())
                       .add(test.getMethodName());
        }

        return testsByClass;
    }

    /**
     * 获取特定方法的相关测试方法
     */
    public Set<MethodRef> getRelatedTests(MethodRef method) {
        Set<MethodRef> allCallers = CallGraphReverser.getTransitiveCallers(
            Collections.singleton(method),
            reverseCallGraph
        );

        Set<MethodRef> relatedTests = new HashSet<>();
        for (MethodRef caller : allCallers) {
            if (testMethods.contains(caller)) {
                relatedTests.add(caller);
            }
        }

        return relatedTests;
    }
} 