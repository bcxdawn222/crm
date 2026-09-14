# Research: crm-sales-desk-corrections

方向：已合作客户标明销售与续费月提醒；电销名单归属、导入、转入客户、电话格式、状态/有效性可编；销售账号能提交日报。

## Practices

- Salesforce / HubSpot 线索列表按 Owner 过滤，管理员看全部、销售看自己的；导入模板含 Owner 列。来源：Salesforce Lead Owner、HubSpot import owner mapping。
- 中国电话号码同时存在 11 位手机号和 `0` 开头区号固话（3 位或 4 位区号 + 7/8 位号码，可带 `-`）。来源：工信部号段规则、GB/T 2260 区号习惯。
- 订阅制 CRM 的续费提醒常用「到期日所在自然月」或「到期前 N 天」；两者语义不同，不能混称。来源：Chargebee / Stripe Billing dunning windows。
- 批量导入沿用文件类型白名单、行数上限、事务锁和重复键拒绝，避免半写入。来源：本仓库客户导入 `src/lib/customers/import.ts`。

## Constraints

- 不新增独立「续费日期」字段，除非现有 `contractEndDate` 无法表达；schema 变更要迁移且不可静默。
- 电销 `GET /api/telemarketing` 现写死 `salesId: session.user.id`；POST/PUT 不接收 status/isEffective/salesId。
- 转化已存在：`convertTelemarketingToCustomer` 要求 `salesId === actorId`，客户写成 `actorId`。
- 日报侧栏权限码是 `report:daily:view`；提交按钮走 CASL `create/report`；API POST 检查 `report:daily:create`。销售 seed 含这三项，线上角色可能漂移。
- 测试写入只允许 test profile；客户历史不得删。
- 项目禁止子智能体，critique/verify 由主智能体分镜头做并注明非独立。

## Open [TBD]

（已清空，见 ## Decided）

## Decided

- DEC-1 电销名单按负责人 `salesId` 归属：admin/finance 看全部，sales_manager 看团队树，sales 看自己的；创建/导入可指定负责人。 | 用户明确「销售名单不跟管理员同步」；不做则导入无意义。 | escalated
- DEC-2 电话同时接受 11 位手机号和国内固话（如 `010-84467791`），前后端同一规则。 | 截图证据；可逆。 | auto
- DEC-3 编辑/API 开放 `status` 与 `isEffective`（结果字段一并进表单）。 | 用户明确没法编辑；砍掉则状态永远待拨打。 | auto
- DEC-4 保留现有转入客户弹窗与接口；放宽为数据范围内可转，客户归属名单上的 `salesId`。导入复用客户导入的 xlsx/csv、5MB、1000 行、库锁模式。 | 转入已存在，只修归属；不重做弹窗。 | auto
- DEC-5 已合作客户表增加「对应销售」「续费时间」两列；续费时间绑定 `contractEndDate`，不新增 schema 字段。 | 合同到期日已是续费锚点；新字段要迁移。 | auto
- DEC-6 智能提醒「续费当月」= `contractEndDate` 所在自然月（当月已过日期仍显示），替换仅「未来 30 天」。 | 用户说当月不是到期前 30 天。 | escalated
- DEC-7 销售必须能进日报页并看到「提交日报」；按钮按 `report:daily:create` 权限码判断，并对销售角色补齐缺失权限。 | 截图侧栏无日报；seed 有权限但线上可能漂移。 | escalated
- DEC-8 销售创建/导入名单默认自己且不能改派；admin/主管导入必须能指定销售（表头「销售」用户名或表单默认负责人）。 | 否则导入仍挂在管理员名下。 | auto
