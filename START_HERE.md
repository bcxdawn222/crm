#  CRM系统 - 测试启动指南

## 🎯 立即开始(只需3步!)

### 步骤1: 启动MySQL服务 🔴 **必须先做!**

**最简单的方法**(推荐):
```
1. 按 Win + R
2. 输入 services.msc 回车
3. 在服务列表中找到 MySQL97
4. 右键 → 启动
5. 等待状态变为"正在运行"
```

**验证成功**:
- 看到绿色勾号 ✅
- 或状态显示"正在运行"

---

### 步骤2: 一键准备测试环境

**双击运行**: `prepare-full-test.bat`

这个脚本会自动完成:
- ✅ 检查MySQL是否启动
- ✅ 启动开发服务器(如果未运行)
- ✅ 生成全面的测试数据
- ✅ 打开浏览器 http://localhost:3008
- ✅ 显示完整的测试清单

**等待约30秒**,一切自动完成!

---

### 步骤3: 开始测试

浏览器会自动打开,使用以下账号登录:

| 用户名 | 密码 | 角色 | 用途 |
|--------|------|------|------|
| admin | 123456 | 管理员 | 测试所有功能 |
| manager | 123456 | 销售主管 | 测试管理权限 |
| sales | 123456 | 普通销售 | 测试数据隔离 |
| finance | 123456 | 财务 | 测试财务功能 |

**建议测试顺序**:
1. 先用 **admin** 登录 - 测试所有功能
2. 再用 **manager** 登录 - 测试管理权限
3. 再用 **sales** 登录 - 测试销售权限和数据隔离
4. 最后用 **finance** 登录 - 测试财务功能

---

## 📊 已生成的测试数据

运行脚本后,系统将包含:

- 👥 **19个客户** (分布在6天,覆盖不同等级和来源)
- 🌊 **2个公海池客户** (已归档)
- 📦 **8个订单** (总金额¥156,000)
- 💰 **5笔收款** (总金额¥98,000)
-  **10个任务** (5个已完成,5个进行中)
-  **5篇日报** (不同日期)
- 📞 **~20条跟进记录**

这些数据足以全面测试所有功能!

---

## 🎯 核心测试点

### Admin(管理员)
✅ 应该能做: 所有操作(CRUD、删除、导出、用户管理等)  
❌ 不应该有: 无限制

### Manager(销售主管)
✅ 应该能做: 查看团队数据、创建/编辑、分配任务、审阅日报  
❌ 不应该能: 删除客户、管理用户、取消订单

### Sales(普通销售)
✅ 应该能做: 查看自己的数据、创建/编辑、认领公海池客户  
❌ 不应该能: 删除、查看他人数据、管理用户

### Finance(财务)
✅ 应该能做: 查看所有订单、完整收款权限、导出报表  
❌ 不应该能: 创建/编辑客户、创建订单、管理用户

---

## 🐛 常见问题速查

### Q: 看到 "500 Internal Server Error"
**原因**: MySQL没启动  
**解决**: 按步骤1启动MySQL97服务

### Q: 看到 "No data"
**原因**: 数据库是空的  
**解决**: 重新运行 `prepare-full-test.bat`

### Q: 看到 "No permission to..."
**原因**: 这是正常的!说明权限控制在工作  
**解决**: 换一个有更多权限的账号测试

### Q: 页面空白或打不开
**原因**: 开发服务器未启动  
**解决**: 运行 `npm run dev` 或重新运行 `prepare-full-test.bat`

---

##  重要文件清单

### 测试工具(最重要的!)
-  **[prepare-full-test.bat](file://d:\CRM系统2\prepare-full-test.bat)** - 一键测试准备(推荐使用!)
- [generate-all-test-data.js](file://d:\CRM系统2\generate-all-test-data.js) - 测试数据生成脚本
- [test-daily-report-fix.bat](file://d:\CRM系统2\test-daily-report-fix.bat) - 日报修复验证
- [test-all-features.bat](file://d:\CRM系统2\test-all-features.bat) - 全功能测试
- [run-all-tests.ps1](file://d:\CRM系统2\run-all-tests.ps1) - PowerShell版本

### 文档指南
-  **[NAVIGATION.md](file://d:\CRM系统2\NAVIGATION.md)** -  测试快速导航(从这里开始!)
-  **[README_TEST.md](file://d:\CRM系统2\README_TEST.md)** - 3分钟快速测试指南(新手必读!)
- 🔥 **[COMPREHENSIVE_TEST_GUIDE.md](file://d:\CRM系统2\COMPREHENSIVE_TEST_GUIDE.md)** - 详细测试指南(635行,包含完整测试清单)
-  **[TEST_FAQ.md](file://d:\CRM系统2\TEST_FAQ.md)** - 测试常见问题解答(遇到问题先看这里!)
- [INDEX.md](file://d:\CRM系统2\INDEX.md) - 测试快速索引
- [CHECKLIST.md](file://d:\CRM系统2\CHECKLIST.md) - 测试快速启动清单
- [QUICK_REFERENCE_CARD.md](file://d:\CRM系统2\QUICK_REFERENCE_CARD.md) - 测试快速参考卡(打印贴显示器!)

### 代码文件
- [src/app/api/daily-reports/route.ts](file://d:\CRM系统2\src\app\api\daily-reports\route.ts) - 日报API(✅ 已修复)
- [src/lib/casl.ts](file://d:\CRM系统2\src\lib\casl.ts) - CASL权限定义
- [src/lib/auth.ts](file://d:\CRM系统2\src\lib\auth.ts) - 用户认证配置

---

## 💡 测试技巧

1. **先测Admin**: 确保所有功能都正常
2. **再测其他角色**: 验证权限控制是否正确
3. **尝试越权操作**: 如用sales尝试删除客户,应该被拒绝
4. **检查数据隔离**: sales应该只能看到自己的数据
5. **记录问题**: 发现任何BUG都记录下来

---

## 🎉 开始测试吧!

现在就:
1. ✅ 启动MySQL (Win+R → services.msc → MySQL97 → 启动)
2. ✅ 双击 `prepare-full-test.bat`
3. ✅ 等待30秒
4. ✅ 开始测试!

**预计时间**: 约1小时完成全面测试

**有任何问题随时问我!** 

---

**最后更新**: 2026-07-06  
**状态**: ✅ 准备就绪
