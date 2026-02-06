/*
 * Component Snapshot Diff Utility
 * 输入 base 与 head 两个 ComponentSnapshot 数组，输出变动列表
 */

/**
 * 生成组件在 Map 中的唯一键
 */
function _key(snapshot) {
  // 考虑同一文件下可能多个组件，加入 componentName
  return `${snapshot.framework}::${snapshot.filePath}::${snapshot.componentName}`;
}

/**
 * 计算两个数组的差异
 * 返回 [removedItems, addedItems]
 */
function _diffArray(beforeArr = [], afterArr = []) {
  const beforeSet = new Set(beforeArr);
  const afterSet = new Set(afterArr);

  const removed = [...beforeSet].filter(x => !afterSet.has(x));
  const added = [...afterSet].filter(x => !beforeSet.has(x));

  return { removed, added };
}

/**
 * 对比两个版本的组件快照列表
 * @param {Array} baseSnapshots 旧版本快照列表
 * @param {Array} headSnapshots 新版本快照列表
 * @returns {Array} changeList 组件变更列表
 */
function diffSnapshots(baseSnapshots = [], headSnapshots = []) {
  const changes = [];

  const baseMap = new Map(baseSnapshots.map(s => [_key(s), s]));
  const headMap = new Map(headSnapshots.map(s => [_key(s), s]));

  // 1. 处理删除 & 修改
  for (const [k, baseSnap] of baseMap.entries()) {
    if (!headMap.has(k)) {
      // 组件被删除
      changes.push({
        component: baseSnap.componentName,
        filePath: baseSnap.filePath,
        changeType: 'componentDeleted',
        before: null,
        after: null
      });
      continue;
    }

    // 组件仍存在，比较字段差异
    const headSnap = headMap.get(k);

    // props
    const { removed: removedProps, added: addedProps } = _diffArray(baseSnap.props, headSnap.props);
    if (removedProps.length) {
      changes.push({
        component: baseSnap.componentName,
        filePath: baseSnap.filePath,
        changeType: 'removedProp',
        before: removedProps,
        after: null
      });
    }
    if (addedProps.length) {
      changes.push({
        component: baseSnap.componentName,
        filePath: baseSnap.filePath,
        changeType: 'addedProp',
        before: null,
        after: addedProps
      });
    }

    // hooks / lifecycle
    const { removed: removedHooks, added: addedHooks } = _diffArray(baseSnap.hooksOrLifecycle, headSnap.hooksOrLifecycle);
    if (removedHooks.length) {
      changes.push({
        component: baseSnap.componentName,
        filePath: baseSnap.filePath,
        changeType: 'removedHook',
        before: removedHooks,
        after: null
      });
    }
    if (addedHooks.length) {
      changes.push({
        component: baseSnap.componentName,
        filePath: baseSnap.filePath,
        changeType: 'addedHook',
        before: null,
        after: addedHooks
      });
    }

    // render elements
    const { removed: removedTags, added: addedTags } = _diffArray(baseSnap.renderElements, headSnap.renderElements);
    if (removedTags.length) {
      changes.push({
        component: baseSnap.componentName,
        filePath: baseSnap.filePath,
        changeType: 'removedRenderElement',
        before: removedTags,
        after: null
      });
    }
    if (addedTags.length) {
      changes.push({
        component: baseSnap.componentName,
        filePath: baseSnap.filePath,
        changeType: 'addedRenderElement',
        before: null,
        after: addedTags
      });
    }

    // event bindings
    const { removed: removedEvents, added: addedEvents } = _diffArray(baseSnap.eventBindings, headSnap.eventBindings);
    if (removedEvents.length) {
      changes.push({
        component: baseSnap.componentName,
        filePath: baseSnap.filePath,
        changeType: 'removedEventBinding',
        before: removedEvents,
        after: null
      });
    }
    if (addedEvents.length) {
      changes.push({
        component: baseSnap.componentName,
        filePath: baseSnap.filePath,
        changeType: 'addedEventBinding',
        before: null,
        after: addedEvents
      });
    }
  }

  // 2. 处理新增
  for (const [k, headSnap] of headMap.entries()) {
    if (!baseMap.has(k)) {
      changes.push({
        component: headSnap.componentName,
        filePath: headSnap.filePath,
        changeType: 'componentAdded',
        before: null,
        after: null
      });
    }
  }

  return changes;
}

module.exports = {
  diffSnapshots,
}; 