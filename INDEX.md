#  CRM系统 - 测试快速索引

##  立即开始(3步)

1. **启动MySQL** → [查看方法](file://d:\CRM系统2\README_TEST.md#步骤1-启动mysql服务-)
2. **运行脚本** → 双击 `prepare-full-test.bat`
3. **开始测试** → 浏览器自动打开 http://localhost:3008

---

## 📚 文档导航

### 新手入门
- **[README_TEST.md](file://d:\CRM系统2\README_TEST.md)** - ⭐ **3分钟快速测试指南**(从这里开始!)
- **[TEST_PREPARATION_COMPLETE.md](file://d:\CRM系统2\TEST_PREPARATION_COMPLETE.md)** - 测试准备完成说明

### 详细测试
- **[COMPREHENSIVE_TEST_GUIDE.md](file://d:\CRM系统2\COMPREHENSIVE_TEST_GUIDE.md)** - 🔥 **完整测试指南**(635行,含所有测试清单)

### 问题排查
- **[MYSQL_STARTUP_GUIDE.md](file://d:\CRM系统2\MYSQL_STARTUP_GUIDE.md)** - MySQL启动和问题排查
- **[DAILY_REPORT_FIX.md](file://d:\CRM系统2\DAILY_REPORT_FIX.md)** - 日报权限修复说明
- **[FUNCTION_TEST_REPORT.md](file://d:\CRM系统2\FUNCTION_TEST_REPORT.md)** - 功能测试报告模板

### 其他文档
- [QUICK_START.md](file://d:\CRM系统2\QUICK_START.md) - 快速启动指南
- [COMPLETION_SUMMARY.md](file://d:\CRM系统2\COMPLETION_SUMMARY.md) - 功能开发完成总结

---

## 🛠️ 测试工具

### 一键工具(推荐!)
-  **[prepare-full-test.bat](file://d:\CRM系统2\prepare-full-test.bat)** - **全能测试准备工具**(检查MySQL+生成数据+打开浏览器)

### 专项工具
- [generate-all-test-data.js](file://d:\CRM系统2\generate-all-test-data.js) - 测试数据生成脚本
- [test-daily-report-fix.bat](file://d:\CRM系统2\test-daily-report-fix.bat) - 日报修复验证
- [test-all-features.bat](file://d:\CRM系统2\test-all-features.bat) - 全功能测试
- [run-all-tests.ps1](file://d:\CRM系统2\run-all-tests.ps1) - PowerShell版本

---

## 👥 测试账号速查

| 用户名 | 密码 | 角色 | 权限 | 适用场景 |
|--------|------|------|------|----------|
| admin | 123456 | 管理员 | 所有权限 | 完整功能测试 |
| manager | 123456 | 销售主管 | 管理+审阅 | 团队管理测试 |
| sales | 123456 | 普通销售 | 销售+个人数据 | 日常销售工作测试 |
| finance | 123456 | 财务 | 财务+报表 | 财务管理测试 |

---

##  常见问题速查

### Q: 500错误 / 数据库连接失败
**原因**: MySQL未启动  
**解决**: [启动MySQL97服务](file://d:\CRM系统2\README_TEST.md#步骤1-启动mysql服务-)

### Q: No data / 空数据
**原因**: 数据库是空的  
**解决**: 运行 `prepare-full-test.bat` 生成测试数据

### Q: No permission to...
**原因**: 权限控制正常工作  
**解决**: 这是预期行为,换有更多权限的账号测试

### Q: 页面空白
**原因**: 服务器未启动或编译错误  
**解决**: 运行 `npm run dev` 或重新运行 `prepare-full-test.bat`

---

## 📊 测试数据概览

运行 `generate-all-test-data.js` 后:

```
 客户: 19个 (分布在6天)
  ├─ 公海池: 2个
  └─ 活跃: 17个

📦 订单: 8个 (¥156,000)
💰 收款: 5笔 (¥98,000)
📋 任务: 10个 (5完成/5进行中)
 日报: 5篇
📞 跟进: ~20条
```

---

## 🎯 核心测试点

### 1. 权限控制
- ✅ 每个角色只能访问其权限范围内的功能
- ❌ 越权操作应返回403 Forbidden
- 🔑 关键测试: sales尝试删除客户 → 应该被拒绝

### 2. 数据隔离
- Sales: 只能看到自己的数据
- Manager: 可以看到团队数据
- Admin/Finance: 可以看到所有数据(根据权限)

### 3. 业务流程
- 客户 → 跟进 → 订单 → 收款
- 任务创建 → 分配 → 执行 → 完成
- 日报提交 → 审阅

---

## 💡 快速提示

### 测试顺序建议
1. **Admin** → 确保所有功能正常
2. **Manager** → 验证管理权限
3. **Sales** → 验证数据隔离
4. **Finance** → 验证财务功能

### 测试重点
- 先测CRUD基本功能
- 再测权限边界(越权操作)
- 最后测业务流程完整性

### 记录问题
使用 [COMPREHENSIVE_TEST_GUIDE.md](file://d:\CRM系统2\COMPREHENSIVE_TEST_GUIDE.md) 中的问题记录模板

---

## 📁 项目结构

```
d:\CRM系统2\
─ 📄 README_TEST.md                    # ⭐ 3分钟快速测试指南
├─ 📄 COMPREHENSIVE_TEST_GUIDE.md       # 🔥 完整测试指南
├─ 📄 TEST_PREPARATION_COMPLETE.md      # 测试准备说明
├─ 📄 MYSQL_STARTUP_GUIDE.md            # MySQL启动指南
├─ 📄 DAILY_REPORT_FIX.md               # 日报修复说明
├─ 📄 QUICK_START.md                    # 快速启动指南
│
├─ 🛠️ prepare-full-test.bat             # 🔥 一键测试准备工具
├─ 🛠️ generate-all-test-data.js         # 测试数据生成脚本
├─ 🛠️ test-daily-report-fix.bat         # 日报修复验证
├─ 🛠️ test-all-features.bat             # 全功能测试
├─ 🛠️ run-all-tests.ps1                 # PowerShell测试脚本
│
─ src/
│  ├─ app/
│  │  ├─ api/
│  │  │  ├─ daily-reports/route.ts      # ✅ 已修复权限问题
│  │  │  ├─ daily-leads/route.ts        # 每日客资API
│  │  │  ├─ customers/route.ts          # 客户API
│  │  │  └─ ...
│  │  └─ (dashboard)/
│  │     ├─ daily-leads/page.tsx        # 每日客资页面
│  │     └─ ...
│  └─ lib/
│     ├─ casl.ts                        # CASL权限定义
│     └─ auth.ts                        # 用户认证配置
│
└─ prisma/
   └─ schema.prisma                     # 数据库模型定义
```

---

##  开始吧!

**现在就**:
1. ✅ 启动MySQL (1分钟)
2. ✅ 双击 `prepare-full-test.bat` (30秒)
3. ✅ 开始测试 (30-60分钟)

**预计总时间**: 约1小时完成全面测试

**有任何问题随时问我!** 

---

**最后更新**: 2026-07-06  
**状态**: ✅ 准备就绪
