# API 与数据库性能

> 生成时间：2026-08-26T12:22:31.564353+00:00；环境：test；每个接口预热后采样 3 次。

## 接口结果

| 接口 | 平均耗时(ms) | p95(ms) | 最大查询数 | 返回行数 | 错误率 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 客户列表 | 51.4 | 60.5 | 9 | 20 | 0.0% |
| 用户列表 | 49.6 | 57.2 | 9 | 1 | 0.0% |
| 每日客资 | 47.3 | 56.6 | 9 | 10 | 0.0% |
| 提醒中心 | 45.5 | 50.2 | 10 | 71 | 0.0% |
| 续签提醒 | 45.0 | 46.9 | 7 | 9 | 0.0% |
| 公海列表 | 42.0 | 50.8 | 8 | 20 | 0.0% |
| 公海统计 | 46.7 | 52.1 | 12 | 30 | 0.0% |
| 销售总览 | 46.9 | 53.2 | 10 | 1 | 0.0% |
| 销售趋势 | 39.3 | 50.6 | 8 | 31 | 0.0% |
| 销售漏斗 | 41.1 | 54.8 | 6 | 5 | 0.0% |
| 财务汇总 | 42.9 | 49.0 | 6 | 1 | 0.0% |
| 订单列表 | 38.5 | 40.0 | 9 | 20 | 0.0% |
| 回款列表 | 33.9 | 34.5 | 10 | 20 | 0.0% |
| 文件列表 | 43.3 | 48.8 | 10 | 20 | 0.0% |
| 消息列表 | 48.0 | 64.1 | 11 | 20 | 0.0% |

## 执行计划

| 查询 | access type | key | 估算行数 | Extra |
| --- | --- | --- | ---: | --- |
| 客户列表 | index | Customer_createdAt_idx | 20 | Using where; Backward index scan |
| 续签提醒 | range | Customer_contractEndDate_idx | 90 | Using where; Using index |
| 订单列表 | index | Order_createdAt_idx | 20 | Backward index scan; Using index |
| 回款列表 | index | Payment_paymentDate_idx | 20 | Backward index scan; Using index |
| 消息列表 | ref | Message_receiverId_idx | 1 | Using filesort |
| 公海认领审计 | range | AuditEvent_action_createdAt_idx | 30 | Using where; Using index |

## 预算

- 单接口 p95 不超过 2000 ms。
- 单请求 Prisma 查询数不超过 20。
- 列表和提醒单次返回不超过 100 行。
- 错误率必须为 0。
- 当前 test 数据量较小，执行计划中的全表扫描仅在估算行数超过 1000 时判定为失败；没有慢查询证据时不新增索引。

原始报告：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\api-database-performance-20260826T122231Z.json`
