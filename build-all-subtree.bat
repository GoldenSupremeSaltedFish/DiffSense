@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo 🚀 开始 DiffSense 完整构建流程 (Subtree 版本)...
echo.

REM 记录开始时间
set START_TIME=%TIME%

REM 1. 更新 plugin subtree (可选)
echo 🔄 步骤 1/6: 检查 Plugin 子仓库更新...
set /p UPDATE_PLUGIN=是否更新 Plugin 子仓库? (y/N): 
if /i "%UPDATE_PLUGIN%"=="y" (
    echo 正在更新 Plugin 子仓库...
    git subtree pull --prefix=plugin https://github.com/GoldenSupremeSaltedFish/DiffSense-Plugin.git main --squash
    if errorlevel 1 (
        echo ⚠️  Plugin 更新失败，使用现有版本继续构建...
    ) else (
        echo ✅ Plugin 更新完成
    )
) else (
    echo ⏭️  跳过 Plugin 更新，使用本地版本
)

REM 2. 构建 Java 分析器
echo.
echo 📦 步骤 2/6: 构建 Java 分析器...
call mvn clean package -DskipTests
if errorlevel 1 (
    echo ❌ Java 构建失败！
    pause
    exit /b 1
)

REM 复制 JAR 到 plugin 目录
if not exist "plugin\analyzers" mkdir "plugin\analyzers"
for %%f in (target\*.jar) do (
    copy "%%f" "plugin\analyzers\" >nul
    echo   📁 复制: %%f → plugin\analyzers\
)
echo ✅ Java 分析器构建完成

REM 3. 构建前端应用
echo.
echo 🎨 步骤 3/6: 构建前端应用...
cd ui\diffsense-frontend
call npm install
if errorlevel 1 (
    echo ❌ 前端依赖安装失败！
    pause
    exit /b 1
)

call npm run build
if errorlevel 1 (
    echo ❌ 前端构建失败！
    pause
    exit /b 1
)
cd ..\..
echo ✅ 前端应用构建完成

REM 4. 准备 Node.js 分析器
echo.
echo 📋 步骤 4/6: 准备 Node.js 分析器...
cd ui\node-analyzer
call npm install
if errorlevel 1 (
    echo ❌ Node.js 分析器依赖安装失败！
    pause
    exit /b 1
)
cd ..\..
echo ✅ Node.js 分析器准备完成

REM 5. 准备 Golang 分析器
echo.
echo 🐹 步骤 5/6: 准备 Golang 分析器...
cd ui\golang-analyzer
call npm install
if errorlevel 1 (
    echo ❌ Golang 分析器依赖安装失败！
    pause
    exit /b 1
)
cd ..\..
echo ✅ Golang 分析器准备完成

REM 6. 同步产物到插件目录并编译
echo.
echo 🔄 步骤 6/6: 同步产物到插件目录并编译...
cd plugin
call npm run prepare-package
if errorlevel 1 (
    echo ❌ 产物同步失败！
    pause
    exit /b 1
)

call npm run compile
if errorlevel 1 (
    echo ❌ 插件编译失败！
    pause
    exit /b 1
)

REM 7. 打包 VSIX
echo.
echo 📦 正在打包 VSIX...
call npm run package
if errorlevel 1 (
    echo ❌ VSIX 打包失败！
    pause
    exit /b 1
)

REM 查找生成的 VSIX 文件
for %%f in (*.vsix) do (
    echo ✅ VSIX 打包完成: %%f
    set "VSIX_FILE=%%f"
)

REM 8. 推送 Plugin 更改到子仓库 (可选)
echo.
set /p PUSH_PLUGIN=是否推送 Plugin 更改到子仓库? (y/N): 
if /i "%PUSH_PLUGIN%"=="y" (
    echo 正在推送到 Plugin 子仓库...
    cd ..
    git subtree push --prefix=plugin https://github.com/GoldenSupremeSaltedFish/DiffSense-Plugin.git main
    if errorlevel 1 (
        echo ⚠️  推送失败，请手动检查
    ) else (
        echo ✅ 推送完成
    )
    cd plugin
)

REM 计算执行时间
set END_TIME=%TIME%

echo.
echo ================================================
echo 🎉 构建流程全部完成！
echo.
echo 📁 生成的文件：
if defined VSIX_FILE (
    echo    - VSIX 文件: plugin\!VSIX_FILE!
)
echo    - 插件代码: plugin\dist\extension.js
echo    - 前端资源: plugin\dist\ 和 plugin\diffsense-frontend\
echo    - Java 分析器: plugin\analyzers\*.jar
echo    - Node/Go 分析器: plugin\analyzers\*-analyzer\
echo.
echo 🚀 现在可以：
echo    1. 在 VS Code 中按 F5 调试插件
echo    2. 安装 VSIX 文件进行测试
echo    3. 发布到 VS Code 市场
echo    4. 推送更改到 GitHub 触发 CI/CD
echo.
echo 📋 子仓库管理：
echo    - 更新子仓库: git subtree pull --prefix=plugin [repo_url] main --squash
echo    - 推送到子仓库: git subtree push --prefix=plugin [repo_url] main
echo.
echo 开始时间: %START_TIME%
echo 结束时间: %END_TIME%
echo ================================================

pause 