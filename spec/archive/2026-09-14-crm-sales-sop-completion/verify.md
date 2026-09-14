# Verification Ledger: crm-sales-sop-completion

## Round 0 - proposal critique - 2026-08-29

> 项目禁止子智能体，本轮由主智能体分别按 necessity 和 regression-compat 两个固定视角审查，不能视为独立复核。

| ID | Lens | Severity | Status | Finding | Evidence |
|---|---|---|---|---|---|
| V-1 | necessity | major | fixed(r0) | 把商机、报价、产品目录或审批加入本轮不能解决截图中的入口缺失、建单阻塞和仪表盘消失 | proposal 的 Not in this change 明确排除，设计只使用现有 Customer、FollowUp、Order、Payment 和 ContractArchive |
| V-2 | necessity | major | fixed(r0) | 只部署本地“转已合作”按钮仍会保留已合作客户不能建单和详情数据不完整两个阻塞 | proposal What 1-3 与 tasks 2-3 要求同一轮修复完整详情、合作状态和订单资格 |
| V-3 | regression-compat | major | fixed(r0) | 仪表盘保留最近成功数据可能让销售误以为旧数据仍然实时 | design 和 tasks 4.2 要求显示上次更新时间与“数据可能已过期” |
| V-4 | regression-compat | major | fixed(r0) | 直接用仓库 Nginx 模板覆盖线上配置会丢失现有 TLS/Certbot 指令 | design 发布约束和 tasks 6.2/7.4 要求先备份线上实际配置，只合并代理、日志和版本标识 |
| V-5 | regression-compat | major | fixed(r0) | 允许已合作客户建单可能扩大普通销售可选客户范围 | 设计把资格限定为当前数据范围、非公海且 `ACTIVE | COOPERATING`，tasks 5.3 要求四角色权限和数据库断言 |
| V-6 | necessity | major | open | 服务器进程、数据库和连续 60 次外部健康请求均正常，现有证据未复现 `ERR_CONNECTION_RESET`；代理配置和页面恢复改进可能提升可观测性，但不能保证消除客户端、运营商或云网络层的连接重置 | research 记录 PM2/MariaDB 重启次数为 0、资源正常、Nginx 无同期 5xx；proposal 已禁止宣称原因已定位，tasks 6.5 保留取证和未定位状态 |
| V-7 | regression-compat | major | fixed(r0) | 线上受控写入冒烟如果清理失败会留下测试客户、订单或回款 | tasks 7.3-7.6 要求先备份、使用可识别验收记录、失败回滚和最终残留复核；不允许操作原始业务记录 |
| V-8 | workflow | major | fixed(r0) | `spec/changes/` 曾存在另一个未归档的 `crm-comprehensive-quality-optimization`，会阻止单活动变更实施门禁 | 已于 2026-08-29 归档到 `spec/archive/2026-08-29-crm-comprehensive-quality-optimization`，提交 `85def9b`；当前只剩 `crm-sales-sop-completion` |

## Round 1 - implementation working checks - 2026-08-29

> 项目明确禁止子智能体，因此本轮是主智能体对任务 2-5 的实施复核，不属于独立 verifier 复核。最终独立验证要求受该项目约束阻止，不能虚构为已完成。

| ID | Scope | Status | Evidence |
|---|---|---|---|
| R1-1 | 完整浏览器回归 | pass | `python scripts\manage.py e2e --profile test` 退出码 0，31/31 通过；覆盖完整销售 SOP、真实 500、断网恢复、会话过期、五档视口和 390px 手机端。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-e2e-20260829-120610.log` |
| R1-2 | 专项销售 SOP | pass | `python scripts\manage.py sop-flow --profile test` 退出码 0；电销转客户、详情、跟进、转已合作、合作维护、建单、回款、提醒、统计、双会话和审计一致，结束后自动清理夹具并停止 test 服务。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-sop-flow-20260829-120307.log` |
| R1-3 | 失败路径 | pass | 设置 `CRM_SOP_EXPECT_FAILURE=1` 后 `sop-flow` 返回退出码 1，日志同时记录测试夹具已清理和 test 服务已停止。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-sop-flow-20260829-110513.log` |
| R1-4 | 数据可达性 | pass | `python scripts\manage.py data-reachability --profile test` 退出码 0；15 张核心表、13 条业务链路通过，孤立关系、异常订单金额和负回款均为 0，Customer、FollowUp、Order、Payment 等测试业务表为 0。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-data-reachability-20260829-120936.log` |
| R1-5 | 构建与静态检查 | pass | E2E 前置生产构建退出码 0，编译、Lint 和类型检查通过；`git diff --check` 无输出。生产构建证据包含在 R1-1 日志中。 |
| R1-6 | 范围与残留 | pass | 当前只有 `crm-sales-sop-completion` 一个活动变更；专项脚本和 E2E 结束后服务停止，测试业务表无残留；未新增商机、报价、审批、AI 或客户字段。 |

## Round 2 - production governance working checks - 2026-08-29

> 本轮仍为主智能体实施复核，不属于独立 verifier。线上备用端口验收只读取正式数据库，没有写入业务数据，也没有切换正式流量。

| ID | Scope | Status | Evidence |
|---|---|---|---|
| R2-1 | 线上只读漂移审计 | pass | `python scripts\manage.py production-audit --profile stable` 退出码 0，确认旧 stable 提交、全网卡 3000、systemd 包装 PM2、固定 Connection upgrade 和 8 个旧回滚目录日志句柄。报告：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\discuss\线上部署漂移报告-2026-08-29.md`；日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-production-audit-20260829-122252.log` |
| R2-2 | 发布治理契约 | pass | `python scripts\manage.py production-ops-test --profile test` 退出码 0；覆盖 SHA256、迁移状态、数据库备份可读性、127.0.0.1 监听、Nginx 校验/reopen、失败恢复和候选进程组清理。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-production-ops-test-20260829-123930.log` |
| R2-3 | release/promote/rollback | pass | `python scripts\manage.py release-test --profile test` 退出码 0。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-release-test-20260829-122446.log` |
| R2-4 | 服务故障演练 | pass | `python scripts\manage.py server-runtime-drill --profile test` 退出码 0；健康与重启、数据库不可达 503、存储不可达 503 均通过并释放随机端口。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-server-runtime-drill-20260829-122457.log` |
| R2-5 | 线上备用端口 | pass | `python scripts\manage.py production-stage --profile stable --artifact D:\Desktop\CRM系统代码 (2)\CRM系统代码\.build\test\release\1.0.0-3b0162be.zip` 退出码 0；SHA256、9 个迁移、健康提交和静态资源通过，结束后 `127.0.0.1:3002` 无监听，正式 `3000` 仍为旧 stable 提交。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-production-stage-20260829-124010.log` |
| R2-6 | 连接重置状态 | unresolved | 仍未稳定复现 `ERR_CONNECTION_RESET`。当前证据只能确认旧代理和日志漂移，不能把客户端、运营商或云网络层问题表述为已修复。 |

## Round 3 - production deployment working checks - 2026-08-29

> 项目禁止子智能体，本轮为主智能体执行的线上部署与恢复验证，不冒充独立 verifier 结论。

| ID | Scope | Status | Evidence |
|---|---|---|---|
| R3-1 | 正式部署 | pass | `python scripts\manage.py production-deploy --profile stable --artifact D:\Desktop\CRM系统代码 (2)\CRM系统代码\.build\test\release\1.0.0-b1962c5d.zip` 退出码 0；线上健康提交为 `b1962c5d726687c8ba49a31504e1f490a6365fef`。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-production-deploy-20260829-130439.log`。 |
| R3-2 | 自动恢复演练 | pass | 首次切换时 systemd 启动后健康检查在端口监听前返回状态 7，部署脚本自动恢复上一稳定版本；加入 `--retry-connrefused` 后重新发布成功。失败证据：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-production-deploy-20260829-125642.log`。 |
| R3-3 | 登录与只读冒烟 | pass | 管理员登录、健康接口和关键只读接口通过，正式服务由 systemd 直接管理并监听 `127.0.0.1:3000`。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-smoke-20260829-130655.log`。 |
| R3-4 | 线上部署漂移 | pass | 2026-08-29 13:28 复核未发现登记漂移：回环监听、systemd 直管、Nginx 动态 Connection map、旧回滚日志句柄 0、最新备份可见。报告：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\discuss\线上部署漂移报告-2026-08-29.md`；日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-production-audit-20260829-132853.log`。 |

## Round 4 - controlled production write and cleanup - 2026-08-29

> 本轮只创建带唯一标记的验收记录，不读取或修改既有业务记录；清理同时使用唯一 marker、精确实体 ID 和 requestId 定位。

| ID | Scope | Status | Evidence |
|---|---|---|---|
| R4-1 | 线上销售 SOP 写入 | pass | `python scripts\manage.py production-sop-smoke --profile stable` 退出码 0；唯一标记 `ab3d9e83d36e` 完成电销、转客户、跟进、转已合作、合作备注、建单和回款。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\manage-production-sop-smoke-20260829-131828.log`。 |
| R4-2 | 数据与审计一致性 | pass | 数据库确认客户状态 `COOPERATING`、合作备注、订单 `12000.00/3000.00/9000.00` 和 7 类审计事件一致；写前备份为 `/root/crm-backups/crm_system-20260829T051829Z.sql.gz`，并通过 gzip 可读性检查。 |
| R4-3 | 精确清理 | pass | Payment、Order、FollowUp、TelemarketingList、Customer 和 AuditEvent 按本次 marker、ID 与 requestId 删除；残留计数全部为 0，核心表数量与金额快照前后一致，远程数据探针已删除。证据同 R4-1。 |
| R4-4 | 进程与候选产物 | pass | PM2 空守护进程已关闭，两个旧候选目录和对应日志已删除；`PM2_DAEMONS=0`、`STALE_DIRS=0`、`STALE_LOGS=0`、systemd 服务 active。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\stable\production-maintenance-20260829-132222.log`。 |
| R4-5 | 最终仓库审计 | pass | `python scripts\manage.py final-audit --profile test` 退出码 0；import 循环 0、明确测试状态残留 0。日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-final-audit-20260829-132955.log`；报告：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\docs\CRM最终代码与残留检查.md`。发布治理契约复核日志：`D:\Desktop\CRM系统代码 (2)\CRM系统代码\logs\test\manage-production-ops-test-20260829-132903.log`。 |
| R4-6 | 连接重置状态 | unresolved | `ERR_CONNECTION_RESET` 仍未稳定复现，尚不能确认客户端、运营商、云网络或应用中的具体来源；本次只确认服务、数据库、Nginx 和部署配置在验收时正常。 |
