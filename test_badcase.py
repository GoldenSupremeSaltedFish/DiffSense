#!/usr/bin/env python3
"""Bad Case 测试 - 验证规则能正确检测真实风险"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sys.path.insert(0, r"C:\Users\30871\Desktop\diffsense-work-space\DiffSense\diffsense")

from core.parser import DiffParser
from core.ast_detector import ASTDetector
from core.rules import RuleEngine
from core.evaluator import ImpactEvaluator
from core.composer import DecisionComposer

# Bad Case 测试：模拟真实的风险场景
BAD_CASES = [
    {
        "name": "删除 public 方法（破坏 API 兼容性）",
        "diff": """diff --git a/src/main/java/com/example/ApiService.java b/src/main/java/com/example/ApiService.java
--- a/src/main/java/com/example/ApiService.java
+++ b/src/main/java/com/example/ApiService.java
@@ -20,7 +20,6 @@ public class ApiService {
     }
 
-    public void deprecatedMethod() {
-        // This method is removed
-    }
+    // Method removed without deprecation
 }
"""
    },
    {
        "name": "接口添加方法（所有实现类需更新）",
        "diff": """diff --git a/src/main/java/com/example/DataRepository.java b/src/main/java/com/example/DataRepository.java
--- a/src/main/java/com/example/DataRepository.java
+++ b/src/main/java/com/example/DataRepository.java
@@ -15,4 +15,6 @@ public interface DataRepository {
     void save(T entity);
 
     void deleteById(String id);
+
+    void batchDelete(List<String> ids);  // New method added to interface
 }
"""
    },
    {
        "name": "移除并发修饰符（线程安全风险）",
        "diff": """diff --git a/src/main/java/com/example/SharedCache.java b/src/main/java/com/example/SharedCache.java
--- a/src/main/java/com/example/SharedCache.java
+++ b/src/main/java/com/example/SharedCache.java
@@ -10,7 +10,7 @@ public class SharedCache {
-    private volatile Map<String, Object> cache;
+    private Map<String, Object> cache;
     private final Lock lock = new ReentrantLock();
 }
"""
    },
    {
        "name": "方法签名变更（破坏调用方）",
        "diff": """diff --git a/src/main/java/com/example/PaymentService.java b/src/main/java/com/example/PaymentService.java
--- a/src/main/java/com/example/PaymentService.java
+++ b/src/main/java/com/example/PaymentService.java
@@ -20,7 +20,7 @@ public class PaymentService {
-    public Result processPayment(String orderId, BigDecimal amount) {
+    public Result processPayment(String orderId, BigDecimal amount, String currency) {
         // Implementation
         return Result.success();
     }
"""
    },
    {
        "name": "移除 synchronized（并发风险）",
        "diff": """diff --git a/src/main/java/com/example/AccountManager.java b/src/main/java/com/example/AccountManager.java
--- a/src/main/java/com/example/AccountManager.java
+++ b/src/main/java/com/example/AccountManager.java
@@ -25,7 +25,7 @@ public class AccountManager {
-    public synchronized void updateBalance(String accountId, BigDecimal delta) {
+    public void updateBalance(String accountId, BigDecimal delta) {
         // This change removes thread safety!
         accountBalances.merge(accountId, delta, BigDecimal::add);
     }
"""
    },
    {
        "name": "Optional.get() 无安全检查（NPE 风险）",
        "diff": """diff --git a/src/main/java/com/example/UserService.java b/src/main/java/com/example/UserService.java
--- a/src/main/java/com/example/UserService.java
+++ b/src/main/java/com/example/UserService.java
@@ -30,7 +30,7 @@ public class UserService {
     public User getUserById(String id) {
         Optional<User> user = userRepository.findById(id);
-        return user.orElse(null);
+        return user.get();  // 危险：无检查直接 get()
     }
 }
"""
    }
]

def run_audit(diff):
    parser = DiffParser()
    diff_data = parser.parse(diff)
    if not diff_data.get('files'):
        return None

    detector = ASTDetector()
    ast_signals = detector.detect_signals(diff_data)

    engine = RuleEngine(r"C:\Users\30871\Desktop\diffsense-work-space\DiffSense\diffsense\config\rules.yaml")
    evaluator = ImpactEvaluator(engine)
    impacts = evaluator.evaluate(diff_data, ast_signals=ast_signals)

    composer = DecisionComposer()
    decision = composer.compose(impacts)

    return {"level": decision.get("review_level"), "impacts": impacts}

print("="*60)
print("Bad Case 测试 - 验证规则能检测真实风险")
print("="*60)
print()

passed = 0
failed = 0

for i, case in enumerate(BAD_CASES, 1):
    print(f"[{i}] {case['name']}")
    print("-" * 50)

    result = run_audit(case['diff'])

    if result:
        triggered = result["impacts"]
        level = result["level"]

        print(f"  审查级别: {level}")
        print(f"  触发规则数: {len(triggered)}")

        if triggered:
            print("  触发的规则:")
            for t in triggered:
                sev = t.get("severity", "?")
                rid = t.get("id", "?")
                print(f"    [{sev}] {rid}")

            # 检查是否包含相关风险规则
            expected_rules = {
                "删除 public 方法": "api.public_method_removed",
                "接口添加方法": "api.interface_changed",
                "移除并发修饰符": "runtime.concurrency.volatile",
                "方法签名变更": "api.method_signature_changed",
                "移除 synchronized": "runtime.concurrency.synchronized",
                "Optional.get": "null.optional_unsafe_get"
            }

            matched = False
            for expected_key, expected_rule in expected_rules.items():
                if expected_key in case['name']:
                    for t in triggered:
                        if expected_rule in t.get('id', ''):
                            matched = True
                            print(f"  ✓ 正确检测到: {expected_rule}")
                            passed += 1
                            break
                    if not matched:
                        print(f"  ✗ 未检测到: {expected_rule}")
                        failed += 1

            if not matched and not any(expected_key in case['name'] for expected_key in expected_rules):
                # 其他规则触发也算通过
                passed += 1
        else:
            print(f"  ⚠ 无规则触发（可能漏报）")
            failed += 1
    else:
        print(f"  ✗ 审计失败")

    print()

print("="*60)
print("测试结果汇总")
print("="*60)
print(f"通过: {passed}")
print(f"失败: {failed}")
print(f"总计: {passed + failed}")

if failed == 0:
    print("\n✓ 所有 Bad Case 都被正确检测！")
else:
    print(f"\n✗ {failed} 个场景未正确检测")