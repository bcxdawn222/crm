# CRM 最终代码与残留检查

生成时间：2026-08-26T20:32:46+08:00

## 结果

- TypeScript/JavaScript import 循环：0。
- 明确测试状态残留：0。
- 超过 300 行的跟踪脚本：4。
- 单层超过 8 个跟踪文件的目录：9。

## 超长文件

| 文件 | 行数 | 分类 |
| --- | ---: | --- |
| `generate-test-data.ts` | 375 | 历史测试脚本 |
| `comprehensive-test.ts` | 370 | 历史测试脚本 |
| `scripts/docs/build_mediation_document.py` | 353 | 历史文档脚本 |
| `generate-all-test-data.js` | 335 | 历史测试脚本 |

## 目录规模

| 目录 | 文件数 |
| --- | ---: |
| `.` | 89 |
| `scripts/quality` | 42 |
| `docs` | 26 |
| `scripts` | 13 |
| `scripts/docs` | 12 |
| `scripts/performance` | 11 |
| `scripts/deploy` | 9 |
| `scripts/runtime` | 9 |
| `tests/e2e/specs` | 9 |

## 循环依赖

- 未发现可解析的 TypeScript/JavaScript import 循环。

## 测试残留

- test PID、锁、认证状态、storage/test 文件和 Playwright `.last-run.json` 均无残留。

## 处理说明

- 超长根目录测试脚本和旧文档生成脚本未进入当前 `scripts/manage.py`、Next.js 页面或 API 运行链路，本期保留以免误删历史资料。
- 根目录仍含较多历史测试、说明、截图和数据脚本，超过当前目录规模目标；发布白名单不会携带这些文件。
- `prisma/schema.prisma` 受 Prisma 单 schema 文件约束，本报告不按普通 TypeScript 文件拆分规则处理。
- 未使用代码和语义重复不能仅靠 import 图完全证明；本轮以 TypeScript 类型检查、路由检查、按钮审计和 E2E 共同补充。
