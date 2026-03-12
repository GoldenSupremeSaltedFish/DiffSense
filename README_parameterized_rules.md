# DiffSense PROrules 参数化路径支持

## 功能概述

DiffSense 现在支持通过构造函数参数直接指定PROrules路径，无需依赖配置文件。

## 使用方法

### 1. 只加载普通规则（Simple Rules Only）

```python
from diffsense.core.rules import RuleEngine

# 只加载内置的Python规则
engine = RuleEngine(rules_path=None)
```

### 2. 同时加载普通规则和PROrules

```python
from diffsense.core.rules import RuleEngine

# 加载内置规则 + 指定路径的PROrules
engine = RuleEngine(
    rules_path=None, 
    pro_rules_path="pro-rules/"
)
```

### 3. 自定义规则路径

```python
from diffsense.core.rules import RuleEngine

# 自定义普通YAML规则路径 + PROrules路径
engine = RuleEngine(
    rules_path="custom-rules/",
    pro_rules_path="pro-rules/"
)
```

## 参数说明

- `rules_path` (str, optional): 普通YAML规则目录路径，默认为None（不加载额外YAML规则）
- `pro_rules_path` (str, optional): PROrules目录路径，默认为None（不加载PROrules）

## 目录结构要求

```
DiffSense/
├── diffsense/
│   └── rules/
│       ├── concurrency.py          # 内置Python规则
│       └── builtin/               # 内置规则模块（空目录）
├── pro-rules/                     # PROrules目录（YAML文件）
│   ├── concurrency.yaml
│   ├── critical_cves.yaml
│   ├── critical_vulnerabilities.yaml
│   ├── data_integrity.yaml
│   ├── performance.yaml
│   ├── security.yaml
│   ├── security_high.yaml
│   └── test_generated_critical_rules.yaml
└── diffsense.config.json          # 配置文件（可选）
```

## 领域划分

PROrules已按以下领域进行分类：
- **critical**: 关键漏洞规则 (22个)
- **data**: 数据完整性规则 (10个)  
- **high**: 高危安全规则 (1647个)
- **performance**: 性能相关规则 (10个)
- **runtime**: 运行时并发规则 (8个)
- **security**: 安全配置规则 (10个)

总计: 1718个PROrules

## 正式运行中的加载（CLI / audit / replay）

**超级规则（PROrules）已与正式 DiffSense 流程打通**：执行 `diffsense audit`、`diffsense replay`、`diffsense rules list`、`diffsense profile-rules`、benchmark 等时，若存在 pro-rules 目录则会**自动加载**，无需仅靠测试验证。

解析顺序（`core.run_config.get_pro_rules_path()`）：
1. **环境变量** `DIFFSENSE_PRO_RULES`：设为 pro-rules 的绝对或相对路径（相对当前工作目录）。
2. **仓库配置** `.diffsense.yaml` 中的 `pro_rules_path: "path/to/pro-rules"`。
3. **默认**：与 diffsense 包同级的 `pro-rules`（源码或同仓部署时即生效）。

仅当上述路径**存在且为目录**时才会加载；未设置或路径不存在时行为与之前一致（不加载 PRO 规则）。

## 兼容性

此修改保持向后兼容：
- 现有代码无需修改即可继续工作
- 配置文件方式仍然支持
- 环境变量方式仍然支持

## 测试验证

已通过以下测试场景验证：
1. Simple Rules Only模式：仅加载6个内置Python规则
2. PRO Rules with path模式：加载6个内置规则 + 1718个PROrules
3. 领域分类验证：确认所有PROrules正确按领域划分