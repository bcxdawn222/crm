@echo off
chcp 65001 >nul
echo ========================================
echo   CRM系统 - 日报权限修复验证
echo ========================================
echo.

echo [1/2] 检查MySQL连接...
node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.$connect().then(() => { console.log('✓ MySQL connected'); process.exit(0); }).catch(e => { console.error('✗ MySQL connection failed'); process.exit(1); });"

if errorlevel 1 (
    echo.
    echo ❌ MySQL未启动!请先启动MySQL97服务
    echo.
    echo 启动方法:
    echo 1. Win+R → services.msc → 找到MySQL97 → 右键启动
    echo 2. 或管理员PowerShell: Start-Service -Name "MySQL97"
    exit /b 1
)

echo.
echo [2/2] 生成测试数据...
node generate-all-test-data.js

if errorlevel 1 (
    echo.
    echo ❌ 测试数据生成失败
    exit /b 1
)

echo.
echo ========================================
echo ✅ 所有准备完成!
echo ========================================
echo.
echo  下一步操作:
echo 1. 打开浏览器: http://localhost:3008
echo 2. 登录账号: admin / 123456
echo 3. 进入"日报管理"页面
echo 4. 点击"新建日报"按钮
echo 5. 填写内容并提交
echo.
echo 🎯 预期结果:
echo - 应该能够成功创建日报
echo - 不再显示"No permission to create daily report"错误
echo.
pause
