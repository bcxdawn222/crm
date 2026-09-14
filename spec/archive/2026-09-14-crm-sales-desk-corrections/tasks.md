# Tasks: crm-sales-desk-corrections

> 触发原因：前后端跨栈且接口契约变更（电销 GET/POST/PUT、新增 import、convert 归属、reminders 查询）。项目禁止子智能体，全部由主智能体串行，不设 owner。

- [x] 1. 契约落地
  - [x] 1.1 实现 `isCrmPhone` 并接到电销表单与 API
  - [x] 1.2 按 design.md Interfaces 改电销 GET 范围、响应带 sales、POST/PUT 的 status/isEffective/salesId
- [x] 2. 电销导入与转化
  - [x] 2.1 `POST /api/telemarketing/import` 与页面入口 deps: 1.2
  - [x] 2.2 convert 改为范围校验且客户归属名单 `salesId` deps: 1.2
  - [x] 2.3 列表增加销售列；编辑弹窗增加状态、有效性
- [x] 3. 已合作与提醒
  - [x] 3.1 已合作表增加对应销售、续费时间列
  - [x] 3.2 `loadReminderRows` 合同子集改为当前自然月，文案同步
- [x] 4. 日报入口
  - [x] 4.1 提交按钮按 `report:daily:create`；核对并补齐销售角色日报权限
- [x] 5. 验收
  - [x] 5.1 test profile 下验证导入分派、销售可见、座机保存、状态可编、转入我的客户、合作列表两列、当月提醒、销售提交日报
  - [x] 5.2 清理测试夹具；不写 stable 业务库
