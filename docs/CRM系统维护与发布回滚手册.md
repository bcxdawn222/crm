# CRM 系统维护与发布回滚手册

更新日期：2026 年 8 月 25 日

适用项目目录：`D:\Desktop\CRM系统代码 (2)\CRM系统代码`

服务器默认目录：`/www/wwwroot/crm-system`

## 1. 系统组成

系统使用 Next.js 15.4.11、React 19.1.1、TypeScript、Ant Design、NextAuth、Prisma 5 和 MySQL/MariaDB。浏览器通过 Nginx 访问 Next.js 服务，业务数据写入 MySQL/MariaDB，上传文件写入各 profile 独立的存储目录。

主要运行层如下：

| 层级 | 作用 | 主要位置 |
| --- | --- | --- |
| Web 页面与 API | 页面、认证、权限、业务接口 | `src/` |
| 数据模型 | Prisma schema 和迁移 | `prisma/` |
| 运行管理 | 启停、检查、构建、测试和发布 | `scripts/manage.py` |
| 发布管理 | ZIP、SHA256、promote 和 rollback 状态 | `scripts/release.py` |
| 服务器模板 | Nginx、PM2、systemd、数据库备份 | `scripts/deploy/` |
| 日志 | 每次管理命令和服务日志 | `logs/<profile>/` |

## 2. stable 与 test 隔离

stable 用于正式业务，test 只用于验收。两者必须使用不同资源：

| 项目 | stable 默认值 | test 默认值 |
| --- | --- | --- |
| 应用端口 | 3000 | 3001 |
| 数据库变量 | `CRM_STABLE_DATABASE_URL` | `CRM_TEST_DATABASE_URL` |
| 认证密钥 | `CRM_STABLE_NEXTAUTH_SECRET` | `CRM_TEST_NEXTAUTH_SECRET` |
| 认证地址 | `CRM_STABLE_NEXTAUTH_URL` | `CRM_TEST_NEXTAUTH_URL` |
| 上传目录 | `storage/stable` 或独立绝对路径 | `storage/test` 或独立绝对路径 |
| 日志目录 | `logs/stable` | `logs/test` |
| PID 与锁 | `.runtime/stable` | `.runtime/test` |
| 发布目录 | `.build/stable` | `.build/test` |

`test` 缺少独立数据库或独立认证密钥时，管理脚本会拒绝运行。自动化测试只允许使用 test 数据库，并检查数据库名以 `_test` 结尾。不得把线上数据库复制到 `CRM_TEST_DATABASE_URL` 后运行测试。

环境变量模板位于 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\.env.example`。真实 `.env` 和 `.env.local` 不进入 Git 和发布包。

## 3. Windows 日常操作

在项目根目录 `D:\Desktop\CRM系统代码 (2)\CRM系统代码` 打开 PowerShell 或命令提示符。客户侧命令使用系统已安装的 Python，不要求安装 `uv`。

查看状态：

```text
python scripts\manage.py status --profile stable
```

生产模式启动：

```text
python scripts\manage.py start --profile stable --mode production
```

停止：

```text
python scripts\manage.py stop --profile stable
```

执行路由、类型和生产构建检查：

```text
python scripts\manage.py check --profile stable
```

每次命令都会在 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\` 生成 `manage-动作-时间.log`。服务运行日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\server.log`。

重复启动同一 profile 会返回非零退出码，不会再启动第二个实例。若状态显示 `port_conflict`、`foreign_pid` 或 `corrupt`，先检查占用端口的进程，不要直接删除 PID 文件或结束不明进程。

## 4. Linux 服务器运行

服务器默认项目目录为 `/www/wwwroot/crm-system`。PM2 与 systemd 二选一，不要同时管理同一个端口。

PM2 模板：`/www/wwwroot/crm-system/scripts/deploy/ecosystem.config.mjs`

systemd 模板：`/www/wwwroot/crm-system/scripts/deploy/crm@.service`

Nginx 模板：`/www/wwwroot/crm-system/scripts/deploy/nginx-crm-system.conf`

Nginx 当前将正式域名转发到 `127.0.0.1:3000`，将 test 域名转发到 `127.0.0.1:3001`。修改域名后必须执行 `nginx -t`，通过后才能 reload。

systemd 使用 `/etc/crm-system/stable.env` 和 `/etc/crm-system/test.env` 注入敏感配置。环境文件权限应限制为服务账号和管理员可读。服务启动后会请求 `/api/health`，健康检查失败时 systemd 会按重启策略处理。

## 5. 健康与日志检查

基础健康接口：

```text
GET /api/health
```

返回内容包括版本、提交、profile、运行时长和数据库状态。深度健康检查还会检查存储和迁移名称，必须使用服务器配置的受保护凭据，不能开放给匿名访问。

排查顺序：

1. 执行 `python scripts\manage.py status --profile stable`，确认实例和端口状态。
2. 查看 `logs/stable/server.log` 和最近的 `logs/stable/manage-*.log`。
3. 请求 `/api/health`，记录响应中的版本、提交和 `requestId`。
4. 检查 Nginx error log、PM2 或 systemd 状态。
5. 检查数据库端口和磁盘剩余空间。

API 未知异常只向浏览器返回通用错误和 `requestId`，完整错误保留在服务日志。排查时使用同一个 `requestId` 查找对应日志，避免只依据页面提示修改数据。

## 6. 按钮契约与数据可达性

按钮验收不是只看页面提示。每个有效动作至少核对以下证据：

- 页面入口和权限是否正确；
- handler 是否发出约定的 HTTP 方法和接口；
- 成功后数据库状态是否符合业务规则；
- 关键写操作是否产生操作者、时间、`requestId` 和前后摘要；
- 失败时是否明确提示，且没有半成品数据或孤立文件。

test 静态入口：

```text
python scripts\manage.py button-audit --profile test
python scripts\manage.py data-reachability --profile test
python scripts\manage.py permission-matrix --profile test
```

按钮级浏览器验收入口：

```text
python scripts\manage.py e2e --profile test
```

最近一次报告位于 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\Playwright按钮级验收.md`。该报告只证明本地 test 环境，不代表线上 TLS、云防火墙和备份介质已经核对。

## 7. 性能预算

当前门禁包括：

- 公共首屏 JavaScript 不超过 100 kB；
- 单页面 First Load JS 不超过 500 kB；
- API p95 不超过 2000 ms；
- 单请求 Prisma 查询数不超过 20；
- 列表和提醒单次返回不超过 100 行；
- 压力测试 HTTP p95 小于 1500 ms、失败率小于 1%；
- 服务重启后 30 秒内恢复；
- 数据库连接峰值不超过 50。

执行 test 性能门禁：

```text
python scripts\manage.py perf --profile test
python scripts\manage.py api-perf --profile test
python scripts\manage.py stability --profile test
```

详细结果位于：

- `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\前端性能预算.md`
- `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\前端运行时性能.md`
- `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\API与数据库性能.md`
- `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\稳定性与压力测试.md`

## 8. 数据库备份

服务器备份脚本为 `/www/wwwroot/crm-system/scripts/deploy/backup_database.py`，systemd timer 每天北京时间 03:20 触发，默认保留 14 天。脚本使用 `mariadb-dump`、单事务、gzip 压缩，并在完成后验证压缩文件可读取。

默认配置：

- 环境文件：`/root/.config/crm-system/migrate.env`
- 备份目录：`/root/crm-backups`
- 备份日志：`/www/wwwroot/crm-system/logs/database-backup.log`
- 最低剩余空间：512 MB

检查 timer：

```text
systemctl status crm-db-backup.timer
systemctl list-timers crm-db-backup.timer
```

手动备份：

```text
systemctl start crm-db-backup.service
journalctl -u crm-db-backup.service -n 100 --no-pager
```

备份成功的最低证据包括：命令退出码为 0、生成新的 `.sql.gz`、压缩包可读取、日志记录文件大小。只有“文件存在”不能证明备份可恢复。

## 9. 数据库恢复

系统不会在代码 rollback 时自动回滚数据库，也不会删除业务数据。数据库恢复属于高风险人工操作，仅在确认迁移不向前兼容或数据损坏时执行。

恢复前必须：

1. 停止写入流量，并保留当前数据库的新备份。
2. 核对目标备份的数据库名、时间、大小和 gzip 完整性。
3. 优先恢复到临时数据库并执行只读核对。
4. 记录操作人、开始时间、目标备份和恢复结果。

示例命令中的数据库名必须替换为实际目标，且不能直接对未知线上库执行：

```text
gzip -t /root/crm-backups/<backup>.sql.gz
gzip -dc /root/crm-backups/<backup>.sql.gz | mariadb --protocol=tcp -h 127.0.0.1 -u <user> -p <temporary_database>
```

当前仓库提供自动备份脚本，但没有自动数据库恢复脚本。恢复步骤需在实际服务器上人工验证，这是已登记限制。

## 10. 发布流程

发布前只在完整源码工作区的 test profile 执行门禁。部署 ZIP 不包含 E2E 和质量测试脚本，不能用服务器解压目录代替发布前源码验收：

```text
python scripts\manage.py check --profile test
python scripts\manage.py button-audit --profile test
python scripts\manage.py data-reachability --profile test
python scripts\manage.py e2e --profile test
python scripts\manage.py perf --profile test
python scripts\manage.py security --profile test
python scripts\manage.py release-test --profile test
```

工作区必须没有未提交改动，然后生成 test 发布包：

```text
python scripts\manage.py release --profile test
```

产物写入 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\.build\test\release\`，包括 ZIP 和同名 SHA256。ZIP 内的 `release-manifest.json` 记录版本、完整提交 SHA、构建时间、迁移哈希和文件清单。

发布包不包含 `.env`、日志、上传文件、数据库备份、Playwright 登录状态或测试截图。解压到服务器后仍需安装 package-lock 中的依赖，并由服务器环境文件注入密钥和数据库连接。

## 11. promote 与 rollback

`promote` 只接受通过 SHA256 检查、且 manifest 中 `profile=test`、`gate_status=passed` 的 test 产物。该命令只登记和复制发布产物，不会自动上传服务器、切换 Nginx、执行数据库迁移或重启线上服务。

必须经用户明确确认后执行：

```text
python scripts\manage.py promote --profile stable --artifact <test发布包绝对路径>
```

`rollback` 只允许切回记录中的上一 stable 发布产物：

```text
python scripts\manage.py rollback --profile stable --artifact <上一发布包绝对路径>
```

回滚后仍需由运维人员把目标产物部署到服务器并重启服务。数据库不会自动回退；若旧代码不能读取当前 schema，应停止回滚并按数据库恢复流程处理。

## 12. 上线后只读验收

上线后不运行会创建、修改或删除业务数据的自动化测试。只读检查包括：

- `/api/health` 返回 200，版本、提交和 profile 正确；
- 登录页面可打开，授权账号可登录；
- 客户、订单、回款等关键列表可读取；
- Nginx、应用和数据库日志没有持续新增错误；
- stable 端口、数据库和上传目录未指向 test；
- 最近一次数据库备份任务仍正常。

## 13. 已知限制与未验证范围

- 项目规则固定使用 Next.js 15.4.11。依赖审计仍登记 Next.js 运行依赖残余风险，不能表述为零风险。
- Content Security Policy 为兼容 Ant Design CSS-in-JS，样式策略仍允许 `'unsafe-inline'`。
- 自动化浏览器主要覆盖 Chromium Desktop 和 390px Chromium Mobile；Firefox、WebKit 和更多真机尚未完整覆盖。
- 当前性能数据来自本地 test 小数据量环境，不等同于线上大数据量峰值结果。
- Nginx TLS、云防火墙、数据库最小权限、备份介质权限和对象存储策略必须在实际服务器核对。
- 发布脚本不会自动部署到远程服务器，也不会自动执行数据库恢复。
- Spec 流程要求独立验证者，但本项目禁止使用子智能体；本轮验证由主智能体执行并保留命令日志，不属于独立上下文复核。
