"""
DiffSense 启动 Banner（类似 Spring Boot 的 banner.txt）
在 CI 运行 audit 时在日志开头打印 Logo，便于识别流水线。
"""


def _get_version() -> str:
    try:
        from importlib.metadata import version
        return version("diffsense")
    except Exception:
        return "2.2.5"


def _get_build_info() -> dict:
    """获取构建信息，用于详细的版本输出。"""
    import os
    import subprocess
    
    build_info = {
        "version": _get_version(),
        "commit": "unknown",
        "build_date": "unknown"
    }
    
    # Try to get git commit hash
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            build_info["commit"] = result.stdout.strip()
    except Exception:
        pass
    
    # Try to get build date
    try:
        from datetime import datetime
        build_info["build_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        pass
    
    return build_info


# ASCII Art: DiffSense（等宽字体，适配 CI 日志）
BANNER = r"""
  ____  _     _ _____ _____ ____ _____
 |  _ \(_) __| |  ___|  ___/ ___| ____|
 | | | | |/ _` | |_  | |_  \___ \  _|
 | |_| | | (_| |  _| |  _|  ___) | |___
 |____/|_|\__,_|_|   |_|   |____/|_____|

 :: DiffSense - MR/PR Risk Audit for CI/CD ::
"""


def print_banner() -> None:
    """在 stdout 打印 DiffSense Logo 与版本，供 CI 流水线识别。"""
    version = _get_version()
    build_info = _get_build_info()
    
    # 只去掉首尾换行，保留每行前导空格以保持 ASCII 对齐
    print(BANNER.strip("\n"))
    print(f" :: Version: v{version}")
    print(f" :: Commit:  {build_info['commit']}")
    print(f" :: Built:   {build_info['build_date']}")
    print()
