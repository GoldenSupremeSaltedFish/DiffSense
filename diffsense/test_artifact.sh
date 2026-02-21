#!/usr/bin/env sh
# 产物基础功能测试（Linux/macOS）
# 用法:
#   ./test_artifact.sh              # 默认用镜像 diffsense:test
#   ./test_artifact.sh diffsense     # 用本地命令（需 pip install -e .）
#   ./test_artifact.sh gitlab        # 模拟 GitLab Runner（--entrypoint= + sh -c），不依赖 GitLab
set -e
IMAGE="${1:-diffsense:test}"

run_diffsense() {
  case "$IMAGE" in
    *:*) docker run --rm "$IMAGE" "$@";;
    *)   "$IMAGE" "$@";;
  esac
}

if [ "$IMAGE" = "gitlab" ]; then
  IMAGE="diffsense:test"
  echo "=== 模拟 GitLab Runner（entrypoint 清空 + /bin/sh -c）==="
  docker run --rm --entrypoint= "$IMAGE" /bin/sh -c "diffsense audit --help && diffsense rules list"
  echo ""
  echo "=== 通过 ==="
  exit 0
fi

echo "=== 1. diffsense audit --help ==="
run_diffsense audit --help

echo ""
echo "=== 2. diffsense rules list ==="
run_diffsense rules list

echo ""
echo "=== 通过 ==="
