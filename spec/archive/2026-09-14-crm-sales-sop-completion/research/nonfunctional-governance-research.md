# Research: crm-sales-sop-completion

## Practices

- 现有销售流程应以客户主档、跟进、提醒、任务、合同、订单、回款和统计为业务事实；本期不通过新增商机、报价或产品目录来改变销售流程。
- 非功能要求应能转成可执行验收：权限要验证菜单、接口和数据范围；数据安全要验证日志、备份和恢复；性能要在双方约定的数据量和网络条件下测试；异常处理要验证错误提示和日志定位。
- 业务审计应独立于业务表的展示字段，记录操作者、时间、对象、动作和必要变更摘要；敏感字段必须在写入审计前过滤。
- 发布和数据库变更应先有备份、迁移检查和回滚路径；只检查备份文件存在不能证明可恢复，需要至少一次临时环境恢复演练。
- 运行检查应通过项目已有 `scripts/` 入口执行，并将日志写入项目 `logs/`，以便 Windows 和服务器环境使用相同的检查方式。

Key references:

- https://learn.microsoft.com/en-us/dynamics365/sales/nurture-sales-from-lead-order-sales
- https://knowledge.hubspot.com/object-settings/set-up-pipeline-rules
- https://knowledge.hubspot.com/account-management/view-and-export-account-activity-history
- https://www.cac.gov.cn/2021-08/20/c_1631050028355286.htm

## Constraints

- 现有项目为 Next.js、React、Prisma、MariaDB、NextAuth、CASL 和 Ant Design，已有 `scripts/manage.py` 负责日志、类型检查、构建、路由检查和服务启停。
- 线上基础设施已经完成数据库本机监听、低权限应用用户、SSH 密钥登录、自动备份和恢复演练；本期不重复改动这些基础设施，只增加可重复检查和应用层治理。
- 当前 Prisma schema 没有统一审计模型；公海历史使用客户 JSON 字段，只能覆盖部分客户归属事件。
- 许多 API 直接返回 `error.message` 或 `details`，错误响应未统一携带 `requestId`；本期先覆盖治理入口和关键高风险路径，不全量重写 37 个接口。
- 工作区没有 `.git` 目录，不执行仓库初始化、合并 `main` 或提交伪造历史。
- 业务数据基本为空，无法用线上数据证明四种角色的真实业务流程；角色浏览器验收留到 Phase 2，并在报告中明确“未验证”范围。
- 动态语言文件存在超过 300 行的页面，但本期不进行页面功能重构；只修改确有必要的服务端治理和检查脚本。

## Open [TBD]

- 无。客户已经明确本期功能范围不变，性能目标、备份周期和日志保留时间作为 PRD 中可修改的建议指标。

## Decided

- [DEC-1] 本变更只实施非功能治理，不增加销售业务功能 | source 用户明确要求 | escalated | 保持现有客户、跟进、提醒、任务、合同、订单、回款和统计页面语义不变。
- [DEC-2] 先做 Phase 1 审计、日志、只读数据检查和脚本入口，再做角色浏览器验收与恢复演练 | source 当前业务数据为空 + 可回滚性 | auto | 先建立能重复验证的基础，避免把未验证的生产操作写成完成。
- [DEC-3] 审计使用独立 `AuditEvent` 模型，公海 JSON 历史继续保留 | source 当前审计碎片化 | auto | 不删除原始数据，并支持按对象和时间查询。
- [DEC-4] 不全量重写 37 个 Route Handler，Phase 1 先覆盖高风险关键路径 | source 当前接口数量和回归风险 | auto | 降低行为变化范围，后续按验收结果分批扩展。
