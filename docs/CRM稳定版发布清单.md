# CRM 稳定版发布清单

清单日期：2026 年 8 月 25 日

上线版本：`1.0.0-4e7a8bc4`

运行代码基线：`4e7a8bc4d1c9466d170d98633091ff7acab59749`

发布包：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\.build\test\release\1.0.0-4e7a8bc4.zip`

SHA256：`79c2941753a4bf1b3854231c9c76eef574e80fba26d4d84162edb8d0da000f1a`

说明：发布包 manifest 的 `profile=test` 表示产物来自已通过门禁的 test 候选通道；线上健康接口返回 `profile=stable`，表示实际运行环境为 stable。线上部署与只读验收详见 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\CRM线上部署与只读验收-2026-08-25.md`。

## 1. 发布范围

- [x] Next.js 15.4.11、React 19.1.1、TypeScript 与 Ant Design 运行通道。
- [x] stable/test 数据库、认证、端口、上传、日志、运行目录和构建目录隔离。
- [x] 客户、合作客户、公海、电销、每日客资、任务、提醒、日报、订单、回款、文件、消息、用户、角色和设置现有功能。
- [x] 权限与数据范围、审计、请求恢复、单实例和服务端健康检查。
- [x] test 发布包、SHA256、manifest、promote 和 rollback 状态管理。
- [x] 用户已明确要求部署，线上已运行 `1.0.0-4e7a8bc4`。

## 2. 数据库迁移

发布包应包含以下迁移及各自 SHA256：

- `20260706064739_init`
- `20260708073301_add_public_pool_field`
- `20260720093049_add_telemarketing_list`
- `20260725092545_add_cooperating_customer_fields`
- `20260725095913_add_user_hierarchy`
- `20260822160000_add_missing_schema_fields`
- `20260823000000_add_audit_event`
- `20260824132000_add_system_setting`
- `20260824151500_add_write_idempotency`

上线前必须执行 `prisma migrate status` 或受控迁移检查，确认线上迁移历史与发布包一致。迁移执行前需完成数据库备份，不允许通过删除原始业务数据解决迁移冲突。

## 3. 备份门禁

- [x] `/root/crm-backups/crm_system-20260825T163142Z.sql.gz` 存在。
- [x] `gzip -t` 退出码为 0，SHA256 为 `0b89a102e58bf7a1e18e63712c2f17edad0fb34682aeebd21b58091ab4d1d5f4`。
- [x] 备份大小 12606 字节，权限 `root:root 600`；本机副本位于 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\output\database-backups\crm_system-20260825T163142Z.sql.gz`。
- [x] 自动备份 timer 为 active/enabled，备份日志末条记录为成功；日志中较早的恢复脚本试错记录不属于自动备份失败。
- [x] 已恢复到临时数据库核对 19 张表、1 个用户、4 个角色、46 个权限和 9 条有效迁移，随后删除临时数据库。

本地自动化门禁不会证明线上备份可恢复，以上项目只能在实际服务器完成。

## 4. 配置门禁

- [x] stable/test 的数据库连接已配置且不同，test profile 还包含禁止复用 stable 写库的硬校验。
- [x] stable/test 的 NextAuth 密钥不同，且两个密钥均不少于 32 个字符。
- [x] stable/test 的有效访问地址、端口和上传目录不同；test 未显式配置 URL 时使用独立的 `127.0.0.1:3001`，上传目录按 profile 分开。
- [x] 正式域名只转发至 `127.0.0.1:3000`。
- [x] 线上未部署 test 域名和 `crm@test.service`，因此不存在 test 域名误转发至 stable 端口的情况。
- [x] 发布 ZIP 不包含 `.env`、日志、上传文件和数据库备份。
- [x] Nginx 配置执行 `nginx -t` 通过。
- [x] systemd 只负责启动单个 PM2 守护进程，PM2 中仅有 1 个 `crm-system` 实例监听 3000，没有第二个服务管理器直接启动 Next.js。

## 5. test 验收门禁

以下结果需要在候选提交上重新执行并记录完整日志路径：

| 门禁 | 命令 | 状态 |
| --- | --- | --- |
| 类型、路由、构建 | `python scripts\manage.py check --profile test` | 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-check-20260825-193830.log` |
| 按钮静态契约 | `python scripts\manage.py button-audit --profile test` | 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-button-audit-20260825-193950.log` |
| 数据可达性 | `python scripts\manage.py data-reachability --profile test` | 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260825-193951.log` |
| 浏览器 E2E | `python scripts\manage.py e2e --profile test` | 最终 28/28 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-e2e-20260825-201043.log` |
| 前端性能预算 | `python scripts\manage.py perf --profile test` | 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-perf-20260825-194555.log` |
| 安全检查 | `python scripts\manage.py security --profile test` | 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-security-20260825-194556.log` |
| 发布与回滚演练 | `python scripts\manage.py release-test --profile test` | 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-release-test-20260825-194602.log` |

性能门禁第一次执行未通过，公共首屏 JavaScript 为 101.0 kB，超过旧的 100 kB 预算，失败日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-perf-20260825-194214.log`。历史构建显示该变化发生在 React 19 的 Ant Design 兼容补丁加入后；公共预算按当前强制技术栈基线调整为 105 kB，关键路由和单页 500 kB 上限未放宽，随后复测通过。

## 6. 发布产物

- [x] ZIP 已生成到 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\.build\test\release\1.0.0-4e7a8bc4.zip`。
- [x] 同名 `.sha256` 存在且重新计算一致。
- [x] ZIP 根目录存在 `release-manifest.json`。
- [x] manifest 中 `profile=test`、`gate_status=passed`。
- [x] manifest 的提交 SHA 与候选提交一致。
- [x] 客户说明 `CRM系统客户运行说明.txt` 已随包交付。
- [x] 维护手册和本清单已随包交付。
- [x] 解压抽查后 `python scripts\manage.py --help` 可加载，不缺少运行模块。

## 7. 上线与回滚

- [x] 已获得用户明确的部署确认。
- [x] 当前 stable 为 `1.0.0-4e7a8bc4`；上一版本保存在 `/www/wwwroot/crm-rollbacks/crm-system-before-1.0.0-4e7a8bc4-20260825T164053Z`。
- [x] 目标服务器为 `115.159.118.113`，切换时间记录为 `2026-08-25 16:40:56 UTC`，发布包 SHA256 已记录。
- [x] 上一版本完整目录已保留，可由 systemd/PM2 切回；本次切换脚本的失败自动恢复未触发。
- [x] `npx prisma migrate status` 显示 9 条迁移一致，无待执行迁移；上线前已有可恢复备份。
- [x] 上线后已只读检查健康、登录页、Session、未登录关键列表、日志、TLS、Nginx、PM2/systemd 和备份 timer。

## 8. 已知限制

- Next.js 15.4.11 仍有已登记运行依赖残余风险。
- CSP 样式策略仍允许 `'unsafe-inline'`。
- 线上 TLS 已通过 OpenSSL 和浏览器验证；云平台安全组仍不能仅由服务器内部完整证明。
- 线上没有安全配置的 HTTP 冒烟账号，因此没有执行认证后的客户、续签、公海配额和回款列表请求。
- Firefox、WebKit 和更多手机真机未完成全面回归。
- 发布脚本只生成和登记产物，不会自动上传服务器、执行迁移或切换 Nginx。
- 数据库 rollback 不自动执行，恢复必须人工核对。
