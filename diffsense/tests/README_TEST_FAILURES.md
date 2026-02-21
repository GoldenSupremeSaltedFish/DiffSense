# 测试失败原因分析（CI 6 failed）

## 已修复（4 项）

### 1. test_inline_ignore – FileNotFoundError (Windows 绝对路径)
- **原因**：用例里写死了 Windows 路径 `Path(r"c:\Users\30871\...")`，在 Linux CI 上该路径不存在。
- **修复**：改为基于 `Path(__file__).parent` 的相对路径：`Path(__file__).parent / "fixtures" / "ast_cases" / "ignore" / "inline_ignore.diff"`。

### 2. test_signal_consistency (synchronized / lock / volatile) – 无信号
- **原因**：只传了 `diff_data = {'raw_diff': diff}`。ASTDetector 的 fallback 会得到 `file='unknown'`，随后因 `not filename.endswith('.java')` 直接跳过，不分析任何文件，故无信号。
- **修复**：显式传入 `file_patches` 且文件名为 `.java`，例如：  
  `diff_data = {'raw_diff': diff, 'file_patches': [{'file': 'Dummy.java', 'patch': diff}]}`。

### 3. test_type_downgrade – KeyError: 'var'
- **原因**：用例期望 `downgrade_signal.meta['var'] == "cache"`，但 ASTDetector 在构造 thread_safety_downgrade 的 Change 时，meta 里只有 `downgrade`、`from`、`to`，没有 `var`（变量名在 `symbol` 里）。
- **修复**：在 `ast_detector.py` 中构造该 Change 时增加 `"var": var_name` 到 meta，与既有测试约定一致。

### 4. test_critical_removal – 未检测到 lock removal 信号
- **原因**：用例用 `s.id == "runtime.concurrency.lock" and s.action == "removed"` 筛选，但 ASTDetector 对 lock 移除返回的 signal id 为 **`runtime.concurrency.lock_removed`**（见 `_map_change_to_signal_id`），不是 `runtime.concurrency.lock`。
- **修复**：筛选时改为接受 `s.id == "runtime.concurrency.lock_removed"` 或 `(s.id == "runtime.concurrency.lock" and s.action == "removed")`；critical 规则筛选改为兼容 `lock_removed` 相关 rule id。

---

## 小结

| 用例 | 原因类型 | 处理 |
|------|----------|------|
| test_inline_ignore | 硬编码 Windows 路径 | 已改为基于 `__file__` 的相对路径 |
| test_signal_consistency (×3) | diff_data 缺 file_patches，导致跳过 .java | 已补 file_patches + Dummy.java |
| test_type_downgrade | meta 缺少 'var' | 已在 detector 中为 downgrade 增加 meta['var'] |
| test_critical_removal | 断言用了错误的 signal id | 已改为接受 lock_removed id |
