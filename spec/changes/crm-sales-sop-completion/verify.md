# Verification Ledger: crm-sales-sop-completion

## Round 0 - proposal critique

> 受项目“禁止子智能体”约束，本轮未派发独立批评智能体；由主智能体按 necessity 和 regression-compat 两个固定视角审查，不能视为独立复核。

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-1 | necessity | major | fixed(r0) | 如果把商机、报价、AI 或 ERP 一并加入本期，非功能治理会被业务扩展掩盖 | proposal 的 Not in this change 明确排除，PRD 只保留现有销售流程 |
| V-2 | necessity | major | fixed(r0) | 只增加空审计表而不接入关键写入，无法证明审计目标已经实现 | proposal 和 tasks 明确要求接入客户、公海、订单、回款、合同和文件访问关键路径 |
| V-3 | regression-compat | major | fixed(r0) | 全量重写接口可能破坏既有页面、错误文本和已验证流程 | design 将 Phase 1 限定为关键路径，旧业务入口和字段语义保持不变 |
| V-4 | regression-compat | major | open | 线上业务数据基本为空，无法证明真实角色、审计查询和恢复演练覆盖生产场景 | Phase 2 另行安排四角色浏览器验收和恢复演练；本期报告必须标记未验证范围 |

## Round 1 - Phase 1 implementation

> 本轮由主智能体执行。项目约束禁止创建或委派子智能体，因此本轮不是独立复核；证据仅覆盖本地源码、生成、类型、路由、构建和只读脚本范围。

| ID | Check | Status | Evidence |
|---|---|---|---|
| I-1 | Prisma Client 生成 | passed | `python scripts\manage.py generate`，退出码 0；生成 Prisma Client v5.22.0 |
| I-2 | TypeScript 类型检查 | passed | `python scripts\manage.py typecheck`，退出码 0 |
| I-3 | 路由契约检查 | passed | `python scripts\manage.py routes`，退出码 0，输出“路由契约静态检查通过” |
| I-4 | 生产构建 | passed | `python scripts\manage.py build`，退出码 0；Next.js 14.2.35 完成生产构建 |
| I-5 | 迁移与备份文件检查 | passed | `python scripts\manage.py audit-data --skip-db`，退出码 0；迁移目录检查通过，未找到本地备份文件并已记录警告 |
| I-6 | 数据库只读检查 | blocked | `python scripts\manage.py audit-data` 退出码 1；本机 `127.0.0.1:3306` 未监听，连接返回 `ERROR 2003 (HY000)` |
| I-7 | 本地 HTTP 冒烟 | blocked | `python scripts\manage.py dbstart` 尝试启动 `MySQL` 服务，Windows 返回 `OpenService FAILED 5: Access is denied`，因此未启动服务和 HTTP 冒烟 |
| I-8 | 线上迁移 | not-run | 本轮只生成 `AuditEvent` migration，未连接或修改线上数据库 |

### 当前未验证范围

- `AuditEvent` migration 尚未在本地或线上数据库执行，因此管理员审计查询和关键写入审计只能确认代码可编译，不能声称真实数据库运行通过。
- 尚未完成登录后四类角色的浏览器验收、真实审计记录查询、备份恢复演练和生产回滚演练。
- 构建日志中仍有现有动态 API 在 Next.js 静态页面生成阶段输出 `Dynamic server usage` 提示，但生产构建最终退出码为 0；本轮未扩大范围处理这些既有提示。
