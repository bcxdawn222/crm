# Design: crm-code-audit-and-sales-form-flow

## Architecture

```text
销售页面
  ├─ 订单表单 ──读取客户选项/提交订单──▶ 客户与订单接口 ──数据范围校验──▶ Prisma Customer / Order
  └─ 任务表单 ──读取负责人选项/提交任务──▶ 任务与负责人接口 ──角色范围校验──▶ Prisma User / Task
```

页面只负责展示、搜索、表单校验和错误提示；Route Handler 负责认证、权限、数据范围和枚举校验；Prisma 仍是客户、用户、订单和任务的唯一数据源。本轮不增加状态管理框架、不增加数据库表。

## Interfaces

### 1. `GET /api/customers`

现有接口继续作为订单客户选项来源。

- Input query:
  - `page`: positive integer, default `1`
  - `pageSize`: positive integer, default `10`, order form may request at most `20`
  - `keyword`: optional customer name/company search string
  - Existing `category`, `status`, `publicPool` parameters remain compatible
- Output `200`:

```json
{
  "success": true,
  "data": {
    "list": [{
      "id": "customer-id",
      "name": "客户名称",
      "company": "公司名称"
    }],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

- Error codes: `401` unauthenticated, `403` no customer read permission, `400` invalid pagination.
- Invariants: list obeys the existing session data scope; the client cannot widen the scope through query parameters.

### 2. `POST /api/finance/orders`

Existing order creation remains the write endpoint.

- Input JSON:
  - `customerId`: non-empty string
  - `contractNo`: optional string
  - `contractAmount`: positive decimal number
  - `currency`: optional supported currency string, default `CNY`
  - `signDate`: valid ISO date string
  - `deliveryDate`: optional valid ISO date string
  - `remarks`: optional string
- Output `200`: `{ "success": true, "data": <created order>, "message": "..." }`
- Error codes: `400` invalid/missing field or amount, `401` unauthenticated, `403` no order create permission or customer outside data scope, `404` customer not found, `409` duplicate order number.
- Invariants: `salesId` is always the authenticated user; `customerId` must be an accessible active customer; initial `status` is `CONFIRMED`; `paidAmount=0`; `unpaidAmount=contractAmount`.

### 3. `GET /api/tasks/assignees`

New narrowly scoped read endpoint for the task form; it must not reuse the administrator-only `/api/users` contract.

- Input query:
  - `page`: positive integer, default `1`
  - `pageSize`: positive integer, default `20`, maximum `50`
  - `keyword`: optional match against `realName`, `username` or `department`
- Output `200`:

```json
{
  "success": true,
  "data": {
    "list": [{
      "id": "user-id",
      "realName": "销售人员",
      "username": "sales",
      "department": "销售部",
      "position": "销售顾问",
      "isSelf": true
    }],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

- Error codes: `401` unauthenticated, `403` task read/create permission missing, `400` invalid pagination.
- Invariants: only `ACTIVE` users in the allowed assignee role set are returned; a sales user sees only self; a sales manager sees self and users in their subordinate scope; admin/finance see active sales users in the permitted global scope. The endpoint does not return passwords, permissions or unrelated user fields.

### 4. `POST /api/tasks`

Existing task creation remains the write endpoint.

- Input JSON:
  - `title`: non-empty string
  - `description`: optional string
  - `assigneeId`: required user ID
  - `dueDate`: optional ISO date string
  - `priority`: one of `LOW`, `MEDIUM`, `HIGH`, `URGENT`, default `MEDIUM`
- Output `200`: `{ "success": true, "data": <created task>, "message": "..." }`
- Error codes: `400` invalid/missing field or enum, `401` unauthenticated, `403` no task create permission or assignee outside scope, `404` assignee not found/inactive.
- Invariants: `creatorId` is always the authenticated user; `status` starts as `TODO`; the server re-checks assignee scope and does not trust the option list or client role.

### 5. List status filters

- Orders accept only `PENDING`, `CONFIRMED`, `DELIVERING`, `COMPLETED`, `CANCELLED`.
- Tasks accept only `TODO`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
- Invalid status values return `400` rather than silently returning an empty list.

## Data Model

- `Customer`: existing `id`, `name`, `company`, `salesId`, `status`, `isPublic`; no new fields.
- `User`: existing `id`, `realName`, `username`, `department`, `position`, `status`, `managerId`, `roles`; passwords and permission details never enter option responses.
- `Order`: existing `customerId`, `salesId`, `contractAmount`, `paidAmount`, `unpaidAmount`, `status`; no schema migration.
- `Task`: existing `assigneeId`, `creatorId`, `priority`, `status`, `endDate`; API continues exposing `dueDate` as the compatibility name for `endDate`.
- Ownership invariant: the authenticated session owns `salesId`/`creatorId`; selected IDs only reference existing records and are checked against server-side scope.

## Key Decisions

### Sales task creation and assignment

- Problem: a sales user sees the task creation button, but the server denies `task:create`; if the form is merely populated with users, the visible workflow still ends in `403`, and allowing arbitrary assignees would widen data access.
- Solution: grant sales users only the ability to create tasks for themselves; keep broader assignee selection for manager/admin/finance within the scoped endpoint.
- Cost: the sales role cannot delegate work to another user; delegation remains a manager function.
- Why not the alternatives: hiding the button preserves the old permission model but leaves the visible product capability absent; allowing any active user creates an unbounded assignment path that does not match current data-scope rules.

## Migration / Compatibility

- No database migration and no data rewrite are required.
- Existing `/api/customers` and `/api/tasks` response fields remain; `dueDate` continues to map from `Task.endDate`.
- Existing order and task list pages keep their routes. Only the invalid UI enum values and missing option loading are corrected.
- `/api/users` remains administrator-oriented; the new task assignee endpoint is additive and can be removed later if a shared directory contract is introduced.
- If the escalated sales task permission is rejected, the rollback is limited to removing the sales create permission and hiding the create button; existing task records remain unchanged.
