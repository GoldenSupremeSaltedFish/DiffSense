# Java CVE 分级快速参考

## 一分钟配置

### 最快模式（推荐 CI/CD）
```yaml
# .diffsense.yaml
profile: lightweight
```
- ✅ 仅 1,549 条规则（8.56%）
- ✅ 冷启动 < 10s
- ✅ 只报告最关键问题

### 平衡模式（推荐日常使用）
```yaml
# .diffsense.yaml
profile: standard
```
- ✅ 4,837 条规则（26.72%）
- ✅ 冷启动 < 30s
- ✅ 覆盖 Critical + High

### 全面模式（推荐审计）
```yaml
# .diffsense.yaml
profile: strict
```
- ✅ 18,134 条规则（100%）
- ✅ 冷启动 < 60s
- ✅ 覆盖所有 CVE

## 分级结构

```
pro-rules/cve/java/
├── tier1_critical/    # 1,549 条 (8.56%) - 立即修复
├── tier2_high/        # 3,288 条 (18.16%) - 优先修复
├── tier3_medium/      # 5,822 条 (32.16%) - 按需修复
└── tier4_low/         # 7,445 条 (41.12%) - 可选修复
```

## 常用命令

```bash
# 查看当前加载的规则
diffsense rules list

# 使用不同 profile 运行
diffsense audit --profile lightweight
diffsense audit --profile standard
diffsense audit --profile strict

# 重新分级规则
python scripts/tier_java_cve_rules.py --dry-run
python scripts/tier_java_cve_rules.py
```

## 性能对比

| Profile | 规则数 | 内存 | 冷启动 | 适用场景 |
|---------|--------|------|--------|---------|
| lightweight | 1,549 | 50MB | < 10s | PR 检查 |
| standard | 4,837 | 150MB | < 30s | 日常开发 |
| strict | 18,134 | 500MB | < 60s | 安全审计 |

## 分级标准

- **Tier 1 (Critical):** CVSS >= 9.0 或 severity=critical
- **Tier 2 (High):** CVSS >= 7.0 或 severity=high
- **Tier 3 (Medium):** CVSS >= 4.0 或 severity=medium
- **Tier 4 (Low):** CVSS < 4.0 或 severity=low

## 故障排查

**Q: 规则没有按分级加载？**
```bash
# 检查 profile 配置
cat .diffsense.yaml | grep profile

# 查看 tier 目录
ls pro-rules/cve/java/tier*/
```

**Q: 想自定义分级标准？**
```bash
# 编辑分级脚本
vim scripts/tier_java_cve_rules.py
# 修改 get_tier_for_rule() 函数
```

**Q: 如何查看分级统计？**
```bash
python scripts/analyze_java_cve_severity.py
```

## 相关文档

- 📖 [完整使用指南](docs/JAVA_CVE_TIER_CLASSIFICATION_GUIDE.md)
- 📊 [实现总结](JAVA_CVE_TIER_IMPLEMENTATION_SUMMARY.md)
- 📝 [英文参考](pro-rules/cve/java/README_TIER_CLASSIFICATION.md)
