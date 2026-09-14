# Verification Ledger: crm-sales-desk-corrections

## Round 0 - proposal critique - 2026-09-14

> 项目禁止子智能体。本轮由主智能体按 necessity、regression-compat 两个固定镜头各审一遍，一轮反驳后写入。不能视为独立复核。

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-1 | necessity | major | closed(r0) | 只加销售列不改 GET 过滤，销售仍看不到管理员创建的名单 | GET 现写死 `salesId: session.user.id`（`src/app/api/telemarketing/route.ts` L64）；What-1 改为 `getAccessibleUserIds` |
| V-2 | necessity | minor | closed(r0) | 转入客户弹窗已存在，重做无增量 | What-2 明确保留弹窗，只改归属与范围；`telemarketing-convert-modal.tsx` 已有入口 |
| V-3 | necessity | major | closed(r0) | 新续费日期字段不能单独解决「当月提醒」；现有 `contractEndDate` 足够 | Customer 已有 `contractEndDate`（schema L190）；DEC-5 不新增列 |
| V-4 | regression-compat | major | open | 提醒窗口从未来 30 天改为自然月后，下月到期（例如今天 9/14、到期 10/5）本月不再出现 | `src/lib/reminders/queries.ts` L37 现为 `gte now, lte now+30d`；design 改为当月起止。反驳：用户要的是当月不是 30 天。仍开放：若销售依赖提前看下月，gate 可推翻 DEC-6 为并集 |
| V-5 | regression-compat | major | closed(r0) | 管理员电销列表会突然看到全公司名单 | What/Risk 用销售列 + 可选 `salesId` 筛选；这正是「同步」要的行为 |
| V-6 | regression-compat | minor | open | 历史挂在管理员 `salesId` 上的名单不会自动出现在销售端 | Migration 节写明不改派。反驳：静默改派会把管理员私有测试数据塞给销售。仍开放：上线后需一次手工改派或重导入 |
| V-7 | necessity | major | closed(r0) | 只修 seed、不改提交按钮，销售仍可能因 CASL `create/report` 与权限码不一致而看不到按钮 | `daily-reports/page.tsx` L113 用 `action=create subject=report`；What-5 改为权限码并补角色 |

Unresolved after rebuttal: V-4, V-6.

## Round 1 - apply 收尾验收 - 2026-09-14

> 项目禁止子智能体。本轮由实施主智能体按 completeness / correctness / coherence / charter 复核并跑 test profile 写入型检查。不能视为独立 spec-verifier。结论：**pass**（无新增 critical/major；V-4/V-6 仍为 round 0 产品语义开放项，非实施缺陷）。

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-4 | regression-compat | major | open | 提醒窗口是自然月，下月到期本月不出现（DEC-6） | `src/lib/reminders/queries.ts`：`contractEndDate: { gte: startOfCurrentMonth, lte: endOfCurrentMonth }`；test GET `/api/reminders` 文案均为 `续费月：2026-09-*`，无 10 月日期 |
| V-6 | regression-compat | minor | open | 历史挂在管理员名下的名单不会自动出现在销售端 | 未改历史 `salesId`。test：管理员 POST `salesId=销售` 后，销售 GET 能看到该行（新分派有效） |
| V-8 | completeness | — | closed(r1) | What-1 电销范围/座机/状态 | `npx tsc --noEmit` 退出码 0；test 保存座机 `010-{8位}`；PUT `status=CONNECTED,isEffective=1` 入库；销售登录可见管理员分派行 `ASSIGN_VISIBLE_OK` |
| V-9 | completeness | — | closed(r1) | What-2 导入与转化归属 | test `POST /api/telemarketing/import` 201、两行 `salesId=admin`；转化后 `Customer.salesId = TelemarketingList.salesId` |
| V-10 | completeness | — | closed(r1) | What-3 已合作两列 | `cooperating-table.tsx` 含「对应销售」「续费时间」绑定 `sales.realName` / `contractEndDate` |
| V-11 | completeness | — | closed(r1) | What-4 续费自然月 | 见 V-4 证据；旧 30 天窗口已删除（无 `thirtyDaysLater`） |
| V-12 | completeness | — | closed(r1) | What-5 销售日报 | 销售角色含 `report:daily:create|view|update`；销售会话带这些码；`POST /api/daily-reports` 写入该用户 `SALES_DAILY_REPORT_OK`；按钮改为 `permissions.includes('report:daily:create')` |
| V-13 | charter | — | closed(r1) | 登录时幂等补齐销售日报权限 | `ensureSalesDailyReportPermissionsOnce` 由 DEC-7 / design「apply 时补齐」授权；失败抛错不静默；不删其他权限 |

命令证据：

- `python scripts/manage.py routes` 退出码 0
- `npx tsc --noEmit` 退出码 0
- test profile 电销 CRUD/导入/座机/转化：`TELEMARKETING_FLOW_OK`（夹具已清理）
- test profile 销售可见分派：`ASSIGN_VISIBLE_OK`（夹具已清理）
- test profile 销售提交日报：`SALES_DAILY_REPORT_OK`（夹具已清理）
- 全量 `python scripts/manage.py data-flow --profile test` 在客户导入「非法行」用例返回 201 失败（`POST /api/customers/import` 第三下 201）。该用例在 `src/lib/customers/import.ts`，**Not in this change**；电话空行按现有客户导入 schema 合法。未改客户导入。

