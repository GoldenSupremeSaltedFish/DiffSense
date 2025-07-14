@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo 🌳 DiffSense Plugin Subtree 管理工具
echo =======================================
echo.

REM 配置子仓库信息
set PLUGIN_REPO=https://github.com/GoldenSupremeSaltedFish/DiffSense-Plugin.git
set PLUGIN_PREFIX=plugin
set PLUGIN_BRANCH=main

:MENU
echo 请选择操作：
echo.
echo 1. 初始化 Plugin 子仓库 (首次设置)
echo 2. 更新本地 Plugin (从子仓库拉取)
echo 3. 推送 Plugin 更改 (推送到子仓库)
echo 4. 检查 Plugin 状态
echo 5. 强制重置 Plugin (危险操作)
echo 6. 退出
echo.
set /p CHOICE=请输入选项 (1-6): 

if "%CHOICE%"=="1" goto INIT_SUBTREE
if "%CHOICE%"=="2" goto PULL_SUBTREE
if "%CHOICE%"=="3" goto PUSH_SUBTREE
if "%CHOICE%"=="4" goto CHECK_STATUS
if "%CHOICE%"=="5" goto FORCE_RESET
if "%CHOICE%"=="6" goto EXIT
goto MENU

:INIT_SUBTREE
echo.
echo 🚀 初始化 Plugin 子仓库...
echo.
echo ⚠️  注意：这将替换现有的 plugin 目录！
set /p CONFIRM=确认继续? (y/N): 
if /i not "%CONFIRM%"=="y" goto MENU

echo 正在添加 subtree...
git subtree add --prefix=%PLUGIN_PREFIX% %PLUGIN_REPO% %PLUGIN_BRANCH% --squash
if errorlevel 1 (
    echo ❌ 初始化失败！
) else (
    echo ✅ 初始化完成！
    echo 📁 Plugin 目录已从子仓库同步
)
echo.
pause
goto MENU

:PULL_SUBTREE
echo.
echo 📥 更新本地 Plugin (从子仓库拉取)...
git subtree pull --prefix=%PLUGIN_PREFIX% %PLUGIN_REPO% %PLUGIN_BRANCH% --squash
if errorlevel 1 (
    echo ❌ 更新失败！
    echo 💡 可能的原因：
    echo    - 本地有未提交的更改
    echo    - 网络连接问题
    echo    - 合并冲突
    echo.
    echo 💡 建议：先提交本地更改，然后重试
) else (
    echo ✅ 更新完成！
    echo 📁 Plugin 目录已从子仓库更新
)
echo.
pause
goto MENU

:PUSH_SUBTREE
echo.
echo 📤 推送 Plugin 更改到子仓库...
echo.
echo 检查是否有更改...
git diff --quiet HEAD -- %PLUGIN_PREFIX%
if errorlevel 1 (
    echo 发现 Plugin 目录有更改，正在推送...
    git subtree push --prefix=%PLUGIN_PREFIX% %PLUGIN_REPO% %PLUGIN_BRANCH%
    if errorlevel 1 (
        echo ❌ 推送失败！
        echo 💡 可能的原因：
        echo    - 没有推送权限
        echo    - 子仓库有新的提交
        echo    - 网络连接问题
        echo.
        echo 💡 建议：先拉取子仓库更新，然后重试
    ) else (
        echo ✅ 推送完成！
        echo 🚀 更改已同步到子仓库，将触发 CI/CD
    )
) else (
    echo ℹ️  Plugin 目录没有更改，无需推送
)
echo.
pause
goto MENU

:CHECK_STATUS
echo.
echo 🔍 检查 Plugin 状态...
echo.
echo 📊 本地 Plugin 目录状态：
git status -- %PLUGIN_PREFIX%
echo.
echo 📈 最近的 Plugin 相关提交：
git log --oneline -5 -- %PLUGIN_PREFIX%
echo.
echo 🌐 子仓库信息：
echo    仓库地址: %PLUGIN_REPO%
echo    分支: %PLUGIN_BRANCH%
echo    本地前缀: %PLUGIN_PREFIX%
echo.
pause
goto MENU

:FORCE_RESET
echo.
echo ⚠️  危险操作：强制重置 Plugin
echo.
echo 这将：
echo 1. 删除当前的 plugin 目录
echo 2. 从子仓库重新获取最新版本
echo 3. 丢失所有本地未推送的更改
echo.
set /p CONFIRM=确认执行强制重置? (输入 YES 确认): 
if not "%CONFIRM%"=="YES" (
    echo 操作已取消
    pause
    goto MENU
)

echo 正在执行强制重置...
echo 1. 删除 plugin 目录...
git rm -r %PLUGIN_PREFIX%
git commit -m "Remove plugin directory for force reset"

echo 2. 重新添加子仓库...
git subtree add --prefix=%PLUGIN_PREFIX% %PLUGIN_REPO% %PLUGIN_BRANCH% --squash

if errorlevel 1 (
    echo ❌ 强制重置失败！
) else (
    echo ✅ 强制重置完成！
    echo 📁 Plugin 目录已完全同步
)
echo.
pause
goto MENU

:EXIT
echo.
echo 👋 感谢使用 DiffSense Subtree 管理工具！
echo.
echo 📚 快速参考：
echo    - 日常开发：使用选项 2 (更新) 和 3 (推送)
echo    - 首次设置：使用选项 1 (初始化)
echo    - 遇到问题：使用选项 4 (检查状态)
echo.
exit /b 0 