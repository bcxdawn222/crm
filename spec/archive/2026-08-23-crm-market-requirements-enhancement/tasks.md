# Tasks: crm-market-requirements-enhancement

> deps omitted = sequential, follows the previous item

- [x] 1. 证据与完成度基线
  - [x] 1.1 复核现有 DOCX、源码模块、接口和 Prisma 模型证据
  - [x] 1.2 建立角色、Lead-to-Cash 主流程和当前完成度矩阵
  - [x] 1.3 对 Task、DailyReport、Order、收款删除及 mock 模块执行负向标注检查
- [x] 2. 市场能力与技术选型章节
  - [x] 2.1 整理官方 CRM 能力来源及访问日期
  - [x] 2.2 编写 P0/P1/P2/暂缓需求及验收边界
  - [x] 2.3 编写 TypeScript 技术族延续结论、跨语言候选与触发条件
  - [x] 2.4 写入当前 Next.js 14/React 18 与目标 Next.js 15.4/React 19 的区别
- [x] 3. 工程治理与兼容要求
  - [x] 3.1 写入 Service/Use Case、DTO/Zod、授权、事务、幂等和并发要求
  - [x] 3.2 写入 34 个 Route Handler 的旧契约快照与消费者回归要求
  - [x] 3.3 写入 NextAuth/CASL、MySQL/Prisma、文件存储的兼容与回滚要求
  - [x] 3.4 写入 OpenAPI、审计、日志、健康检查、工作流、缓存和队列边界
- [x] 4. 文档生成
  - [x] 4.1 新增独立 DOCX 生成脚本，保留旧脚本和原 DOCX
  - [x] 4.2 生成市场调研规划完善版 DOCX                         deps: 4.1
  - [x] 4.3 生成客户可读 UTF-8 BOM/CRLF TXT 摘要                  deps: 4.2
- [x] 5. 验证与交付
  - [x] 5.1 运行旧文档生成入口并核对原产物未变化                deps: 4.1
  - [x] 5.2 渲染新 DOCX 为逐页图片并检查截断、重叠和分页          deps: 4.2
  - [x] 5.3 检查章节、需求编号、来源、完成度和追踪矩阵            deps: 2.4, 3.4, 4.2
  - [x] 5.4 将执行结果、页数、章节数和需求数写入日志              deps: 5.1, 5.2, 5.3
- [x] 6. 合并交付物
  - [x] 6.1 将市场调研规划与原始代码审查正文合并到同一 DOCX
  - [x] 6.2 将两部分正文合并到同一 UTF-8 BOM/CRLF TXT
  - [x] 6.3 移出旧市场调研中间产物，保留原始 DOCX 作为历史源稿
  - [x] 6.4 重新渲染合并版并检查过渡页、表格和正文
