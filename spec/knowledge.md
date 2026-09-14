# Project Knowledge

- CRM 使用 Next.js App Router、React、Ant Design、NextAuth、CASL、Prisma 和 MariaDB/MySQL；业务 API 位于 `src/app/api`。 | evidence: package.json、src/app、prisma/schema.prisma | 2026-08-23 (crm-comprehensive-quality-optimization)
- 运行、类型检查、构建、路由检查和数据检查统一从 `scripts/manage.py` 与 `scripts/manage.sh` 进入，日志写入 `logs/`。 | evidence: scripts/manage.py、scripts/manage.sh | 2026-08-23 (crm-code-audit-and-flow-repair)
- 客户、公海、订单、回款、合同与审计数据必须保留历史；测试写入使用独立数据库，不得使用稳定版业务数据。 | evidence: prisma/schema.prisma、spec/changes/crm-comprehensive-quality-optimization/design.md | 2026-08-23 (crm-comprehensive-quality-optimization)
- 当前用户指令禁止子智能体，所有实现和复核由主智能体单线程执行，验证记录必须注明非独立复核。 | evidence: AGENTS.md instructions | 2026-08-23 (crm-comprehensive-quality-optimization)
- stable/test profile 必须隔离数据库、认证密钥、访问地址、上传目录、端口、PID/锁和日志；写入型自动验收只允许 test。 | evidence: scripts/runtime/profile_config.py、scripts/quality/runtime_checks.py | 2026-08-29 (crm-comprehensive-quality-optimization)
- 发布包使用 manifest 与 SHA256 校验；promote 保留 current/previous stable，rollback 只切换应用发布物，不自动回滚或删除业务数据。 | evidence: scripts/release、scripts/quality/release_flow_test.py | 2026-08-29 (crm-comprehensive-quality-optimization)
- 电销名单 `TelemarketingList.salesId` 表示负责人；GET 按 `getAccessibleUserIds` 过滤（admin/finance 全量、主管团队、销售自己），响应带 `sales`；创建/导入可指定负责人。历史上挂在管理员名下的名单不会自动出现在销售端。 | evidence: src/app/api/telemarketing/route.ts、src/lib/telemarketing/scope.ts | 2026-09-14 (crm-sales-desk-corrections)
- 电销导入 `POST /api/telemarketing/import`（xlsx/csv、整批拒绝、锁 `crm_telemarketing_import:{profile}`）；CSV 需 utf-8-sig。转化客户 `salesId` 为名单负责人。表单负责人选项走 `GET /api/telemarketing/owners`。 | evidence: src/lib/telemarketing/import.ts、src/lib/telemarketing/convert.ts、src/app/api/telemarketing/owners/route.ts | 2026-09-14 (crm-sales-desk-corrections)
- 已合作客户列表展示对应销售与续费时间（`contractEndDate`）。智能提醒合同子集是当前自然月，文案 `续费月：YYYY-MM-DD`，不是未来 30 天。 | evidence: src/app/(dashboard)/customers/cooperating/cooperating-table.tsx、src/lib/reminders/queries.ts | 2026-09-14 (crm-sales-desk-corrections)
- 电销电话前后端共用 `isCrmPhone`（11 位手机或国内座机）；表单可改 status/isEffective。写入型验收电话必须是合法数字，不能用十六进制 marker 拼接。 | evidence: src/lib/http/phone.ts、scripts/quality/crm_http.py `marker_mobile` | 2026-09-14 (crm-sales-desk-corrections)
- 销售日报入口看 `report:daily:view` / 提交看 `report:daily:create`；销售角色缺这三项时在认证路径幂等补齐 RolePermission，不删其他权限。 | evidence: src/app/(dashboard)/daily-reports/page.tsx、src/lib/roles/ensure-sales-daily-report.ts | 2026-09-14 (crm-sales-desk-corrections)
