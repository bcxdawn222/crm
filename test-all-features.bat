@echo off
chcp 65001 >nul
echo ========================================
echo   CRM系统 - 完整功能测试
echo ========================================
echo.

REM Set environment variable
set DATABASE_URL=%CRM_TEST_DATABASE_URL%

echo [1/3] Checking MySQL connection...
node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.$connect().then(() => { console.log('✓ MySQL connected'); process.exit(0); }).catch(e => { console.error('✗ MySQL connection failed:', e.message); process.exit(1); });"
if errorlevel 1 (
    echo.
    echo ERROR: Cannot connect to MySQL!
    echo Please start MySQL97 service first.
    echo.
    echo To start MySQL:
    echo   1. Press Win+R, type: services.msc
    echo   2. Find MySQL97 and click Start
    echo   3. Then run this script again
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Generating test data...
node generate-all-test-data.js
if errorlevel 1 (
    echo.
    echo ERROR: Test data generation failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Test data generation completed!
echo.
echo ========================================
echo   Testing Summary
echo ========================================
echo.
echo ✓ Customers: ~19 records
echo ✓ Public Pool: 2 records
echo ✓ Follow-ups: ~20 records
echo ✓ Orders: 8 records
echo ✓ Payments: 5 records
echo ✓ Tasks: 10 records
echo ✓ Daily Reports: 5 records
echo.
echo ========================================
echo   Next Steps
echo ========================================
echo.
echo 1. Open browser: http://localhost:3008
echo 2. Login: admin / 123456
echo 3. Test all features:
echo    - Customer Management
echo    - Public Pool
echo    - Daily Leads
echo    - Orders & Payments
echo    - Tasks
echo    - Daily Reports
echo.
echo ========================================
echo.
pause
