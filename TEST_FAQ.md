#  CRM系统 - 测试FAQ(常见问题解答)

## 🔴 P0 - 阻塞性问题

### Q1: 所有API返回500错误怎么办?

**症状**: 
- 页面显示 "Internal Server Error"
- 浏览器控制台显示 "500 Internal Server Error"
- 终端显示 "Can't reach database server at localhost:3306"

**原因**: MySQL服务未启动

**解决步骤**:
1. **检查MySQL状态**:
   ```powershell
   Get-Service -Name "MySQL97" | Select-Object Name, Status
   ```

2. **如果显示 Stopped**,启动MySQL:
   - **方法1 **(最简单): Win + R → services.msc → 找到MySQL97 → 右键启动
   - **方法2 **(管理员PowerShell): `Start-Service -Name "MySQL97"`
   - **方法3 **(管理员CMD): `net start MySQL97`

3. **验证启动成功**:
   ```powershell
   Get-Service -Name "MySQL97"
   # 应该显示: Status = Running
   ```

4. **刷新浏览器页面**,重新测试

---

### Q2: 登录后显示"No data"或空列表怎么办?

**症状**: 
- 登录成功但所有列表都是空的
- 仪表盘统计都是0
- 页面显示 "No data"

**原因**: 数据库中没有测试数据

**解决步骤**:
1. **确保MySQL已启动**(见Q1)

2. **生成测试数据**:
   ```bash
   # 方式1: 使用一键脚本(推荐)
   prepare-full-test.bat
   
   # 方式2: 手动执行
   node generate-all-test-data.js
   ```

3. **等待数据生成完成**(约10-20秒)

4. **刷新浏览器页面**,应该能看到数据了

**预期结果**:
- 客户列表: 19个客户
- 订单列表: 8个订单
- 收款列表: 5笔收款
- 任务列表: 10个任务
- 日报列表: 5篇日报

---

### Q3: 页面完全空白或打不开怎么办?

**症状**: 
- 访问 http://localhost:3008 显示空白页
- 或显示Next.js错误页面
- 浏览器控制台有JavaScript错误

**可能原因**:
1. 开发服务器未启动
2. Next.js编译错误
3. JavaScript运行时错误

**解决步骤**:
1. **检查开发服务器是否运行**:
   ```bash
   # 查看是否有Node.js进程在运行
   tasklist | findstr node
   ```

2. **如果未运行,启动服务器**:
   ```bash
   cd d:\CRM系统2
   npm run dev
   ```

3. **如果有编译错误**:
   - 查看终端输出的错误信息
   - 根据错误提示修复代码
   - 或重启服务器(Ctrl+C停止,然后重新运行)

4. **清除浏览器缓存**:
   - Ctrl + Shift + Delete
   - 选择"缓存的图片和文件"
   - 点击"清除数据"
   - 刷新页面(F5)

5. **尝试无痕模式**:
   - Ctrl + Shift + N (Chrome)
   - 访问 http://localhost:3008

---

## 🟡 P1 - 重要问题

### Q4: 操作时提示"No permission to..."怎么办?

**症状**: 
- 创建/编辑/删除时提示无权限
- API返回403 Forbidden
- 显示 "No permission to create daily report" 等

**这是正常的吗**? 
✅ **是的**!这说明权限控制在工作。

**如何判断是否正确**:

#### Admin角色(admin/123456)
- ✅ 应该能执行所有操作
- ❌ 如果出现权限错误,说明配置有问题

#### Manager角色(manager/123456)
- ✅ 应该能: 查看团队数据、创建/编辑、分配任务、审阅日报
- ❌ 应该不能: 删除客户、管理用户、取消订单
-  如果尝试删除客户被拒绝,说明权限控制正确!

#### Sales角色(sales/123456)
- ✅ 应该能: 查看自己的数据、创建/编辑、认领公海池
- ❌ 应该不能: 删除、查看他人数据、管理用户
-  如果只能看到自己的客户,说明数据隔离正确!

#### Finance角色(finance/123456)
- ✅ 应该能: 查看所有订单、完整收款权限、导出报表
- ❌ 应该不能: 创建/编辑客户、创建订单、管理用户
- 💡 如果客户列表是只读的,说明权限控制正确!

**如果遇到意外的权限错误**:
1. 检查当前登录的账号和角色
2. 确认该角色应该有这个权限
3. 查看 [src/lib/casl.ts](file://d:\CRM系统2\src\lib\casl.ts) 中的权限定义
4. 查看 [src/lib/auth.ts](file://d:\CRM系统2\src\lib\auth.ts) 中的用户权限配置
5. 换admin账号测试,看是否正常

---

### Q5: 表单提交失败或无反应怎么办?

**症状**: 
- 填写表单后点击提交按钮无反应
- 或显示验证错误
- 或提交后数据未保存

**可能原因**:
1. 必填字段未填写
2. 数据格式不正确
3. 枚举值不匹配
4. API返回错误

**解决步骤**:
1. **检查必填字段**:
   - 标有 * 号的字段必须填写
   - 确保没有空值

2. **检查数据格式**:
   - 日期格式: YYYY-MM-DD
   - 金额: 数字,不能为负数
   - 电话: 11位数字
   - 邮箱: 正确的邮箱格式

3. **查看浏览器控制台**:
   - F12打开开发者工具
   - Network标签查看API请求
   - 查看响应状态码和错误信息

4. **查看终端日志**:
   - 开发服务器可能有详细的错误信息
   - Prisma验证错误会显示在这里

5. **常见枚举值问题**:
   - 客户等级: POTENTIAL, NORMAL, IMPORTANT, VIP
   - 客户来源: WEBSITE, REFERRAL, MANUAL, OTHER
   - 订单状态: PENDING, IN_PROGRESS, COMPLETED, CANCELLED
   - 任务状态: PENDING, IN_PROGRESS, COMPLETED
   - 任务优先级: HIGH, MEDIUM, LOW

---

### Q6: 数据保存后刷新页面不见了怎么办?

**症状**: 
- 创建/编辑数据后显示成功
- 但刷新页面后数据消失
- 或列表中没有新数据

**可能原因**:
1. 数据确实保存了,但查询条件过滤掉了
2. 数据保存到了错误的用户名下
3. 数据库事务未提交
4. 前端缓存问题

**解决步骤**:
1. **检查查询条件**:
   - 是否有筛选条件(如日期范围、状态等)
   - 清除所有筛选,查看全部数据

2. **检查数据归属**:
   - Sales角色只能看到自己的数据
   - 确认数据保存到了正确的用户名下

3. **硬刷新页面**:
   - Ctrl + F5 (强制刷新,清除缓存)
   - 或清除浏览器缓存后刷新

4. **直接查询数据库**:
   ```sql
   -- 连接MySQL后执行
   USE crm_system;
   SELECT * FROM Customer ORDER BY createdAt DESC LIMIT 10;
   ```

5. **查看API响应**:
   - F12 → Network标签
   - 查看POST请求的响应
   - 确认返回了正确的数据

---

##  P2 - 次要问题

### Q7: 导出Excel文件打不开或乱码怎么办?

**症状**: 
- 点击导出按钮下载了文件
- 但Excel无法打开
- 或打开后显示乱码

**可能原因**:
1. 文件格式不正确
2. 编码问题
3. Excel版本不兼容

**解决步骤**:
1. **尝试用其他软件打开**:
   - WPS Office
   - Google Sheets
   - LibreOffice Calc

2. **检查文件扩展名**:
   - 应该是 .xlsx 或 .xls
   - 如果不是,手动重命名

3. **查看浏览器控制台**:
   - F12 → Network标签
   - 查看导出API的响应
   - 确认Content-Type正确

4. **尝试不同浏览器**:
   - Chrome
   - Edge
   - Firefox

---

### Q8: 图片上传失败怎么办?

**症状**: 
- 上传图片时显示失败
- 或上传后图片不显示

**可能原因**:
1. 文件大小超限
2. 文件格式不支持
3. OSS配置问题

**解决步骤**:
1. **检查文件大小**:
   - 通常限制在5MB以内
   - 压缩图片后重试

2. **检查文件格式**:
   - 支持: JPG, PNG, GIF, WebP
   - 不支持: BMP, TIFF, RAW

3. **检查OSS配置**:
   - 查看 .env 文件中的OSS配置
   - 确认AccessKey和SecretKey正确

4. **查看浏览器控制台**:
   - F12 → Network标签
   - 查看上传API的响应
   - 确认错误信息

---

### Q9: 页面加载很慢怎么办?

**症状**: 
- 打开页面需要很长时间
- 或切换页面时卡顿
- 或数据加载缓慢

**可能原因**:
1. 网络问题
2. 数据库查询慢
3. 前端渲染慢
4. 开发模式性能较低

**解决步骤**:
1. **检查网络**:
   - 本地开发应该很快
   - 如果是远程数据库,检查网络连接

2. **优化数据库查询**:
   - 添加索引
   - 减少关联查询
   - 使用分页

3. **生产环境测试**:
   ```bash
   npm run build
   npm start
   ```
   - 生产模式性能更好

4. **清除浏览器缓存**:
   - Ctrl + Shift + Delete
   - 清除缓存后重试

---

## 🔵 P3 - 轻微问题

### Q10: 菜单Key重复警告怎么办?

**症状**: 
- 浏览器控制台显示警告
- "Warning: Duplicated key '/customers' used in Menu"

**影响**: 
- 不影响功能
- 只是React警告

**解决**: 
- 可以忽略,不影响使用
- 或修复Sidebar组件中的菜单key

---

### Q11: 退出登录后跳转异常怎么办?

**症状**: 
- 点击退出登录后跳转到 chrome-error://chromewebdata/
- 或跳转到错误页面

**解决**: 
- 手动导航回登录页
- 或直接访问 http://localhost:3008/login

---

### Q12: 富文本编辑器样式不正常怎么办?

**症状**: 
- 日报编辑器的工具栏显示异常
- 或格式化功能不工作

**解决**: 
1. 刷新页面
2. 清除浏览器缓存
3. 尝试不同浏览器

---

##  获取帮助

### 文档资源
- **快速入门**: [README_TEST.md](file://d:\CRM系统2\README_TEST.md)
- **详细指南**: [COMPREHENSIVE_TEST_GUIDE.md](file://d:\CRM系统2\COMPREHENSIVE_TEST_GUIDE.md)
- **快速索引**: [INDEX.md](file://d:\CRM系统2\INDEX.md)
- **测试清单**: [CHECKLIST.md](file://d:\CRM系统2\CHECKLIST.md)
- **问题排查**: [MYSQL_STARTUP_GUIDE.md](file://d:\CRM系统2\MYSQL_STARTUP_GUIDE.md)

### 调试工具
- **浏览器控制台**: F12
- **Network标签**: 查看API请求
- **终端日志**: 查看服务器输出
- **Prisma Studio**: `npx prisma studio` (可视化数据库)

### AI助手
- 随时提问,我会帮您解决问题!
- 提供详细的故障排查步骤
- 协助修复发现的BUG

---

## 💡 最佳实践

### 预防问题
1. **启动前先检查**:
   - MySQL是否运行
   - 开发服务器是否启动
   - 环境变量是否正确

2. **测试前准备**:
   - 运行 `prepare-full-test.bat`
   - 确认生成了测试数据
   - 清除浏览器缓存

3. **系统化测试**:
   - 按角色顺序测试
   - 记录每个测试结果
   - 及时发现问题

### 快速定位
1. **500错误** → 检查MySQL
2. **No data** → 生成测试数据
3. **No permission** → 检查角色权限
4. **页面空白** → 检查服务器状态
5. **表单失败** → 检查必填字段和数据格式

### 高效解决
1. **查看日志**: 终端和浏览器控制台
2. **查阅文档**: README_TEST.md 和 COMPREHENSIVE_TEST_GUIDE.md
3. **简化问题**: 用admin账号测试,排除权限问题
4. **逐步排查**: 从环境→数据→代码逐层检查

---

**最后更新**: 2026-07-06  
**版本**: v1.0  
**维护者**: AI Assistant
