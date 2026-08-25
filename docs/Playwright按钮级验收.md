# Playwright 按钮级验收报告

## 本轮结果

- 生成时间：2026-08-25 18:32:25 +0800
- 运行环境：`CRM_PROFILE=test`
- 数据库保护：仅允许数据库名以 `_test` 结尾
- 浏览器：Chromium Desktop、Chromium Mobile（390px）
- 结果：22 项通过，0 项未通过，共 22 项
- 原始 JSON：`output/playwright/report.json`
- 失败产物：`output/playwright/results/`，仅失败时保留 screenshot、video 和 trace

## 覆盖范围

- 页面与按钮：导航、搜索、重置、分页、新增、编辑、删除、归档、转移、认领、上传、下载、设置保存。
- 数据证据：客户、文件、系统设置、归属关系、软删除状态和下载次数。
- 审计证据：客户创建/更新/归档/删除/转移/认领、文件上传/删除、系统设置更新。
- 权限证据：管理员、销售主管、销售和受限用户，覆盖按钮隐藏、API 403、页面 403 和数据范围。
- 恢复证据：空状态、加载状态、真实慢响应、断网恢复、会话撤销后重新登录、浏览器刷新和真实服务端 500。
- 重复操作：客户新增和系统设置保存验证重复点击只产生一次写请求。
- 视觉边界：销售漏斗全零数据、移动端抽屉导航、标题唯一性和页面横向溢出。

## 用例明细

| 序号 | 套件 | 用例 | 结果 |
| ---: | --- | --- | --- |
| 1 | auth.setup.ts | 准备夹具并生成四个角色的认证状态 | 通过 |
| 2 | specs\customers.spec.ts / 客户列表与客户写操作 | 搜索、重置和分页使用真实服务端数据 | 通过 |
| 3 | specs\customers.spec.ts / 客户列表与客户写操作 | 新增客户重复点击只写入一次并记录审计 | 通过 |
| 4 | specs\customers.spec.ts / 客户列表与客户写操作 | 编辑客户同步更新页面、数据库和审计 | 通过 |
| 5 | specs\customers.spec.ts / 客户列表与客户写操作 | 归档客户进入公海且流转可追溯 | 通过 |
| 6 | specs\customers.spec.ts / 管理员客户删除 | 删除客户执行软删除且保留审计 | 通过 |
| 7 | specs\customers.spec.ts / 主管客户转移 | 转移按钮写入目标销售并记录审计 | 通过 |
| 8 | specs\customers.spec.ts / 公海认领 | 销售认领公海客户并更新归属与审计 | 通过 |
| 9 | specs\dashboard.visual.spec.ts | 销售漏斗全零时仍显示清晰阶梯且不改变真实标签 | 通过 |
| 10 | specs\dashboard.visual.spec.ts | 仪表盘在关键宽度切换侧栏且没有横向溢出 | 通过 |
| 11 | specs\files.spec.ts / 文件共享按钮 | 上传、下载和删除文件均写入真实存储、数据库和审计 | 通过 |
| 12 | specs\files.spec.ts / 销售文件权限 | 销售可上传并下载自己的文件但看不到删除按钮 | 通过 |
| 13 | specs\permissions.spec.ts / 销售页面权限与导航 | 销售可导航到文件页且客户动作按权限隐藏 | 通过 |
| 14 | specs\permissions.spec.ts / 销售页面权限与导航 | 销售无法读取管理员客户 | 通过 |
| 15 | specs\permissions.spec.ts / 主管数据范围 | 主管可读取本人和下属客户 | 通过 |
| 16 | specs\permissions.spec.ts / 受限用户权限 | 客户接口返回 403 且页面转到无权限页 | 通过 |
| 17 | specs\recovery.spec.ts / 列表状态与网络恢复 | 空状态、慢响应、断网恢复和浏览器刷新均可用 | 通过 |
| 18 | specs\recovery.spec.ts / 会话过期恢复 | 会话失效后重新登录返回原页面 | 通过 |
| 19 | specs\recovery.spec.ts / 真实服务端 500 | 下载对象缺失时按钮返回 500、带请求号且不误改数据 | 通过 |
| 20 | specs\settings.spec.ts / 系统设置按钮 | 保存设置重复点击只写入一次并在刷新后回显 | 通过 |
| 21 | specs\settings.spec.ts / 受限设置权限 | 受限用户直达页面和接口均被拒绝 | 通过 |
| 22 | specs\shell.mobile.spec.ts | 手机端使用抽屉导航且页面无横向溢出 | 通过 |

## 未自动化范围

- 未使用 `skip`；业务写操作、权限和数据断言均连接真实 test 服务及 test 数据库。
- 销售漏斗视觉边界用例仅替换 `/api/statistics/funnel` 的只读响应为五层全零数据，用于稳定复现截图中的布局问题，不作为业务接口正确性的证据。
- 未对 stable 或线上数据库执行写操作，线上只允许发布后进行只读核对。
- 本阶段覆盖 Chromium Desktop 和 390px Chromium Mobile；Firefox、WebKit 及更多尺寸仍属于最终发布验收范围。
- E2E 不替代持续压力测试、依赖安全审计和真实 Nginx/PM2/systemd 主机演练，这些由后续任务单独验证。
