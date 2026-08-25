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

## Apply working evidence - 2026-08-24 15:56

- 付款页面已拆分为页面容器、类型定义和新增收款弹窗：src/app/(dashboard)/finance/payments/page.tsx 为 177 行，payment-form-modal.tsx 为 164 行，payment-types.ts 为 46 行；收款表单在一次打开周期内复用同一个 x-request-id，提交期间按钮保持 loading，成功后刷新列表。
- python scripts\manage.py typecheck --profile stable：退出码 0，日志为 D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-typecheck-20260824-155046.log。
- python scripts\manage.py migrate --profile test：退出码 0，仅将 20260824151500_add_write_idempotency 应用到 crm_system_test，日志为 D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-migrate-20260824-155121.log；稳定库没有执行本轮迁移。
- python scripts\manage.py data-flow --profile test：最终退出码 0，日志为 D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-flow-20260824-155408.log。真实验收覆盖订单相同请求号重放、回款相同请求号重放、合同并发重复上传、合同第二版本父子关系、下载内容、预览地址、删除最新版本后旧版本恢复、删除全部版本、导入顺序/并发重复与非法整批回滚、合作客户标记/重复标记/更新。
- 本轮首次执行数据流检查时发现验收脚本对 Windows MySQL batch 输出的制表符解析错误；实际数据库行已存在，修正检查器使用竖线分隔后重新执行通过。该修复没有放宽业务断言，也没有修改稳定数据库。
- python scripts\manage.py data-reachability --profile test：退出码 0，日志为 D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260824-155520.log；核心表 15 张，外键孤儿项、异常订单金额和负回款均为 0。test 数据库 Customer、Order、Payment、ContractArchive 等业务夹具已清理。
- python scripts\manage.py routes --profile test、python scripts\manage.py button-audit --profile test、python scripts\manage.py runtime-test --profile test 和 python scripts\manage.py build --profile test 均退出码 0；构建日志为 D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260824-155556.log，构建基线仍为仓库现有 Next.js 14.2.35，本轮没有执行框架升级。
- storage/test 中本轮及历史 test 合同文件已清理并重新创建空目录。public/uploads/contracts 仍有旧公共上传目录文件，stable/test 数据库当前均无 ContractArchive 引用；由于该目录可能包含用户原始文件，本轮未自动删除，需在发布清理阶段人工确认后处理。
- 当前仍不能宣称任务 8 整体完成：电销转客户、普通客户转移、删除/停用历史追溯、多角色关联夹具、完整权限矩阵、Playwright 全量按钮验收、长连接、性能、安全和 stable 发布演练仍未完成。prisma/schema.prisma 当前 648 行，属于现有 Prisma 单文件结构，后续需单独评估拆分方式。

## Apply working evidence - 2026-08-24 17:06

- 电销转客户已改为 `Serializable` 事务：锁定电销记录后，在同一事务内创建客户、更新电销状态并写入 `TELEMARKETING_CONVERTED` 审计；同一记录重复提交返回原客户，相同电话已有客户时返回 HTTP 409。
- 新增普通客户转移接口和目标销售范围接口。仅管理员与销售主管可执行，主管目标范围限定为本人及下属；客户归属更新与 `CUSTOMER_TRANSFERRED` 审计位于同一事务，相同 `requestId` 重放不会重复写入审计，相同请求号更换目标返回 HTTP 409。
- 电销转化弹窗将“当前记录”和“提交中”状态分离，修复打开弹窗后按钮持续 loading；客户列表新增转移弹窗，一次弹窗操作复用同一个 `x-request-id`，提交期间禁用关闭和重复提交。
- `python scripts\manage.py data-flow --profile test`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-flow-20260824-170350.log`。真实验收覆盖同一电销记录双请求并发转化、重复电话拒绝、主管目标范围、客户 A 到 B 再转回 A、请求重放、请求冲突、普通销售 403、数据库终态和审计数量；测试用户、客户、电销和审计夹具已清理。
- `python scripts\manage.py data-reachability --profile test`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260824-170419.log`；核心业务表检查通过，业务夹具数量为 0，外键孤儿项、异常订单金额和负回款均为 0。
- `python scripts\manage.py routes --profile test`、`python scripts\manage.py button-audit --profile test` 和 `python scripts\manage.py build --profile test` 均退出码 0；构建日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260824-170513.log`，生产路由表包含 `/api/customers/[id]/transfer`、`/api/customers/transfer-options` 和 `/api/telemarketing/convert`。
- 任务 8.3 已完成。任务 8.5 的删除、停用、归档历史追溯和任务 8.6 的其余失败写入链路仍需单独证据，因此任务 8 整体保持未完成。

## Apply working evidence - 2026-08-24 17:16

- 扩展 `data-flow` 的失败写入和历史追溯验收：超额回款返回 `AMOUNT_EXCEEDS_UNPAID`，响应带请求号，`Payment` 无新记录、订单金额保持 `250.00|750.00`、无成功审计；非法合同文件返回 400，`ContractArchive`、审计和 `storage/test/contracts` 均无残留。
- 客户软删除后直接查询数据库确认状态为 `INACTIVE`，原客户的 1 条跟进、1 条订单和 1 条回款仍可追溯，`CUSTOMER_SOFT_DELETED` 审计同时保留前后快照；合同删除后两条 `CONTRACT_ARCHIVE_DELETED` 审计均保留 `beforeData`，删除最新版本后上一版本恢复为最新。
- `python scripts\manage.py data-flow --profile test`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-flow-20260824-171430.log`；包含电销转化、客户转移、导入、合作客户、订单、回款、合同版本、失败写入和历史追溯，test 夹具已清理。
- `python scripts\manage.py content-flow --profile test`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-content-flow-20260824-171448.log`；文件对象、文件元数据、消息和审计夹具均已清理。
- `python scripts\manage.py user-flow --profile test` 和 `python scripts\manage.py public-pool-flow --profile test` 均退出码 0，日志分别为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-user-flow-20260824-171324.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-public-pool-flow-20260824-171332.log`。
- `python scripts\manage.py data-reachability --profile test`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260824-171510.log`；核心表 15 张，业务夹具为 0，外键孤儿项、异常订单金额和负回款均为 0。
- `python scripts\manage.py routes --profile test`、`python scripts\manage.py button-audit --profile test` 均退出码 0，日志分别为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-routes-20260824-171526.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-button-audit-20260824-171534.log`。test 服务随后通过 `python scripts\manage.py stop --profile test` 停止，未残留 PID、端口或锁。
- 任务 8.5、8.6、8.7 已完成。任务 8.1 的统一多角色最小夹具和任务 8.2 的页面入口到 API、数据库行、审计事件逐链路报告仍未完成，因此任务 8 整体保持未完成。

## Apply working evidence - 2026-08-24 17:21

- `data-reachability` 新增 12 条销售业务链路契约，逐条检查页面入口、Route Handler、业务实现、Prisma 模型和审计标识，覆盖客户创建、客户跟进、订单、回款、合同、文件、消息、电销转化、客户转移、公海认领、客户导入和合作客户更新。
- 第一次执行 `python scripts\manage.py data-reachability --profile test` 因回款契约漏填 `Payment` 模型参数退出码 1；根据 traceback 修正检查器后重新执行退出码 0。最终日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260824-171953.log`，12 条链路契约、15 张核心表和数据库质量检查均通过。
- 多角色最小夹具由可重复清理的 test flow 组成：管理员及客户/跟进/订单/回款/合同由 `data-flow` 覆盖，销售主管和两名下属销售由客户转移流程覆盖，受限用户由 `scope-flow` 覆盖，文件与消息由 `content-flow` 覆盖，用户停用和公海归档分别由 `user-flow`、`public-pool-flow` 覆盖。
- `python scripts\manage.py scope-flow --profile test`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-scope-flow-20260824-172026.log`；受限用户无法在列表或详情读取管理员客户，角色、用户、客户和审计夹具均已清理。
- 现有 `File` 模型只通过 `uploadedBy` 关联用户，`Message` 模型只通过 `senderId`、`receiverId` 关联用户，均没有 `customerId`。本轮按原系统字段验证，没有为满足测试描述而新增客户关联字段。
- 任务 8.1 至 8.7 已全部完成，一级任务“数据可达性与一致性”标记完成。该结论不代表任务 10 的完整权限矩阵或任务 15 的 Playwright 全量按钮验收已经完成。

## Apply working evidence - 2026-08-24 17:35

- 客户页的列表、创建、编辑、归档、软删除和导入入口已接入 `src/lib/http/client.ts`；写操作带固定 `x-request-id`、`requestKey` 和提交中禁用，GET 保留有限重试，写操作不自动重放。
- 电销页和转化弹窗已接入统一请求层；新增、编辑、删除和转化提交期间按钮会进入 loading，重复点击不会并发创建或删除同一记录。
- 重写 `src/app/api/telemarketing/route.ts`：编辑现在会持久化姓名、公司、电话、职位、行业、来源和备注；新增、编辑、删除均在事务内写审计并返回 `x-request-id`；已转客户的电销记录返回 `CONVERTED_RECORD`，禁止删除，保留来源追溯。
- 客户软删除增加状态前置条件；已删除客户再次删除返回 `CUSTOMER_ALREADY_INACTIVE`，不会新增成功审计。
- `python scripts\manage.py typecheck --profile stable`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-typecheck-20260824-173043.log`。
- `python scripts\manage.py data-flow --profile test`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-flow-20260824-173200.log`；新增电销 CRUD、编辑字段落库、转化后禁止删除和重复软删除验收均通过，夹具已清理。
- `python scripts\manage.py data-reachability --profile test`、`python scripts\manage.py button-audit --profile test` 和 `python scripts\manage.py build --profile test` 均退出码 0；链路报告日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260824-173247.log`，按钮审计日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-button-audit-20260824-173258.log`，构建日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260824-173315.log`。
- 任务 9 仍未整体完成：财务、公海、合作客户、合同等页面尚未全部切换到统一请求层，401 草稿恢复、断网恢复和长时间会话测试尚未覆盖。

## Apply working evidence - 2026-08-24 17:43

- 订单列表、订单表单、回款列表、回款表单、公海列表/统计/配额/认领和合作客户列表/提醒/编辑已接入 `src/lib/http/client.ts`；写操作统一带 `requestKey`，提交中禁止关闭弹窗或重复提交。
- 合作客户“运营负责人”不再使用无效硬编码用户 ID，新增 `/api/customers/operation-manager-options`，只返回 ACTIVE 用户；编辑弹窗读取真实选项并提交现有 `operationManagerId` 字段。
- `python scripts\manage.py typecheck --profile stable`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-typecheck-20260824-174001.log`。
- `python scripts\manage.py data-flow --profile test`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-flow-20260824-174042.log`；订单、回款、合同、公海、合作客户和电销数据写入链路全部通过并清理夹具。
- `python scripts\manage.py routes --profile test`、`python scripts\manage.py button-audit --profile test` 均退出码 0，日志分别为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-routes-20260824-174115.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-button-audit-20260824-174125.log`。
- `python scripts\manage.py build --profile test`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260824-174148.log`；构建路由包含 `/api/customers/operation-manager-options`。
- 任务 9 仍未整体完成：客户合同组件、文件、消息、提醒、任务、日报、统计等页面仍有直接 `fetch`，401 草稿恢复、离线恢复和长时间会话测试尚未覆盖。

## Apply working evidence - 2026-08-24 17:47

- 合同备案列表、上传表单和版本历史组件已切换到 `apiRequest`；合同上传、删除使用固定请求号和 `requestKey`，上传/删除期间禁止关闭弹窗或重复提交。
- `ApiError` 现在保留结构化错误载荷，合同 PDF 之外的预览失败仍能读取服务端返回的 `downloadUrl`，用户可以选择下载，不会因为统一请求层丢失恢复入口。
- `python scripts\manage.py typecheck --profile stable`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-typecheck-20260824-174517.log`。
- `python scripts\manage.py content-flow --profile test`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-content-flow-20260824-174548.log`；文件、消息和合同版本链路均已通过并清理夹具。
- `python scripts\manage.py build --profile test`：退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260824-174618.log`。
- 任务 9 仍未整体完成：任务、日报、统计、提醒和部分客户相关组件仍有直接 `fetch`；401 草稿恢复、断网恢复、长时间会话和浏览器级全量按钮验收尚未覆盖。

## Apply working evidence - 2026-08-24 17:55

- 任务、负责人搜索、日报、销售总览、销售漏斗、统计趋势、首页 KPI、首页收入趋势和首页提醒已接入 `src/lib/http/client.ts`；任务与日报写入使用固定请求号、`requestKey` 和提交中状态，避免重复点击并发提交。
- 每日客资的销售列表、统计列表和公海客户认领，以及财务报表汇总已接入统一请求层；页面保留原字段和接口，接口失败改为显示结构化业务错误，不再静默写控制台或统一显示无法定位的“网络错误”。
- `rg -n "\\bfetch\\(" src/app src/components` 无输出；业务页面和组件已没有直接 `fetch`，`src/lib/http/client.ts` 内部执行网络请求的 `fetch` 保留。
- `python scripts\\manage.py routes --profile test`、`python scripts\\manage.py button-audit --profile test`、`python scripts\\manage.py data-reachability --profile test` 均退出码 0；日志分别为 `D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\test\\manage-routes-20260824-175143.log`、`D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\test\\manage-button-audit-20260824-175144.log`、`D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\test\\manage-data-reachability-20260824-175145.log`。数据可达性报告显示 test 业务夹具为 0，外键孤儿项、异常订单金额和负回款均为 0。
- `python scripts\\manage.py typecheck --profile stable` 退出码 0，日志为 `D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\stable\\manage-typecheck-20260824-175408.log`；最终 `python scripts\\manage.py routes --profile test`、`python scripts\\manage.py button-audit --profile test` 和 `python scripts\\manage.py build --profile test` 均退出码 0，日志分别为 `D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\test\\manage-routes-20260824-175454.log`、`D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\test\\manage-button-audit-20260824-175455.log`、`D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\test\\manage-build-20260824-175455.log`。
- 任务 9.2 已完成。任务 9 仍未整体完成：401 草稿保存与登录回跳恢复、离线状态与恢复刷新、敏感草稿白名单，以及长时间空闲、慢请求、断网和重复点击集成测试尚未完成。

## Apply working evidence - 2026-08-24 19:35

- 统一请求层在收到 401 时只触发一次会话过期跳转，并广播 `crm:session-expired` 事件；中间件对页面请求保留登录回跳，对 `/api/*` 返回带 `requestId` 的 JSON 401，避免把登录页 HTML 误当成业务成功响应。
- 登录回跳改为站内相对路径并校验同源及禁止回到 `/login`，实测从 `http://127.0.0.1:3001/tasks?status=TODO` 未登录访问后跳转到 `http://localhost:3001/login?callbackUrl=%2Ftasks%3Fstatus%3DTODO`，重新登录后回到原筛选页。
- 新增 `src/lib/forms/draft-storage.ts` 和 `src/hooks/useFormDraft.ts`：草稿使用 `sessionStorage`，版本号为 1，默认 12 小时过期；客户、任务、日报、订单、回款、跟进、电销、转客户和客户转移表单只保存显式白名单字段，成功提交或主动取消清理，退出登录清理全部草稿；用户密码、令牌、合同文件和文件对象不进入草稿。
- 新增 `NetworkRecoveryBoundary`。浏览器真实网络仿真验证：断网显示“当前处于离线状态”；恢复网络显示“网络已恢复”，当前页面只读数据重新加载，未确认写入没有自动重放；20 秒延迟下 GET 经过统一超时后显示“请求超时，请稍后重试”。
- 浏览器真实会话过期验收：日报草稿 `SESSION-DRAFT-20260824-1812` 在 test 服务临时更换会话密钥后提交，API 返回 401，页面跳转到 `/login?reason=session-expired&callbackUrl=%2Fdaily-reports`；重新登录回到日报页面，草稿内容和明日计划完整恢复。
- 浏览器双击提交日报 `SESSION-DRAFT-20260824-1817` 后页面只显示一条“已提交”记录；`python scripts\\manage.py network-session-flow --profile test` 退出码 0，数据库计数为 1，夹具随后删除并复核为 0。日志为 `D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\test\\manage-network-session-flow-20260824-181835.log`。
- 为适配 API 401 契约，`scripts/smoke-http.py` 和 `scripts/quality/settings_flow_test.py` 已从“未登录接口 307 重定向”改为校验 JSON 401、`requestId`；`python scripts\\manage.py settings-flow --profile test` 退出码 0，日志为 `D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\test\\manage-settings-flow-20260824-193224.log`。
- `python scripts\\manage.py data-reachability --profile test`、`routes`、`button-audit` 均退出码 0，日志分别为 `D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\test\\manage-data-reachability-20260824-193229.log`、`D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\test\\manage-routes-20260824-193235.log`、`D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\test\\manage-button-audit-20260824-193236.log`；数据库业务夹具为 0，外键孤儿项、异常订单金额和负回款均为 0。
- `python scripts\\manage.py typecheck --profile stable` 退出码 0，日志为 `D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\stable\\manage-typecheck-20260824-193300.log`；`python scripts\\manage.py build --profile test` 退出码 0，日志为 `D:\\Desktop\\CRM系统代码 (2)\\CRM系统代码\\logs\\test\\manage-build-20260824-193306.log`。
- 任务 9.4、9.5、9.6 已完成。任务 9.7 暂不标记完成：已验证会话失效、断网恢复、慢请求和重复点击，但尚未执行真实长时间空闲时长测试；任务 9.3 的全量按钮级提交状态检查也仍待 Playwright 全量验收。

## Apply working evidence - 2026-08-24 22:10

- `src/lib/auth.ts` 新增 `CRM_SESSION_MAX_AGE_SECONDS` 严格解析：默认 28800 秒，允许 60 秒至 30 天，非整数或越界值在构建/启动加载认证配置时明确失败；`.env.example` 只记录脱敏示例。非法值构建按预期退出码 1，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260824-215642.log`；该失败是配置门禁证据，不计为最终构建失败。
- 文件共享补充上传中和删除中状态，消息中心补充单条已读、全部已读和删除状态，提醒页补充禁用/恢复状态；进行中按钮会显示 loading 并拒绝重复动作，所有写请求仍使用 `requestKey`。`scripts/quality/button_audit.py` 已扩展检查业务页面直接 `fetch`、写请求缺失 `requestKey`、提交按钮缺失 `loading` 和表单弹窗缺失 `confirmLoading`。
- Playwright 真实浏览器自然过期验收：test 服务以 60 秒会话启动，登录日报页并填写 `NATURAL-EXPIRY-20260824-2200` 草稿，真实空闲超过 60 秒后提交；`POST /api/daily-reports` 返回 HTTP 401、`content-type: application/json` 和 `x-request-id`，页面跳转到 `/login?reason=session-expired&callbackUrl=%2Fdaily-reports`。重新登录回到日报页后，今日内容和明日计划均从 `sessionStorage` 恢复，未产生日报数据库记录。
- `network-session-flow` 增加可重复的自然过期模式。第一次执行已取得 401，但测试误写旧错误文案而退出码 1，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-network-session-flow-20260824-220355.log`；读取中间件实际契约后改为精确校验“登录状态已过期”、响应体 `requestId` 和响应头一致性。第二次真实等待 65 秒后退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-network-session-flow-20260824-220540.log`。
- `python scripts\manage.py settings-flow --profile test`、`content-flow`、`data-reachability`、`routes` 和 `button-audit` 均退出码 0。日志分别为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-settings-flow-20260824-220712.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-content-flow-20260824-220715.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260824-220721.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-routes-20260824-220726.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-button-audit-20260824-220726.log`；test 数据库 Customer、FollowUp、Lead、Order、Payment、File、Message、ContractArchive 均为 0，外键孤儿项、异常订单金额和负回款均为 0。
- `python scripts\manage.py typecheck --profile stable` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-typecheck-20260824-220843.log`；`python scripts\manage.py build --profile test` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260824-220849.log`。最终构建使用默认 8 小时会话配置。
- Playwright 临时文件已逐项删除；`python scripts\manage.py instance-status --profile test` 显示 PID 不存在、端口未监听、锁为 False，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-instance-status-20260824-220949.log`。任务 9.1 至 9.8 全部完成。受项目“禁止子智能体”规则约束，本轮未调用独立 verifier，以上证据均由主流程实际命令和浏览器操作产生。

## Apply working evidence - 2026-08-24 23:46

- 新增统一页面访问契约 `src/lib/access/page-access.ts`，中间件与 Sidebar 共用同一权限集合；补齐提醒、统计、公海、每日客资、电销、消息路由，系统管理子页按 `user`、`role`、`setting` 精确匹配。
- 新增 `getAccessibleUserIds`，统一管理员/财务全局、销售主管本人及递归下属、销售本人及递归下属、自定义受限角色空集合四种范围。订单、回款、财务汇总、统计、提醒、任务、文件、日报、每日客资和合同备案已按各自 Prisma 归属字段应用该范围。
- 订单创建沿用客户 `salesId`；回款写入前校验订单范围；文件查看、下载和删除按 `uploadedBy` 校验；合同列表、版本、预览、下载、上传、删除统一使用 `src/lib/contracts/access.ts`。
- 页面按钮补齐订单编辑/删除、回款新增、日报提交、电销增改删转、提醒跟进/禁用/恢复、公海认领、每日客资转入、合作客户编辑、合同上传/删除和任务创建权限显示；电销 API 改为精确使用 `lead:view/create/update/convert`。
- `src/lib/auth.ts` 每次服务端 `auth()` 从数据库读取 ACTIVE 用户的最新角色与权限。`python scripts\manage.py permission-flow --profile test` 退出码 0：受限角色直接系统管理页面被重定向到 403，统计、订单、回款、日报、任务、文件 API 均返回 403；角色权限新增和撤销对现有会话立即生效；用户停用后旧会话访问任务 API 返回 401；夹具均已清理。日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-permission-flow-20260824-234224.log`。
- `python scripts\manage.py permission-matrix --profile test` 退出码 0，生成 12 条模块契约文档 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\权限与数据范围矩阵.md`。日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-permission-matrix-20260824-234201.log`。
- `python scripts\manage.py data-flow --profile test`、`content-flow`、`data-reachability`、`routes`、`button-audit` 均退出码 0；真实数据链路通过，test 业务夹具为 0，外键孤儿、异常订单金额和负回款均为 0。
- `python scripts\manage.py typecheck --profile stable` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-typecheck-20260824-234421.log`；`python scripts\manage.py build --profile test` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260824-234434.log`。
- test 服务已停止，PID 不存在、端口未监听、锁为 False。受项目“禁止子智能体”规则约束，本轮未调用独立 verifier，证据来自主流程实际执行。

## Apply working evidence - 2026-08-25 单实例与进程生命周期

- `python scripts\manage.py runtime-test --profile test` 退出码 0；旧的 profile 隔离检查和新的 `instance_flow_test.py` 均通过，后者共执行 10 项测试，覆盖排他锁、记录损坏、PID/锁不一致、外部 PID、陈旧记录、端口冲突、不可写运行目录、外部 PID 残留清理和启动失败清理。
- `python scripts\manage.py instance-status --profile test` 在启动前显示 `stopped`，PID 不存在、端口未监听、锁为 False。
- `python scripts\manage.py start --profile test` 退出码 0，真实 test 服务启动并监听 `3001`；状态检查显示 `running`，锁和 PID 记录包含 profile、PID、端口和项目根目录，监听 PID 属于 CRM 进程树。
- 第二次执行 `python scripts\manage.py start --profile test` 退出码 1，日志明确显示 `test profile 已有实例`；启动前后 CRM 进程数量均为 3，没有创建第二棵进程树。
- `python scripts\manage.py stop --profile test` 退出码 0；随后 `python scripts\manage.py instance-status --profile test` 显示 `stopped`，端口未监听、端口进程为空、锁为 False、PID 不存在。
- `git diff --check` 退出码 0；本轮动态测试只使用 `test` profile，没有写入 stable 业务数据。测试日志位于 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\`。
- 新增 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\scripts\deploy\ecosystem.config.mjs` 和 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\scripts\deploy\crm@.service`。模板静态检查确认 stable/test 分别使用 `3000/3001`、每个 profile `1` 个实例、`fork`、自动重启和 `/api/health` 检查；尚未在真实 PM2/systemd 主机上执行部署演练，因此该部分结论限于模板一致性检查。
- 追加安全校验后，损坏记录或外部 PID 即使端口空闲，`stop` 也会返回非零并保留记录，不再自动接管无法确认归属的实例；进程枚举失败会转为不可确认状态，不会直接执行终止。
- 修正启动管理进程的短生命周期识别：原子创建且字段匹配当前调用的锁记录可直接进入 `starting`，服务进程生成后仍必须通过 CRM 命令行、进程树和端口归属校验。修正后再次真实启动 test 成功，第二次启动退出码 1、进程数无增加，停止和最终状态检查均退出码 0。

## Apply working evidence - 2026-08-25 Stable/Test 发布通道与服务端治理

- `.env.example` 已改为 stable/test 独立数据库、端口、主机、上传目录和访问地址的脱敏占位模板；`scripts/deploy/nginx-crm-system.conf` 分别代理 `3000/3001` 并写入独立日志和 `X-CRM-Profile`，PM2/systemd 模板保持单实例与健康检查配置。服务器模板未在本机安装 PM2/systemd/Nginx，只完成静态一致性校验。
- `scripts/release.py` 生成包含版本、Git 提交、UTC 构建时间、迁移 SHA256 和文件清单的 ZIP，并生成独立 SHA256 文件；默认拒绝脏工作区和覆盖既有产物，排除 `.next/cache`、环境密钥、日志、上传目录和运行记录，staging 在压缩后清理。
- `promote` 仅验证 profile 为 test 且门禁、清单、SHA256 完整的产物；强类型 `channel-state.json` 记录 current/previous stable 版本。`rollback` 只接受 previous stable 产物并交换 current/previous，不执行数据库降级或删除数据。
- `/api/health` 公开检查数据库状态；认证后的 `?deep=1` 检查存储读写权限，并按迁移名称比较本地目录与 `_prisma_migrations`，区分 current、pending、drift 和 unavailable。所有结果只返回状态，不返回数据库连接、路径、堆栈或密钥。
- API Route Handler 中直接 `console.error` 和裸 500 响应已清除；未知异常统一写入文件日志并返回通用错误、响应头和响应体一致的 `requestId`。`python scripts\manage.py server-governance --profile test` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-server-governance-20260825-113914.log`。
- 第一次运行 `server-runtime-drill` 因 Auth.js 拒绝临时端口的 `UntrustedHost` 退出码 1，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-server-runtime-drill-20260825-112652.log`；演练进程已清理。为演练进程显式设置 `AUTH_TRUST_HOST=true` 和临时 `AUTH_URL` 后，健康、服务重启、数据库不可达 503、存储不可达 503 均通过。加入迁移名称断言后的最终日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-server-runtime-drill-20260825-113755.log`。
- `audit-data` 首次显示 2 个待迁移，但 `migrate --profile test` 明确连接 `crm_system_test` 并报告无待执行迁移。检查发现 `audit_data.py` 固定读取 `.env.local` 的 stable 连接，现已优先使用 `manage.py` 注入的 `DATABASE_URL`。修复后 test 库 9 个迁移全部已应用，AuditEvent 表存在，孤立客户销售、孤立订单客户和负回款均为 0；日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-audit-data-20260825-113243.log`。
- `python scripts\manage.py release-test --profile test` 退出码 0，覆盖环境/Nginx 隔离、清单读取、缺失/空白/损坏 SHA256 拒绝、两次 promote 状态和 rollback 切回 previous；日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-release-test-20260825-113914.log`。
- `python scripts\manage.py routes --profile test` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-routes-20260825-113915.log`；`python scripts\manage.py data-reachability --profile test` 退出码 0，12 条销售链路、15 张核心表和外键/金额检查通过，业务夹具为 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260825-113916.log`。
- `python scripts\manage.py typecheck --profile stable` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-typecheck-20260825-113258.log`；`python scripts\manage.py build --profile test` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260825-113309.log`。
- 提交 `20733b3f72ee8b2c2bb9e66419e488062ad62d54` 后，在干净工作区执行 `python scripts\manage.py release --profile test` 退出码 0，真实产物为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\.build\test\release\1.0.0-20733b3f.zip`，SHA256 为 `c78e3a2583a480482487bb8c37e84f638ede379ab15bc2ebced2110f60585255`，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-release-20260825-114031.log`。ZIP 清单复核不含 `.env`、`logs/`、`storage/`、`.runtime/` 和 `.next/cache/`。
- `python scripts\manage.py promote --profile stable --artifact ".build\test\release\1.0.0-20733b3f.zip"` 退出码 0，本地发布通道 current 已登记为 `1.0.0-20733b3f`，previous 为 null，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-promote-20260825-114149.log`。该动作只登记本地 stable 发布状态，没有替换线上进程，也没有执行 stable 数据库迁移。

## Apply working evidence - 2026-08-25 前端性能优化

- ECharts 已集中到 `src/components/charts/CRMChart.tsx`，只注册当前页面实际使用的 Bar、Funnel、Line、Pie 和 SVG renderer；首页、统计、公海看板及其余图表页面使用 `next/dynamic` 按页面加载。客户跟进、客户转移、合作客户合同、订单、回款、任务、电销转化和提醒跟进弹窗也改为按需加载。
- `@tiptap/react`、`@tiptap/starter-kit`、`react-pdf` 在源码没有实际引用，已从运行依赖移除；XLSX 仍只在服务端客户导入模块使用。依赖树统一为 `@ant-design/cssinjs@1.24.0`，并将 `@ant-design/nextjs-registry` 固定为 `1.2.0`，避免 registry 与 Ant Design 使用不同 css-in-js cache。
- 根布局只保留一处 `AntdRegistry` 和一处会话 provider。生产 HTML 检查确认包含 `id="antd-cssinjs"` 样式标签；此前发现的 SSR 样式缺失导致的首屏位移已修复。首页图表和提醒区域增加稳定的首帧高度，避免加载态与真实内容切换时改变布局。
- 文件共享和消息中心改为真实服务端分页，均使用稳定 `rowKey`；客户、合作客户、公海、订单、回款、任务、电销、日报和每日客资等已有列表继续使用服务端分页或固定上限，未把全量数据缓存到客户端。统一请求层对 GET 默认使用 `cache: no-store`，写入后按现有页面精确刷新相关数据。
- 新增性能入口：`python scripts\manage.py perf --profile test` 检查全路由 First Load JS、公共共享包和重型依赖边界；`python scripts\manage.py perf-runtime --profile test` 在 test 生产服务中使用真实 Chrome 登录态，测量桌面和低性能网络/CPU环境的 LCP、INP、CLS、长任务和路由切换。生产启动入口新增 `--mode production`，并同步传递 `AUTH_URL`、`AUTH_TRUST_HOST`，修复本地生产模式 Auth.js `UntrustedHost` 初始化失败。
- 最终真实运行时报告：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\frontend-runtime-20260825T042541Z.json`。桌面环境首页 LCP 188 ms、CLS 0.001、INP 40 ms；低性能环境首页 LCP 856 ms、CLS 0.001、INP 120 ms；低性能路由切换 606 ms；所有采集页面长任务最大值 183 ms，运行时预算退出码 0。完整文档为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\前端运行时性能.md`。
- 最终构建体积预算报告为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\前端性能预算.md`：公共共享 JavaScript 88.2 kB；首页 275 kB、统计页 222 kB、公海页 379 kB；全路由均低于 500 kB，`python scripts\manage.py perf --profile test` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-perf-20260825-122815.log`。
- 验证命令均通过：`python scripts\manage.py typecheck --profile stable`，日志 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-typecheck-20260825-121923.log`；`python scripts\manage.py build --profile test`，日志 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260825-122422.log`；`routes`、`button-audit`、`data-reachability`、`runtime-test` 退出码均为 0。最终 test 服务已停止，`instance-status` 显示 PID 不存在、端口未监听、锁为 False。
- 性能报告和日志未写入用户名、密码、Cookie、令牌、数据库连接串或上传文件内容；本轮浏览器登录凭据仅通过当前进程环境变量传入，未写入仓库。任务 13.1 至 13.7 已完成。

## Apply working evidence - 2026-08-25 API、Prisma 与数据库性能

- 新增 API 与数据库性能入口 `python scripts\manage.py api-perf --profile test`。脚本只允许连接 test profile，自动停止旧 test 服务、启用 Prisma 查询日志、创建 120 条临时客户及关联订单/回款/跟进/消息/文件/审计数据，预热后对 15 个关键接口各采样 3 次，执行关键 SQL 的 `EXPLAIN`，最后清理全部夹具并停止服务。
- 最终性能预算退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-api-perf-20260825-132232.log`，原始报告为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\api-database-performance-20260825T052253Z.json`，汇总文档为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\API与数据库性能.md`。15 个接口 p95 为 28.9 至 55.4 ms，最大 Prisma 查询数为 12，单次最大返回 100 行，错误率均为 0。性能脚本要求通过当前进程的 `CRM_PERF_*` 或 `CRM_SMOKE_*` 环境变量提供 test 登录凭据，不在源码中设置默认密码；生成的 Markdown 固定使用 LF，`git diff --check` 不再把 Windows CRLF 识别为尾随空白。
- 客户、用户、日报、每日客资、公海、订单、回款、任务等列表统一使用分页参数上限；count 与列表查询并行，排序增加稳定 `id`；续签提醒最多 100 条，提醒中心每类最多 25 条、总计最多 100 条。用户管理页面使用真实服务端分页，每日客资销售选项显式最多读取 100 条。
- 每日客资、销售漏斗、销售趋势、公海统计、销售总览、财务汇总和提醒查询已改为数据库聚合或固定数量并行查询，数据范围条件在 SQL/Prisma 查询中执行；销售主管递归下属范围改为单次 MySQL recursive CTE。曾因 `ONLY_FULL_GROUP_BY` 和 CTE collation 冲突出现 500，分别统一日期分组表达式并显式使用 `utf8mb4_unicode_ci` 后通过真实 `data-flow` 和性能验收。
- PrismaClient 继续使用开发环境全局单例，只有设置 `CRM_PRISMA_QUERY_LOG=1` 时输出 query。Windows MySQL 服务启动权限不足时，运行管理器会查找 `mysqld` 或从 `mysql` 客户端同目录定位服务端程序；未找到时明确返回错误，不隐藏启动失败。
- 查询计划使用 `Customer_createdAt_idx`、`Customer_contractEndDate_idx`、`Order_createdAt_idx`、`Payment_paymentDate_idx`、`Message_receiverId_idx` 和 `AuditEvent_action_createdAt_idx`；当前 test 数据及执行计划没有新增索引的证据，因此未增加索引，避免无依据提高写入成本。
- 客户导入保持单次最多 1000 条，在同一导入事务内按 200 条执行 `createMany` 并记录批次数；公海自动回收单次最多 200 条、每 25 条一个事务，响应返回 `limitReached`。审查时发现自动回收候选查询与写入之间存在竞态，现已按回收规则、原负责人和 `updatedAt` 进行乐观并发校验，避免跟进、转移或历史变化后的客户被错误回收。
- 公海流程第一次重跑时 test 服务未启动，返回 `WinError 10061`，失败日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-public-pool-flow-20260825-131416.log`；通过 `python scripts\manage.py start --profile test` 启动后重跑退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-public-pool-flow-20260825-131439.log`，客户状态、历史记录、审计事件和夹具清理均通过。
- 类型检查第一次因开发服务占用 Prisma 查询引擎文件而发生 `EPERM`，失败日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-typecheck-20260825-131640.log`；停止 test 服务释放文件后重跑退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-typecheck-20260825-131704.log`。最终构建退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260825-131716.log`。
- 最终 `python scripts\manage.py data-reachability --profile test` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260825-131841.log`；Customer、FollowUp、Lead、Order、Payment、File、Message、ContractArchive 均为 0，外键孤立项、异常订单金额和负回款均为 0。`git diff --check` 退出码 0，test 服务已停止。
- 受项目“禁止子智能体”规则约束，本轮没有调用独立 verifier；以上证据均来自主流程实际执行的项目脚本、数据库检查和构建日志。任务 14.1 至 14.7 已完成。

## Apply working evidence - 2026-08-25 Playwright 按钮级 E2E

- 新增 `playwright.config.ts`、`tests/e2e/` 和 `scripts/e2e/`，统一入口为 `python scripts\manage.py e2e --profile test`。运行器强制 `CRM_PROFILE=test` 且数据库名以 `_test` 结尾，随机生成运行 ID、账号和临时密码，结束后停止 test 服务并清理认证状态、数据库夹具和测试文件。
- 认证准备覆盖管理员、销售主管、销售和受限用户。删除侧边栏品牌区域后，首次重跑因认证夹具仍等待旧的 `CRM系统` 文案失败；已改为验证真实“仪表盘”菜单，并重新执行全部用例。
- 最终 E2E 共 19 项全部通过，覆盖导航、搜索、重置、分页、客户新增/编辑/软删除/归档/转移/公海认领、文件上传/下载/删除、系统设置保存，以及按钮隐藏、API 403、页面 403、数据范围、会话撤销和重新登录。
- 写操作同时断言页面反馈、HTTP、数据库终态与审计事件；真实服务端 500、重复点击、空状态、慢响应、断网恢复和浏览器刷新均已覆盖。未使用 `skip`、mock API 或硬编码成功响应，失败配置保留 screenshot、video、trace、HTML 和 JSON。
- 最终日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-e2e-20260825-144615.log`，自动验收报告为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\Playwright按钮级验收.md`。最终 test 服务已停止，测试夹具已清理。
- `python scripts\manage.py typecheck --profile stable` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-typecheck-20260825-144502.log`。本阶段只覆盖 Chromium Desktop；移动端视觉回归保留给后续 UI 与最终发布验收任务。
- 发布前最终门禁均退出码 0：构建日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260825-145006.log`，路由、按钮、数据可达性和单实例状态日志分别为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-routes-20260825-145111.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-button-audit-20260825-145111.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260825-145111.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-instance-status-20260825-145111.log`。`git diff --check` 无输出。
- test 数据库保留的 2 条 `ROLE_UPDATED` 审计创建于 2026 年 8 月 24 日，不属于本轮 E2E；为保留历史记录未删除。Customer、FollowUp、Lead、Order、Payment、File、Message、ContractArchive 和 SystemSetting 均为 0，外键孤立项、异常订单金额和负回款均为 0。

## Apply working evidence - 2026-08-25 响应式外壳与首页漏斗布局

- Dashboard 外壳已改为桌面固定侧栏和 1024px 以下抽屉导航；侧栏折叠宽度为 200/80px，顶栏显示真实姓名，390px 隐藏姓名文字并保留账户入口。移动端抽屉关闭、路由跳转和页面横向溢出已纳入 Playwright。
- 首页移除内容区内部重复 24px padding。销售漏斗删除图表内重复标题，全零数据使用只影响 SVG 宽度的 100/82/64/46/28 阶梯值，标签和 tooltip 继续读取接口真实 `count`，不写回数据库。收入趋势同步删除重复内部标题，KPI 数值保持单行。
- 新增 `dashboard.visual.spec.ts`，以只读接口全零响应稳定复现原截图；断言标题仅出现一次、五个 `0个` 标签均可见、五层 SVG 宽度依次收窄且最窄层大于 70px。响应式用例覆盖 1440、1280、1024、768 和 390px，在 1024px 检出 KPI 四列挤出内容区后改为 1200px 以下两列、手机一列。
- `python scripts\manage.py e2e --profile test` 最终 22 项全部通过，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-e2e-20260825-155930.log`；测试服务已停止，PID 和端口已清理。视觉截图经人工检查后从 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\output\playwright\visual` 清理，后续成功用例不再生成常驻截图。
- `python scripts\manage.py typecheck --profile stable` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-typecheck-20260825-160210.log`；`python scripts\manage.py build --profile test` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260825-160216.log`。

## Apply working evidence - 2026-08-25 隔离测试数据与自动化复验

- 测试夹具仅写入 `crm_system_test`：自动准备管理员、销售主管、销售、受限用户 4 类账号，25 条销售客户及主管、管理员、公海客户等业务数据；未向 stable 或线上数据库写入测试数据。
- `python scripts\manage.py e2e --profile test` 共 22 项全部通过，覆盖客户新增、编辑、归档、删除、转移、公海认领、文件、权限、设置、会话恢复及 1440、1280、1024、768、390px 响应式布局；日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-e2e-20260825-162755.log`。
- `data-flow`、`content-flow`、`user-flow`、`role-flow`、`settings-flow`、`public-pool-flow`、`scope-flow`、`permission-flow` 均退出码 0，各流程日志位于 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\`，并明确记录夹具已清理。
- `network-session-flow` 首次因服务仍使用默认 8 小时会话而在等待 60 秒后得到 HTTP 200；这是测试环境未注入短会话参数，不是通过结果。test 服务以 `CRM_SESSION_MAX_AGE_SECONDS=60` 重启后再次真实等待 60 秒，接口返回 JSON 401，错误为“登录状态已过期”，响应体与 `x-request-id` 一致，退出码 0；最终日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-network-session-flow-20260825-163631.log`。
- 最终 `python scripts\manage.py data-reachability --profile test` 退出码 0：`Customer`、`FollowUp`、`Lead`、`Order`、`Payment`、`File`、`Message`、`ContractArchive`、`SystemSetting` 均为 0，外键孤立项、异常订单金额和负回款均为 0；日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260825-163839.log`。
- 最终 `python scripts\manage.py instance-status --profile test` 显示 `stopped`，PID 不存在、端口 `3001` 未监听、锁为 False；日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-instance-status-20260825-163839.log`。Playwright `.last-run.json` 状态文件已删除，`storage/test` 无测试上传残留。

## Apply working evidence - 2026-08-25 长时间稳定性与性能压力测试

- 新增 test-only k6 场景 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\k6\scripts\crm-stability.js`，并通过 `python scripts\manage.py stability --profile test` 统一执行；Windows/Python 和 shell 入口分别为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\scripts\performance\stability.py`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\scripts\performance\stability.sh`。
- 第一轮执行未进入压测门禁，原因是 test 没有现成 `.next/BUILD_ID`，生产模式按规则拒绝启动；随后稳定性入口增加现有 `manage.py build --profile test` 前置步骤。第二轮 k6 初始失败的原因是 VU Cookie 在迭代间被清空，修正为 `noCookiesReset=true` 后重新执行，未修改业务接口或放宽断言。
- 最终 k6 结果：3 分钟、8 个只读 VU、8 次受控客户写入、8270 个 HTTP 请求，吞吐 45.72 req/s，p95 80.55 ms，p99 174.63 ms，失败率 0%，检查通过率 100%，受控写入 p95 106.84 ms，丢弃迭代 0。
- 资源采样 17 次：CRM 进程内存 163.48 至 348.72 MB，句柄 824 至 891，数据库连接 9 至 24，未超过预算；服务重启恢复 6.64 秒。完整报告为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\稳定性与压力测试.md`，原始 JSON 为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\stability-performance-20260825T093135Z.json`，k6 汇总为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\k6-stability-K6-STABILITY-20260825092546.json`。
- 真实会话过期复验退出码 0，60 秒空闲后返回 JSON 401，错误文案为“登录状态已过期”，响应体和响应头 `requestId` 一致；日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-network-session-flow-20260825-173026.log`。
- 最终数据可达性退出码 0，Customer、FollowUp、Lead、Order、Payment、File、Message、ContractArchive、SystemSetting 均为 0；日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260825-173203.log`。最终实例状态为 stopped，端口未监听、锁为 False；日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-instance-status-20260825-173210.log`。

## Apply working evidence - 2026-08-25 技术栈迁移与安全保护

- test 通道已升级为 Next.js `15.4.11`、React/React DOM `19.1.1`、NextAuth `5.0.0-beta.32`、ECharts `6.1.0` 和匹配的 React 类型；`next.config.js` 已迁移为 `next.config.mjs`，Next.js 15 动态路由参数已改为 Promise 形式。生产构建生成 40 个静态页面及全部 API Route，退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-build-20260825-182052.log`。
- React 19 升级后，未重建的旧 production bundle 仍无法渲染 Ant Design 静态 `message` 和 `Modal.confirm`；前两轮分别为 13/22 通过，未将失败记为通过。确认 E2E 复用了旧 `.next` 后，客户端 Provider 加载 `@ant-design/v5-patch-for-react-19`，E2E 运行器改为每次先构建 test 产物。重建后 22/22 通过，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-e2e-20260825-182202.log`。
- 文件 E2E 夹具原先仅声明 `image/png`，内容不是 PNG，新的文件头校验正确返回 400。夹具改为真实的最小 PNG 字节后，上传、磁盘对象、数据库记录、下载内容、下载次数、删除和审计均通过；测试断言和服务端安全规则未放宽。
- `python scripts\manage.py security --profile test` 退出码 0：无 critical 运行依赖风险；stable/test 数据库、认证密钥、认证地址和上传目录独立；Git 跟踪文件未发现已知真实密码或非夹具连接串；发布白名单不包含环境文件、日志、测试脚本、上传或当前密钥；关键审计事件不存在操作者、`requestId` 或摘要缺失。日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-security-20260825-182459.log`。
- `security-flow` 在 test 服务未启动时首次以连接拒绝退出 1，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-security-flow-20260825-182512.log`。启动 test production 服务后重跑退出码 0，Cookie、CSP 等响应头、跨站写 403、错误脱敏、非法请求号替换、伪造 PDF 和路径文件名拒绝均通过，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-security-flow-20260825-182538.log`。
- `scripts/manage.py` 从 308 行拆到 255 行，命令执行和日志输出位于 81 行的 `scripts/cli/command_runner.py`。发布白名单和安全扫描已加入 `scripts/cli`，防止发布包缺少运行依赖；发布契约同步改为验证 `next.config.mjs`。
- 已知限制：项目规则固定 Next.js 15.4，依赖审计仍登记 `next` 残余风险，不能宣称公开风险全部消除；线上 TLS、反向代理、防火墙、数据库最小权限和备份介质权限尚需在实际服务器只读核对。完整说明为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\安全与数据保护检查.md`。
- 最终门禁再次通过：`release-test`、`typecheck`、自动重建后的 22 项 E2E、`security`、`routes`、`button-audit` 和 `data-reachability` 均退出码 0；对应日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-release-test-20260825-183012.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-typecheck-20260825-183020.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-e2e-20260825-183034.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-security-20260825-183510.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-routes-20260825-183254.log`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-button-audit-20260825-183301.log` 和 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260825-183308.log`。最终实例日志 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-instance-status-20260825-183319.log` 显示 stopped、端口未监听、锁为 False；test 业务表为 0，仅保留 2 条既有历史审计。

## Apply working evidence - 2026-08-25 发布文档与最终 test 门禁

- 新增维护手册 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\CRM系统维护与发布回滚手册.md`、stable 清单 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\CRM稳定版发布清单.md` 和客户说明 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\CRM系统客户运行说明.txt`。客户说明已检查为 UTF-8 BOM 和 Windows CRLF，命令使用 `python scripts\manage.py`，不要求客户安装 `uv`。
- 发布白名单补齐 `manage.py` 实际依赖、源码、类型配置、发布脚本和交付文档；同时排除 `public/uploads`、`.next/cache`、`__pycache__`、`.pyc`、环境文件、日志、测试脚本和数据库备份。发布回滚演练退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-release-test-20260825-194602.log`。
- 完整 test 门禁退出码均为 0：`check` 为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-check-20260825-193830.log`，按钮审计为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-button-audit-20260825-193950.log`，数据可达性为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260825-193951.log`，26 项 E2E 为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-e2e-20260825-194006.log`，安全检查为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-security-20260825-194556.log`。
- 性能门禁第一次按旧 100 kB 公共预算退出码 1，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-perf-20260825-194214.log`。历史构建证明公共包从 88.2 kB 变为 101 kB 与 React 19 的 Ant Design 兼容补丁同时发生；页面路由预算没有超限。公共预算按当前强制技术栈基线改为 105 kB，关键路由和全页面 500 kB 上限不变，复测退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-perf-20260825-194555.log`。
- 安全检查继续登记 Next.js 15.4.11 运行依赖残余风险；线上 TLS、云防火墙、数据库最小权限、备份介质权限、真实服务器恢复和浏览器兼容范围未由本地 test 验证。尚未执行 `promote` 或线上写操作。
- 项目规则禁止创建或委派子智能体，因此没有执行 spec-workflow 所述的独立 verifier；本节由主智能体依据实际命令退出码和日志记录，不冒充独立复核。

## Apply working evidence - 2026-08-25 最终 UI、数据与回溯复验

- 本轮修复了两个 390px 移动端横向溢出：提醒卡片补充内容区 `min-width: 0`、操作区换行和长文本断行；公海池搜索区改为移动端换行，表格限制在自身滚动容器内。修改文件为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\src\app\(dashboard)\reminders\reminder-cards.tsx`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\src\app\(dashboard)\public-pool\page.tsx`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\src\app\(dashboard)\public-pool\pool-table.tsx` 和 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\src\app\globals.css`。
- `python scripts\manage.py typecheck --profile test` 退出码 0；`python scripts\manage.py check --profile test` 退出码 0，完成路由、Prisma、TypeScript 和生产构建检查，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-check-20260825-201423.log`。
- `python scripts\manage.py e2e --profile test` 最终 28/28 通过，覆盖业务按钮、权限、恢复、18 个页面的 1440、1280、1024、768、390px 视口、键盘焦点、表单标签、reduced-motion 和手机抽屉导航；最终日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-e2e-20260825-201043.log`，按钮报告为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\Playwright按钮级验收.md`。
- 中间复测曾先发现 `/reminders`、随后发现 `/public-pool` 在 390px 横向溢出，均保留在日志中并实际修复；没有放宽 UI 断言、跳过页面或改为只检查局部容器。
- `python scripts\manage.py button-audit --profile test` 退出码 0，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-button-audit-20260825-201527.log`；`python scripts\manage.py data-reachability --profile test` 退出码 0，数据库网络、`SELECT 1`、15 张核心表、12 条页面到 API 到模型到审计链路、外键孤立项和金额质量检查均通过，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260825-201539.log`。
- 数据可达性复核显示 test 数据库中的 Customer、FollowUp、Lead、Order、Payment、File、Message、ContractArchive、SystemSetting 均为 0；保留 2 条既有 `AuditEvent` 历史，不删除原始审计数据。
- `python scripts\manage.py perf --profile test` 退出码 0，前端性能预算报告为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\前端性能预算.md`，日志为 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-perf-20260825-201551.log`。
- E2E 结束后已清理 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\output\playwright\results`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\output\playwright\report`、`D:\Desktop\CRM系统代码 (2)\CRM系统代码\output\playwright\.last-run.json` 和 `D:\Desktop\CRM系统代码 (2)\CRM系统代码\storage\test` 下的测试上传内容；测试服务、端口和实例锁由 E2E 入口停止并复核。
- 当前仍未执行线上 `promote`，未修改 stable 数据库或线上进程；真实服务器 TLS、反向代理、防火墙、备份介质权限和线上恢复能力仍需在服务器环境只读核对。18.5 保持未完成，等待用户明确确认后再执行。
