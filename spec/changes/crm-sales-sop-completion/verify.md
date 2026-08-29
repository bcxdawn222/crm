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
