# Research: crm-market-requirements-enhancement

## Practices
- 成熟 CRM 以 Lead-to-Cash 为主链路：线索进入后转换为客户、联系人和商机，再推进报价、合同/订单与回款；本项目应补齐线索、商机和活动时间线，不扩张为 ERP 总账。参考：Salesforce Sales Cloud、Microsoft Dynamics 365 Sales、销售易官方产品资料。
- 销售管道通常包含可配置阶段、金额、赢单概率、预计关闭日期、下一步、停留时长和输单原因；当前固定漏斗只能作为现状，目标能力进入 P1。参考：Pipedrive Sales、Zoho CRM 官方资料。
- 功能权限与数据可见范围分离；数据范围可覆盖本人、上下级、部门/业务单元、共享对象和全局，并延伸到报表下钻。参考：Microsoft Learn Security Roles、Pipedrive Visibility and Permissions、纷享销客权限管理资料。
- 数据质量应在新增、编辑、导入和 API 写入时执行标准化、重复检测、候选合并和逐行错误报告；当前项目已有简单查重与导入上限，但缺少预检和合并。
- 公海管理应配置领取上限、客户保有量、冷却、回收条件、提醒、规则优先级、字段脱敏和审计；多层级树状公海与商机公海后置。
- 自动化首期采用有限的“触发器 + 条件 + 动作”，动作仅含任务、通知、字段更新、负责人分配和 Webhook；规则必须有启停、版本、执行日志、重试和幂等。
- 报表覆盖线索转化、阶段停留、商机老化、活动完成、业绩、回款、合同、公海和加权预测，图表下钻继续遵守数据权限。
- 移动端优先采用响应式/PWA，覆盖查询、跟进、任务、阶段更新和审批；原生双端与复杂离线同步暂缓。
- AI 先作为辅助能力：记录摘要、跟进草稿、风险提示和自然语言报表；结果经用户确认后写库，并继承当前用户的数据权限。
- 当前项目最适合延续 TypeScript + Next.js + React + Prisma 的模块化单体路线。Next.js 官方文档将 Route Handlers 定位为 BFF/API 层，并明确生产环境仍需数据访问层、认证授权和限流；Prisma 官方文档提供类型安全查询、嵌套写入、批量/交互式事务、隔离级别和乐观并发控制能力。参考：https://nextjs.org/docs/app/guides/backend-for-frontend、https://nextjs.org/docs/app/guides/production-checklist、https://www.prisma.io/docs/orm/prisma-client/type-safety/prisma-type-system、https://www.prisma.io/docs/orm/prisma-client/queries/transactions。
- Java + Spring Boot 适合独立建设大型企业后端：Spring 提供声明式事务、方法级授权和 Actuator 审计/健康/指标；代价是重建 Controller/Service/Repository、Spring Security、JPA/MyBatis、迁移和契约测试。参考：https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative.html、https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html、https://docs.spring.io/spring-boot/reference/actuator/。
- C# + ASP.NET Core + EF Core 适合已有 .NET/Azure 运维体系的企业后端：策略授权、事务、并发令牌和 OpenAPI 完整；代价与 Java 同级，且当前 TypeScript/Prisma/NextAuth/CASL 资产需要重建。参考：https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies、https://learn.microsoft.com/en-us/ef/core/saving/transactions、https://learn.microsoft.com/en-us/ef/core/saving/concurrency、https://learn.microsoft.com/en-us/aspnet/core/fundamentals/openapi/overview。
- Python Django/FastAPI 适合后台管理、独立 API 或 AI 服务：Django 自带模型权限与 atomic 事务，FastAPI 提供 Pydantic 校验和 OpenAPI；Python 类型注解主要依赖外部检查器，迁移后仍需重建会话、权限、ORM、部署和测试。参考：https://docs.djangoproject.com/en/5.2/topics/db/transactions/、https://docs.djangoproject.com/en/5.2/topics/auth/default/、https://fastapi.tiangolo.com/features/、https://docs.python.org/3/library/typing.html。
- Go 适合后期高并发 API、Webhook、异步 Worker 和连接器；标准库提供连接池与事务，但 CRM 的 RBAC、数据范围、工作流、审计和后台管理需要自行组合，作为主 CRM 重写收益不直接。参考：https://go.dev/doc/database/、https://go.dev/doc/database/open-handle、https://go.dev/doc/modules/layout。

## Constraints
- 当前代码不是空白项目：约 91 个 `.ts/.tsx/.prisma` 文件、约 15,179 行，34 个 API Route Handler、20 个页面；33 个 API 文件直接访问 Prisma，33 个涉及认证，31 个涉及 CASL。
- 当前技术栈为 Next.js 14、React 18、TypeScript、Prisma 5、MySQL、NextAuth、CASL、Ant Design；项目约束要求后续升级到 Next.js 15.4 与 React 19。版本升级属于同栈兼容改造，不能作为跨语言重写依据。
- API 业务逻辑、认证、权限、JSON 解析和 Prisma 查询集中在 route handler；源码没有 service/repository/controller/dto/validator 分层，存在约 106 处 `any`，也没有统一 typed API client 或 OpenAPI 契约。
- Prisma schema 有 Customer、Lead、FollowUp、Order、Payment、DailyReport、Task、Message、File、ContractArchive 等模型，但没有 `tenantId/orgId`；不能把未来多租户需求当作当前迁移理由。
- Task、DailyReport、Order、收款删除存在接口/模型不一致或路由缺失；消息、用户、文件、设置等存在 mock、只读或部分实现，需求文档必须标记为“部分实现/模型预留/未实现”。
- 认证当前通过 NextAuth JWT 提供 `session.user.id/roles/permissions`，权限由 CASL 与层级数据范围共同表达；跨语言迁移不能只替换 ORM，必须重写认证适配、权限矩阵、数据范围和契约回归。
- 收款、公海认领、归属转移和财务金额要求短事务、唯一约束、幂等键、乐观并发控制或 Serializable 冲突处理；长流程应使用队列/Worker，不在 HTTP 请求中持有长事务。
- 文件目前由 Next 进程工作目录或 OSS 保存；拆分后端前必须明确共享卷/对象存储、下载鉴权和签名 URL，不能仅复制数据库 URL 字段。
- 独立后端触发条件分两类：监管/客户合同要求独立安全边界、网络隔离或统一企业 SSO 属于强制评估项，可单独触发；多个独立前端或公开 API、独立扩容/队列/长耗时任务、成熟 Java/.NET 平台、单体规模瓶颈属于综合评估项。触发后按团队、运维、合规和实测负载选择 PoC 技术栈，不预设固定顺序。
- 不使用未经验证的吞吐排名、工期承诺或“某语言一定更快”的结论；迁移比例和工期只能作为后续立项时的工程估算。

## Open [TBD]

## Decided
- [DEC-1] 产品定位为面向中小销售团队的销售型 CRM，而非低代码 CRM 平台 | source [TBD-1] | escalated | 当前代码围绕客户、公海、订单、回款和协作，平台化会引入多租户、对象设计器和生态治理 | if wrong: 产品范围与数据模型需整体重写
- [DEC-2] 新文档同时保留代码整改基线和产品能力路线图 | source [TBD-2] | auto | 两部分可独立修订，原需求不会丢失 | reversibility: 后续可拆回两份文档
- [DEC-3] 市场能力按 P0 基础、P1 增强、P2 后续、暂缓四层编排 | source [TBD-3] | auto | 便于排期并限制范围膨胀 | reversibility: 可调整优先级标签
- [DEC-4] 首期自动化采用有限规则引擎，不建设任意流程设计器 | source [TBD-4] | escalated | 复用现状提醒与回收规则，保留升级路径 | if wrong: 规则数据模型和界面范围扩大
- [DEC-5] 移动端采用响应式/PWA 作为 P1，原生双端与离线同步暂缓 | source [TBD-5] | escalated | 当前是 Next.js Web 应用，复用率最高 | if wrong: 需增加双端工程、同步协议和额外测试矩阵
- [DEC-6] AI 仅列为 P2 辅助能力，默认不自动修改业务数据 | source [TBD-6] | escalated | 当前缺少模型接入、数据治理和审计基础 | if wrong: 需新增模型供应商、提示治理、成本和自动写入控制
- [DEC-7] 外部集成只定义安全边界和候选清单，不在本轮选定供应商 | source [TBD-7] | auto | 避免绑定邮件、日历或企业微信供应商 | reversibility: 后续独立变更选择连接器
- [DEC-8] 原文档保留，新建市场调研规划完善版 DOCX | source [TBD-8] | decided from status quo | 原版需求仍有消费场景，新增版本承载市场路线
- [DEC-9] 本轮继续采用 TypeScript + Next.js + React + Prisma + MySQL 技术族，按模块化单体演进，不整体迁移 Java、C#、Python 或 Go | source [TBD-9] | escalated | 当前约 15,179 行代码、34 个 API、20 个页面已绑定 NextAuth/CASL/Prisma；同栈演进可复用现有 UI、数据库、认证和迁移，跨语言必须重建认证、权限、ORM、部署和契约回归 | if wrong: 需要按独立后端项目重新建设这些边界
- [DEC-10] 先建立领域服务/use-case、DTO/Zod、统一认证与数据范围及旧接口兼容基线，再评估独立后端；触发后按团队、运维、合规和实测负载比较 TypeScript、Java/.NET、FastAPI 或 Go 的 PoC，不预设固定优先顺序 | source [TBD-10] | escalated | 稳定边界和回归证据可降低拆分风险，同时允许强制合规项单独触发 | if wrong: 需调整服务边界与目标语言，已有契约快照和测试仍可复用
- [DEC-12] 当前版本仍是 Next.js 14/React 18；Next.js 15.4/React 19 是项目约束下的后续目标基线，升级顺序由独立兼容性评估决定 | source [TBD-12] | auto | 区分当前事实与目标版本，避免把技术族选择等同于已完成升级 | reversibility: 可在版本兼容变更中调整执行顺序
- [DEC-11] P0 增加事务、幂等、唯一约束、OCC/Serializable、统一权限和契约测试；P1 增加审计、健康检查、结构化日志、OpenAPI 和有限工作流执行日志 | source [TBD-11] | auto | 这些能力直接解决当前构建阻断、金额一致性和权限分散问题 | reversibility: 可按模块分期启用

## 2026-08-23 市场调研补充：与现有销售系统相似的产品

### 1. 调研范围

本次调研围绕当前系统已经存在的字段和页面进行，不以“功能越多越好”为目标。重点核对以下能力：

- 电销名单、销售线索、线索分配和线索转客户
- 客户主档、联系人、客户 360 信息和客户时间线
- 公海池、客户领取额度、负责人分配、自动回收
- 跟进记录、下一次联系时间、任务和提醒
- 商机阶段、销售漏斗、预计金额和赢单/输单
- 合同、订单、收款、发票和未收金额
- 部门层级、角色权限、数据范围和操作日志
- 销售日报、排行榜、漏斗和经营统计

调研日期：2026年8月23日。产品页面会随版本变化，以下内容以本次访问到的官方产品页或官方帮助文档为准。市场页面中的“智能”“自动化”“AI”等表述只作为能力方向，不直接等同于本项目必须建设的功能。

### 2. 官方资料中确认到的相似系统

| 产品 | 官方资料中确认的能力 | 与现有系统的相似点 | 需要注意的范围 |
|---|---|---|---|
| 纷享销客 CRM | 销售线索、线索池、客户、公海、商机、销售记录、提醒、销售订单、合同、回款、发票、报表、权限和数据日志 | 与当前“电销名单/线索→客户→跟进→合同/订单→回款→统计”链路最接近；官方帮助文档还明确写到客户领取上限、自动回收、负责人及上下级可见范围 | 产品能力覆盖面较大，包含自定义对象、流程、审批和开放平台；当前项目不应一次性照搬 |
| 销售易销售云 | 从线索、客户、商机、报价、合同、订单到开票和收款的销售流程；线索公海、客户查重、客户 360、回款提醒和交易管理 | 与当前客户、公海、合同备案、订单、回款模块高度相似；尤其适合参考“销售最后一公里” | 官方页面以产品概览为主，具体字段、权限细节和版本差异尚未逐项核验 |
| 悟空 CRM | 线索、客户、联系人、商机、报价单、合同、回款、发票、回访、产品、营销、任务、审批、报表和客户遗忘提醒 | 与当前系统的客户、跟进、合同、回款、日报/任务和统计模块接近；帮助中心明确展示销售漏斗、回款/合同排行榜和长期未联系提醒 | 同时包含 OA、项目、AI、进销存等扩展模块，应只借鉴销售主链路 |
| Zoho CRM | 线索自动分配、线索转化为客户/联系人/交易、多个销售管道、工作流触发器、任务、字段和模块权限、记录共享、报表 | 适合参考线索分配、线索转化、可配置阶段、触发器+条件+动作和细粒度权限 | 官方资料中的部分能力依赖特定版本或扩展配置，需在立项时再次核对版本和授权范围 |
| HubSpot Sales Hub | 线索和活动工作区、销售自动化、电话记录、任务、交易管道、报价/收款、销售分析和预测 | 适合参考“每天要做什么”的销售工作台、活动记录、任务队列、交易管道和管理层报表 | 其产品组合包含 Sales Hub、Revenue Hub 和 AI 能力，报价、账单、收款不应简单理解为一个基础 CRM 模块 |
| Salesforce Sales Cloud | 销售自动化、线索管理、客户追踪、预测、工作流和统一数据平台 | 适合参考标准化销售对象、线索到交易的全流程、权限和预测的产品边界 | 产品定位和实施复杂度明显高于当前中小销售团队需求，不作为首期对标实现 |
| Pipedrive | 以活动为中心的销售方式、管道管理、线索管理、销售自动化、报表分析、邮件同步、移动端、权限和可见范围 | 适合参考“跟进活动必须有下一步”的界面思路，以及按阶段看销售机会的轻量操作体验 | 官方产品页未体现当前系统所需的国内式客户公海和合同回款细节，不能作为公海规则的主要参考 |

### 3. 按当前字段进行对照

| 当前系统字段/模块 | 市场上相似做法 | 当前判断 | 需求文档建议 |
|---|---|---|---|
| `TelemarketingList` 电销名单：姓名、公司、电话、职位、行业、来源、联系次数、通话时间、状态、结果、是否有效、销售负责人、关联客户 | Zoho、纷享销客、HubSpot 都把外部来源的潜在客户先作为线索管理，并支持分配、跟进和转化；HubSpot 还把电话记录放进销售活动中 | 当前字段方向合理，但“电销名单”和“销售线索”的边界需要写清楚 | 保留现有字段；明确电销名单是销售线索的来源之一，转换客户后保留原记录和来源，不直接删除 |
| `Lead` 销售线索：来源、冷热等级、预计金额、负责人、处理状态、转化客户 | Zoho 明确采用线索→客户/联系人/交易的转化；纷享销客也将线索验证后转为客户 | 当前已经具备线索转化基础，但商机对象和阶段还不完整 | P0 保证线索分配、重复检查和转化留痕；P1 再增加商机阶段、预计关闭日期、输单原因和下一步 |
| `Customer` 客户主档：公司、联系人、电话、邮箱、微信、地区、来源、行业、等级、状态、标签、负责人 | 纷享销客强调客户 360、客户查重、负责人/上下级可见；销售易强调客户 360 和查重 | 当前主档已经接近成熟 CRM 的基础客户对象 | 不新增大量字段；优先统一字段名称、必填规则、查重规则、脱敏规则和客户详情时间线 |
| `publicPoolEnteredAt`、公海认领和自动回收 | 纷享销客官方文档明确有公海成员、领取上限、保有量、提醒、按规则自动收回和规则优先级 | 当前系统的公海方向与成熟产品相似度高 | P0 修正领取、回收、归属变更的并发和审计；P1 再考虑多公海、字段脱敏、冷却期和更细的规则配置 |
| `FollowUp` 跟进记录：方式、内容、结果、下一步行动、下次联系时间、附件 | 悟空 CRM 有客户遗忘提醒和客户活动时间线；Pipedrive 以 activity-based selling 为核心；HubSpot 将活动、任务、外呼记录放到销售工作区 | 当前字段已经覆盖销售日常记录，缺的是统一时间线和待办入口 | 以客户详情为主入口，把跟进、任务、合同到期和回款提醒按时间线或待办集中展示；不强制引入复杂自动化 |
| `Order`、`Payment`、`ContractArchive`：订单、收款、发票、合同版本 | 销售易、纷享销客、悟空 CRM 都把合同、订单、开票、回款作为销售成交后的关联模块；微软 Dynamics 也将 quote、order、invoice 作为销售周期的一部分 | 当前财务关联模块方向正确，但需要维护金额一致性 | P0 明确订单金额、已收金额、未收金额的计算口径和权限；合同和回款附件保留历史版本，不用删除代替变更 |
| `User`、角色、部门、上级和 CASL 权限 | Zoho、纷享销客、Pipedrive 都把功能权限与记录可见范围分开；纷享销客明确支持本人、下属、部门、共享数据范围 | 当前已有权限基础，但接口中认证、数据范围和业务查询较分散 | 把“能不能操作”和“能看哪些记录/字段”分开写；销售、主管、运营、财务和管理员分别列出范围 |
| 销售统计、日报、排行、漏斗 | 悟空 CRM 展示销售漏斗、回款/合同排行榜和客户遗忘提醒；HubSpot、Dynamics 365 和 Zoho 都提供管道分析、报表或预测 | 当前已有基础统计，但还不是完整销售漏斗 | P0 统一统计口径；P1 增加线索转化、跟进完成率、长期未跟进、合同到期和回款进度；预测和 AI 暂列后续 |

### 4. 最接近当前系统的产品组合判断

从现有字段和业务流程看，最接近的是以下组合，而不是某一个产品的完整复制：

1. **主参考：纷享销客 + 销售易**
   - 参考客户、公海、负责人、线索池、合同、订单和回款的业务结构。
   - 参考公海领取上限、自动收回、提醒和数据范围等规则。
2. **流程参考：Zoho CRM + Pipedrive**
   - 参考线索自动分配、销售阶段、活动记录、下一步行动和轻量销售管道。
   - 只把“触发器+条件+动作”作为有限自动化方向，不直接建设任意流程设计器。
3. **报表和销售工作台参考：悟空 CRM + HubSpot**
   - 参考销售漏斗、排行榜、遗忘提醒、任务队列、外呼记录和销售活动工作台。
4. **企业级边界参考：Salesforce + Dynamics 365**
   - 只用于确认线索、客户、商机、报价/订单/发票、预测、移动端和安全治理的长期边界。
   - 不把企业级产品的全部对象、AI 或实施复杂度写入当前首期范围。

### 5. 对当前需求文档的具体补充建议

#### P0：在现有字段上先做稳定

- 电销名单、销售线索、客户之间保留来源、负责人、转换时间和原始记录，不以删除原记录完成转换。
- 客户详情增加统一的关联视图：基本资料、联系人、跟进时间线、任务、合同、订单、收款和文件。
- 公海认领、负责人转移、自动回收必须记录操作人、时间、原负责人、新负责人和原因。
- 订单和收款统一金额口径，明确“订单金额、已收金额、未收金额、发票信息”的计算和查看权限。
- 统一销售、主管、运营、财务、管理员五类角色的可见字段和可操作动作。

#### P1：补齐成熟 CRM 中最常用的销售动作

- 增加轻量商机对象或在现有线索上增加销售阶段、预计金额、预计成交日期、下一步、赢单/输单原因。
- 增加可配置的跟进方式和跟进结果，但第一版保留当前电话、拜访、微信、邮件、会议、其他等分类。
- 增加线索批量分配、负责人变更、批量导入预检、重复候选和逐行错误报告。
- 增加销售漏斗、线索转化率、阶段停留、长期未跟进、合同到期和回款进度报表，并在报表下钻时继续遵守数据权限。
- 增加响应式/PWA 的查询、跟进、任务和阶段更新能力；暂不建设原生双端和复杂离线同步。

#### P2 或暂缓：有明确使用场景再做

- AI 跟进摘要、跟进草稿、风险提示和自然语言报表，只能先生成建议，经用户确认后写入。
- 呼叫中心、录音、短信、企业微信、邮件同步和电子签，需要先确认供应商、账号权限、隐私范围和费用。
- 报价单、产品、CPQ、库存、退货、退款、服务工单和项目交付不属于当前客户主档需求，除非客户后续明确提出。

### 6. 仍需验证的内容

- 销售易、纷享销客和悟空 CRM 不同版本的具体授权、字段数量、自动化额度和接口限制尚未逐项核实。
- “电销名单”是否需要真实外呼、通话录音、拨号器或只记录电话结果，现有资料无法确认；需求文档先按记录型电销名单处理。
- 客户是否存在多个联系人、多个商机、多个合同并行维护的实际场景，需要在后续业务确认中验证。
- 当前系统是否要把“客户”与“商机”拆成两个正式对象，仍需结合客户日常销售方式决定；本轮只提出 P1 需求，不视为当前已实现。

### 7. 本轮调研结论

当前系统已经具备一个销售 CRM 的核心骨架，并非需要从零设计。它与市场产品的主要差距不在于缺少大量菜单，而在于：线索/电销名单到客户的转换规则还需要统一，销售阶段和商机信息不够完整，公海及金额操作需要更强的一致性和审计，统计需要统一口径。

因此，需求文档继续采用“现有字段优先、成熟做法择取、分阶段补齐”的路线：先把现有客户、跟进、公海、合同、订单和收款做稳定，再补商机、销售漏斗和有限自动化，最后根据实际使用量评估 AI、外部集成和移动能力。

### 8. 本次参考来源

- 纷享销客产品手册《4.1 客户》：https://ale.fxiaoke.com/mob/guide/crmdoc/src/4-1%E5%AE%A2%E6%88%B7.html
- 纷享销客帮助中心《客户和公海管理》：https://help.fxiaoke.com/1969/ba74/6ff4
- 销售易《销售云》：https://www.xiaoshouyi.com/sfaold
- 销售易《销售云产品聚合页》：https://www.xiaoshouyi.com/marketing/product-sfa
- 悟空 CRM 帮助中心《CRM系统功能介绍》：https://www.72crm.com/help-details/type/1/menu_id/5
- Zoho CRM《Working With Leads》：https://help.zoho.com/portal/en/kb/crm/sales-force-automation/leads/articles/leads-26-4-2026
- Zoho CRM《Workflow - An Overview》：https://www.zoho.com/crm/tutorials/workflow/overview.html
- Zoho CRM《Role-based security》：https://www.zoho.com/crm/data-security/role-based-security.html
- HubSpot《Sales Hub》：https://www.hubspot.com/products/sales
- Salesforce《Sales Cloud》：https://www.salesforce.com/sales/cloud/
- Microsoft Learn《Dynamics 365 Sales documentation》：https://learn.microsoft.com/en-us/dynamics365/sales/
- Pipedrive《Features and products》：https://www.pipedrive.com/en/features
