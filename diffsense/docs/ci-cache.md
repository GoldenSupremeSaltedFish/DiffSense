# CI 缓存（Cache）

为缩短冷启动时间，建议在 CI 中缓存 DiffSense 的 diff/AST 缓存目录。

## 缓存目录

- **默认**：`~/.diffsense/cache`（用户目录下）
- **自定义**：设置环境变量 `DIFFSENSE_CACHE_DIR` 指向希望缓存的目录（例如项目内的 `.diffsense-cache`，便于 GitLab 等按 job 路径缓存）

## GitHub Actions

在 Run DiffSense 之前增加一步：

```yaml
- name: Cache DiffSense (diff + AST)
  uses: actions/cache@v4
  with:
    path: ~/.diffsense
    key: diffsense-${{ runner.os }}-${{ hashFiles('**/requirements.txt') || 'default' }}
```

第二次及后续 PR 运行时会恢复缓存，Performance Report 中的「Diff Cache Hit / AST Cache Hit」会体现命中率。

## GitLab CI

使用 Docker 镜像时，建议把缓存目录设到项目目录下并用 GitLab `cache`：

```yaml
diffsense_check:
  cache:
    key: diffsense-cache
    paths:
      - .diffsense-cache
  variables:
    DIFFSENSE_CACHE_DIR: "${CI_PROJECT_DIR}/.diffsense-cache"
  script:
    - diffsense audit ...
```

这样缓存键与项目绑定，同一项目的后续 MR 会复用缓存。
