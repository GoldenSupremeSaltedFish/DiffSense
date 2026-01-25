# DiffSense · MR 审计技术草图（MVP）

> **目标**：
> 清晰回答三件事：
> 1️⃣ 系统运行在什么地方
> 2️⃣ MR 事件如何流转
> 3️⃣ 哪些模块是“不可替换核心”，哪些是“可迭代实现”

---

## 一、整体技术视角（一句话）

**DiffSense 是一个事件驱动的 MR 审计分析器，运行在 CI / App 回调中，输出结构化工程影响结论。**

它不是：

* 常驻服务
* Dashboard 系统
* Runtime agent

---

## 二、系统整体结构（逻辑视图）

```
┌──────────────┐
│ GitHub/GitLab│
│   MR Event   │
└──────┬───────┘
       │ (PR opened / synchronized)
       ▼
┌─────────────────────────┐
│ DiffSense Trigger Layer │
│ (GitHub App / CI Job)   │
└──────┬──────────────────┘
       │ fetch diff / metadata
       ▼
┌─────────────────────────┐
│ DiffSense Core Analyzer │   ← 核心资产
│                         │
│ 1. Diff Parser          │
│ 2. Impact Evaluator     │
│ 3. Rule Engine          │
│ 4. Decision Composer   │
└──────┬──────────────────┘
       │ structured result
       ▼
┌─────────────────────────┐
│ Output Renderer         │
│                         │
│ - CI Check Status       │
│ - MR Comment (Markdown) │
└─────────────────────────┘
```

---

## 三、模块拆解（工程级）

### 1️⃣ Trigger Layer（事件入口）

**职责**：

* 接收 MR 事件
* 拉取最小必要上下文
* 触发分析器

**技术选型**：

* GitHub App / GitLab App
* 或 CI（GitHub Actions / GitLab CI）

**只做三件事**：

* 获取 base / head SHA
* 拉取 diff & 文件列表
* 调用 Core Analyzer

❗不允许放业务逻辑

---

### 2️⃣ Core Analyzer（核心）

> **这是 DiffSense 唯一真正值钱的部分**

#### 2.1 Diff Parser

**输入**：

* unified diff
* 文件路径 / 语言

**输出**：

```json
{
  "files": ["src/order/service.ts"],
  "stats": {"add": 120, "del": 30},
  "change_types": ["logic", "config"]
}
```

技术：

* Python / Node diff parser
* Tree-sitter（可选，非必须）

---

#### 2.2 Impact Evaluator（工程影响计算）

**固定维度（初期锁死）**：

* Architecture
* Data
* Runtime
* Observability
* Change Scale

**原则**：

* 每个维度独立判断
* 不互相影响

示例：

```json
{
  "runtime": "high",
  "data": "medium"
}
```

---

#### 2.3 Rule Engine（可解释规则）

**规则形态**：

* JSON / YAML + 代码

示例：

```yaml
runtime:
  high:
    - match: "thread|async|lock"
    - file: "**/core/**"
```

原则：

* 命中即触发
* 不做概率判断

---

#### 2.4 Decision Composer（结论合成）

**输入**：

* 各维度 impact

**输出（唯一允许的结论）**：

```json
{
  "review_level": "elevated",
  "reasons": ["runtime_high"]
}
```

禁止：

* 多级评分
* 模糊语言

---

### 3️⃣ Output Renderer（输出层）

#### 3.1 CI Check

* Status: success / neutral
* Summary: `Elevated review recommended`

❗ 不允许 fail pipeline

---

#### 3.2 MR Comment（核心 UX）

**Markdown 结构固定**：

```
### DiffSense · MR Audit

**Review Level:** Elevated

| Dimension | Impact |
|----------|--------|
| Runtime  | High   |
| Data     | Medium |

**Why:**
- Runtime: async logic changed in core module
```

---

## 四、数据 & 状态策略

| 项目   | 策略    |
| ---- | ----- |
| 历史数据 | ❌ 不存  |
| 用户配置 | ❌ 不支持 |
| 项目画像 | ❌ 不做  |

每次 MR = 一次独立审计

---

## 五、技术选型总结（可执行）

| 层级       | 技术                      |
| -------- | ----------------------- |
| Trigger  | GitHub App / GitLab CI  |
| Analyzer | Python（推荐）              |
| Rules    | YAML + Code             |
| Output   | GitHub Status + Comment |

---

## 六、你下一步“只该做什么”

### ✅ 第一步（必须）

* 把 Core Analyzer 单独做成 CLI
* 输入：diff
* 输出：JSON 审计结果

### ❌ 不要做

* Dashboard
* AI Agent
* SRE 自动化

---

## 七、一句工程底线

> **只要 Core Analyzer 还能被替换，DiffSense 就还不是一个产品。**

当这个核心模块：

* 稳定
* 可解释
* Reviewer 开始依赖

你就赢了。
