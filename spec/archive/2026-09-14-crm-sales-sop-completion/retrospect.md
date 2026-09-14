# Retrospect: crm-sales-sop-completion

归档原因：新需求 `crm-sales-desk-corrections` 启动前必须保持单一 active change。本变更已 APPROVED，tasks 全勾，archive-check 通过。

## 偏差

- 文档写“独立 spec-verifier”，项目 knowledge 禁止子智能体；verify.md 已标明主智能体复核，不算独立验收。
- `ERR_CONNECTION_RESET` 仍未定位（V-6 open），未宣称为已修复。

## 证据

- E2E 31/31、sop-flow、data-reachability、release-test 均在 2026-08-29 留下 `logs/test` 日志。
- 未新增客户业务字段；订单资格扩到 `ACTIVE | COOPERATING`。

## 未完成

- 连接重置根因、线上正式切流（当时只做备用端口只读验收）。
- 电销名单仍按创建人 `salesId` 隔离，状态/有效性表单未开放——转入本轮新变更。
