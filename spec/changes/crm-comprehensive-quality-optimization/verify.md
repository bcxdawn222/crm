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

## Apply working evidence - 2026-08-23 22:36

- 新增 `POST /api/customers/:id/follow-ups`：校验跟进方式、内容、权限、客户数据范围和计划跟进状态；新增或完成跟进均与客户 `lastFollowUpAt`、`nextFollowUpAt` 更新放在同一事务，并写入 `AuditEvent`。
- 客户页新增共享跟进弹窗和跟进记录展示；提醒中心的“立即跟进”“联系续签”“开始跟进”现在直接打开跟进表单，计划跟进会更新原记录为已完成并刷新提醒列表。
- `python scripts\manage.py data-flow --profile test`：退出码 0；客户、跟进、订单、回款均写入并读回，数据库核对金额 `1000.00 / 250.00 / 750.00`，审计事件数量为 4，test 夹具已清理。
- Playwright 真实浏览器验收：登录 test 服务后，从客户页新增客户、打开“新增跟进”、提交内容，页面列表立即显示跟进数为 1 和最近跟进时间；浏览器验收客户及跟进记录随后已清理。
- `python scripts\manage.py typecheck --profile stable`、`routes`、`button-audit`、`build`：均退出码 0；构建产物包含 `/api/customers/[id]/follow-ups`。
- 修复跟进弹窗的 Ant Design `destroyOnClose` 弃用警告，并修复侧边栏客户管理父菜单与子菜单重复 key。Playwright 环境在 Windows 上无法使用 Bash wrapper，因为系统未安装 WSL 发行版，改用同一 `@playwright/cli` 的 `npx` 入口完成验证。
- 当前未覆盖：文件、消息、导入、转移、公海、权限矩阵和 Playwright 全量按钮验收仍不能宣称完成。

## Apply working evidence - 2026-08-24 12:28

- 新增 `python scripts\manage.py content-flow --profile test`，真实执行 PDF 上传、磁盘对象检查、`File` 数据库记录检查、下载内容与下载次数检查、文件删除、消息列表、单条已读、全部已读、消息删除和审计动作检查。
- 消息单条已读、全部已读和删除接口现在统一回传 `x-request-id`，错误写入服务端日志；业务更新和 `MESSAGE_READ`、`MESSAGE_READ_ALL`、`MESSAGE_DELETED` 审计记录位于同一 Prisma 事务。
- 首次 `data-flow` 返回 HTTP 500，服务日志记录交互事务超过 5 秒；再次执行时登录失败，随后 `data-reachability` 和端口检查确认本地 `3306` 已无监听。通过项目既有 direct 模式重新启动本地 MySQL 后，`data-reachability`、`data-flow` 均退出码 0，说明阻塞来自数据库进程退出，而不是通过放宽断言绕过。
- `python scripts\manage.py content-flow --profile test` 修复前退出码 1，明确失败于“单条已读响应缺少 x-request-id”；修复后连续两次退出码 0，文件与消息审计动作符合预期，测试文件、消息、文件元数据和本轮审计夹具已清理。
- `python scripts\manage.py typecheck --profile stable`、`routes`、`button-audit`、`build` 均退出码 0；运行中执行 typecheck 曾因 Prisma 引擎 DLL 被 Next.js 占用而失败，停止 test 服务后串行复验通过。
- 当前未覆盖：导入、客户转移、公海、权限矩阵和 Playwright 全量按钮验收；任务 8 仍保持未完成。

## Apply working evidence - 2026-08-24 12:50

- 用户管理页已接入真实创建、编辑、停用和角色分配；新增 `/api/users/[id]`，用户与角色替换、状态变更和 `AuditEvent` 位于同一事务，当前登录账号不能停用或锁定自己。
- 用户列表与写入响应使用显式 Prisma select，不包含 `password`；创建或重置密码使用 bcrypt 哈希，审计快照也不记录密码内容。
- 新增 `python scripts\manage.py user-flow --profile test`。首次退出码 1，原因是现有数据库管理员拥有 `role:manage`，但种子权限漏建 `role:view`，导致角色列表 403；修正角色读取权限关系并补充种子定义后退出码 0。
- `user-flow` 已验证创建、重复创建 409、无重复行、编辑、角色替换、停用、密码非明文、列表不返回密码、`USER_CREATED`、`USER_UPDATED`、`USER_DISABLED` 审计动作和夹具清理。
- Playwright 真实按钮验收完成新增、编辑和停用。首次打开编辑弹窗时发现表单保留刚输入的明文初始密码；修复为每次打开先重置表单并清空密码后，复验编辑弹窗密码为空，编辑和停用均成功，页面控制台错误数为 0。
- 浏览器测试用户及对应审计记录已从 `crm_system_test` 清理，测试应用、MySQL 和 Playwright 会话均已停止。
- `python scripts\manage.py typecheck --profile stable`、`routes`、`button-audit`、`build` 均退出码 0；构建包含 `/api/users/[id]`。

## Apply working evidence - 2026-08-24 13:14

- 角色管理页已接入真实编辑弹窗和 `PATCH /api/roles/:id`；可更新显示名称、描述及权限集合，权限按模块分组展示，保存后重新读取列表。
- 角色更新、角色权限替换和 `ROLE_UPDATED` 审计记录位于同一 Prisma 事务；接口校验权限 ID 必须存在，内置 `admin` 角色必须保留数据库中的全部权限。
- 新增 `python scripts\manage.py role-flow --profile test`，退出码 0。测试在 `crm_system_test` 创建临时销售用户，验证普通销售直接修改角色返回 403、管理员移除权限返回 400、被拒绝请求不产生成功审计、旧 JWT 不会自动获得新增权限、重新登录后获得新增权限，并恢复销售角色原值、删除临时用户及本轮审计记录。
- Playwright 真实浏览器验收：管理员角色 46 个权限均选中且不可取消；销售角色显示名称和权限通过页面保存后，列表权限数由 24 更新为 25；随后通过同一页面恢复原显示名称和 24 项权限。
- 浏览器验收未产生新的角色管理控制台错误；已有登录页 `favicon.ico` 404、Ant Design `Card` 弃用警告和密码输入框 autocomplete 提示属于既存问题，不计为本任务通过项。
- 浏览器会话、test 应用和本地 MySQL 均已停止，`.playwright-cli` 临时产物已清理。
- `python scripts\manage.py typecheck --profile stable`、`routes`、`button-audit`、`build` 均退出码 0；生产构建包含 `/api/roles/[id]`，`/admin/roles` First Load JS 约 363 kB。

## Apply working evidence - 2026-08-24 13:32

- 系统设置已从前端默认值和假成功提示改为真实持久化：新增 `SystemSetting` 表，只允许 `systemName`、`companyName` 两个字段；新增迁移 `20260824132000_add_system_setting`，并提供同目录 `rollback.sql`。
- 新增 `GET/PUT /api/settings`。接口要求登录，读取允许 `setting:view` 或 `setting:update`，修改要求 `setting:update`；请求体使用严格白名单校验，未知字段返回 400；更新和 `SETTINGS_UPDATED` 审计记录位于同一 Prisma 事务。
- 新增 `python scripts\manage.py settings-flow --profile test`，首次执行发现未登录请求会被现有中间件按全站契约返回 307 登录跳转；测试已按实际认证行为精确断言，不修改中间件。第二次执行退出码 0：系统设置写入、重新读取、数据库值、审计记录、白名单拒绝和原值恢复均通过。
- Playwright 真实浏览器验收通过：登录后打开 `/admin/settings`，修改系统名称和公司名称，页面显示“设置保存成功”；刷新页面后两个字段仍回显修改值。随后已删除页面验收产生的设置记录和审计记录，测试库恢复为 `SystemSetting=0`、设置审计=0。
- `python scripts\manage.py typecheck --profile stable`、`routes`、`button-audit`、`build` 均退出码 0；生产构建包含 `/api/settings`，`/admin/settings` First Load JS 约 231 kB。
- 稳定库尚未执行 `prisma migrate deploy`，避免在未进入发布门禁前改变稳定数据库结构；迁移和回滚文件已提交，发布阶段需先备份再执行。

## Apply working evidence - 2026-08-24 13:40

- 审查发现 `src/app/(dashboard)/daily-leads/page.tsx` 的“转入我的客户”调用旧 `/api/customers/transfer`，旧接口没有复用公海认领配额、流转历史和串行化冲突保护。
- `/api/customers/transfer` 已改为复用 `handlePublicPoolClaim`，因此每日客资入口与公海页面入口使用同一客户认领规则、事务和审计动作。
- 新增 `python scripts\manage.py public-pool-flow --profile test`，退出码 0：创建客户、进入公海、重复归档 409、通过每日客资入口认领、重复认领 409、数据库状态、`ARCHIVED`/`CLAIMED` 流转历史和 `ARCHIVE_TO_PUBLIC_POOL`/`CLAIM` 审计均通过；测试客户和审计记录已清理。
- 本轮只完成公海进入/认领链路；客户转移其他场景、导入、合作客户更新、合同版本和批量重复写入仍未宣称完成。

## Apply working evidence - 2026-08-24 13:44

- `data-reachability` 已从单一 `SELECT 1` 扩展为只读数据质量报告：检查 Prisma 数据库探针、15 张核心业务表、各表数据量、10 类外键关联孤儿行、订单金额一致性和负回款。
- 首次执行因 Windows MySQL 的 `lower_case_table_names` 返回小写表名，脚本误报核心表缺失；修正为大小写无关比对后，发现 `Lead` 未转义导致 SQL 语法错误；修正为 `` `Lead` `` 后重新执行通过。这两次失败均为检查器问题，未修改业务数据。
- `python scripts\manage.py data-reachability --profile test`：退出码 0。测试库网络和 Prisma 探针通过；核心表 15 张；孤立用户角色、角色权限、客户销售、跟进、线索、订单、回款、文件、消息、合同均为 0；异常订单金额和负回款均为 0。
- 当前报告是数据库结构与数据质量门禁，不等同于全部页面按钮链路已完成；8.1 的多角色最小夹具、导入、合作客户、合同版本和批量重复写入仍待后续链路验收。

## Apply working evidence - 2026-08-24 13:49

- 数据范围审查发现：`buildDataFilter` 对没有 admin、finance、sales_manager、sales 角色的账号返回 `{}`，客户列表会把“没有声明范围”解释为全局访问；客户详情、更新和删除也只限制 `sales` 角色，其他自定义角色可绕过范围。
- 默认数据范围已改为空集合 `{ salesId: { in: [] } }`；客户列表对所有角色统一应用 `buildDataFilter`；客户详情、更新和删除统一调用 `canAccessSalesData`，不再只判断角色名是否为 `sales`。
- 新增 `python scripts\manage.py scope-flow --profile test`，退出码 0：临时创建只拥有 `customer:view` 的受限角色和用户，再创建管理员客户；受限用户列表中看不到该客户，直接详情 API 返回 403。临时角色、权限关系、用户、客户和审计记录均已清理。
- `python scripts\manage.py typecheck --profile stable`、`routes`、`button-audit`、`build` 均退出码 0。
- 本轮验证了受限自定义角色的客户列表与详情范围；经理下属层级、订单、回款、提醒、文件等模块的统一范围矩阵仍待任务 10 后续完成。

## Apply status - 2026-08-24 13:52

- 任务 7 的 7.1 至 7.8 已全部完成，一级任务“Mock 页面与死按钮修复”同步标记完成。
- 任务 8 已完成基础业务写入、文件/消息、用户、角色、设置、公海和受限客户范围等部分链路，以及只读数据库质量门禁；因导入、合作客户、合同版本、批量重复写入和完整多角色矩阵仍未完成，任务 8 保持未完成。

## Apply working evidence - 2026-08-24 15:00

- 客户导入从逐行写入改为先解析整批、校验全部行、检查文件内重复和数据库现有电话/邮箱冲突，再在单个 Prisma 事务中批量创建客户并记录 `CustomerImport` 审计；任一行非法时整批返回 400，不再保留已通过行形成半批数据。
- 导入限制已明确为 `.xlsx/.xls/.csv`、5 MB、1000 行；姓名和电话必填，字段长度、邮箱、客户分类和来源均执行强类型校验。导入写事务使用按 profile 区分的 MySQL 命名锁和 `Serializable` 隔离，两个同时到达的相同批次实测结果为一个 HTTP 201、一个 HTTP 409，数据库只有两条客户记录和一条成功导入审计。
- 合作客户列表现在应用统一数据范围；标记和更新要求 `customer:update`、目标数据可访问、状态满足前置条件。合同与回访日期会与数据库现值合并校验，运营负责人必须为有效账号；状态更新、客户写入和审计位于同一事务，重复标记返回 409。
- 扩展 `python scripts\manage.py data-flow --profile test`，真实覆盖正常导入、顺序重复导入、非法行整批回滚、双请求并发导入、标记合作、重复标记、合作信息更新、列表重新读取、数据库字段、成功审计、失败无审计和 `requestId`。2026-08-24 15:03 最终执行退出码 0，所有本轮客户、订单、回款、跟进和审计夹具均已清理。
- 本地 MySQL Windows 服务启动曾返回 `OpenService FAILED 5: Access is denied`；随后仍通过项目 `dbstart` 入口设置已有 direct 模式参数，使用原 `my.ini` 用户态启动，未创建或迁移其他数据目录。最终测试日志位于 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-flow-20260824-150254.log`。
- `python scripts\manage.py typecheck --profile stable`、`routes`、`button-audit`、`build` 和 `data-reachability --profile test` 均退出码 0。构建第一次因运行中的 test 服务占用 Prisma Windows DLL 退出码 1，停止服务后串行重跑通过；最终测试库 `Customer`、`FollowUp`、`Order`、`Payment`、`File`、`ContractArchive` 均为 0，关联孤儿项和金额异常均为 0。
- 任务 8 仍未整体完成：电销转客户、普通客户转移、合同版本、订单与回款重复点击、删除/停用历史追溯及管理员、经理、销售、受限用户完整关联夹具仍待后续验收。
