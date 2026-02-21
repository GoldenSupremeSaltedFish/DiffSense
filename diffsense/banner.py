"""
DiffSense 启动 Banner（类似 Spring Boot 的 banner.txt）
在 CI 运行 audit 时在日志开头打印 Logo，便于识别流水线。
"""


def _get_version() -> str:
    try:
        from importlib.metadata import version
        return version("diffsense")
    except Exception:
        return "1.0.0"


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
    # 只去掉首尾换行，保留每行前导空格以保持 ASCII 对齐
    print(BANNER.strip("\n"))
    print(f" (v{version})")
    print()
