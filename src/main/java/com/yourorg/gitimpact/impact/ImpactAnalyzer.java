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
    private final Path baseDir;
    private final AnalysisConfig config;
    private final CallGraphAnalyzer callGraphAnalyzer;
    private final TestMethodIdentifier testMethodIdentifier;
    private Map<MethodRef, Set<MethodRef>> callGraph;
    private Map<MethodRef, Set<MethodRef>> reverseCallGraph;
    private Set<MethodRef> testMethods;
    private TestImpactAnalyzer testImpactAnalyzer;

    public ImpactAnalyzer(List<Path> sourceFiles, Path baseDir) {
        this(sourceFiles, baseDir, AnalysisConfig.getDefault());
    }

    public ImpactAnalyzer(List<Path> sourceFiles, Path baseDir, AnalysisConfig config) {
        this.sourceFiles = sourceFiles;
        this.baseDir = baseDir;
        this.config = config;
        this.callGraphAnalyzer = new CallGraphAnalyzer(sourceFiles, baseDir, config);
        this.testMethodIdentifier = new TestMethodIdentifier(sourceFiles, baseDir, config);
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
        Set<String> impactedSignatures = new HashSet<>();
        Queue<MethodRef> queue = new LinkedList<>();

        // 将变更的方法加入队列
        for (ImpactedMethod method : changedMethods) {
            MethodRef methodRef = convertImpactedMethodToMethodRef(method);
            if (methodRef != null) {
                queue.offer(methodRef);
                impactedSignatures.add(methodRef.toSignature());
            }
        }

        // BFS 遍历反向调用图
        int depth = 0;
        while (!queue.isEmpty() && depth < config.getMaxDepth()) {
            int size = queue.size();
            for (int i = 0; i < size; i++) {
                MethodRef currentMethodRef = queue.poll();
                if (currentMethodRef == null) continue;

                Set<MethodRef> callers = reverseCallGraph.getOrDefault(currentMethodRef, Collections.emptySet());
                for (MethodRef callerRef : callers) {
                    String callerSignature = callerRef.toSignature();
                    if (!impactedSignatures.contains(callerSignature)) {
                        impactedSignatures.add(callerSignature);
                        queue.offer(callerRef);
                    }
                }
            }
            depth++;
        }
        return impactedSignatures;
    }

    public Map<String, Set<String>> findImpactedTests(List<ImpactedMethod> changedMethods) {
        Map<String, Set<String>> testImpacts = new HashMap<>();
        // TODO: 实现测试影响分析,需要将 impactedMethods (Set<String>) 转换为 Set<MethodRef>
        // Set<String> impactedMethodsSignatures = findImpactedMethods(changedMethods);
        // Set<MethodRef> impactedMethodRefs = impactedMethodsSignatures.stream()
        // .map(MethodRef::fromSignature)
        // .collect(Collectors.toSet());

        // testImpactAnalyzer.getImpactedTests(impactedMethodRefs); // 这是一个示例，需要根据TestImpactAnalyzer的实际方法调整

        return testImpacts;
    }

    private MethodRef convertImpactedMethodToMethodRef(ImpactedMethod impactedMethod) {
        // 根据 ImpactedMethod 的信息（特别是 packageName, className, methodSignature）创建 MethodRef
        // methodSignature 可能需要解析参数类型以匹配 MethodRef 的构造
        // 这是一个简化的示例，您可能需要更复杂的逻辑来解析和匹配签名
        if (impactedMethod.className == null || impactedMethod.methodName == null) {
            return null;
        }
        // 假设 MethodRef 有一个构造函数或工厂方法可以从这些信息创建实例
        // 例如: return new MethodRef(impactedMethod.packageName + "." + impactedMethod.className, impactedMethod.methodName, parseArgumentTypes(impactedMethod.methodSignature));
        // 为了编译通过，暂时返回null
        // TODO: 实现正确的转换逻辑
        return MethodRef.fromSignature(String.format("%s.%s#%s", 
            impactedMethod.packageName, 
            impactedMethod.className, 
            impactedMethod.methodName // 假设 impactedMethod.methodSignature 只是方法名
        ));
    }

    private String getMethodId(ImpactedMethod method) {
        // 这个方法现在可能不再直接需要，或者需要调整为返回 MethodRef
        return String.format("%s.%s#%s",
            method.packageName,
            method.className,
            method.methodSignature
        );
    }

    /**
     * 获取受影响的测试方法
     */
    public Map<String, Set<String>> findImpactedTestsByClass(List<ImpactedMethod> changedMethods) {
        // 直接调用，假设返回类型已经是 Map<String, Set<String>>
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
        if (methodRefs == null) return signatures;
        for (MethodRef methodRef : methodRefs) {
            signatures.add(methodRef.toSignature());
        }
        return signatures;
    }
} 