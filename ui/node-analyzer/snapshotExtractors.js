const path = require('path');
const fs = require('fs');
const { Project, SyntaxKind } = require('ts-morph');
const { parse } = require('@vue/compiler-sfc');

/**
 * 通用组件快照结构
 */
function createSnapshot(base) {
  return {
    componentName: '',
    framework: '',
    filePath: '',
    props: [],
    hooksOrLifecycle: [],
    eventBindings: [],
    renderElements: [],
    ...base
  };
}

/**
 * SnapshotExtractor 接口
 */
class SnapshotExtractor {
  support(ext) {
    return false;
  }

  extract(filePath, code) {
    return [];
  }
}

/**
 * React 组件快照提取器
 */
class ReactSnapshotExtractor extends SnapshotExtractor {
  constructor() {
    super();
    this.project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 1 } });
  }

  support(ext) {
    return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
  }

  extract(filePath, code) {
    const relativeName = path.basename(filePath);
    const sourceFile = this.project.createSourceFile(relativeName, code, { overwrite: true });

    const snapshots = [];

    // 检测顶级函数声明或箭头函数赋值
    sourceFile.forEachChild(node => {
      if (node.getKind() === SyntaxKind.FunctionDeclaration || node.getKind() === SyntaxKind.VariableStatement || node.getKind() === SyntaxKind.ClassDeclaration) {
        let componentName = '';
        let parameters = [];
        let bodyText = '';

        if (node.getKind() === SyntaxKind.FunctionDeclaration) {
          componentName = node.getName() || 'Anonymous';
          parameters = node.getParameters().map(p => p.getName());
          bodyText = node.getBody()?.getText() || '';
        } else if (node.getKind() === SyntaxKind.VariableStatement) {
          // arrow function const Foo = (props) => { ... }
          const declarations = node.getDeclarations();
          if (declarations.length > 0) {
            componentName = declarations[0].getName();
            const initializer = declarations[0].getInitializer();
            if (initializer) {
              if (initializer.getKind() === SyntaxKind.ArrowFunction) {
                parameters = initializer.getParameters().map(p => p.getName());
                bodyText = initializer.getBody().getText();
              }
            }
          }
        } else if (node.getKind() === SyntaxKind.ClassDeclaration) {
          componentName = node.getName() || 'AnonymousClass';
          // React class component uses this.props
          parameters = ['props'];
          bodyText = node.getText();
        }

        if (!componentName) return;

        // 判断是否包含 JSX => 大致判断是否是 React 组件
        if (!bodyText.includes('<')) return;

        const snapshot = createSnapshot({
          componentName,
          framework: 'react',
          filePath,
          props: [...new Set(parameters)],
          hooksOrLifecycle: this._extractHooks(bodyText),
          eventBindings: this._extractJSXEvents(bodyText),
          renderElements: this._extractJSXTags(bodyText)
        });
        snapshots.push(snapshot);
      }
    });

    return snapshots;
  }

  _extractHooks(text) {
    const hooks = [];
    const hookRegex = /use[A-Z]\w*\s*\(/g;
    let m;
    while ((m = hookRegex.exec(text))) {
      hooks.push(m[0].replace('(', '').trim());
    }
    return [...new Set(hooks)];
  }

  _extractJSXTags(text) {
    const tagRegex = /<([A-Za-z][A-Za-z0-9]*)[^>]*?>/g;
    const tags = [];
    let m;
    while ((m = tagRegex.exec(text))) {
      tags.push(m[1]);
    }
    return [...new Set(tags)];
  }

  _extractJSXEvents(text) {
    const evtRegex = /on[A-Z][A-Za-z]+\s*=|\.addEventListener\(/g;
    const evts = [];
    let m;
    while ((m = evtRegex.exec(text))) {
      const raw = m[0];
      if (raw.startsWith('on')) {
        evts.push(raw.replace('=', '').trim());
      } else {
        evts.push('addEventListener');
      }
    }
    return [...new Set(evts)];
  }
}

/**
 * Vue 组件快照提取器
 */
class VueSnapshotExtractor extends SnapshotExtractor {
  support(ext) {
    return ext === '.vue';
  }

  extract(filePath, code) {
    const descriptor = parse(code, { pad: 'space' }).descriptor;

    const scriptContent = descriptor.script?.content || descriptor.scriptSetup?.content || '';
    const templateContent = descriptor.template?.content || '';

    const props = this._extractVueProps(scriptContent);
    const lifeCycles = this._extractVueLifeCycles(scriptContent);
    const eventBindings = this._extractVueEvents(templateContent);
    const renderTags = this._extractVueTags(templateContent);

    const snapshot = createSnapshot({
      componentName: path.basename(filePath, '.vue'),
      framework: 'vue',
      filePath,
      props,
      hooksOrLifecycle: lifeCycles,
      eventBindings,
      renderElements: renderTags
    });

    return [snapshot];
  }

  _extractVueProps(script) {
    const props = [];
    // match props: { foo: ..., bar: ... } OR defineProps<{...}>()
    const propRegex = /props\s*:\s*{([^}]*)}/g;
    const match = propRegex.exec(script);
    if (match) {
      const inner = match[1];
      const nameRegex = /(\w+)\s*:/g;
      let n;
      while ((n = nameRegex.exec(inner))) {
        props.push(n[1]);
      }
    }
    // defineProps syntax
    const definePropsRegex = /defineProps\s*<[^>]*>\s*\(([^)]*)\)/g;
    const match2 = definePropsRegex.exec(script);
    if (match2) {
      const inner = match2[1];
      const nameRegex = /['\"](\w+)['\"]/g;
      let n;
      while ((n = nameRegex.exec(inner))) {
        props.push(n[1]);
      }
    }
    return [...new Set(props)];
  }

  _extractVueLifeCycles(script) {
    const lifeCycles = [];
    const lifeCycleNames = ['created', 'mounted', 'updated', 'unmounted', 'setup', 'beforeMount'];
    lifeCycleNames.forEach(lc => {
      if (new RegExp(`\\b${lc}\\s*\\(`).test(script)) {
        lifeCycles.push(lc);
      }
    });
    return lifeCycles;
  }

  _extractVueEvents(template) {
    const evtRegex = /@([a-zA-Z0-9_-]+)=|v-on:([a-zA-Z0-9_-]+)=/g;
    const evts = [];
    let m;
    while ((m = evtRegex.exec(template))) {
      evts.push(m[1] || m[2]);
    }
    return [...new Set(evts)];
  }

  _extractVueTags(template) {
    const tagRegex = /<([A-Za-z][A-Za-z0-9-]*)\b/g;
    const tags = [];
    let m;
    while ((m = tagRegex.exec(template))) {
      tags.push(m[1]);
    }
    return [...new Set(tags)];
  }
}

// 注册提取器
const extractors = [new ReactSnapshotExtractor(), new VueSnapshotExtractor()];

function extractSnapshotsForFile(filePath, code) {
  const ext = path.extname(filePath);
  const extractor = extractors.find(ex => ex.support(ext));
  if (!extractor) return [];
  try {
    return extractor.extract(filePath, code);
  } catch (err) {
    console.error('快照提取失败', filePath, err.message);
    return [];
  }
}

module.exports = {
  extractSnapshotsForFile,
}; 