package com.yourorg.gitimpact.impact;

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
     * 获取一组方法的所有间接调用者
     * @param changedMethods 变更的方法集合
     * @param reverseCallGraph 反向调用图
     * @return 所有直接和间接调用者的集合
     */
    public static Set<MethodRef> getTransitiveCallers(
        Set<MethodRef> changedMethods,
        Map<MethodRef, Set<MethodRef>> reverseCallGraph
    ) {
        Set<MethodRef> result = new HashSet<>();
        Deque<MethodRef> stack = new ArrayDeque<>(changedMethods);

        while (!stack.isEmpty()) {
            MethodRef current = stack.pop();
            Set<MethodRef> callers = reverseCallGraph.getOrDefault(current, Collections.emptySet());

            for (MethodRef caller : callers) {
                if (result.add(caller)) {
                    stack.push(caller);
                }
            }
        }

        return result;
    }
} 