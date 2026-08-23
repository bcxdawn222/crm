@echo off
chcp 65001 >nul
echo ========================================
echo CRM系统启动脚本
echo ========================================
echo.

set "CRM_MYSQL_SERVICE=%CRM_MYSQL_SERVICE%"
if "%CRM_MYSQL_SERVICE%"=="" set "CRM_MYSQL_SERVICE=MySQL"

REM 检查MySQL服务状态
echo [1/3] 检查MySQL数据库服务...
sc query "%CRM_MYSQL_SERVICE%" | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo ✓ MySQL服务已运行
) else (
    echo ✗ MySQL服务未运行，正在启动...
    net start "%CRM_MYSQL_SERVICE%"
    if %errorlevel% equ 0 (
        echo ✓ MySQL服务启动成功
    ) else (
        echo ✗ MySQL服务启动失败，请以管理员身份运行此脚本
        pause
        exit /b 1
    )
)
echo.

REM 检查Node.js开发服务器
echo [2/3] 检查Next.js开发服务器...
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo ✓ Next.js服务器已在端口3000运行
) else (
    echo ✗ Next.js服务器未运行，正在启动...
    cd /d "%~dp0"
    python scripts\manage.py start
    if %errorlevel% neq 0 (
        echo ✗ Next.js服务器启动失败，请查看 logs 目录中的最新日志
        pause
        exit /b 1
    )
    echo ✓ Next.js服务器已通过健康检查
)
echo.

REM 打开浏览器
echo [3/3] 打开浏览器...
timeout /t 5 /nobreak >nul
start http://localhost:3000
echo ✓ 浏览器已打开
echo.

echo ========================================
echo CRM系统启动完成！
echo ========================================
echo.
echo 提示：
echo 1. 如果看到"拒绝访问"错误，请右键此脚本选择"以管理员身份运行"
echo 2. 首次启动需要等待Next.js编译完成（约30-60秒）
echo 3. 建议将MySQL服务设置为自动启动（见下方说明）
echo.
pause
