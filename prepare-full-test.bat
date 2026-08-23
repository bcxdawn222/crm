@echo off
chcp 65001 >nul
cls
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║         CRM系统 - 全面功能测试准备工具                    ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

echo [步骤1/4] 检查MySQL服务状态...
sc query MySQL97 | findstr "STATE" | findstr "RUNNING" >nul
if %errorlevel%==0 (
    echo ✅ MySQL97服务正在运行
) else (
    echo ❌ MySQL97服务未启动!
    echo.
    echo ⚠️  需要管理员权限启动MySQL服务
    echo.
    echo 请按以下步骤操作:
    echo ────────────────────────────────
    echo 方法1 ^(推荐^): Windows服务管理器
    echo   1. 按 Win + R
    echo   2. 输入 services.msc 回车
    echo   3. 找到 MySQL97
    echo   4. 右键 → 启动
    echo.
    echo 方法2: 管理员PowerShell
    echo   1. 右键PowerShell → 以管理员身份运行
    echo   2. 执行: Start-Service -Name "MySQL97"
    echo.
    echo 方法3: 管理员CMD
    echo   1. 右键命令提示符 → 以管理员身份运行
    echo   2. 执行: net start MySQL97
    echo ────────────────────────────────
    echo.
    pause
    exit /b 1
)

echo.
echo [步骤2/4] 检查开发服务器状态...
curl -s http://localhost:3008 >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 开发服务器正在运行 (http://localhost:3008)
) else (
    echo ️  开发服务器未运行,正在启动...
    echo.
    start "" cmd /k "cd /d d:\CRM系统2 && npm run dev"
    timeout /t 10 /nobreak >nul
    echo 💡 新窗口已打开,等待服务器启动完成(约10-15秒)...
    timeout /t 15 /nobreak >nul
)

echo.
echo [步骤3/4] 清理旧测试数据并生成新数据...
echo 正在生成全面的测试数据(覆盖所有4个角色)...
node generate-all-test-data.js

if errorlevel 1 (
    echo.
    echo ❌ 测试数据生成失败!
    echo 请检查MySQL连接是否正常
    pause
    exit /b 1
)

echo.
echo [步骤4/4] 打开浏览器进行测试...
timeout /t 3 /nobreak >nul
start http://localhost:3008

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║           ✅ 准备工作已完成!                              ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo  已生成的测试数据:
echo   • 客户: 19个 (分布在6天)
echo   • 公海池客户: 2个
echo   • 订单: 8个
echo   • 收款: 5笔
echo   • 任务: 10个
echo   • 日报: 5篇
echo   • 跟进记录: ~20条
echo.
echo 👥 可用的测试账号:
echo   ┌──────────┬──────────┬──────────────┬──────────────────┐
echo   │ 用户名   │ 密码     │ 角色         │ 权限范围         │
echo   ├──────────┼──────────┼────────────────────────────────┤
echo   │ admin    │ 123456   │ 管理员       │ 所有权限         │
echo   │ manager  │ 123456   │ 销售主管     │ 管理+审阅        │
echo   │ sales    │ 123456   │ 普通销售     │ 销售+个人数据    │
echo   │ finance  │ 123456   │ 财务         │ 财务+报表        │
echo   └──────────┴──────────┴──────────────┴──────────────────┘
echo.
echo 🧪 测试清单:
echo.
echo 【Admin角色测试】(admin/123456)
echo   ✓ 客户管理 - CRUD + 归档
echo   ✓ 公海池 - 查看 + 认领
echo   ✓ 每日新增客资 - 统计 + 详情
echo   ✓ 订单管理 - CRUD + 取消
echo   ✓ 收款管理 - CRUD
echo   ✓ 任务管理 - CRUD + 分配
echo   ✓ 日报管理 - CRUD + 审阅
echo   ✓ 用户管理 - CRUD
echo.
echo 【Manager角色测试】(manager/123456)
echo   ✓ 客户管理 - 查看所有 + 创建 + 编辑
echo   ✓ 公海池 - 查看 + 认领
echo   ✓ 订单管理 - 查看团队订单
echo   ✓ 日报管理 - 审阅下属日报
echo   ✓ 任务管理 - 分配任务
echo    删除客户 (无权限)
echo   ✗ 用户管理 (无权限)
echo.
echo 【Sales角色测试】(sales/123456)
echo   ✓ 客户管理 - 仅自己的客户
echo   ✓ 公海池 - 认领
echo   ✓ 订单管理 - 仅自己的订单
echo   ✓ 日报管理 - 创建 + 查看自己的
echo   ✓ 任务管理 - 查看 + 更新自己的
echo   ✗ 删除客户 (无权限)
echo   ✗ 用户管理 (无权限)
echo.
echo 【Finance角色测试】(finance/123456)
echo   ✓ 客户管理 - 只读
echo   ✓ 订单管理 - 查看所有
echo   ✓ 收款管理 - 完整权限
echo   ✓ 报表查看
echo   ✓ 任务管理
echo   ✗ 创建客户 (无权限)
echo   ✗ 用户管理 (无权限)
echo.
echo ────────────────────────────────────────────────────────
echo 💡 测试建议:
echo   1. 依次用4个账号登录测试
echo   2. 验证每个角色的权限边界
echo   3. 尝试越权操作(应被拒绝)
echo   4. 检查数据隔离(如sales只能看自己的数据)
echo   5. 记录所有发现的问题
echo ────────────────────────────────────────────────────────
echo.
pause
