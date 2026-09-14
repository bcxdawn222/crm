# Retrospect: crm-sales-desk-corrections

归档原因：用户调用 `/spec:archive`。archive-check 通过（APPROVED + 账本 + tasks 全勾）。

## 偏差

- 文档写独立 spec-verifier；项目禁止子智能体。verify round 1 由实施对话自审，已标明非独立复核。
- design Interfaces 未列 `GET /api/telemarketing/owners`；实施为表单/导入选负责人新增该接口。
- design 写「apply 时」补齐销售日报权限；代码在首次认证路径幂等补齐（`ensureSalesDailyReportPermissionsOnce`），不经单独运维脚本。
- 未做浏览器端到端点击；验收走 test profile HTTP/SQL。已合作两列仅对照源码，未对页面截图。
- 电销验收夹具电话从 `prefix+marker[:8]` 改为纯数字，否则 `isCrmPhone` 会拒十六进制 marker。

## 证据

- `npx tsc --noEmit`、`python scripts/manage.py routes` 退出码 0。
- test：座机入库、PUT 状态/有效性、导入两行 `salesId`、转化客户归属名单负责人、管理员分派后销售 GET 可见、销售 `POST /api/daily-reports` 写入。夹具已删。
- `/api/reminders` 合同文案为 `续费月：2026-09-*`（自然月，无 30 天窗口）。

## 未完成

- V-4：下月到期合同本月不提醒；若要并集需推翻 DEC-6。
- V-6：历史挂在管理员名下的名单不自动改派，需手工改派或重导入。
- 全量 `data-flow` 仍在客户导入「空电话行」失败（Not in this change）。
