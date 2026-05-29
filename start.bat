@echo off
echo 正在启动 DevHub - 个人 AI 编码中枢桌面应用
echo.

cd /d "%~dp0"

echo 检查依赖...
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo 依赖安装失败！
        pause
        exit /b 1
    )
)

echo 启动应用...
call npm start

if errorlevel 1 (
    echo 应用启动失败！
    pause
    exit /b 1
)

echo 应用已启动
pause