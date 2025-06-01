package com.yourorg.gitimpact.impact;

import com.yourorg.gitimpact.config.AnalysisConfig;
import java.util.*;

public class CallGraphReverser {
    /**
     * 构建反向调用图
     * @param callGraph 正向调用图（caller -> callees）
     * @return 反向调用图（callee -> callers）
     */
    public static Map<MethodRef, Set<MethodRef>> buildReverseCallGraph(Map<MethodRef, Set<MethodRef>> callGraph) {
        Map<MethodRef, Set<MethodRef>> reverse = new HashMap<>();

        for (Map.Entry<MethodRef, Set<MethodRef>> entry : callGraph.entrySet()) {
            MethodRef caller = entry.getKey();
            for (MethodRef callee : entry.getValue()) {
                reverse.computeIfAbsent(callee, k -> new HashSet<>()).add(caller);
            }
        }

        return reverse;
    }

    /**
     * 获取一组方法的所有间接调用者，受最大深度限制
     * @param changedMethods 变更的方法集合
     * @param reverseCallGraph 反向调用图
     * @param config 分析配置
     * @return 所有直接和间接调用者的集合
     */
    public static Set<MethodRef> getTransitiveCallers(
        Set<MethodRef> changedMethods,
        Map<MethodRef, Set<MethodRef>> reverseCallGraph,
        AnalysisConfig config
    ) {
        Set<MethodRef> result = new HashSet<>();
        Queue<MethodRefWithDepth> queue = new LinkedList<>();
        
        // 初始化队列，深度为0
        for (MethodRef method : changedMethods) {
            queue.offer(new MethodRefWithDepth(method, 0));
        }

        while (!queue.isEmpty()) {
            MethodRefWithDepth current = queue.poll();
            
            // 如果已达到最大深度，不再继续搜索
            if (current.depth >= config.getMaxDepth()) {
                continue;
            }

            Set<MethodRef> callers = reverseCallGraph.getOrDefault(current.methodRef, Collections.emptySet());
            for (MethodRef caller : callers) {
                if (result.add(caller)) {
                    queue.offer(new MethodRefWithDepth(caller, current.depth + 1));
                }
            }
        }

        return result;
    }

    /**
     * 获取一组方法的所有间接调用者（使用默认配置）
     */
    public static Set<MethodRef> getTransitiveCallers(
        Set<MethodRef> changedMethods,
        Map<MethodRef, Set<MethodRef>> reverseCallGraph
    ) {
        return getTransitiveCallers(changedMethods, reverseCallGraph, AnalysisConfig.getDefault());
    }

    private static class MethodRefWithDepth {
        final MethodRef methodRef;
        final int depth;

        MethodRefWithDepth(MethodRef methodRef, int depth) {
            this.methodRef = methodRef;
            this.depth = depth;
        }
    }
} 