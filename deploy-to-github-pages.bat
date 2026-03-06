@echo off
echo Deploying DiffSense website to GitHub Pages...

REM 创建gh-pages分支目录
if not exist gh-pages mkdir gh-pages

REM 复制所有文件到gh-pages目录
xcopy *.html gh-pages\ /Y
xcopy *.css gh-pages\ /Y
xcopy *.js gh-pages\ /Y
if exist *.png xcopy *.png gh-pages\ /Y
if exist *.jpg xcopy *.jpg gh-pages\ /Y
if exist *.svg xcopy *.svg gh-pages\ /Y

REM 进入gh-pages目录
cd gh-pages

REM 初始化git仓库（如果不存在）
if not exist .git (
    git init
    git checkout -b gh-pages
)

REM 配置git用户信息（使用全局配置）
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"

REM 添加所有文件
git add .

REM 提交更改
git commit -m "Update DiffSense website - %date% %time%"

REM 推送到GitHub Pages分支
REM 请替换 YOUR_GITHUB_USERNAME 和 YOUR_REPO_NAME
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git 2>nul
git push -f origin gh-pages

echo Deployment complete!
echo Your website will be available at: https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME/

pause