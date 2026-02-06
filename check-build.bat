@echo off
chcp 65001 >nul
echo ======================================
echo DiffSense 构建产物检查
echo ======================================

set MISSING=0

echo.
echo 检查 Java 分析器...
if exist "vscode-extension\target\gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar" (
    echo   ✅ Java JAR 源文件存在
) else (
    echo   ❌ Java JAR 源文件缺失
    set MISSING=1
)

if exist "vscode-extension\plugin\analyzers\gitimpact-1.0-SNAPSHOT-jar-with-dependencies.jar" (
    echo   ✅ Java JAR 插件文件存在
) else (
    echo   ❌ Java JAR 插件文件缺失
    set MISSING=1
)

echo.
echo 检查前端构建产物...
if exist "vscode-extension\ui\diffsense-frontend\dist\index.html" (
    echo   ✅ 前端源文件存在
) else (
    echo   ❌ 前端源文件缺失
    set MISSING=1
)

if exist "vscode-extension\plugin\dist\index.html" (
    echo   ✅ 前端插件文件存在
) else (
    echo   ❌ 前端插件文件缺失
    set MISSING=1
)

echo.
echo 检查分析器...
if exist "vscode-extension\ui\node-analyzer\analyze.js" (
    echo   ✅ Node.js 源分析器存在
) else (
    echo   ❌ Node.js 源分析器缺失
    set MISSING=1
)

if exist "vscode-extension\plugin\analyzers\node-analyzer\analyze.js" (
    echo   ✅ Node.js 插件分析器存在
) else (
    echo   ❌ Node.js 插件分析器缺失
    set MISSING=1
)

if exist "vscode-extension\ui\golang-analyzer\analyze.js" (
    echo   ✅ Golang 源分析器存在
) else (
    echo   ❌ Golang 源分析器缺失
    set MISSING=1
)

if exist "vscode-extension\plugin\analyzers\golang-analyzer\analyze.js" (
    echo   ✅ Golang 插件分析器存在
) else (
    echo   ❌ Golang 插件分析器缺失
    set MISSING=1
)

echo.
echo 检查插件编译产物...
if exist "vscode-extension\plugin\dist\extension.js" (
    echo   ✅ 插件编译产物存在
) else (
    echo   ❌ 插件编译产物缺失
    set MISSING=1
)

echo.
echo ======================================
if %MISSING%==0 (
    echo 🎉 所有必要文件验证通过！
    echo ✅ 项目已准备好进行调试或发布
) else (
    echo ❌ 发现缺失文件，需要重新构建
    echo 💡 请参考 technical_documentation\build-tools\VERIFICATION_CHECKLIST_CN.md 进行完整构建
)

echo.
echo 📋 快速修复命令：
echo   Java 构建: mvn clean package -DskipTests
echo   前端构建: cd ui\diffsense-frontend ^&^& npm run build
echo   同步产物: cd plugin ^&^& npm run prepare-package
echo   编译插件: cd plugin ^&^& npm run compile
echo   完整构建: build-all.bat
echo ====================================== 