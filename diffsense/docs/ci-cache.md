# CI 缓存（Cache）

为缩短冷启动时间，建议在 CI 中缓存 DiffSense 的 diff/AST 缓存目录。

## 缓存目录

- **默认**：`~/.diffsense/cache`（用户目录下）
- **自定义**：设置环境变量 `DIFFSENSE_CACHE_DIR` 指向希望缓存的目录（例如项目内的 `.diffsense-cache`，便于 GitLab 等按 job 路径缓存）

## TTL 与容量（可选）

- **TTL**：设置环境变量 **`DIFFSENSE_CACHE_MAX_AGE_DAYS`**（整数，如 `7`），超过天数的缓存条目在读取时视为失效并删除，可避免磁盘长期增长。
- **主动清理**：在 CI 或 cron 中可定期执行 **`diffsense cache prune --max-age-days 7`**，删除超过指定天数的缓存文件；加 `--dry-run` 可仅打印将删除的条目。

## GitHub Actions

在 Run DiffSense 之前增加一步；**key 中建议包含 `core/__init__.py`**，以便 `CACHE_VERSION` 变更时自动失效旧缓存、减少无用占用：

```yaml
- name: Cache DiffSense (diff + AST)
  uses: actions/cache@v4
  with:
    path: ~/.diffsense
    key: diffsense-${{ runner.os }}-${{ hashFiles('**/requirements.txt') || 'default' }}-${{ hashFiles('**/core/__init__.py') || 'none' }}
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
