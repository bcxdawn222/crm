# ✅ CRM系统 - 全面测试准备完成

## 📋 已完成的工作

### 1. 修复的问题 ✅

#### 问题1: 日报权限错误
- **现象**: "No permission to create daily report"
- **原因**: CASL权限检查中subject名称不匹配(`dailyReport` vs `report`)
- **修复**: [src/app/api/daily-reports/route.ts](file://d:\CRM系统2\src\app\api\daily-reports\route.ts)
  - 将 `ability.cannot('read', 'dailyReport')` 改为 `ability.cannot('read', 'report')`
  - 将 `ability.cannot('create', 'dailyReport')` 改为 `ability.cannot('create', 'report')`
  - 安全访问 `session.user?.roles || []`

#### 问题2: session访问不安全
- **现象**: 可能导致运行时TypeError
- **修复**: 所有API中使用可选链操作符 `session.user?.roles || []`

### 2. 创建的测试工具 ✅

| 文件 | 用途 | 状态 |
|------|------|------|
| [prepare-full-test.bat](file://d:\CRM系统2\prepare-full-test.bat) | **一键测试准备工具** | ✅ 已创建 |
| [generate-all-test-data.js](file://d:\CRM系统2\generate-all-test-data.js) | 测试数据生成脚本 | ✅ 已存在 |
| [test-daily-report-fix.bat](file://d:\CRM系统2\test-daily-report-fix.bat) | 日报修复验证脚本 | ✅ 已创建 |
| [test-all-features.bat](file://d:\CRM系统2\test-all-features.bat) | 全功能测试脚本 | ✅ 已存在 |
| [run-all-tests.ps1](file://d:\CRM系统2\run-all-tests.ps1) | PowerShell测试脚本 | ✅ 已存在 |

### 3. 创建的文档 ✅

| 文件 | 内容 | 行数 |
|------|------|------|
| [README_TEST.md](file://d:\CRM系统2\README_TEST.md) | **3分钟快速测试指南** | 142行 |
| [COMPREHENSIVE_TEST_GUIDE.md](file://d:\CRM系统2\COMPREHENSIVE_TEST_GUIDE.md) | **详细测试指南**(含完整测试清单) | 635行 |
| [DAILY_REPORT_FIX.md](file://d:\CRM系统2\DAILY_REPORT_FIX.md) | 日报权限修复报告 | 218行 |
| [QUICK_START.md](file://d:\CRM系统2\QUICK_START.md) | 快速启动指南 | 已存在 |
| [MYSQL_STARTUP_GUIDE.md](file://d:\CRM系统2\MYSQL_STARTUP_GUIDE.md) | MySQL启动指南 | 已存在 |
| [FUNCTION_TEST_REPORT.md](file://d:\CRM系统2\FUNCTION_TEST_REPORT.md) | 功能测试报告模板 | 已存在 |

### 4. 测试数据规划 ✅

运行 `generate-all-test-data.js` 后将生成:

```
📊 测试数据统计:
├─ 👥 客户: 19个
│  ├─ 今天: 5个 (POTENTIAL: 3, NORMAL: 2)
│  ├─ 昨天: 4个
│  ├─ 前2天: 3个
│  ├─ 前3天: 3个
│  ├─ 前4天: 2个
│  └─ 前5天: 2个
│
├─  公海池: 2个 (已归档)
│
├─ 📦 订单: 8个
│  ├─ 总金额: ¥156,000
│  ├─ 状态分布: 待处理(2), 进行中(3), 已完成(3)
│  └─ 支付方式: 银行转账(3), 支付宝(2), 微信(2), 现金(1)
│
├─ 💰 收款: 5笔
│  ├─ 总金额: ¥98,000
│  └─ 收款方式: 银行转账(2), 支付宝(2), 微信(1)
│
├─ 📋 任务: 10个
│  ├─ 状态: PENDING(3), IN_PROGRESS(2), COMPLETED(5)
│  ├─ 优先级: HIGH(2), MEDIUM(5), LOW(3)
│  └─ 分配给: admin(4), manager(3), sales(3)
│
├─  日报: 5篇
│  ├─ 日期: 分布在最近5天
│  └─ 作者: admin(3), sales(2)
│
└─  跟进记录: ~20条
   └─ 类型: 电话(8), 面谈(6), 邮件(4), 微信(2)
```

---

## 🚀 如何开始测试

### 超简单3步:

#### 步骤1️⃣: 启动MySQL服务 🔴 **最重要!**

**方法1 **(最简单):
```
Win + R → services.msc → 找到MySQL97 → 右键启动
```

**方法2 **(管理员PowerShell):
```powershell
Start-Service -Name "MySQL97"
```

**方法3 **(管理员CMD):
```cmd
net start MySQL97
```

**验证成功**:
```powershell
Get-Service -Name "MySQL97"
# 应该显示: Status = Running
```

---

#### 步骤2️⃣: 一键准备测试环境

**双击运行**: `prepare-full-test.bat`

这个脚本会:
- ✅ 检查MySQL是否启动
- ✅ 启动开发服务器(如果未运行)
- ✅ 生成全面的测试数据
- ✅ 打开浏览器 http://localhost:3008
- ✅ 显示完整的测试清单

**等待约30秒**,一切自动完成!

---

#### 步骤3️⃣: 开始测试

浏览器会自动打开,使用以下账号登录:

| 用户名 | 密码 | 角色 | 测试重点 |
|--------|------|------|----------|
| **admin** | 123456 | 管理员 | 所有功能(CRUD、删除、用户管理等) |
| **manager** | 123456 | 销售主管 | 团队数据查看、任务分配、日报审阅 |
| **sales** | 123456 | 普通销售 | 数据隔离(只能看自己的)、公海池认领 |
| **finance** | 123456 | 财务 | 收款管理、订单查看、报表导出 |

**建议测试顺序**:
1. Admin → 确保所有功能正常
2. Manager → 验证管理权限
3. Sales → 验证数据隔离
4. Finance → 验证财务功能

---

## 🎯 核心测试点

### 权限控制(最重要!)

每个角色应该:
- ✅ 只能访问其权限范围内的功能
- ❌ 越权操作应返回403 Forbidden
- ✅ 前端按钮根据权限显示/隐藏

**关键测试**:
- Sales尝试删除客户 → 应该被拒绝
- Sales尝试查看其他销售的客户 → 应该看不到
- Finance尝试创建客户 → 应该被拒绝
- Manager尝试管理用户 → 应该被拒绝

### 数据隔离

- **Sales**: 只能看到自己负责的客户、订单、日报
- **Manager**: 可以看到团队所有数据
- **Admin**: 可以看到所有数据
- **Finance**: 可以看到所有订单和收款,但客户只读

### 业务流程

- 客户 → 跟进 → 订单 → 收款 (完整流程)
- 任务创建 → 分配 → 执行 → 完成 (完整流程)
- 日报提交 → 审阅 (完整流程)

---

## 🐛 常见问题速查

### Q1: 所有API返回500错误
**症状**: 
- 页面显示 "Internal Server Error"
- 控制台显示 "Can't reach database server at localhost:3306"

**原因**: MySQL服务未启动

**解决**: 按步骤1启动MySQL97服务

---

### Q2: 登录后显示"No data"
**症状**: 
- 列表页面显示空
- 仪表盘统计都是0

**原因**: 数据库中没有数据

**解决**: 运行 `prepare-full-test.bat` 或 `node generate-all-test-data.js`

---

### Q3: "No permission to..." 错误
**症状**: 
- 操作时提示无权限

**原因**: 这是**正常的**!说明权限控制在工作

**解决**: 
- 如果是预期行为(如sales尝试删除),说明权限控制正确 ✅
- 如果是不应该的(如admin无法创建日报),检查casl.ts配置

---

### Q4: 页面空白或打不开
**症状**: 
- 浏览器显示空白页
- 或显示Next.js错误页面

**原因**: 开发服务器未启动或编译错误

**解决**: 
1. 检查终端是否有编译错误
2. 运行 `npm run dev` 重新启动服务器
3. 或重新运行 `prepare-full-test.bat`

---

### Q5: 表单提交失败
**症状**: 
- 填写表单后点击提交无反应
- 或显示验证错误

**可能原因**:
1. 必填字段未填写
2. 数据格式不正确
3. 枚举值不匹配(如source字段)

**解决**:
1. 检查所有必填字段(*)
2. 查看浏览器控制台(F12)的错误信息
3. 检查Prisma schema中的枚举定义

---

## 📁 重要文件清单

### 测试工具(最重要的!)
- 🔥 **[prepare-full-test.bat](file://d:\CRM系统2\prepare-full-test.bat)** - 一键测试准备(推荐使用!)
- [generate-all-test-data.js](file://d:\CRM系统2\generate-all-test-data.js) - 测试数据生成脚本
- [test-daily-report-fix.bat](file://d:\CRM系统2\test-daily-report-fix.bat) - 日报修复验证
- [test-all-features.bat](file://d:\CRM系统2\test-all-features.bat) - 全功能测试
- [run-all-tests.ps1](file://d:\CRM系统2\run-all-tests.ps1) - PowerShell版本

### 文档指南
-  **[README_TEST.md](file://d:\CRM系统2\README_TEST.md)** - 3分钟快速测试指南(新手必读!)
- 🔥 **[COMPREHENSIVE_TEST_GUIDE.md](file://d:\CRM系统2\COMPREHENSIVE_TEST_GUIDE.md)** - 详细测试指南(635行,包含完整测试清单)
- [DAILY_REPORT_FIX.md](file://d:\CRM系统2\DAILY_REPORT_FIX.md) - 日报权限修复报告
- [QUICK_START.md](file://d:\CRM系统2\QUICK_START.md) - 快速启动指南
- [MYSQL_STARTUP_GUIDE.md](file://d:\CRM系统2\MYSQL_STARTUP_GUIDE.md) - MySQL启动指南

### 代码修复
- [src/app/api/daily-reports/route.ts](file://d:\CRM系统2\src\app\api\daily-reports\route.ts) - 日报API(已修复权限问题)
- [src/lib/casl.ts](file://d:\CRM系统2\src\lib\casl.ts) - CASL权限定义
- [src/lib/auth.ts](file://d:\CRM系统2\src\lib\auth.ts) - 用户认证配置

---

## 💡 测试技巧

### 1. 系统化测试
- 按角色依次测试(admin → manager → sales → finance)
- 每个角色测试完再换下一个
- 记录每个角色的测试结果

### 2. 边界测试
- 尝试空表单提交
- 输入无效数据(如负数金额)
- 尝试重复数据
- 并发操作(同时打开多个页面)

### 3. 越权测试(重要!)
- 用sales尝试删除客户 → 应该被拒绝
- 用sales尝试查看其他销售的客户 → 应该看不到
- 用finance尝试创建客户 → 应该被拒绝
- 用manager尝试管理用户 → 应该被拒绝

### 4. 数据完整性
- 创建客户后立即查看是否正确保存
- 修改数据后刷新页面确认更改
- 删除数据后确认真的删除了
- 导出数据后检查Excel内容

### 5. 用户体验
- 操作流程是否顺畅
- 错误提示是否友好
- 加载速度是否可以接受
- 界面是否美观易用

---

## 📝 问题记录模板

发现BUG时使用此模板:

```markdown
### 问题 #X

**严重程度**: P0(阻塞)/P1(重要)/P2(次要)/P3(轻微)  
**发现角色**: admin/manager/sales/finance  
**功能模块**: 客户管理/订单管理/日报管理/...  

**问题描述**:
[详细描述问题]

**复现步骤**:
1. [步骤1]
2. [步骤2]
3. [步骤3]

**预期结果**:
[应该发生什么]

**实际结果**:
[实际发生了什么]

**错误信息**:
[控制台错误或API响应]

**截图**:
[如果有]

**建议修复**:
[如果有想法]
```

---

## 🎉 准备好了吗?

现在就:

1. ✅ **启动MySQL** (Win+R → services.msc → MySQL97 → 启动)
2. ✅ **双击运行** `prepare-full-test.bat`
3. ✅ **等待30秒** (自动生成数据+打开浏览器)
4. ✅ **开始测试** (用4个账号依次测试)

**预计时间**:
- 启动MySQL: 1分钟
- 运行脚本: 30秒
- 全面测试: 30-60分钟(取决于测试深度)

**总计**: 约1小时完成全面测试! 🚀

---

## 📞 需要帮助?

如果在测试过程中遇到任何问题:

1. **查看文档**: README_TEST.md 或 COMPREHENSIVE_TEST_GUIDE.md
2. **检查常见问题**: 本文档的"常见问题速查"部分
3. **查看终端日志**: 开发服务器的输出可能有错误信息
4. **查看浏览器控制台**: F12打开开发者工具查看JavaScript错误
5. **随时问我**: 我会帮您解决问题!

---

## ✨ 总结

**已完成**:
- ✅ 修复日报权限问题
- ✅ 创建全面的测试工具
- ✅ 编写详细的测试文档
- ✅ 规划完整的测试数据

**下一步**:
1. 启动MySQL服务
2. 运行 `prepare-full-test.bat`
3. 开始全面测试
4. 记录发现的问题

**预期结果**:
- 所有功能正常工作
- 权限控制正确生效
- 数据隔离符合预期
- 业务流程完整流畅

祝测试顺利! 🎊

---

**最后更新**: 2026-07-06  
**文档版本**: v1.0  
**状态**: ✅ 准备就绪,可以开始测试!
