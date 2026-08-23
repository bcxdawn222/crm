# Research: crm-code-audit-and-flow-repair

## Practices
- Next.js App Router 的 Route Handler 只允许导出 HTTP 方法和框架配置；当前 `src/app/api/customers/cooperating/route.ts` 额外导出 `GET_REMINDERS`，已被 `next build` 的生成类型检查直接阻断。处理应把续签提醒拆成独立路由，避免继续向 Route Handler 添加业务导出。
- 认证与数据权限必须共用数据库中的用户、角色和权限事实源。当前 `src/lib/auth.ts` 使用硬编码演示账号，而 Prisma `User`、`UserRole`、`RolePermission` 已提供真实数据关系；继续保留两套事实源会造成登录身份与业务数据所有者不一致。参考：Next.js Authentication Guide（Context7 来源 `https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/authentication.mdx`）、Auth.js 文档（Context7 `/websites/authjs_dev`）。
- 需要同时更新金额记录和订单汇总时，应使用同一事务中的读改写，并对并发重试、唯一编号和余额不变量做验证。当前收款接口先独立读取订单，再用批量事务执行创建与更新，两个并发请求可能依据同一个旧未收款金额同时通过校验。参考：Prisma Transactions（Context7 `/prisma/prisma`，包含 `Serializable` 示例）。
- 用户界面调用的路径必须与实际 Route Handler 路径一致；修复优先采用兼容路由或共享业务函数，保留已有 `/api/public-pool`、`/api/customers/cooperating` 等消费者，避免只改一侧造成新的断裂。
- 业务流转记录应保留原负责人、进入公海时间、流转原因和认领人；Customer 已有 `publicPoolHistory`、`originalSalesId`、`publicPoolEnteredAt` 等字段，本轮优先修复写入时机和并发条件，不新增审计表。

## Constraints
- 当前项目技术栈为 Next.js 14.2.35、React 18.3.1、TypeScript 5.9.3、Prisma 5.22.0、MySQL、NextAuth 5 beta、Ant Design 5；用户要求通过 Context7 核对最新用法，但本轮不把 Next.js 15.4/React 19 升级与业务修复强绑定。
- `npm run build` 当前失败于 `.next/types/app/api/customers/cooperating/route.ts`，错误指出非法导出 `GET_REMINDERS`；因此构建恢复是 P0 验收前置条件。
- 当前工作区没有 `.git` 目录，`git rev-parse` 在项目目录、父目录均失败；本轮可以维护源码和验证脚本，但无法在现有状态下真实合并到 `main` 或提交，除非先建立 Git 仓库并确认提交边界。
- 用户要求保留原始数据并支持双向流转；本轮不采用硬删除客户流转历史或收款记录的方式解决页面问题。收款删除入口先按“不可删除、等待可追溯作废流程”处理，避免未定义的财务语义。
- `src` 中存在多个超过 300 行的页面文件和至少 84 处 `any`/`as any`，本轮只拆分直接阻塞主链路的模块；大范围 UI 重构、全面类型收紧和依赖升级另立变更。
- `npm audit --registry=https://registry.npmjs.org` 报告 15 个漏洞，其中包括 Next.js、NextAuth/Auth.js、ECharts、Socket.IO Parser 和 `xlsx`；升级依赖可能带来破坏性变化，本轮只记录并建立独立依赖治理任务，不执行 `npm audit fix --force`。

## Open [TBD]

## Decided
- [DEC-1] 第一批修复范围限定为构建阻断、主页面路由断裂、认证事实源、公海流转并发/溯源和收款删除误导；来源为代码扫描与 `npm run build` 结果，理由是这些问题会直接阻止登录、页面操作或产生错误数据。
- [DEC-2] 续签提醒采用独立兼容路由 `/api/customers/renewal-reminders`，保留现有页面调用；来源为现有页面请求与非法 `GET_REMINDERS` 导出，理由是改调用方会扩大兼容面且没有必要。
- [DEC-3] 公海认领新增 `/api/public-pool/claim` 兼容入口，同时保留 `/api/public-pool` 的旧 POST；来源为页面调用路径与现有 POST 实现不一致，理由是双入口能减少旧消费者回归风险。
- [DEC-4] 认证改为查询 Prisma 用户及其角色权限并使用 bcrypt 校验，默认不再把硬编码账号作为生产认证事实源；来源为数据库模型、种子脚本和 `src/lib/auth.ts`，理由是当前会话 ID 与数据库用户 ID 不一致会导致所有权查询、数据范围和审计失真。该决定涉及用户登录语义，标记为 escalated。
- [DEC-5] 收款记录不在本轮新增硬删除接口；前端去掉当前必然 404 的删除操作，保留新增和查询，后续另立“收款作废/冲正/审计”变更；来源为用户要求保留原始数据与当前无删除路由，理由是直接补删除会破坏财务可追溯性。该决定涉及用户可见财务语义，标记为 escalated。
- [DEC-6] Git 操作只在检测到有效 `.git` 仓库后执行；当前记录为阻塞项，不初始化仓库、不提交未知历史；来源为 `git rev-parse` 结果，理由是自动初始化会把现有大量文档、图片和依赖状态纳入不可逆提交。
