# Research: crm-market-requirements-enhancement

## Practices
- 成熟 CRM 以 Lead-to-Cash 为主链路：线索进入后转换为客户/联系人/商机，继续推进报价、合同/订单、回款，并保留负责人、阶段、时间和活动历史；当前项目适合补齐线索、商机与活动时间线，不宜直接扩展到 ERP 总账。参考：https://www.salesforce.com/sales/cloud/ 、https://learn.microsoft.com/en-us/dynamics365/sales/overview 、https://www.xiaoshouyi.com/sfa
- 销售管道通常包含可配置阶段、金额、赢单概率、预计关闭日期、下一步、停留时长和输单原因；当前固定漏斗只适合作为现状，目标能力应进入 P1。参考：https://www.pipedrive.com/en/products/sales 、https://www.zoho.com/crm/features.html
- 功能权限与数据可见范围分离是共同做法，数据范围覆盖本人、上下级、部门/业务单元、共享对象和全局，并延伸至报表下钻。参考：https://learn.microsoft.com/en-us/power-platform/admin/security-roles-privileges 、https://support.pipedrive.com/en/article/visibility-and-permissions-overview 、https://ale.fxiaoke.com/mob/guide/crmdoc/src/7-1-3%E6%95%B0%E6%8D%AE%E6%9D%83%E9%99%90%E7%AE%A1%E7%90%86.html
- 数据质量应在新增、编辑、导入和 API 写入时执行标准化、重复检测、警告/阻止、候选合并和逐行错误报告；当前项目已有简单查重与 1000 行导入上限，但缺少预检和合并。参考：https://help.salesforce.com/s/articleView?id=managing_duplicates_overview.htm&language=en_US 、https://www.hubspot.com/products/crm
- 公海管理应配置领取上限、客户保有量、连续领取冷却、回收条件、提醒、规则优先级、字段脱敏和完整审计；多层级树状公海与商机公海适合后置。参考：https://help.fxiaoke.com/1969/ba74/6ff4 、https://service.xiaoshouyi.com/portal.php?aid=11&catid=7&mod=view&upid=5
- 客户活动应统一电话、拜访、邮件、会议、备注、任务和下一步动作，并与客户、线索、商机、订单关联；当前 FollowUp/Task 模型可作为基础。参考：https://help.fxiaoke.com/2615/85jk/4bc2 、https://www.hubspot.com/products/sales
- 自动化首期采用有限的“触发器 + 条件 + 动作”，动作仅含任务、通知、字段更新、负责人分配和 Webhook；规则必须有启停、版本、执行日志、重试和幂等。参考：https://www.zoho.com/crm/features.html 、https://www.hubspot.com/products/sales
- 报表应覆盖线索转化、阶段停留、商机老化、活动完成、业绩、回款、合同、公海和加权预测，且图表下钻继续遵守数据权限。参考：https://help.salesforce.com/s/articleView?id=sales.pipeline_inspection.htm&language=en_US 、https://learn.microsoft.com/en-us/dynamics365/sales/project-accurate-revenue-sales-forecasting
- 移动端优先采用响应式/PWA 覆盖查询、跟进、任务、阶段更新和审批；原生双端与复杂离线同步成本较高。参考：https://www.salesforce.com/products/mobile/ 、https://www.hubspot.com/products/mobile 、https://crm.xiaoshouyi.com/mob/performance.html
- AI 应先作为辅助能力：记录摘要、跟进草稿、风险提示和自然语言报表，结果经用户确认后写库，并严格继承当前用户的数据权限。参考：https://www.salesforce.com/sales/ai/ 、https://learn.microsoft.com/en-us/dynamics365/sales/copilot-overview 、https://support.pipedrive.com/en/article/pipedrive-ai

## Constraints
- 当前需求文档偏整改清单，缺少产品范围、角色场景、完成度矩阵和市场基线；若只追加功能列表，读者仍分不清现有能力与规划能力。
- 客户、公海、电销、合作客户、合同备案、订单、收款、统计和提醒已有代码依据；用户、角色、消息、文件、设置、任务、日报存在 mock、只读或前后端字段断裂，文档必须标记“部分实现”或“模型预留”。
- Task、DailyReport、Order 和收款删除存在接口/模型不一致或缺失路由，这些构建阻断项优先于新增市场功能。
- 认证仍使用硬编码用户 ID，权限和角色大小写不统一，管理员 manage/all 规则缺失；新增产品能力必须以统一认证授权为前置。
- 当前无 tenantId/orgId、多租户计费、呼叫中心、邮件/企微发送、审批引擎、电子签、ERP、原生移动端和 AI 模型接入，需求文档不得描述为已实现。
- 项目采用 Next.js、React、TypeScript、Prisma、MySQL、NextAuth、CASL 与 Ant Design；技术栈升级要与业务需求分阶段验证。
- 正式文档保留原版，另存市场调研完善版；输出位于 `docs/`，生成脚本位于 `scripts/docs/`，日志位于 `logs/`。
- 市场事实仅采用厂商官方产品页、帮助中心和 Microsoft Learn；销售易旧版本文章只用于行业实践参考，不作为当前产品版本承诺。

## Open [TBD]

## Decided
- [DEC-1] 将产品定位为面向中小销售团队的销售型 CRM，而非低代码 CRM 平台 | source [TBD-1] | escalated | 当前代码围绕客户、公海、订单、回款和协作，平台化会引入多租户、对象设计器和生态治理 | if wrong: 产品范围与数据模型需整体重写
- [DEC-2] 新文档同时保留“代码整改基线”和“产品能力路线图”，不再只列缺陷 | source [TBD-2] | auto | 两部分可独立修订，原需求不会丢失 | reversibility: 可拆回两份文档
- [DEC-3] 市场能力按 P0 基础、P1 增强、P2 后续、暂缓四层编排 | source [TBD-3] | auto | 便于排期并限制范围膨胀 | reversibility: 可调整优先级标签
- [DEC-4] 首期自动化仅定义有限规则引擎，不建设任意流程设计器 | source [TBD-4] | escalated | 当前只有硬编码提醒和回收规则，有限模型能复用现状并保留升级路径 | if wrong: 规则数据模型和界面范围会扩大
- [DEC-5] 移动端选择响应式/PWA 作为 P1，原生双端与离线同步暂缓 | source [TBD-5] | escalated | 当前是 Next.js Web 应用，PWA 复用率最高 | if wrong: 需增加双端工程、同步协议和额外测试矩阵
- [DEC-6] AI 仅列为 P2 辅助能力，默认不自动修改业务数据 | source [TBD-6] | escalated | 当前缺少模型接入、数据治理和审计基础 | if wrong: 需新增模型供应商、提示治理、成本和自动写入控制
- [DEC-7] 外部集成先定义安全边界和候选清单，不在本轮选定具体供应商 | source [TBD-7] | auto | 避免在缺少业务偏好时绑定邮件、日历或企业微信 | reversibility: 后续在独立变更中选择首个连接器
- [DEC-8] 原文档保留，新建“市场调研完善版” DOCX | source [TBD-8] | decided from status quo: 文档 skill 与论文修订规范均要求保留原稿、另存新版本

