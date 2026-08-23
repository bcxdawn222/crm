# Verification Ledger: crm-comprehensive-quality-optimization

---
round: 0
conclusion: fail
---

## Round 0 - proposal critique

> 受项目“禁止子智能体”约束，本轮未派发独立批评智能体；由主智能体分别按 necessity 和 regression-compat 两个固定视角审查，不能视为独立复核。

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-1 | necessity | major | fixed(r0) | 如果先做全量视觉重构，mock 和死按钮仍会被包装成更完整的假功能 | tasks 先建立按钮契约并修真实数据链路，UI 验收要求与按钮和数据证据共同通过 |
| V-2 | necessity | major | fixed(r0) | 把 Next.js/React 升级直接绑定稳定版发布会扩大本次质量修复的必要范围 | design 与 tasks 将升级限定在 test，必须完整回归后才能 promote |
| V-3 | necessity | critical | open | 当前没有 Git，无法执行每个一级任务的独立提交与回退 | research DEC-12 和 tasks 1.2 将初始化 Git 作为 HARD GATE 决策；用户拒绝时只能明确放弃该验收项 |
| V-4 | regression-compat | critical | open | 当前有三个未归档 Spec，其中一个仍缺 HTTP 冒烟，直接运行 apply 可能选错活动变更或掩盖未完成验证 | research DEC-13 和 tasks 1.1 要求 apply 前处理旧 Spec，但本轮未擅自归档 |
| V-5 | regression-compat | critical | fixed(r0) | 按钮 E2E 和性能测试若复用稳定数据库，会污染客户、订单、回款和上传文件 | design 强制 stable/test 分离数据库与上传目录，tasks 1 和 8 禁止稳定数据作为测试夹具 |
| V-6 | regression-compat | major | fixed(r0) | 页面拆分和统一请求层可能遗漏字段、改变错误语义或重复提交写操作 | tasks 5 要求字段快照，tasks 9 禁止非幂等写自动重试，tasks 15 用真实浏览器和数据库断言回归 |

### Round 0 conclusion

- Proposal、design 和 tasks 已覆盖用户指定的八类 CRM 优化范围，并明确排除原第 9、10、11 项。
- V-3 与 V-4 需要在 HARD GATE 由用户确认或接受其限制，因此当前结论为 `fail`，不能进入实施。
- 本轮只生成 Spec 文档，没有修改业务代码、数据库或线上环境。

## Apply working evidence - 2026-08-23

- `python scripts\manage.py typecheck --profile stable`：退出码 0。
- `python scripts\manage.py runtime-test --profile stable`：退出码 0，test profile 复用 stable 数据库时被明确拒绝。
- `python scripts\manage.py build --profile stable`：退出码 0；新增 `/api/health` 与消息 API 进入路由表，构建不再输出 `Dynamic server usage` 堆栈。
- `python scripts\manage.py button-audit --profile stable`：退出码 1，当前仍有文件 mock 和提醒假跟进 3 项，未宣称通过。
- `python scripts\manage.py data-reachability --profile stable`：退出码 1，`localhost:3306` 连接超时，数据库级验收仍被阻塞。
- Git 已初始化为 `main`，数据库备份、上传文件、临时渲染、截图和 `__pycache__` 已从索引排除，磁盘原文件未删除。

## Apply working evidence - 2026-08-23 18:41

- `python scripts\manage.py typecheck --profile stable`：退出码 0；Prisma Client 生成和 TypeScript 检查均通过。
- `python scripts\manage.py routes --profile stable`：退出码 0；路由契约静态检查通过。
- `python scripts\manage.py button-audit --profile stable`：退出码 0；当前页面未发现 mock 标识或仅提示型跟进动作。
- 文件共享页已改为读取 `/api/files`，上传调用 `POST /api/files`，下载调用 `GET /api/files/:id`，删除调用 `DELETE /api/files/:id`；服务端包含文件类型、大小、路径约束、权限校验和 `AuditEvent` 记录。
- 消息中心已改为读取真实 `/api/messages`，单条已读、全部已读和删除均调用对应 Route Handler；用户管理页已移除当前没有真实保存契约的编辑/删除控件。
- 提醒页的跟进类按钮现在只跳转到客户入口，不再显示“正在跟进”的假成功提示；真正创建跟进记录及时间线同步仍未完成。
- `python scripts\manage.py data-reachability --profile stable`：退出码 1；`localhost:3306` 当前不可达，因此上述文件、消息和权限行为尚未完成数据库级验证。

## Apply working evidence - 2026-08-23 18:47

- 新增 `src/lib/http/client.ts`：统一处理 `x-request-id`、超时、取消、离线状态、401 跳转、结构化 `ApiError`、GET 一次有限重试，以及带 `requestKey` 的重复请求保护。
- 文件、消息、提醒三个页面已接入统一请求层；写操作未启用自动重试，并为上传、删除、已读和提醒开关设置了请求键。
- `python scripts\manage.py typecheck --profile stable`：退出码 0。
- `python scripts\manage.py build --profile stable`：退出码 0；构建输出显示 Next.js `14.2.35`，本轮未执行 Next.js 15.4/React 19 升级。
- `python scripts\manage.py button-audit --profile stable`：退出码 0。
- `python scripts\manage.py runtime-test --profile stable`：退出码 0。

## Apply working evidence - 2026-08-23 18:50

- 新增全局 `NetworkStatusBanner` 和 `useNetworkStatus`：离线时提示只读数据暂时不可更新，恢复时提示手动核对数据；未确认写操作不会由该层自动重放。
- `python scripts\manage.py typecheck --profile stable`：退出码 0。
- `python scripts\manage.py build --profile stable`：退出码 0；构建输出仍为 Next.js `14.2.35`，首页 First Load JS 约 `623 kB`。
- `python scripts\manage.py button-audit --profile stable`：退出码 0。
- 9.5 仍未完全完成：其他页面尚未全部接入统一请求层，恢复网络后的只读数据重新拉取和长时间会话测试待后续实现。

## Apply working evidence - 2026-08-23 18:53

- 单实例锁已调整为服务启动前原子创建，锁内容包含 profile、PID、端口和项目根目录；陈旧锁可清理，活跃锁会拒绝第二次启动。
- 停止服务前会读取进程命令行并确认其包含当前 CRM 项目根目录及 Node/Next/npm 标识；无法确认归属时拒绝终止，避免 PID 复用误杀其他进程。
- `python scripts\manage.py runtime-test --profile stable`：退出码 0；临时目录中的同 profile 重复加锁测试通过。
- `scripts/runtime/manager.py` 当前 278 行，进程识别逻辑位于 `scripts/runtime/process_identity.py`，57 行。
- `python scripts\manage.py typecheck --profile stable`：退出码 0。
- 11.2、11.3、11.4、11.5、11.6 尚未完全完成；当前没有启动真实服务做双启动、端口归属和 PM2/systemd 演练。

## Apply working evidence - 2026-08-23 18:56

- `/api/health` 现在支持浅检查和 `?deep=1` 深检查：返回 `status`、`profile`、`version`、`commit`、`uptimeSeconds`、数据库、存储和 `requestId`；深检查要求登录，健康检查不写入业务数据。
- `/api/health` 已加入公开路由，避免监控探针被登录页重定向；数据库不可达时仍返回 HTTP `503` 和明确的 `degraded` 状态。
- `python scripts\manage.py routes --profile stable`：退出码 0。
- `python scripts\manage.py build --profile stable`：退出码 0。
- `python scripts\manage.py typecheck --profile stable`：串行执行退出码 0。此前与 build 并发执行时因共享 `.next/types` 出现 `TS6053`，该结果归因于验证命令并发冲突，不是代码错误。
- 迁移状态和真实 HTTP 健康探针尚未在数据库/服务进程可用环境下执行。

## Apply working evidence - 2026-08-23 19:00

- 提醒页跳转的 `/customers?id=<customerId>` 已接入客户页：客户页挂载后读取地址参数，调用真实 `GET /api/customers/:id`，加载成功后打开现有客户窗口；不存在或无权限时明确显示接口错误。
- `python scripts\manage.py typecheck --profile stable`：退出码 0。
- `python scripts\manage.py button-audit --profile stable`：退出码 0。
- 首次构建因 Next.js 14 的 `useSearchParams()` 缺少 `Suspense` 边界退出码 1；改为客户端挂载后读取 URL 参数后，`python scripts\manage.py build --profile stable` 退出码 0。
- 当前仍未新增跟进记录 Route Handler，因此“提交跟进并同步提醒状态/客户时间线”不宣称完成。

## Apply working evidence - 2026-08-23 19:04

- `python scripts\manage.py dbstatus --profile stable`：退出码 0，`localhost:3306` 网络端口可达；这不等于 Prisma 认证成功。
- `python scripts\manage.py start --profile stable`：退出码 0，启动 stable PID `68360`，端口 `3000` 监听。
- `python scripts\manage.py smoke --profile stable`：退出码 1，真实登录失败；服务日志显示 Prisma 连接使用 `root` 数据库账号时认证失败，未执行业务写入。
- `GET http://127.0.0.1:3000/api/health`：返回 HTTP `503`，`status=degraded`、`database=unreachable`，没有泄露连接密码。
- `python scripts\manage.py stop --profile stable`：退出码 0；通过进程树中的项目路径识别后停止整棵服务进程树。
- 停止后的 `python scripts\manage.py status --profile stable`：退出码 0，PID 不存在、端口未监听、锁文件已清理。
- 单实例进程树校验第一次实现曾出现父 PID 自循环，已修复并通过 `python scripts\manage.py runtime-test --profile stable`；当前 `scripts/runtime/process_identity.py` 为 64 行。

## Apply working evidence - 2026-08-23 19:40

- `python scripts\manage.py dbstatus --profile stable`：退出码 0，MySQL 服务端口 `localhost:3306` 可达。
- `python scripts\manage.py data-reachability --profile stable`：现在已执行真实 Prisma `SELECT 1`，退出码 1；错误为数据库服务器拒绝 `root` 凭据。
- 连接结构检查显示 `.env.local` 的 `DATABASE_URL` 中 `@` 数量为 2。当前连接串存在未编码的额外 `@`，密码中的特殊字符应使用 URL 编码，例如 `@` 写成 `%40`；密码本身仍需使用 MySQL 实际密码，不能凭猜测替换。
- 这次检查排除了“端口未开”和“脚本未连接 Prisma”两个误判，当前阻塞明确为 `DATABASE_URL` 凭据或格式错误。

## Apply working evidence - 2026-08-23 21:52

- 已确认本地 MySQL 账号认证通过，连接目标为新建的 `crm_system` 数据库；没有修改现有 `crm_db`。
- `python scripts\manage.py migrate --profile stable`：退出码 0，7 个 Prisma migration 全部成功应用，包含 `_prisma_migrations` 状态表和 `AuditEvent` 表。
- `python scripts\manage.py data-reachability --profile stable`：退出码 0；数据库网络可达，Prisma `SELECT 1` 探针通过。
- `python scripts\manage.py audit-data --profile stable`：退出码 0；迁移状态已应用 7 个，孤立客户销售为 0、孤立订单客户为 0、负回款为 0。当前数据库为空业务库，因此这些一致性检查的样本量为 0，不能替代业务写入后的验收。
- 原阻塞处理方式：先修正本地 profile 使用的数据库连接目标并创建与 Prisma schema 对应的 `crm_system`，再通过项目脚本执行 `prisma migrate deploy`；不能把结构不兼容的旧 `crm_db` 直接当作当前 CRM 数据库。
- 当前剩余范围：尚未在 test 数据库准备最小业务夹具，也尚未完成页面按钮到 API、数据库行、审计事件和文件对象的全链路写入验收，因此任务 8 仍保持未完成。
- 新增 `python scripts\manage.py migrate --profile stable` 和 `python scripts\manage.py seed --profile stable` 入口；种子脚本不再把管理员密码写入日志。
- 使用种子数据后，`python scripts\manage.py start --profile stable`、`python scripts\manage.py smoke --profile stable`、`python scripts\manage.py stop --profile stable` 和最终 `status` 均退出码 0；HTTP 冒烟已完成管理员登录验证，停止后端口未监听、PID 不存在、锁已清理。

## Apply working evidence - 2026-08-23 22:10

- 新增 test 数据库初始化入口 `python scripts\manage.py dbinit-test --profile test`；当 `DATABASE_URL` 被 manage 注入为 test 连接时，profile 隔离校验仍以文件中的 stable 连接为准，不会把 test 误判为 stable。
- `crm_system_test` 已独立创建并通过 7 个 Prisma migration、种子初始化和 `python scripts\manage.py data-reachability --profile test`。
- 修正 stable/test 的 `NEXTAUTH_URL` 隔离：stable 默认使用 3000，test 默认使用 3001，也支持 `CRM_STABLE_NEXTAUTH_URL` 和 `CRM_TEST_NEXTAUTH_URL` 覆盖。此前 test 登录回调误指向 3000，导致 HTTP 连接被拒绝。
- 新增 `python scripts\manage.py data-flow --profile test`：真实登录后创建客户、读取客户详情、创建订单、登记回款，并直接核对数据库金额 `1000.00 / 250.00 / 750.00` 和 3 条 `AuditEvent`；唯一标记的 test 夹具已自动清理。
- `python scripts\manage.py data-flow --profile test`：退出码 0；test 服务启动、停止和最终状态检查均退出码 0。stable/test 数据库中均未残留本轮测试标记数据。
- stable 回归：`data-reachability`、`typecheck`、`build`、`start`、`smoke`、`stop`、`status` 均退出码 0；构建输出仍为当前仓库已有的 Next.js 14.2.35，本轮没有执行框架升级。
- 将回款列表的 Prisma 条件从 `any` 改为 `Prisma.PaymentWhereInput`，并将路由契约检查从 `scripts/manage.py` 拆出；Python 语法、路由检查、TypeScript 类型检查和生产构建均通过。
- 当前未覆盖：跟进记录没有独立写入 Route Handler，文件、消息、导入、转移、公海、权限矩阵和 Playwright 按钮级全量验收仍不能宣称完成。
