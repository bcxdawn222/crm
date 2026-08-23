# Tasks: crm-sales-sop-completion

> 本项目禁止子智能体，所有任务由主智能体串行执行。

- [x] 1. PRD 与 phase 交付
  - [x] 1.1 编写销售 SOP 流程 PRD
  - [x] 1.2 编写 Phase 实施计划
  - [x] 1.3 同步客户可修改 TXT 版本
- [x] 2. Phase 1 数据审计基础
  - [x] 2.1 增加 `AuditEvent` Prisma 模型和迁移
  - [x] 2.2 增加敏感字段过滤和审计写入服务
  - [x] 2.3 接入客户、公海、订单、回款、合同和文件访问关键路径
  - [x] 2.4 增加管理员审计查询接口
- [x] 3. Phase 1 日志与请求治理
  - [x] 3.1 增加统一 `requestId` 生成和透传
  - [x] 3.2 统一关键错误响应，移除对外 `error.message/details` 泄露
  - [x] 3.3 确认服务端日志写入 `logs/` 并可按 requestId 定位
- [x] 4. Phase 1 数据和运行检查
  - [x] 4.1 增加只读数据质量检查脚本
  - [x] 4.2 增加备份完整性、哈希和迁移状态检查
  - [x] 4.3 接入 `python scripts\manage.py audit-data` 和日志入口
- [ ] 5. Phase 1 验证
  - [x] 5.1 类型检查和 Prisma Client 生成
  - [x] 5.2 路由契约检查和错误信息扫描
  - [ ] 5.3 生产构建已通过；本地 HTTP 冒烟因 MySQL 服务未启动而未完成
  - [x] 5.4 清理临时测试数据和测试文件，输出未验证范围
