# Verification Ledger: crm-market-requirements-enhancement

## Round 0 - propose critique panel

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-1 | necessity | major | fixed(r0) | PWA 在 proposal 中被误放到 P2，与 research 的 P1 决策冲突 | 已修改 `proposal.md ## How`，PWA=P1、AI=P2 |
| V-2 | necessity | major | fixed(r0) | 对 P2/暂缓能力编写完整验收会扩大本次文档范围 | 已修改 `proposal.md ## What`，P0/P1 写验收，P2/暂缓只写进入条件、依赖和边界 |
| V-3 | necessity | minor | fixed(r0) | 缺少排期数据时使用“里程碑”容易形成伪承诺 | 已改为“阶段顺序”，并明确不虚构日期、负责人和交付承诺 |
| V-4 | regression-compat | major | fixed(r0) | 更新原生成脚本可能破坏现有入口和原 DOCX 产物 | 已改为新增独立生成脚本，验收要求旧脚本与原文档保持不变 |
| V-5 | regression-compat | major | fixed(r0) | Task、DailyReport、Order、收款删除等断裂模块可能被误标为已实现 | 已在完成度矩阵验收中加入具体负向检查列表 |
| V-6 | regression-compat | major | fixed(r0) | 新 DOCX 可能被误读为当前产品能力清单 | 标题增加“规划完善版”，规划项强制标注“规划/未实现”，原文档路径保持不变 |

## Evidence
- necessity critic：逐项审查 `proposal.md ## What/How`，返回 3 条证据化发现，均已采纳或部分采纳。
- regression-compat critic：审查旧脚本、半成品模块和现有文档消费场景，返回 3 条证据化发现，均已采纳。

## Round 1 - language and architecture review

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-7 | necessity | major | fixed(r1) | “跨语言需重写 70%–90% 后端”没有可复核计算依据，并与“不写未经校准的迁移比例”约束冲突 | 已删除比例；改为列出必须重建的认证、权限、ORM、部署和契约边界 |
| V-8 | necessity | major | fixed(r1) | “满足 2–3 项才拆分”与固定优先 TypeScript 后端缺少依据，且强制合规隔离可能单独触发 | 已区分强制评估项与综合评估项；触发后按团队、运维、合规和实测负载选择 PoC，不预设语言顺序 |
| V-9 | necessity | major | fixed(r1) | 本轮提前定义统一响应包、请求头和错误码，实际是在引入新契约，与“本轮不改接口”冲突 | `design.md ## Interfaces` 已改为记录现状快照与不变量；具体新契约移到独立接口设计变更 |
| V-10 | necessity | minor | fixed(r1) | 语言延续结论把目标框架版本误写成当前事实，并无依据固定“先重构后升级” | 已区分当前 Next.js 14/React 18 与目标 Next.js 15.4/React 19；升级顺序交由独立兼容性评估 |
| V-11 | regression-compat | major | fixed(r1) | API 兼容承诺缺少逐路由旧契约基线，标准化可能破坏现有前端消费者 | `proposal.md` 增加 34 个 Route Handler 的方法、路径、请求、响应、状态码、错误和调用方快照验收 |
| V-12 | regression-compat | major | fixed(r1) | Next.js/React 升级验收未覆盖 NextAuth、CASL 和数据范围关键路径 | `proposal.md` 与 `design.md` 增加 build、JWT/callback、登录态续期、受保护页面/API、列表/详情/导出/报表下钻矩阵 |
| V-13 | regression-compat | major | fixed(r1) | MySQL/Prisma schema 和文件存储缺少迁移、回滚与旧对象访问兼容要求 | 已增加 expand/contract、备份/回滚演练、Decimal/枚举/Json/约束/级联回归，以及文件对象、权限和签名 URL 验收 |

## Evidence for Round 1
- 本地迁移分析：`src`/`prisma` 约 91 个源码文件、约 15,179 行，34 个 API Route Handler、20 个页面；33 个 API 文件直接访问 Prisma，33 个涉及认证，31 个涉及 CASL，约 106 处 `any`。
- 官方资料：TypeScript Handbook、Prisma Client/Transactions、Next.js Route Handlers/BFF、Spring Framework/Security/Actuator、ASP.NET Core/EF Core、Django/FastAPI、Go database 文档，均已写入 `research.md` 的 Practices。
- 当前没有执行生产构建、类型检查或 DOCX 渲染；这些属于 `$spec-apply` 阶段的验证项，不在本轮提案门禁中伪造为已通过。
- 审查意见处理：V-7、V-8、V-9、V-11、V-12、V-13 全部采纳；V-10 部分采纳，保留项目明确要求的 Next.js 15.4/React 19 作为目标基线，但取消“当前已使用”和固定升级顺序的表述。

## Round 2 - apply closing verification

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-14 | completeness | major | fixed(r2-fix1) | 完成度矩阵缺少“已实现”和“模型预留”状态 | DOCX 解析：`已实现` 5 次、`模型预留` 3 次、`规划/未实现` 5 次；能力表覆盖四类状态 |
| V-15 | completeness | major | fixed(r2-fix2) | DOCX 未同步 P0/P1 可执行验收、P2/暂缓进入条件和完整迁移边界 | 最终 DOCX 中 `P0 验收`、`P1 验收`、`P2/暂缓进入条件` 各 1 次；Decimal、枚举、Json、唯一约束、级联、文件旧对象访问、长任务进入队列均可检出 |
| V-16 | completeness | major | fixed(r2-fix1) | 缺少需求编号、代码证据、官方来源和验收项的追踪矩阵 | DOCX 第 10 章为 5 列、9 行追踪表，包含 REQ-P0-01 至 REQ-P2-01 共 8 项 |

## Evidence for Round 2
- `python -m py_compile scripts/docs/build_crm_market_requirements.py`：退出码 0。
- `python scripts/docs/build_crm_market_requirements.py`：退出码 0，生成独立 DOCX 与 UTF-8 BOM/CRLF TXT。
- LibreOffice headless 转 PDF：退出码 0；PyMuPDF 解析为 5 页、4767 个文本字符，并输出 5 张逐页 PNG。
- 逐页视觉检查：能力表与追踪矩阵行未跨页拆分，标题、表格和正文未见截断或重叠。
- 旧入口 `python scripts/docs/build_crm_requirements.py`：退出码 0；旧脚本和原 DOCX 路径保留。原 DOCX 会被旧脚本按当前时间重新生成，因此二进制哈希变化不作为内容不兼容证据。
- 独立 spec-verifier 初验提出 3 项 major；第一轮修复关闭 V-14、V-16，第二轮定向修复关闭 V-15。当前无 open ledger finding。

## Round 3 - user-sourced merge acceptance

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-17 | user-acceptance | major | fixed(r3) | 用户要求将市场调研规划与原始代码审查内容合并为一个交付文档，不再分开提供 | 新增合并输出 `docs/CRM系统代码需求规格说明书（市场调研完善合并版）.docx` 与根目录 TXT；旧市场调研中间产物移至 `logs/superseded/`，原始审查 DOCX 保留为历史源稿 |

## Evidence for Round 3
- 合并 DOCX 解析：128 个段落、21 张表、32 个标题；同时包含市场技术选型、`REQ-P0-01` 追踪矩阵、原始 `REQ-01` 整改需求和附录 B。
- 合并 DOCX 渲染：PyMuPDF 解析为 15 页；过渡页无空白页，市场追踪矩阵与原始整改章节均可见。
- 合并 TXT 已验证 UTF-8 BOM 与 Windows CRLF，内容同时包含两部分正文。
- 生成脚本仍为单一入口：`scripts/docs/build_crm_market_requirements.py`；旧代码审查脚本和原始 DOCX 未删除。
