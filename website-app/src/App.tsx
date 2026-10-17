import {
  Component,
  Fragment,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import textureUrl from "./assets/footer-texture.png";

const QUICKSTART_DOC =
  "https://github.com/GoldenSupremeSaltedFish/DiffSense/blob/main/diffsense/docs/quickstart.md";

/** 与仓库 `diffsense/docs/quickstart.md` 中「方式一」YAML 一致，便于复制到 `.github/workflows/diffsense.yml`。 */
const WORKFLOW_SNIPPET = [
  "name: DiffSense PR Audit",
  "on:",
  "  pull_request:",
  "    types: [opened, synchronize]",
  "jobs:",
  "  audit:",
  "    runs-on: ubuntu-latest",
  "    permissions:",
  "      contents: read",
  "      pull_requests: write",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "      - uses: actions/setup-python@v5",
  "        with:",
  '          python-version: "3.12"',
  "      - name: Cache DiffSense",
  "        uses: actions/cache@v4",
  "        with:",
  "          path: ~/.diffsense",
  "          key: diffsense-${{ runner.os }}-${{ hashFiles('.github/workflows/diffsense.yml') }}",
  "      - name: Install DiffSense",
  '        run: pip install "git+https://github.com/GoldenSupremeSaltedFish/DiffSense.git@release/2.2.0#subdirectory=diffsense"',
  "      - name: Run DiffSense",
  "        env:",
  "          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}",
  '        run: diffsense audit --platform github --token "$GITHUB_TOKEN" --repo "${{ github.repository }}" --pr "${{ github.event.pull_request.number }}"',
].join("\n");

/** Footer 碎片动画异步加载，three.js 独立 chunk，不阻塞首屏 */
const FooterDistortion = lazy(() => import("./FooterDistortion"));

/** Footer 动画兜底：渲染异常时降级为静态纹理图，避免单组件故障卸载整页 */
class FooterDistortionBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <img
          src={textureUrl}
          alt="DiffSense"
          className="distortion-fallback-img"
          draggable={false}
        />
      );
    }
    return this.props.children;
  }
}

const featureCards = [
  {
    title: "增量分析",
    desc: "只分析变更集，相较全量扫描提升 10-100 倍，适配 CI/CD 流水线。",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 15l-2-3 2-3" />
        <path d="M21 12h-4" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z" />
      </svg>
    ),
  },
  {
    title: "AST 语义分析",
    desc: "基于抽象语法树的变更语义分析，准确率优于正则匹配，显著降低误报。",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 6l-2-3 2-3" />
        <path d="M16 6l2-3-2-3" />
        <path d="M21 12h-4" />
        <path d="M8 8a2 2 0 0 0-2 2v2" />
        <path d="M16 8a2 2 0 0 1 2 2v2" />
        <path d="M7 22l3-8M17 22l-3-8" />
      </svg>
    ),
  },
  {
    title: "信号驱动架构",
    desc: "模块化信号检测系统，支持规则扩展，适配不同业务与语言场景。",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l2.1 6.2L20 9.5l-4.4 3.9 1.3 6.1L12 16.8 7.1 19.5l1.3-6.1L4 9.5l5.9-.3z" />
      </svg>
    ),
  },
  {
    title: "精准风险定位",
    desc: "精确到行号的风险提示，支持内联注释和自动修复建议。",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
        <path d="M8 11h6M11 8v6" />
      </svg>
    ),
  },
  {
    title: "CI/CD 无缝集成",
    desc: "支持 GitHub Actions 与 GitLab CI，可快速接入现有研发流程。",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 0 1-9 9" />
        <path d="M3 12a9 9 0 0 1 9-9" />
        <path d="M12 21a9 9 0 0 0 9-9" />
        <path d="M12 3a9 9 0 0 0-9 9" />
        <path d="M12 3v18" />
      </svg>
    ),
  },
  {
    title: "规则质量调优",
    desc: "按历史命中持续校准规则，检测策略可迭代优化。",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 17l5-5 4 4 7-7" />
        <path d="M15 9h6v6" />
      </svg>
    ),
  },
] as const;

const pipelineSteps = [
  ["1", "差异解析", "解析 Git diff，提取变更信息"],
  ["2", "AST 检测", "生成语义变化对象 (Change)"],
  ["3", "信号转换", "Change 转为标准化信号 (Signal)"],
  ["4", "规则评估", "基于信号执行风险规则"],
  ["5", "结果输出", "生成报告和内联评论"],
] as const;

const App = () => {
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  /* scroll-spy：滚动时高亮当前区块对应的导航项 */
  useEffect(() => {
    const sectionIds = ["features", "architecture", "risks", "get-started"];
    const handleScroll = () => {
      let current = "";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 96) {
          current = id;
        }
      }
      setActiveSection(current);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const copyWorkflow = () => {
    void navigator.clipboard.writeText(WORKFLOW_SNIPPET).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    <>
      <header className="site-header">
        <div className="container header-content">
          <div className="logo">
            <span className="logo-icon">DS</span>
            <span>DiffSense</span>
          </div>
          <nav>
            <a href="#features" className={activeSection === "features" ? "active" : undefined}>
              核心能力
            </a>
            <a
              href="#architecture"
              className={activeSection === "architecture" ? "active" : undefined}
            >
              技术架构
            </a>
            <a href="#risks" className={activeSection === "risks" ? "active" : undefined}>
              风险检测
            </a>
            <a
              href="#get-started"
              className={activeSection === "get-started" ? "active" : undefined}
            >
              快速开始
            </a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <div className="hero-kicker">增量 AST 语义分析 · CI 更快、误报更少</div>
          <h1>MR/PR 回归风险，秒级出结论</h1>
          <p>
            面向 CI 的 MR/PR 回归风险审计。只做增量 AST 语义分析，秒级给出风险反馈；对关键变更模式高度敏感、
            少漏报，同时不把 CI 拖成全仓长任务。
          </p>
          <div className="cta-buttons">
            <a href="#get-started" className="cta-button">
              立即开始
            </a>
            <a
              href="https://github.com/GoldenSupremeSaltedFish/DiffSense"
              target="_blank"
              rel="noreferrer"
              className="cta-button cta-secondary"
            >
              查看源码
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="section">
        <div className="container">
          <div className="section-title">
            <h2>核心能力</h2>
            <p>面向 CI 的 MR/PR 回归风险审计</p>
          </div>
          <div className="features-grid">
            {featureCards.map((card) => (
              <article key={card.title} className="feature-card">
                <div className="feature-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="architecture" className="section architecture">
        <div className="container">
          <div className="section-title">
            <h2>技术架构</h2>
            <p>Change → Signal → Rule → Report 的流水线</p>
          </div>
          <div className="architecture-diagram">
            <div className="pipeline-flowchart" aria-label="DiffSense 分析流程（按顺序执行）">
              <div className="pipeline-row">
                {pipelineSteps.slice(0, 3).map(([no, title, desc], index) => (
                  <Fragment key={no}>
                    <div className="pipeline-step">
                      <div className="step-number" aria-hidden="true">
                        {no}
                      </div>
                      <h4>{title}</h4>
                      <p>{desc}</p>
                    </div>
                    {index < 2 ? (
                      <div className="pipeline-join pipeline-join--h" aria-hidden="true">
                        <span className="pipeline-chevron pipeline-chevron--right" />
                      </div>
                    ) : null}
                  </Fragment>
                ))}
              </div>
              <div className="pipeline-row-bridge" aria-hidden="true">
                <span className="pipeline-chevron pipeline-chevron--down" />
              </div>
              <div className="pipeline-row pipeline-row--second">
                {pipelineSteps.slice(3).map(([no, title, desc], index) => (
                  <Fragment key={no}>
                    <div className="pipeline-step">
                      <div className="step-number" aria-hidden="true">
                        {no}
                      </div>
                      <h4>{title}</h4>
                      <p>{desc}</p>
                    </div>
                    {index < 1 ? (
                      <div className="pipeline-join pipeline-join--h" aria-hidden="true">
                        <span className="pipeline-chevron pipeline-chevron--right" />
                      </div>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="risks" className="section">
        <div className="container">
          <div className="section-title">
            <h2>风险检测能力</h2>
            <p>内置常见回归风险规则，命中即报告</p>
          </div>
          <div className="risk-categories">
            <article className="risk-card">
              <h4>并发风险</h4>
              <ul>
                <li>synchronized 关键字移除</li>
                <li>volatile 修饰符删除</li>
                <li>锁机制变更</li>
              </ul>
            </article>
            <article className="risk-card">
              <h4>性能风险</h4>
              <ul>
                <li>Thread.sleep() 添加</li>
                <li>循环内集合修改</li>
                <li>忙等待模式引入</li>
              </ul>
            </article>
            <article className="risk-card">
              <h4>资源风险</h4>
              <ul>
                <li>try-with-resources 移除</li>
                <li>缓存过期策略删除</li>
                <li>无界队列创建</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section id="get-started" className="section">
        <div className="container get-started-layout">
          <div className="get-started-copy">
            <h2>5 分钟接入 PR 审计</h2>
            <p>
              将下方 YAML 保存为仓库中的{" "}
              <code className="get-started-inline-code">.github/workflows/diffsense.yml</code>
              ，推送后即在 Pull Request 上自动运行（与官方快速开始文档一致）。
            </p>
            <div className="cta-buttons get-started-actions">
              <a href={QUICKSTART_DOC} target="_blank" rel="noreferrer" className="cta-button">
                文档与可选配置
              </a>
              <a
                href="https://github.com/GoldenSupremeSaltedFish/DiffSense"
                target="_blank"
                rel="noreferrer"
                className="cta-button cta-secondary get-started-secondary"
              >
                Star 仓库
              </a>
            </div>
          </div>
          <div className="get-started-code">
            <div className="code-window">
              <div className="code-window-header">
                <span className="code-window-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="code-window-title">.github/workflows/diffsense.yml</span>
                <button
                  type="button"
                  className="code-window-copy"
                  onClick={copyWorkflow}
                  aria-label={copied ? "已复制到剪贴板" : "复制 YAML 到剪贴板"}
                >
                  {copied ? "已复制" : "复制"}
                </button>
              </div>
              <pre className="code-window-body">
                <code>{WORKFLOW_SNIPPET}</code>
              </pre>
            </div>
            <p className="get-started-hint">
              本地离线示例：<code>git diff main {'>'} my.diff</code> 后执行{" "}
              <code>diffsense replay my.diff</code>。详见{" "}
              <a href={QUICKSTART_DOC} target="_blank" rel="noreferrer">
                快速开始
              </a>
              。
            </p>
          </div>
        </div>
      </section>

      <section className="footer-distortion" aria-label="DiffSense">
        <FooterDistortionBoundary>
          <Suspense fallback={<div className="distortion-fallback" />}>
            <FooterDistortion />
          </Suspense>
        </FooterDistortionBoundary>
        <div className="footer-distortion-meta">
          <span>GitHub 开源 · GoldenSupremeSaltedFish/DiffSense</span>
        </div>
      </section>
    </>
  );
};

export default App;