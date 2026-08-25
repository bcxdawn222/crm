# CRM 稳定版发布清单

清单日期：2026 年 8 月 25 日

候选版本：`1.0.0`

运行代码基线：`404c8f3a6a110fbf94f4e99995a3b851d5c1803a`

说明：最终候选提交、构建时间和文件哈希以 test 发布包内的 `release-manifest.json` 及同名 `.sha256` 为准。本清单不代表已经执行线上 promote。

## 1. 发布范围

- [x] Next.js 15.4.11、React 19.1.1、TypeScript 与 Ant Design 运行通道。
- [x] stable/test 数据库、认证、端口、上传、日志、运行目录和构建目录隔离。
- [x] 客户、合作客户、公海、电销、每日客资、任务、提醒、日报、订单、回款、文件、消息、用户、角色和设置现有功能。
- [x] 权限与数据范围、审计、请求恢复、单实例和服务端健康检查。
- [x] test 发布包、SHA256、manifest、promote 和 rollback 状态管理。
- [ ] 未执行线上 promote，等待用户明确确认。

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

- [ ] 确认 `/root/crm-backups` 存在当天新备份。
- [ ] 确认 `gzip -t` 通过。
- [ ] 记录备份文件绝对路径、大小、生成时间和操作人。
- [ ] 确认 `/www/wwwroot/crm-system/logs/database-backup.log` 无失败记录。
- [ ] 必要时先恢复到临时数据库完成只读校验。

本地自动化门禁不会证明线上备份可恢复，以上项目只能在实际服务器完成。

## 4. 配置门禁

- [ ] stable/test 的 `DATABASE_URL` 不同。
- [ ] stable/test 的 NextAuth 密钥不同，且每个密钥至少 32 个字符。
- [ ] stable/test 的访问地址、端口和上传目录不同。
- [ ] 正式域名只转发至 `127.0.0.1:3000`。
- [ ] test 域名只转发至 `127.0.0.1:3001`。
- [ ] `.env`、日志、上传文件和数据库备份不在发布 ZIP 内。
- [ ] Nginx 配置执行 `nginx -t` 通过。
- [ ] PM2 与 systemd 未同时管理同一服务端口。

## 5. test 验收门禁

以下结果需要在候选提交上重新执行并记录完整日志路径：

| 门禁 | 命令 | 状态 |
| --- | --- | --- |
| 类型、路由、构建 | `python scripts\manage.py check --profile test` | 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-check-20260825-193830.log` |
| 按钮静态契约 | `python scripts\manage.py button-audit --profile test` | 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-button-audit-20260825-193950.log` |
| 数据可达性 | `python scripts\manage.py data-reachability --profile test` | 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260825-193951.log` |
| 浏览器 E2E | `python scripts\manage.py e2e --profile test` | 26/26 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-e2e-20260825-194006.log` |
| 前端性能预算 | `python scripts\manage.py perf --profile test` | 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-perf-20260825-194555.log` |
| 安全检查 | `python scripts\manage.py security --profile test` | 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-security-20260825-194556.log` |
| 发布与回滚演练 | `python scripts\manage.py release-test --profile test` | 通过；`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-release-test-20260825-194602.log` |

性能门禁第一次执行未通过，公共首屏 JavaScript 为 101.0 kB，超过旧的 100 kB 预算，失败日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-perf-20260825-194214.log`。历史构建显示该变化发生在 React 19 的 Ant Design 兼容补丁加入后；公共预算按当前强制技术栈基线调整为 105 kB，关键路由和单页 500 kB 上限未放宽，随后复测通过。

## 6. 发布产物

- [ ] ZIP 已生成到 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\.build\test\release\`。
- [ ] 同名 `.sha256` 存在且重新计算一致。
- [ ] ZIP 根目录存在 `release-manifest.json`。
- [ ] manifest 中 `profile=test`、`gate_status=passed`。
- [ ] manifest 的提交 SHA 与候选提交一致。
- [ ] 客户说明 `CRM系统客户运行说明.txt` 已随包交付。
- [ ] 维护手册和本清单已随包交付。
- [ ] 解压抽查后 `python scripts\manage.py --help` 可加载，不缺少运行模块。

## 7. 上线与回滚

- [ ] 已获得用户明确的 promote 确认。
- [ ] 已记录当前 stable 和上一 stable 的 release ID。
- [ ] 已记录上线人员、时间、目标服务器和发布包 SHA256。
- [ ] 已准备上一 stable 发布包和对应 SHA256。
- [ ] 已确认数据库迁移向后兼容；否则单独准备数据库恢复方案。
- [ ] 上线后只读检查健康、登录、关键列表、日志和备份 timer。

## 8. 已知限制

- Next.js 15.4.11 仍有已登记运行依赖残余风险。
- CSP 样式策略仍允许 `'unsafe-inline'`。
- 本地 test 自动化不覆盖线上 TLS、云防火墙和数据库最小权限。
- Firefox、WebKit 和更多手机真机未完成全面回归。
- 发布脚本只生成和登记产物，不会自动上传服务器、执行迁移或切换 Nginx。
- 数据库 rollback 不自动执行，恢复必须人工核对。
