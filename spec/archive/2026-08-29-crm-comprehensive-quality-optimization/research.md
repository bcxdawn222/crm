# Research: crm-comprehensive-quality-optimization

## Practices

- 现有管理系统的 UI 优化应建立在真实业务动作之上：先建立“页面-按钮-权限-接口-数据表-审计”映射，再调整布局和交互；否则视觉验收无法证明功能可用。
- React/Next.js 大型页面宜按业务能力拆为页面容器、查询区、表格、操作弹窗和数据访问模块，并由统一请求层处理超时、取消、401、错误分类和请求标识；这与项目中 8 个超过 300 行的页面及大量重复 `fetch`/`message.error` 直接相关。
- Playwright 的 actionability、web-first assertion 和 trace 适合按钮级验收：测试应点击真实控件并检查网络响应、页面结果和数据库结果，而不是只判断元素存在。
- 会话稳定不等于无限延长登录。空闲恢复需要分别处理身份过期、未提交表单草稿、网络恢复后的重新拉取和写操作重复提交；非幂等写入不得自动重试。
- 稳定版与测试版应分离环境变量、数据库、上传目录、端口、PID、日志和构建产物。测试版不得写入稳定版数据库，提升到稳定版前必须经过同一套脚本化验收。
- 性能治理先记录基线，再设置预算并测量回归；前端关注首屏资源、交互延迟和大列表，服务端关注慢查询、N+1、连接管理、分页和批量操作。

Key references:
- https://nextjs.org/docs/app/guides/upgrading/version-15
- https://react.dev/blog/2024/12/05/react-19
- https://5x.ant.design/docs/react/v5-for-19/
- https://authjs.dev/guides/refresh-token-rotation
- https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-management
- https://playwright.dev/docs/actionability
- https://playwright.dev/docs/test-assertions
- https://playwright.dev/docs/trace-viewer
- https://web.dev/articles/vitals
- https://nextjs.org/docs/app/guides/package-bundling

## Constraints

- 当前安装版本为 Next.js 14.2.35、React 18.3.1、Ant Design 5.29.3、Prisma Client 5.22.0、NextAuth 5.0.0-beta.31 和 TypeScript 5.9.3；直接在稳定版升级框架会同时影响认证、中间件、Ant Design 渲染和构建行为。
- `next.config.js` 使用 CommonJS；新改动需迁移为 ESM/TypeScript 配置，但必须在测试版构建和浏览器回归通过后再提升。
- CRM 有 18 个业务页面和 38 个 API Route；客户、合作客户、每日客资、提醒、电销等页面体积过大，最大页面约 706 行，继续堆叠会增加按钮回归和维护成本。
- 文件、消息、用户管理页面使用本地 `mock` 数据；文件上传/下载/删除、消息已读/查看/删除、用户编辑/删除等可见按钮没有完整真实链路。系统设置“保存”只弹成功提示，未持久化。
- 提醒页“跟进客户”当前只调用 `message.info`，没有进入客户跟进页面或创建跟进记录，属于可点击但不完成业务动作的入口。
- 页面普遍直接调用 `fetch`，错误多被统一显示为“网络错误”；当前没有统一超时、取消、401 恢复、离线恢复和写操作重入控制。
- NextAuth 使用 JWT，`maxAge` 为 8 小时；未发现统一会话过期提示、重新登录后恢复当前位置或表单草稿的机制。
- 路由、中间件、按钮和 API 权限检查并非同一份契约；按钮可见性、页面访问、接口权限和数据范围需要四层一致性验证。
- `scripts/runtime_manager.py` 已有 PID 文件和端口检查，但无法充分识别 PID 复用、不同项目占用、陈旧锁和 stable/test 双实例边界。
- `scripts/manage.py` 已统一写入 `logs/`，但尚无 profile、按钮审计、数据可达性、E2E、性能、发布提升和回滚动作。
- 当前只有 `.env.local` 与 `.env.example`，没有 stable/test 独立数据库、上传目录、日志、端口和发布配置。
- 仓库根目录没有 `.git`，当前无法满足“一步一提交、可回溯”；初始化 Git 会改变项目元数据，需在实施门禁确认。
- `spec/changes/` 有三个未归档变更：两个已完成，一个仍缺本地 MySQL 条件下的 HTTP 冒烟；Spec 工作流设计为单一活动变更，实施前需处理旧变更状态。
- 现有客户、线索、电销、订单、回款、日报、任务、消息、文件、合同和权限字段均应保留；任何迁移不得删除原始业务数据。
- 所有运行、测试、构建和发布动作必须从 `scripts/*.py` 与 `scripts/*.sh` 进入并写入 `logs/`；Windows 客户路径使用 `python`，不引入 `uv` 前置条件。
- 禁止子智能体和并行实施；任务由主智能体单线程按依赖顺序执行。

## Open [TBD]

无。

## Decided

- [DEC-1] 本变更只优化当前销售 CRM 的非新增业务能力，排除 pymss/MSST、DDSP、SVC、GPU 适配和音频模型移植 | source: 用户明确范围 | rationale: 这些内容与当前仓库和 CRM 业务无关。
- [DEC-2] 保留 Ant Design 作为唯一主要组件库，不引入 Tailwind 或第二套 UI 组件体系 | auto | rationale: 当前页面、表格、表单和弹窗均基于 Ant Design，替换会扩大回归范围；该决定可逆。
- [DEC-3] 每个可见按钮必须对应真实处理器、权限、接口、持久化结果和可观察反馈；无法完成真实动作的按钮必须移除或明确禁用，不允许用成功提示冒充完成 | auto | rationale: 按钮级验收的最低可证伪标准；可逐页回退。
- [DEC-4] 文件、消息、用户、角色和系统设置优先复用现有 Prisma 模型与权限；缺失持久化结构仅做最小迁移，并保留所有现有可设置字段 | auto | rationale: 修复现有功能，不扩张新业务模块。
- [DEC-5] 建立统一类型化请求层；GET 可按明确规则重试，写操作默认不自动重试，并用禁用重复点击、事务、唯一约束和请求标识防止重复写入 | auto | rationale: 长时间使用稳定性不能以重复数据为代价；可按接口迁移。
- [DEC-6] 会话策略保持有限有效期，增加过期提示、重新登录返回原页面、草稿保护和网络恢复后重新拉取；不采用无限会话 | auto | rationale: 同时满足连续使用和账户安全；策略参数可调整。
- [DEC-7] 数据可达性验收使用独立测试数据库与可追踪测试夹具，验证 UI、API、数据库和审计结果；不删除或改写原始稳定版数据 | auto | rationale: 测试必须可重复且不能污染线上数据。
- [DEC-8] stable/test 使用独立 profile、端口、PID/锁、日志、数据库和上传目录；测试版不得连接稳定版写库 | escalated | rationale: 这是发布隔离的基本边界，配置错误会影响线上数据。
- [DEC-9] 单实例采用原子文件锁、进程身份校验和端口校验；stable/test 各自最多一个实例，服务端进程管理器也按目标实例数校验 | auto | rationale: 现有 PID 检查不足以识别陈旧或复用 PID。
- [DEC-10] 性能目标采用“重新测量的基线 + 明确预算”，不沿用历史构建数字；每次优化必须有前后证据 | auto | rationale: 旧构建数据可能已失效，预算可根据真实环境调整。
- [DEC-11] Next.js 15.4、React 19 和 ESM 配置先在 test profile 迁移，Ant Design、NextAuth、Prisma、构建和 E2E 全通过后才允许提升 stable | escalated | rationale: 满足当前项目规范，同时限制框架升级对稳定版的影响。
- [DEC-12] 若用户在 HARD GATE 不反对，则初始化本地 Git、建立基线提交并按一级任务提交；若拒绝初始化，任务仍可实施，但不能宣称满足逐步提交和完整回溯 | escalated | rationale: 当前目录没有 Git 元数据。
- [DEC-13] `$spec-apply` 前先归档两个已完成变更，并决定未完成 HTTP 冒烟的旧变更是补验、保留还是明确关闭 | escalated | rationale: 多活动变更会使 apply 无法可靠选择任务来源。
- [DEC-14] 不设置吞掉错误的静默兼容路径；发布失败、审计失败、数据校验失败或环境串用时应明确阻止操作并记录日志 | auto | rationale: 假成功会破坏数据准确性和可追溯性。
