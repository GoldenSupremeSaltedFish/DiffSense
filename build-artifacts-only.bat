@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

cd vscode-extension

echo 🚀 构建 DiffSense Plugin 独立调试产物...
echo ================================================
echo.

REM 记录开始时间
set START_TIME=%TIME%

REM 1. 构建 Java 分析器
echo 📦 步骤 1/6: 构建 Java 分析器...
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

REM 2. 构建前端应用
echo.
echo 🎨 步骤 2/6: 构建前端应用...
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

REM 3. 准备 Node.js 分析器
echo.
echo 📋 步骤 3/6: 准备 Node.js 分析器...
cd ui\node-analyzer
call npm install
if errorlevel 1 (
    echo ❌ Node.js 分析器依赖安装失败！
    pause
    exit /b 1
)
cd ..\..
echo ✅ Node.js 分析器准备完成

REM 4. 准备 Golang 分析器
echo.
echo 🐹 步骤 4/6: 准备 Golang 分析器...
cd ui\golang-analyzer
call npm install
if errorlevel 1 (
    echo ❌ Golang 分析器依赖安装失败！
    pause
    exit /b 1
)
cd ..\..
echo ✅ Golang 分析器准备完成

REM 5. 构建插件
echo.
echo 🔨 步骤 5/6: 构建插件...
cd plugin
call npm install
if errorlevel 1 (
    echo ❌ 插件依赖安装失败！
    pause
    exit /b 1
)

call npm run prepare-package
if errorlevel 1 (
    echo ❌ 产物准备失败！
    pause
    exit /b 1
)

call npm run compile
if errorlevel 1 (
    echo ❌ 插件编译失败！
    pause
    exit /b 1
)

call npm run package
if errorlevel 1 (
    echo ❌ VSIX 打包失败！
    pause
    exit /b 1
)

REM 6. 生成独立调试产物
echo.
echo 📦 步骤 6/6: 生成独立调试产物...

REM 创建产物目录
if exist "artifacts-output" (
    rmdir /s /q "artifacts-output"
)
mkdir "artifacts-output"

echo   🔄 复制基本配置文件...
copy "package.json" "artifacts-output\"
copy "tsconfig.json" "artifacts-output\"
copy "icon.png" "artifacts-output\"
copy "LICENSE.txt" "artifacts-output\"
copy "README.md" "artifacts-output\"
copy ".vscodeignore" "artifacts-output\"

echo   🔄 复制编译产物...
xcopy "dist" "artifacts-output\dist\" /e /i /y

echo   🔄 复制前端构建产物...
if exist "ui\diffsense-frontend\dist" (
    mkdir "artifacts-output\ui\diffsense-frontend"
    xcopy "ui\diffsense-frontend\dist" "artifacts-output\ui\diffsense-frontend\dist\" /e /i /y
    copy "ui\diffsense-frontend\package.json" "artifacts-output\ui\diffsense-frontend\"
)

echo   🔄 复制分析器产物...
if exist "analyzers" (
    xcopy "analyzers" "artifacts-output\analyzers\" /e /i /y
)

echo   🔄 复制 UI 适配层编译产物...
if exist "ui" (
    mkdir "artifacts-output\ui"
    for /r "ui" %%f in (*.js) do (
        set "relpath=%%f"
        set "relpath=!relpath:%CD%\ui\=!"
        set "destdir=artifacts-output\ui\!relpath!"
        for %%d in ("!destdir!") do set "destdir=%%~dpd"
        if not exist "!destdir!" mkdir "!destdir!"
        copy "%%f" "!destdir!" >nul
    )
)

echo   🔄 复制 VSIX 文件...
for %%f in (*.vsix) do (
    copy "%%f" "artifacts-output\"
    echo   📦 VSIX: %%f
)

echo   🔄 生成运行时配置...
echo { > "artifacts-output\runtime-config.json"
echo   "version": "%version%", >> "artifacts-output\runtime-config.json"
echo   "buildTime": "%date% %time%", >> "artifacts-output\runtime-config.json"
echo   "isProduction": true, >> "artifacts-output\runtime-config.json"
echo   "debugMode": true, >> "artifacts-output\runtime-config.json"
echo   "artifactsOnly": true >> "artifacts-output\runtime-config.json"
echo } >> "artifacts-output\runtime-config.json"

echo   🔄 生成产物 README...
echo # DiffSense Plugin Artifacts > "artifacts-output\ARTIFACTS_README.md"
echo. >> "artifacts-output\ARTIFACTS_README.md"
echo This directory contains production-ready artifacts that maintain >> "artifacts-output\ARTIFACTS_README.md"
echo the same structure as the plugin source and can be used for >> "artifacts-output\ARTIFACTS_README.md"
echo independent debugging and testing. >> "artifacts-output\ARTIFACTS_README.md"
echo. >> "artifacts-output\ARTIFACTS_README.md"
echo ## Quick Debug >> "artifacts-output\ARTIFACTS_README.md"
echo 1. Open this directory in VS Code >> "artifacts-output\ARTIFACTS_README.md"
echo 2. Press F5 to start debugging >> "artifacts-output\ARTIFACTS_README.md"
echo 3. Install VSIX: `code --install-extension diffsense-*.vsix` >> "artifacts-output\ARTIFACTS_README.md"

cd ..

REM 计算执行时间
set END_TIME=%TIME%

echo.
echo ================================================
echo 🎉 独立调试产物构建完成！
echo.
echo 📁 产物位置: plugin\artifacts-output\
echo.
echo 📦 包含内容：
echo    ✅ 编译后的 TypeScript 代码 (dist/)
echo    ✅ 前端构建产物 (ui/diffsense-frontend/dist/)
echo    ✅ 分析器运行时文件 (analyzers/)
echo    ✅ UI 适配层编译产物 (ui/)
echo    ✅ VSIX 安装包
echo    ✅ 完整的插件配置文件
echo    ✅ 运行时配置和说明文档
echo.
echo 🔧 使用方式：
echo    1. 📂 直接调试: 在 VS Code 中打开 artifacts-output 目录，按 F5
echo    2. 📦 安装测试: code --install-extension artifacts-output\*.vsix
echo    3. 🚀 推送到子仓库: 将 artifacts-output 内容推送到 Diffsense-artifacts
echo.
echo 💡 这个产物目录：
echo    - 保持与插件源码相同的目录结构
echo    - 包含所有运行时依赖
echo    - 支持独立调试和测试
echo    - 不包含源码，只有编译产物
echo.
echo 开始时间: %START_TIME%
echo 结束时间: %END_TIME%
echo ================================================

pause 