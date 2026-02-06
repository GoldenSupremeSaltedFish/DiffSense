package com.yourorg.gitimpact.test;

import com.yourorg.gitimpact.impact.MethodRef;
import com.yourorg.gitimpact.impact.CallGraphReverser;
import com.yourorg.gitimpact.ast.DiffToASTMapper.ImpactedMethod;
import com.yourorg.gitimpact.config.AnalysisConfig;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 测试覆盖分析器 - 检测受影响的业务方法中的测试覆盖漏洞
 */
public class TestCoverageAnalyzer {
    
    public enum RiskLevel {
        HIGH("高风险", "red"),
        MEDIUM("中风险", "orange"), 
        LOW("低风险", "yellow");
        
        private final String displayName;
        private final String color;
        
        RiskLevel(String displayName, String color) {
            this.displayName = displayName;
            this.color = color;
        }
        
        public String getDisplayName() { return displayName; }
        public String getColor() { return color; }
    }
    
    public static class TestGap {
        private final MethodRef method;
        private final RiskLevel riskLevel;
        private final Set<MethodRef> impactedCallers;
        private final String reason;
        
        public TestGap(MethodRef method, RiskLevel riskLevel, Set<MethodRef> impactedCallers, String reason) {
            this.method = method;
            this.riskLevel = riskLevel;
            this.impactedCallers = impactedCallers;
            this.reason = reason;
        }
        
        public MethodRef getMethod() { return method; }
        public RiskLevel getRiskLevel() { return riskLevel; }
        public Set<MethodRef> getImpactedCallers() { return impactedCallers; }
        public String getReason() { return reason; }
        
        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("method", method.toSignature());
            map.put("className", method.getClassName());
            map.put("methodName", method.getMethodName());
            map.put("riskLevel", riskLevel.name());
            map.put("riskDisplayName", riskLevel.getDisplayName());
            map.put("riskColor", riskLevel.getColor());
            map.put("reason", reason);
            map.put("impactedCallersCount", impactedCallers.size());
            map.put("impactedCallers", impactedCallers.stream()
                .map(MethodRef::toSignature)
                .collect(Collectors.toList()));
            return map;
        }
    }
    
    private final Set<MethodRef> testMethods;
    private final Map<MethodRef, Set<MethodRef>> reverseCallGraph;
    private final Map<MethodRef, Set<MethodRef>> callGraph;
    private final AnalysisConfig config;
    
    public TestCoverageAnalyzer(
        Set<MethodRef> testMethods,
        Map<MethodRef, Set<MethodRef>> reverseCallGraph,
        Map<MethodRef, Set<MethodRef>> callGraph,
        AnalysisConfig config
    ) {
        this.testMethods = testMethods;
        this.reverseCallGraph = reverseCallGraph;
        this.callGraph = callGraph;
        this.config = config;
    }
    
    /**
     * 分析受影响方法的测试覆盖情况
     * @param changedMethods 变更的方法列表
     * @return 测试覆盖漏洞列表
     */
    public List<TestGap> analyzeTestCoverage(List<ImpactedMethod> changedMethods) {
        // 1. 获取所有受影响的方法（直接和间接）
        Set<MethodRef> allImpactedMethods = getAllImpactedMethods(changedMethods);
        
        // 2. 过滤出业务方法（排除测试方法、框架方法等）
        Set<MethodRef> businessMethods = filterBusinessMethods(allImpactedMethods);
        
        // 3. 检测测试覆盖漏洞
        List<TestGap> testGaps = new ArrayList<>();
        
        for (MethodRef method : businessMethods) {
            // 检查该方法是否被测试覆盖
            Set<MethodRef> relatedTests = findRelatedTests(method);
            
            if (relatedTests.isEmpty()) {
                // 没有测试覆盖，计算风险等级
                RiskLevel riskLevel = calculateRiskLevel(method);
                Set<MethodRef> impactedCallers = getImpactedCallers(method);
                String reason = buildReason(method, impactedCallers);
                
                testGaps.add(new TestGap(method, riskLevel, impactedCallers, reason));
            }
        }
        
        // 4. 按风险等级排序
        testGaps.sort((a, b) -> {
            // 先按风险等级排序（HIGH > MEDIUM > LOW）
            int riskCompare = Integer.compare(b.getRiskLevel().ordinal(), a.getRiskLevel().ordinal());
            if (riskCompare != 0) return riskCompare;
            
            // 风险等级相同时，按受影响调用者数量排序
            return Integer.compare(b.getImpactedCallers().size(), a.getImpactedCallers().size());
        });
        
        return testGaps;
    }
    
    /**
     * 获取所有受影响的方法（包括直接和间接影响）
     */
    private Set<MethodRef> getAllImpactedMethods(List<ImpactedMethod> changedMethods) {
        Set<MethodRef> changedMethodRefs = changedMethods.stream()
            .map(this::convertToMethodRef)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        
        Set<MethodRef> allImpacted = new HashSet<>(changedMethodRefs);
        
        // 获取所有间接调用者
        Set<MethodRef> transitiveCallers = CallGraphReverser.getTransitiveCallers(
            changedMethodRefs, reverseCallGraph, config);
        allImpacted.addAll(transitiveCallers);
        
        return allImpacted;
    }
    
    /**
     * 过滤出业务方法（排除测试方法、框架方法、工具方法等）
     */
    private Set<MethodRef> filterBusinessMethods(Set<MethodRef> methods) {
        return methods.stream()
            .filter(method -> !isTestMethod(method))
            .filter(method -> !isFrameworkMethod(method))
            .filter(method -> !isUtilityMethod(method))
            .filter(method -> !isGetterSetter(method))
            .collect(Collectors.toSet());
    }
    
    /**
     * 查找与指定方法相关的测试方法
     */
    private Set<MethodRef> findRelatedTests(MethodRef method) {
        Set<MethodRef> relatedTests = new HashSet<>();
        
        // 获取所有调用该方法的方法（直接和间接）
        Set<MethodRef> allCallers = CallGraphReverser.getTransitiveCallers(
            Collections.singleton(method), reverseCallGraph, config);
        
        // 找出其中的测试方法
        for (MethodRef caller : allCallers) {
            if (testMethods.contains(caller)) {
                relatedTests.add(caller);
            }
        }
        
        return relatedTests;
    }
    
    /**
     * 计算方法的风险等级
     */
    private RiskLevel calculateRiskLevel(MethodRef method) {
        int score = 0;
        
        // 基于调用者数量
        Set<MethodRef> callers = getImpactedCallers(method);
        if (callers.size() >= 5) score += 3;
        else if (callers.size() >= 2) score += 2;
        else score += 1;
        
        // 基于方法类型
        if (isPublicAPIMethod(method)) score += 2;
        if (isBusinessLogicMethod(method)) score += 2;
        if (isCoreServiceMethod(method)) score += 3;
        
        // 基于包路径重要性
        String className = method.getClassName();
        if (className.contains(".service.") || className.contains(".business.")) score += 2;
        if (className.contains(".core.") || className.contains(".main.")) score += 2;
        if (className.contains(".controller.") || className.contains(".api.")) score += 1;
        
        // 基于方法名称模式
        String methodName = method.getMethodName();
        if (methodName.startsWith("save") || methodName.startsWith("update") || 
            methodName.startsWith("delete") || methodName.startsWith("create")) score += 2;
        if (methodName.startsWith("process") || methodName.startsWith("execute") ||
            methodName.startsWith("handle")) score += 1;
        
        // 计算最终风险等级
        if (score >= 7) return RiskLevel.HIGH;
        if (score >= 4) return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }
    
    /**
     * 获取受影响的调用者
     */
    private Set<MethodRef> getImpactedCallers(MethodRef method) {
        return reverseCallGraph.getOrDefault(method, Collections.emptySet());
    }
    
    /**
     * 构建风险原因说明
     */
    private String buildReason(MethodRef method, Set<MethodRef> impactedCallers) {
        StringBuilder reason = new StringBuilder();
        reason.append("该方法缺少测试覆盖");
        
        if (!impactedCallers.isEmpty()) {
            reason.append("，影响 ").append(impactedCallers.size()).append(" 个调用方法");
        }
        
        if (isPublicAPIMethod(method)) {
            reason.append("，为公共API方法");
        }
        
        if (isBusinessLogicMethod(method)) {
            reason.append("，包含重要业务逻辑");
        }
        
        if (isCoreServiceMethod(method)) {
            reason.append("，为核心服务方法");
        }
        
        return reason.toString();
    }
    
    // 辅助判断方法
    
    private boolean isTestMethod(MethodRef method) {
        return testMethods.contains(method);
    }
    
    private boolean isFrameworkMethod(MethodRef method) {
        String className = method.getClassName();
        return className.startsWith("java.") || 
               className.startsWith("javax.") ||
               className.startsWith("org.springframework.") ||
               className.startsWith("org.junit.") ||
               className.startsWith("org.mockito.");
    }
    
    private boolean isUtilityMethod(MethodRef method) {
        String className = method.getClassName();
        String methodName = method.getMethodName();
        return className.contains(".util.") || 
               className.endsWith("Util") ||
               className.endsWith("Utils") ||
               className.endsWith("Helper") ||
               methodName.equals("toString") ||
               methodName.equals("hashCode") ||
               methodName.equals("equals");
    }
    
    private boolean isGetterSetter(MethodRef method) {
        String methodName = method.getMethodName();
        return methodName.startsWith("get") || 
               methodName.startsWith("set") ||
               methodName.startsWith("is");
    }
    
    private boolean isPublicAPIMethod(MethodRef method) {
        String className = method.getClassName();
        return className.contains(".controller.") ||
               className.contains(".api.") ||
               className.contains(".rest.") ||
               className.contains(".web.");
    }
    
    private boolean isBusinessLogicMethod(MethodRef method) {
        String className = method.getClassName();
        String methodName = method.getMethodName();
        return className.contains(".service.") ||
               className.contains(".business.") ||
               methodName.startsWith("process") ||
               methodName.startsWith("calculate") ||
               methodName.startsWith("validate") ||
               methodName.startsWith("transform");
    }
    
    private boolean isCoreServiceMethod(MethodRef method) {
        String className = method.getClassName();
        return className.contains(".core.") ||
               className.contains(".main.") ||
               className.endsWith("Service") ||
               className.endsWith("Manager") ||
               className.endsWith("Engine");
    }
    
    private MethodRef convertToMethodRef(ImpactedMethod impactedMethod) {
        if (impactedMethod.className == null || impactedMethod.methodName == null) {
            return null;
        }
        
        String fullClassName = impactedMethod.packageName != null ? 
            impactedMethod.packageName + "." + impactedMethod.className :
            impactedMethod.className;
            
        return new MethodRef(fullClassName, impactedMethod.methodName);
    }
} 