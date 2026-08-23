@echo off
chcp 65001 >nul
echo ========================================
echo MySQL自动启动配置工具
echo ========================================
echo.
echo 此工具将设置MySQL服务为开机自动启动
echo 这样每次重启电脑后，MySQL会自动运行
echo.
echo 注意：需要管理员权限才能修改服务设置
echo.
pause

set "CRM_MYSQL_SERVICE=%CRM_MYSQL_SERVICE%"
if "%CRM_MYSQL_SERVICE%"=="" set "CRM_MYSQL_SERVICE=MySQL"

REM 以管理员身份运行sc命令
echo 正在设置MySQL服务为自动启动...
sc config "%CRM_MYSQL_SERVICE%" start= auto
if %errorlevel% equ 0 (
    echo ✓ MySQL服务已设置为自动启动
) else (
    echo ✗ 设置失败，请以管理员身份运行此脚本
    echo.
    echo 手动设置方法：
    echo 1. 按 Win+R，输入 services.msc，回车
    echo 2. 找到 %CRM_MYSQL_SERVICE% 服务
    echo 3. 右键 → 属性 → 启动类型改为"自动"
    echo 4. 点击"应用" → "确定"
    pause
    exit /b 1
)

echo.
echo 是否立即启动MySQL服务？(Y/N)
set /p choice=
if /i "%choice%"=="Y" (
    net start "%CRM_MYSQL_SERVICE%"
    if %errorlevel% equ 0 (
        echo ✓ MySQL服务已启动
    ) else (
        echo ✗ MySQL服务启动失败
    )
)

echo.
echo ========================================
echo 配置完成！
echo ========================================
echo.
echo 以后每次重启电脑，MySQL都会自动启动了
echo 您只需双击 start.bat 即可快速启动整个系统
echo.
pause
