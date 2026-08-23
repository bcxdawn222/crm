# Verification Ledger: crm-comprehensive-quality-optimization

---
round: 0
conclusion: fail
---

## Round 0 - proposal critique

> 受项目“禁止子智能体”约束，本轮未派发独立批评智能体；由主智能体分别按 necessity 和 regression-compat 两个固定视角审查，不能视为独立复核。

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-1 | necessity | major | fixed(r0) | 如果先做全量视觉重构，mock 和死按钮仍会被包装成更完整的假功能 | tasks 先建立按钮契约并修真实数据链路，UI 验收要求与按钮和数据证据共同通过 |
| V-2 | necessity | major | fixed(r0) | 把 Next.js/React 升级直接绑定稳定版发布会扩大本次质量修复的必要范围 | design 与 tasks 将升级限定在 test，必须完整回归后才能 promote |
| V-3 | necessity | critical | open | 当前没有 Git，无法执行每个一级任务的独立提交与回退 | research DEC-12 和 tasks 1.2 将初始化 Git 作为 HARD GATE 决策；用户拒绝时只能明确放弃该验收项 |
| V-4 | regression-compat | critical | open | 当前有三个未归档 Spec，其中一个仍缺 HTTP 冒烟，直接运行 apply 可能选错活动变更或掩盖未完成验证 | research DEC-13 和 tasks 1.1 要求 apply 前处理旧 Spec，但本轮未擅自归档 |
| V-5 | regression-compat | critical | fixed(r0) | 按钮 E2E 和性能测试若复用稳定数据库，会污染客户、订单、回款和上传文件 | design 强制 stable/test 分离数据库与上传目录，tasks 1 和 8 禁止稳定数据作为测试夹具 |
| V-6 | regression-compat | major | fixed(r0) | 页面拆分和统一请求层可能遗漏字段、改变错误语义或重复提交写操作 | tasks 5 要求字段快照，tasks 9 禁止非幂等写自动重试，tasks 15 用真实浏览器和数据库断言回归 |

### Round 0 conclusion

- Proposal、design 和 tasks 已覆盖用户指定的八类 CRM 优化范围，并明确排除原第 9、10、11 项。
- V-3 与 V-4 需要在 HARD GATE 由用户确认或接受其限制，因此当前结论为 `fail`，不能进入实施。
- 本轮只生成 Spec 文档，没有修改业务代码、数据库或线上环境。

## Apply working evidence - 2026-08-23

- `python scripts\manage.py typecheck --profile stable`：退出码 0。
- `python scripts\manage.py runtime-test --profile stable`：退出码 0，test profile 复用 stable 数据库时被明确拒绝。
- `python scripts\manage.py build --profile stable`：退出码 0；新增 `/api/health` 与消息 API 进入路由表，构建不再输出 `Dynamic server usage` 堆栈。
- `python scripts\manage.py button-audit --profile stable`：退出码 1，当前仍有文件 mock 和提醒假跟进 3 项，未宣称通过。
- `python scripts\manage.py data-reachability --profile stable`：退出码 1，`localhost:3306` 连接超时，数据库级验收仍被阻塞。
- Git 已初始化为 `main`，数据库备份、上传文件、临时渲染、截图和 `__pycache__` 已从索引排除，磁盘原文件未删除。

## Apply working evidence - 2026-08-23 18:41

- `python scripts\manage.py typecheck --profile stable`：退出码 0；Prisma Client 生成和 TypeScript 检查均通过。
- `python scripts\manage.py routes --profile stable`：退出码 0；路由契约静态检查通过。
- `python scripts\manage.py button-audit --profile stable`：退出码 0；当前页面未发现 mock 标识或仅提示型跟进动作。
- 文件共享页已改为读取 `/api/files`，上传调用 `POST /api/files`，下载调用 `GET /api/files/:id`，删除调用 `DELETE /api/files/:id`；服务端包含文件类型、大小、路径约束、权限校验和 `AuditEvent` 记录。
- 消息中心已改为读取真实 `/api/messages`，单条已读、全部已读和删除均调用对应 Route Handler；用户管理页已移除当前没有真实保存契约的编辑/删除控件。
- 提醒页的跟进类按钮现在只跳转到客户入口，不再显示“正在跟进”的假成功提示；真正创建跟进记录及时间线同步仍未完成。
- `python scripts\manage.py data-reachability --profile stable`：退出码 1；`localhost:3306` 当前不可达，因此上述文件、消息和权限行为尚未完成数据库级验证。
