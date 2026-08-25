# CRM 按钮契约清单

更新日期：2026 年 8 月 25 日

## 编号规则

- `NAV-*`：菜单和页面导航。
- `SHELL-*`：侧栏、账号和网络恢复。
- `CUS/POL/LEAD/TEL/COOP-*`：客户、公海、每日客资、电销和合作客户。
- `ORD/PAY/FIN-*`：订单、收款和财务报表。
- `REP/MSG/TASK/FILE-*`：日报、消息、任务和文件。
- `USR/ROLE/SET-*`：用户、角色和设置。
- `COMMON-FILTER`、`COMMON-PAGE`、`COMMON-CANCEL`：页面内重复使用的筛选、分页和取消动作；实例 ID 由页面前缀加通用 ID 组成，例如 `ORD-COMMON-FILTER`。

## 导航与外壳

| ID | 入口 | 权限 | 动作与成功证据 | 失败证据 |
| --- | --- | --- | --- | --- |
| `NAV-001..018` | 18 个 Sidebar 页面入口 | 对应页面权限 | 路由改变、菜单选中、页面标题唯一 | 无权限菜单隐藏，直达页面 403 |
| `SHELL-001` | 桌面折叠/展开 | 登录用户 | 侧栏宽度和内容偏移同步 | 布局不得横向溢出 |
| `SHELL-002` | 手机菜单 | 登录用户 | 抽屉打开，选中路由后关闭 | 390px 仍可到达全部授权页面 |
| `SHELL-003` | 账号菜单/退出 | 登录用户 | 会话结束并进入登录页 | 草稿按白名单清理 |
| `SHELL-004` | 网络恢复 | 登录用户 | 恢复后重新拉取只读数据 | 不自动重放写操作 |

## 客户业务

| ID | 页面与文字 | 权限 | Handler / API | 数据与审计证据 |
| --- | --- | --- | --- | --- |
| `CUS-001` | 客户-新增客户 | `customer:create` | `POST /api/customers` | Customer 新增，`CUSTOMER_CREATED` |
| `CUS-002` | 客户-客资录入 | `customer:create` | `POST /api/customers/import` | 整批事务，`CUSTOMERS_IMPORTED` |
| `CUS-003` | 客户-查看 | `customer:view` | 只读详情 | 不显示保存入口 |
| `CUS-004` | 客户-编辑 | `customer:update` | `PUT /api/customers/[id]` | Customer 更新，`CUSTOMER_UPDATED` |
| `CUS-005` | 客户-删除 | `customer:delete` | `DELETE /api/customers/[id]` | 软删除，`CUSTOMER_SOFT_DELETED` |
| `CUS-006` | 客户-归档 | `customer:update` | `POST /api/customers/[id]/archive` | 进入公海，保留历史 |
| `CUS-007` | 客户-转移 | 主管/管理员及 `customer:update` | `POST /api/customers/[id]/transfer` | salesId 更新，`CUSTOMER_TRANSFERRED` |
| `CUS-008` | 客户-新增跟进 | `followUp:create` | `POST /api/customers/[id]/follow-ups` | FollowUp 新增，提醒时间线更新 |
| `POL-001` | 公海-认领 | `customer:update` | `POST /api/public-pool/claim` | salesId/isPublic 更新，`PUBLIC_POOL_CLAIM` |
| `POL-002` | 公海-自动转入 | 管理权限 | `POST /api/public-pool/auto-move` | 符合规则客户进入公海 |
| `LEAD-001` | 每日客资-查看详情 | `customer:view` | 只读统计接口 | 日期和客户明细一致 |
| `TEL-001` | 电销-新增/编辑 | `lead:create/update` | `POST/PATCH /api/telemarketing` | 电销记录持久化并审计 |
| `TEL-002` | 电销-删除 | `lead:update` | `DELETE /api/telemarketing` | 未转化记录删除并审计 |
| `TEL-003` | 电销-转入客户 | `lead:convert` + `customer:create` | `POST /api/telemarketing/convert` | 事务创建唯一 Customer，`TELEMARKETING_CONVERTED` |
| `COOP-001` | 合作客户-编辑 | `customer:update` | `PUT /api/customers/cooperating` | 合作字段更新，`COOPERATING_CUSTOMER_UPDATED` |
| `COOP-002` | 合作客户-合同备案 | `customer:update` | `/api/customers/[id]/contract-archives` | 文件、ContractArchive、版本和审计一致 |

## 财务与协作

| ID | 页面与文字 | 权限 | Handler / API | 数据与审计证据 |
| --- | --- | --- | --- | --- |
| `ORD-001` | 订单-新增/编辑 | `order:create/update` | `POST/PATCH /api/finance/orders` | Order 金额和客户范围正确，审计存在 |
| `ORD-002` | 订单-删除 | `order:cancel` | `DELETE /api/finance/orders/[id]` | 状态前置条件和历史保留 |
| `PAY-001` | 收款-登记收款 | `payment:create` | `POST /api/finance/payments` | Payment、订单已收/未收和审计同事务 |
| `FIN-001` | 财务报表-查询 | `report:view` | `GET /api/finance/reports/summary` | 日期范围和销售数据范围一致 |
| `REP-001` | 日报-提交 | `report:daily:create` | `POST /api/daily-reports` | 双击只产生一条 DailyReport |
| `REP-002` | 日报-查看 | `report:daily:view` | 只读详情 | 表格与详情字段一致 |
| `MSG-001` | 消息-查看/已读 | `message:view` | `PATCH /api/messages/[id]` | isRead 更新，未读数同步 |
| `MSG-002` | 消息-全部已读 | `message:view` | `POST /api/messages/read-all` | 当前用户消息批量已读 |
| `MSG-003` | 消息-删除 | `message:delete` | `DELETE /api/messages/[id]` | 消息删除且不能越权 |
| `TASK-001` | 任务-创建 | `task:create` | `POST /api/tasks` | Task 写入，负责人范围正确 |
| `FILE-001` | 文件-上传 | `file:upload` | `POST /api/files` | 存储对象、File 元数据和审计一致 |
| `FILE-002` | 文件-下载 | `file:download` | `GET /api/files/[id]` | 内容正确，下载次数增加 |
| `FILE-003` | 文件-删除 | `file:delete` | `DELETE /api/files/[id]` | 元数据与存储对象删除，审计存在 |

## 提醒与系统管理

| ID | 页面与文字 | 权限 | Handler / API | 数据与审计证据 |
| --- | --- | --- | --- | --- |
| `REM-001` | 提醒-跟进 | `followUp:create` | 客户跟进 API | FollowUp 和提醒状态同步 |
| `REM-002` | 提醒-不再提醒 | `customer:update` | `POST /api/reminders/disable` | reminderDisabled 更新 |
| `REM-003` | 提醒-恢复 | `customer:update` | `POST /api/reminders/enable` | 客户重新进入提醒查询 |
| `USR-001` | 用户-新增/编辑 | `user:create/update` | `POST/PATCH /api/users` | 密码只存 bcrypt，角色关系更新并审计 |
| `USR-002` | 用户-停用 | `user:delete` | `PATCH /api/users/[id]` | status=INACTIVE，旧会话失效，审计保留 |
| `ROLE-001` | 角色-编辑 | `role:update` | `PATCH /api/roles/[id]` | RolePermission 更新，重新登录后生效 |
| `SET-001` | 设置-保存 | `setting:update` | `PUT /api/settings` | SystemSetting 持久化，刷新回显 |

## 通用失败契约

- 写按钮在请求期间 `loading/disabled`，不自动重试 POST、PUT、PATCH 或 DELETE。
- 401 保存允许保存的草稿并回到登录页；403 不显示成功反馈；409 保留表单并显示冲突原因。
- 未知 500 返回通用错误和 `requestId`，完整异常只进入文件日志。
- 文件或数据库写入失败时不保留半成品、孤立元数据或成功审计。
- 静态审计入口：`python scripts\manage.py button-audit --profile test`。
- 浏览器证据：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\Playwright按钮级验收.md`。
- 权限映射：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\权限与数据范围矩阵.md`。

明确限制：合同预览、下载等只读动作由内容流程验证；Firefox、WebKit 和屏幕阅读器完整操作尚未自动化。
