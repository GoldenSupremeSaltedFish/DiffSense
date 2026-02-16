# 产物基础功能测试：镜像或本地 pip 安装后的 CLI
# 用法:
#   .\test_artifact.ps1              # 默认用镜像 diffsense:test
#   .\test_artifact.ps1 diffsense    # 用本地命令（需 pip install -e .）
#   .\test_artifact.ps1 gitlab       # 模拟 GitLab Runner（--entrypoint= + sh -c），不依赖 GitLab
$ErrorActionPreference = "Stop"
$image = $args[0]
if (-not $image) { $image = "diffsense:test" }

if ($image -eq "gitlab") {
  $image = "diffsense:test"
  Write-Host "=== 模拟 GitLab Runner（entrypoint 清空 + /bin/sh -c）==="
  docker run --rm --entrypoint= $image /bin/sh -c "diffsense audit --help && diffsense rules list"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "`n=== 通过 ==="
  exit 0
}

function Run-Diffsense {
  param([string[]]$Cmd)
  if ($image -match ":") {
    docker run --rm $image @Cmd
  } else {
    & $image @Cmd
  }
  if ($LASTEXITCODE -ne 0) { throw "Exit $LASTEXITCODE" }
}

Write-Host "=== 1. diffsense audit --help ==="
Run-Diffsense @("audit","--help")

Write-Host "`n=== 2. diffsense rules list ==="
Run-Diffsense @("rules","list")

Write-Host "`n=== 通过 ==="
