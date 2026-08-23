# Verification Ledger: crm-code-audit-and-flow-repair

## Round 0 - research baseline

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-1 | necessity | major | fixed(r0) | 认证从硬编码账号切换到数据库会改变本地演示登录方式，需要明确测试数据准备边界 | proposal Risk 已要求先核验数据库用户；tasks 3.3 增加数据库用户所有权回归，不以硬编码回退掩盖缺失数据 |
| V-2 | regression-compat | major | refuted(r0) | 收款删除入口直接移除会改变现有财务操作，需要后续作废/冲正路径承接 | 当前按钮调用不存在的接口，本来就不能完成操作；用户要求保留原始数据，直接补硬删除的风险更高，proposal 已明确后续作废/冲正边界 |
| V-3 | regression-compat | major | fixed(r0) | 公海认领双入口若没有共享用例，可能出现两个入口写入历史规则不同 | proposal How 与 tasks 4.1-4.2 已要求两个入口复用同一认领用例并执行相同回归 |

## Baseline Evidence
- `npm run build`：失败，`.next/types/app/api/customers/cooperating/route.ts` 报 `GET_REMINDERS` 非法导出。
- `npm audit --registry=https://registry.npmjs.org`：15 个漏洞；本轮不执行强制升级。
- `git rev-parse --show-toplevel`：项目目录及父目录均不是 Git 仓库。
- 已通过 Context7 查询 Next.js Route Handler/认证、Prisma 事务与迁移用法；外部技术原则只作为实现约束，不作为已完成代码的证明。
- 项目指令禁止创建或委派子智能体，因此本轮未伪造独立 critique panel；以上 Round 0 为主智能体按 necessity 与 regression-compat 两个视角进行的证据化自审。

## Round 1 - implementation and self-run verification

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-4 | build-contract | major | fixed(r1) | 续签提醒非法 Route Handler 导出阻断构建 | `python scripts\\manage.py build` 退出码 0；构建输出包含 `/api/customers/renewal-reminders` |
| V-5 | run-debug | major | fixed(r1) | 原启动脚本仅记录子进程创建成功，服务实际可能未监听端口 | `scripts/manage.py` 已加入端口健康检查、提前退出日志、陈旧 PID 清理；启动测试成功返回 `http://127.0.0.1:3000`，停止测试通过 `taskkill` 清理进程树 |
| V-6 | database-availability | blocker | blocked(r1) | 数据库依赖链路无法完成真实业务验证 | `logs/dev-server.log` 明确记录 `Can't reach database server at localhost:3306`；`python scripts\\manage.py dbstart` 返回 Windows 服务 `MySQL` 错误码 5 `Access is denied` |
| V-7 | static-contract | major | fixed(r1) | 路由、类型和生产构建需要在修复后重新确认 | `python scripts\\manage.py routes`、`python scripts\\manage.py typecheck`、`python scripts\\manage.py build` 均退出码 0 |
| V-8 | product-flow | major | open-next | 订单客户下拉、任务负责人下拉没有加载选项；页面仍使用不存在的 `PROCESSING`、`DONE` 状态值 | 代码审查证据：`src/app/(dashboard)/finance/orders/page.tsx` 的客户 `Select` 无 `options`；`src/app/(dashboard)/tasks/page.tsx` 的负责人 `Select` 无 `options`；对应 Prisma 枚举为 `CONFIRMED`、`DELIVERING`、`COMPLETED`。该项超出本次已批准 proposal 的 What 范围，需下一轮单独修复 |
| V-9 | maintainability | minor | fixed(r1) | `scripts/manage.py` 在加入健康检查后达到 387 行，超过项目 Python 文件规模约定 | 运行管理逻辑已拆到 `scripts/runtime_manager.py`；最终行数为 `manage.py` 193、`runtime_manager.py` 213、`smoke-http.py` 185，`scripts` 顶层 8 个条目 |
| V-10 | dependency-security | critical | open-next | 当前依赖仍有 15 项漏洞，包含 2 个 critical | `python scripts\\manage.py audit` 输出 2 moderate、11 high、2 critical；Next.js/ECharts 修复涉及 proposal 明确排除的大版本升级，`xlsx` 报告无可用修复，本轮未运行强制升级 |

## Round 1 - command evidence

- `python scripts\\manage.py routes`：通过，退出码 0。
- `python scripts\\manage.py typecheck`：通过，包含 `prisma generate` 和 `npx tsc --noEmit`，退出码 0。
- `python scripts\\manage.py build`：通过，`next build` 退出码 0；期间的 `Dynamic server usage` 是构建阶段对动态 Route Handler 的日志，不构成失败。
- `python scripts\\manage.py start`：通过健康检查，服务在 `http://127.0.0.1:3000` 监听；随后通过 `python scripts\\manage.py stop` 停止。
- `python scripts\\manage.py smoke`：未通过，原因是数据库服务不可达，不是测试绕过；服务日志已记录 Prisma 初始化错误。
- `python scripts\\manage.py dbstart`：未通过，Windows 服务 `MySQL` 启动返回错误码 5，需要管理员权限；没有执行清库、种子或业务写入脚本。
- `python scripts\\manage.py audit`：退出码 1，报告 15 项漏洞；完整日志为 `logs/manage-audit-20260822-123830.log`。
- `git rev-parse --show-toplevel`：仍失败，项目目录没有 `.git`；没有执行合并或提交。

## Round 1 - scope notes

- 本轮没有删除客户、收款、流转历史、既有测试脚本、历史报告或业务数据。
- 本轮新增的 `scripts/smoke-http.py` 是只读 HTTP 冒烟测试，不创建、修改或删除业务数据。
- `start.bat`、`setup-auto-start.bat`、`启动说明.txt` 和 `MYSQL_STARTUP_GUIDE.md` 已从错误的固定服务名 `MySQL97` 改为默认 `MySQL`，并支持 `CRM_MYSQL_SERVICE` 覆盖。
- 由于项目指令禁止子智能体，本轮没有伪造独立 verifier 结果；Round 1 是主智能体按实际命令输出完成的验证记录。

## Round 2 - proposal critique

本轮按照 `spec-workflow` 要求进行主智能体自审。项目指令禁止创建或委派子智能体，因此不伪造独立 critique panel；审查只记录已核验的代码事实和方案风险。

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-11 | necessity | major | fixed(r2) | 如果只给下拉框补选项，不同步修复服务端权限和页面状态值，销售仍会在提交时收到 403，订单和任务筛选仍可能传非法枚举 | proposal What 同时覆盖选项加载、服务端范围校验、销售创建权限和真实状态映射；tasks 7-8 按接口与页面拆分验证 |
| V-12 | regression-compat | major | fixed(r2) | 直接复用管理员 `/api/users` 会把任务负责人查询绑定到 `user:view`，销售无法使用，或为绕过权限暴露过多用户字段 | design 保留 `/api/users` 管理员契约，新增最小字段的 `/api/tasks/assignees`；proposal 明确不返回密码、权限和无关字段 |
| V-13 | regression-compat | major | escalated | 销售是否只能创建自己的任务属于产品权限语义，不能仅依据页面当前按钮推断 | research DEC-10 与 proposal Risk 已标记；硬门需由用户确认“销售只能指派自己”，或提出同组派单规则 |

## Round 2 - evidence baseline

- `research.md` 已无未处理的 `[TBD]`，DEC-9 为可回退的接口复用决策，DEC-10 为需要硬门确认的产品决策。
- `design.md` 已定义四个接口方向、真实枚举、数据范围和无迁移约束。
- `proposal.md` 已移除上一轮审批标记，改为本轮订单和任务流程修复范围。

## Round 3 - implementation verification

本轮未创建或委派独立验证子智能体，原因是项目指令明确禁止子智能体；以下记录由主智能体依据实际命令输出完成，数据库阻塞单独保留。

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-14 | product-flow | major | fixed(r3) | 订单和任务页面的远程选择项、真实状态枚举和新增入口已经接上，页面不再引用 `PROCESSING` 或 `DONE` | `python scripts\\manage.py routes` 退出码 0；检查脚本覆盖 `/api/customers`、`/api/tasks/assignees`、页面选项和旧状态片段；生产构建路由表包含 `/api/tasks/assignees` |
| V-15 | security-boundary | critical | fixed(r3) | 仅修页面会让客户端可以提交任意客户或负责人 ID，因此服务端必须重新校验数据范围 | `POST /api/finance/orders` 查询 ACTIVE、非公海且符合 `buildDataFilter` 的客户；`POST /api/tasks` 使用 `findTaskAssigneeWithinScope`，并区分不存在/停用与越权 |
| V-16 | validation-contract | major | fixed(r3) | 分页、日期、金额、币种、任务状态和优先级的非法输入如果直接进入 Prisma，会产生不稳定的 500 或空结果 | `parsePagination` 统一校验；订单和任务接口使用 Prisma 枚举与显式日期/金额校验；类型检查和生产构建均通过 |
| V-17 | database-availability | blocker | blocked(r3) | 真实客户选择、订单创建、负责人选择、任务创建和越权拒绝无法在当前环境完成 | `python scripts\\manage.py dbstatus` 退出码 1，记录 `127.0.0.1:3306` 未监听；`python scripts\\manage.py start` 尝试启动 `MySQL` 时返回 Windows 服务错误码 5 `Access is denied`；未写入或删除业务数据 |
| V-18 | maintainability | minor | fixed(r3) | 订单页和任务页原文件较大且混合表单、远程查询和列表逻辑，后续修改容易相互影响 | 表单已拆为 `order-form-modal.tsx`、`task-form-modal.tsx`，页面分别约 260 行和 230 行以内；新增共享分页和负责人范围工具保持单一职责 |

## Round 3 - command evidence

- `python scripts\\manage.py routes`：通过，退出码 0；日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\manage-routes-20260822-130513.log`。
- `python scripts\\manage.py typecheck`：通过，退出码 0；日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\manage-typecheck-20260822-130305.log`。
- `python scripts\\manage.py check`：通过，包含路由检查、Prisma 生成、类型检查和 `next build`，退出码 0；日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\manage-check-20260822-130527.log`。
- `python -m py_compile scripts\\manage.py scripts\\runtime_manager.py scripts\\check-crm-flow.py`：通过，退出码 0。
- `python scripts\\manage.py dbstatus`：失败，退出码 1，数据库端口未监听；未执行数据库写入测试。
- 本轮没有新增持久化测试文件；`py_compile` 生成的 `scripts\\__pycache__` 已清理。项目原有 `scripts\\docs\\__pycache__` 未触碰。
- 页面状态扫描：通过，订单和任务页面不再包含 `PROCESSING` 或 `DONE`。
- 当前目录仍没有 `.git` 元数据，因此没有合并 `main` 或提交操作。

## Round 4 - real product-flow verification

本轮使用临时数据库 `crm_system_codex_verify_20260822`，通过真实 Next.js 开发服务和 Playwright 登录会话完成订单、任务页面及接口验证。临时数据库不代表生产数据，验证完成后应删除；原有 `crm_db` 未使用、未修改。

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-19 | product-flow | major | fixed(r4) | 销售订单客户下拉、订单创建和订单列表展示需要真实数据验证 | 销售账号登录 `http://127.0.0.1:3000` 后，订单弹窗加载“验证客户-可访问”；创建订单成功，列表显示状态 `CONFIRMED`、合同金额 `1000`、未付金额 `1000` |
| V-20 | product-flow | major | fixed(r4) | 销售任务负责人下拉、任务创建和任务列表状态需要真实数据验证 | 创建任务弹窗负责人字段为禁用状态并显示“验证销售 - 销售部”；创建成功，任务列表显示负责人/创建人“验证销售”、状态 `TODO` |
| V-21 | security-boundary | critical | fixed(r4) | 订单越权客户、停用客户和任务越权负责人必须由服务端拒绝 | `POST /api/finance/orders` 对越权客户返回 `403`；对停用客户返回 `404`；销售提交管理员用户为任务负责人时，`POST /api/tasks` 返回 `403` |
| V-22 | validation-contract | major | fixed(r4) | 订单和任务状态筛选必须使用真实 Prisma 枚举，并拒绝旧状态值 | `status=CONFIRMED` 和 `status=TODO` 均返回 `200` 且返回对应记录；订单 `status=PROCESSING`、任务 `status=DONE` 均返回 `400` |
| V-23 | database-availability | blocker | fixed(r4) | 本地 MySQL 阻塞已解除，但验证环境使用临时数据库，不能据此宣称生产数据库已验收 | 显式启动 `mysqld.exe` 后 `127.0.0.1:3306` 可用；Next.js 服务日志记录订单和任务请求均完成；生产数据库 `crm_db` 未执行写入 |
| V-24 | authentication | major | fixed(r4) | 数据库认证需要同时拒绝错误密码和停用账号，并确认会话用户来自数据库记录 | 正确销售账号登录成功；错误密码提交后仍停留在 `/login`；临时 `INACTIVE` 用户提交正确密码后仍停留在 `/login`；SQL 查询核对 `admin` 与 `sales_verify_20260822` 的数据库 ID，且临时库已删除 |

### Round 4 command and browser evidence

- `npx --yes --package @playwright/cli playwright-cli -s=crm-sop-verify snapshot`：任务页面可打开，销售账号显示“创建任务”。
- 通过 Playwright 创建任务：页面列表出现“验证销售任务 20260822”，状态为“待办”。
- `POST /api/finance/orders` 越权客户：HTTP `403`，响应 `No permission to create an order for this customer`。
- `POST /api/finance/orders` 停用客户：HTTP `404`，响应 `Customer not found or inactive`。
- `POST /api/tasks` 越权负责人：HTTP `403`，响应 `No permission to assign this task`。
- `GET /api/tasks?page=1&pageSize=10&status=TODO`：HTTP `200`，返回 1 条任务。
- `GET /api/finance/orders?page=1&pageSize=10&status=CONFIRMED`：HTTP `200`，返回 1 条订单。
- `GET /api/tasks?...&status=DONE`：HTTP `400`，响应 `Task status is invalid`。
- `GET /api/finance/orders?...&status=PROCESSING`：HTTP `400`，响应 `Order status is invalid`。
- `python scripts\\manage.py check`：退出码 `0`；路由检查、Prisma Client 生成、TypeScript 检查和 `next build` 均通过。构建期间出现的 `Dynamic server usage` 是动态 Route Handler 的预渲染提示，最终构建仍以退出码 `0` 完成。
- 公海归档/认领真实接口：归档 `200`；认领 `200`；`originalSalesId` 保留原销售 ID，`publicPoolHistory` 追加 `ARCHIVED` 和 `CLAIMED` 两条事件。
- 公海并发认领：一个请求 `200`，另一个请求 `409`，错误码 `ALREADY_CLAIMED`。
- 活跃客户配额：HTTP `400`，错误码 `ACTIVE_CUSTOMER_LIMIT_EXCEEDED`。
- 每日认领配额：HTTP `400`，错误码 `DAILY_CLAIM_LIMIT_EXCEEDED`。

### Round 4 remaining scope

- `V-10` 依赖漏洞仍为 `open-next`，本轮没有擅自升级 Next.js、ECharts 或 `xlsx`。
- 收款专用接口仍未在本轮重新执行完整真实回归；依赖漏洞 `V-10` 仍保持 `open-next`。
- 当前目录没有 `.git`，仍不能执行合并 `main` 或提交。

## Round 5 - public-pool verification

本轮使用临时数据库 `crm_system_public_pool_verify_20260822`，验证完成后已删除该数据库，原有 `crm_db` 未使用、未修改。

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-25 | public-pool | critical | fixed(r5) | 公海归档、认领、配额和并发场景必须保留数据来源并由服务端控制 | 归档后 `originalSalesId` 保留原销售；认领后 `salesId` 切换为新销售且历史追加 `CLAIMED`；两个销售同时认领同一客户仅一个返回 `200`，另一个返回 `409 ALREADY_CLAIMED`；活跃客户上限返回 `ACTIVE_CUSTOMER_LIMIT_EXCEEDED`；每日认领上限返回 `DAILY_CLAIM_LIMIT_EXCEEDED` |

### Round 5 command and browser evidence

- 公海归档接口：HTTP `200`，客户进入公海，状态为 `INACTIVE`，`originalSalesId` 写入原销售 ID，历史追加 `ARCHIVED`。
- 公海认领接口：HTTP `200`，客户转为新销售名下，状态为 `ACTIVE`，`originalSalesId` 保持原销售 ID，历史追加 `CLAIMED`。
- 并发认领：两个销售同时提交同一客户，一个请求 HTTP `200`，另一个 HTTP `409`，错误码 `ALREADY_CLAIMED`。
- 活跃客户上限：HTTP `400`，错误码 `ACTIVE_CUSTOMER_LIMIT_EXCEEDED`。
- 每日认领次数上限：HTTP `400`，错误码 `DAILY_CLAIM_LIMIT_EXCEEDED`。

### Round 5 remaining scope

- 收款专用接口仍未在本轮重新执行完整真实回归；依赖漏洞 `V-10` 仍保持 `open-next`。
- 当前目录没有 `.git`，仍不能执行合并 `main` 或提交。
