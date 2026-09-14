# Design: crm-sales-desk-corrections

引用 research `## Decided` DEC-1..DEC-8，不重复动机。

## Architecture

```mermaid
flowchart LR
  Admin[管理员/主管] -->|指定 salesId 导入或新建| List[TelemarketingList]
  Sales[销售] -->|只看自己的名单| List
  List -->|convert 客户归属 salesId| Customer[Customer ACTIVE]
  Coop[已合作客户列表] -->|展示 sales + contractEndDate| UI[已合作页]
  EndDate[contractEndDate 自然月] --> Remind[/api/reminders]
  Remind --> Dash[智能提醒]
```

电销范围复用 `getAccessibleUserIds`，不另建权限模型。续费不新增表。

## Interfaces

### 共享电话

```ts
// 去空格后：11 位手机 1[3-9]\d{9}，或 0 开头区号固话 0\d{2,3}-?\d{7,8}
function isCrmPhone(value: string): boolean
```

错误文案：`请输入有效的手机号或座机号`。长度仍 ≤20。

### `GET /api/telemarketing`

Query: 现有 pagination + `status` + `isEffective` + `keyword`，新增可选 `salesId` uuid（仅 admin/主管且目标在范围内时过滤）。

范围：

- `getAccessibleUserIds === null` → 不按 salesId 限制（可被 query.salesId 收窄）
- 否则 `salesId in accessibleUserIds`

响应 `data.list[]` 增加：

```json
{ "salesId": "uuid", "sales": { "id": "uuid", "realName": "string", "username": "string" } }
```

错误：401 / 403 `无权查看电销名单` / 400 分页或状态非法。

### `POST /api/telemarketing`

Body 在现有姓名公司电话等字段上增加：

```ts
{
  status?: TelemarketingStatus  // default PENDING
  isEffective?: boolean         // default false
  result?: TelemarketingResult | null
  salesId?: string              // uuid；销售忽略，强制自己；admin/主管可指定范围内用户
}
```

`phone` 必须通过 `isCrmPhone`。403 指定他人时不在范围。201 + 审计 `TELEMARKETING_CREATED`。

### `PUT /api/telemarketing?id=`

Body 与 POST 相同（字段均可选但至少一项）。鉴权：当前用户在记录 `salesId` 的数据范围内（不再要求 `record.salesId === actorId`）。销售不能把 `salesId` 改成别人。已转化记录允许改备注/状态，不允许改 phone 导致与客户脱节——phone 仍可改但 duplicate 不在本接口检查客户表。409 仅删除时已转化。

### `POST /api/telemarketing/import`

`multipart/form-data`：`file`（.xlsx/.xls/.csv，≤5MB，≤1000 行）；可选 `salesId` 作为缺省负责人。

列映射：姓名/name、公司/company、电话/phone、职位/position、行业/industry、来源/source、备注/notes、销售/sales（用户名或姓名，admin/主管；销售行内销售列忽略）。

规则：姓名、电话必填；电话 `isCrmPhone`；电话在文件内去重；与现有 `TelemarketingList.phone` 冲突则整批拒绝（与客户导入一致）。销售导入全部 `salesId=自己`。admin/主管：行内销售可解析则用，否则用表单 `salesId`，再否则 400 `请指定负责人`。

成功：`{ success: true, data: { count: number, ids: string[] } }`。锁名 `crm_telemarketing_import:{profile}`，Serializable。审计 `TELEMARKETING_IMPORTED`。

错误：400 校验数组、403 无权、409 冲突条数。

### `POST /api/telemarketing/convert`

保持现有 body。权限仍 `lead:convert` + `customer:create`。数据范围：`canAccessSalesData(actor, record.salesId)`。新建客户 `salesId = telemarketing.salesId`（不是 actor）。其余 FOR UPDATE / 电话冲突 / 幂等不变。

### `GET /api/customers/cooperating`

已包含 `sales`。无契约变更。前端加列即可。

### `GET /api/reminders` 续费子集

`expiringContracts` 查询从：

`contractEndDate: { gte: now, lte: now+30d }`

改为：

`contractEndDate: { gte: startOfCurrentMonth, lte: endOfCurrentMonth }`，`status: COOPERATING`，其余范围/禁用条件不变。

文案：`续费月：YYYY-MM-DD`。`totalExpiring` 仍统计该数组长度。

### 日报提交按钮

`PermissionGuard` 改为 `check={(can, permissions) => permissions.includes('report:daily:create')}`，或直接读 `usePermission().permissions`。若销售角色缺该码，apply 时对 `sales` 角色补 `report:daily:create|view|update`（幂等，不删其他权限）。

## Data Model

无新表、无新列。

使用现有：

- `TelemarketingList.salesId / status / isEffective / result / phone`
- `Customer.salesId / contractEndDate / status=COOPERATING`

## Migration

无 Prisma 迁移。可选数据修复：销售角色缺失日报权限时 `RolePermission` 补齐。不改历史电销 `salesId`（管理员名下旧名单仍挂管理员，直到导入/改派）。

## Key Decisions

### 1. 名单不同步：范围错误 vs 共享一张全员表

选范围纠正（DEC-1），不选全员共享。共享会让销售看到同事私有线索。管理员要分发 → 指定 `salesId`。旧管理员自建名单不会自动出现在销售端，需改派或重新导入。

### 2. 续费当月 vs 到期前 30 天

选自然月（DEC-6）。9 月 1 日到期、今天 9 月 14 日仍提醒；10 月 5 日到期在 9 月不提醒。若产品仍要提前看下月，应推翻本决策改为并集，而不是暗中加回 30 天。
