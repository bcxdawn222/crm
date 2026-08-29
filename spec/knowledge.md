# Project Knowledge

- CRM 使用 Next.js App Router、React、Ant Design、NextAuth、CASL、Prisma 和 MariaDB/MySQL；业务 API 位于 `src/app/api`。 | evidence: package.json、src/app、prisma/schema.prisma | 2026-08-23 (crm-comprehensive-quality-optimization)
- 运行、类型检查、构建、路由检查和数据检查统一从 `scripts/manage.py` 与 `scripts/manage.sh` 进入，日志写入 `logs/`。 | evidence: scripts/manage.py、scripts/manage.sh | 2026-08-23 (crm-code-audit-and-flow-repair)
- 客户、公海、订单、回款、合同与审计数据必须保留历史；测试写入使用独立数据库，不得使用稳定版业务数据。 | evidence: prisma/schema.prisma、spec/changes/crm-comprehensive-quality-optimization/design.md | 2026-08-23 (crm-comprehensive-quality-optimization)
- 当前用户指令禁止子智能体，所有实现和复核由主智能体单线程执行，验证记录必须注明非独立复核。 | evidence: AGENTS.md instructions | 2026-08-23 (crm-comprehensive-quality-optimization)
- stable/test profile 必须隔离数据库、认证密钥、访问地址、上传目录、端口、PID/锁和日志；写入型自动验收只允许 test。 | evidence: scripts/runtime/profile_config.py、scripts/quality/runtime_checks.py | 2026-08-29 (crm-comprehensive-quality-optimization)
- 发布包使用 manifest 与 SHA256 校验；promote 保留 current/previous stable，rollback 只切换应用发布物，不自动回滚或删除业务数据。 | evidence: scripts/release、scripts/quality/release_flow_test.py | 2026-08-29 (crm-comprehensive-quality-optimization)
