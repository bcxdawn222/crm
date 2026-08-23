@echo off
chcp 65001 >nul
echo ========================================
echo   CRM系统测试数据管理工具
echo ========================================
echo.

:menu
echo 请选择操作:
echo 1. 清空数据库
echo 2. 生成测试数据
echo 3. 清空并重新生成
echo 4. 查看数据统计
echo 5. 退出
echo.
set /p choice=请输入选项 (1-5): 

if "%choice%"=="1" goto clear
if "%choice%"=="2" goto generate
if "%choice%"=="3" goto regenerate
if "%choice%"=="4" goto stats
if "%choice%"=="5" goto end
goto menu

:clear
echo.
echo [正在清空数据库...]
set DATABASE_URL=mysql://root:REDACTED_c68d10500c05@localhost:3306/crm_system
npx ts-node clear-database.ts
echo.
echo 按任意键返回主菜单...
pause >nul
cls
goto menu

:generate
echo.
echo [正在生成测试数据...]
set DATABASE_URL=mysql://root:REDACTED_c68d10500c05@localhost:3306/crm_system
npx ts-node generate-test-data.ts
echo.
echo 按任意键返回主菜单...
pause >nul
cls
goto menu

:regenerate
echo.
echo [正在清空数据库...]
set DATABASE_URL=mysql://root:REDACTED_c68d10500c05@localhost:3306/crm_system
npx ts-node clear-database.ts
echo.
echo [正在生成测试数据...]
npx ts-node generate-test-data.ts
echo.
echo 按任意键返回主菜单...
pause >nul
cls
goto menu

:stats
echo.
echo [正在查询数据统计...]
set DATABASE_URL=mysql://root:REDACTED_c68d10500c05@localhost:3306/crm_system
npx ts-node check-users.ts
echo.
echo 按任意键返回主菜单...
pause >nul
cls
goto menu

:end
echo.
echo 感谢使用!再见!
exit /b 0
