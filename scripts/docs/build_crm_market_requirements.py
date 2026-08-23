from __future__ import annotations

import logging
import copy
from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt

from build_crm_requirements import (
    LOG_FILE,
    add_body,
    add_heading,
    add_page_number,
    add_table,
    setup_styles,
    set_font,
)


ROOT = Path(__file__).resolve().parents[2]
ORIGINAL_DOCX = ROOT / "docs" / "CRM系统代码审查整改需求规格说明书.docx"
OUTPUT = ROOT / "docs" / "CRM系统代码需求规格说明书（市场调研完善合并版）.docx"
TXT_OUTPUT = ROOT / "CRM系统代码需求规格说明书（市场调研完善合并版）.txt"
LOG_FILE = ROOT / "logs" / "crm_market_requirements_document.log"


SOURCES = [
    "Salesforce Sales Cloud：https://www.salesforce.com/sales/cloud/",
    "Microsoft Dynamics 365 Sales：https://learn.microsoft.com/en-us/dynamics365/sales/overview",
    "Pipedrive Sales：https://www.pipedrive.com/en/products/sales",
    "Zoho CRM：https://www.zoho.com/crm/features.html",
    "HubSpot CRM：https://www.hubspot.com/products/crm",
    "Next.js BFF：https://nextjs.org/docs/app/guides/backend-for-frontend",
    "Next.js Production Checklist：https://nextjs.org/docs/app/guides/production-checklist",
    "Prisma Transactions：https://www.prisma.io/docs/orm/prisma-client/queries/transactions",
    "Spring Security Method Security：https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html",
    "ASP.NET Core Policies：https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies",
    "Django Transactions：https://docs.djangoproject.com/en/5.2/topics/db/transactions/",
    "FastAPI Features：https://fastapi.tiangolo.com/features/",
    "Go Database：https://go.dev/doc/database/",
]

CAPABILITY_ROWS = [
    ["认证与角色", "登录、角色、功能权限、数据范围", "基础登录与角色模型已实现；统一组织/多租户为模型预留", "P0/P2"],
    ["线索与商机", "阶段、金额、概率、预计关闭日期、下一步", "Lead 模型部分实现；商机主链路不完整", "P1 规划/未实现"],
    ["客户与联系人", "去重、合并、负责人、标签、活动时间线", "客户、公海、FollowUp 已实现基础能力；合并不足", "P0/P1 部分实现"],
    ["公海", "领取上限、冷却、回收、审计、脱敏", "公海与配额已实现基础能力，统计和并发需修复", "P0 部分实现"],
    ["合同订单回款", "金额、状态、版本、回款计划、审计", "模型与部分接口已实现；一致性治理待补", "P0 部分实现"],
    ["消息、文件、设置", "通知、受保护文件、系统配置", "消息/设置为模型预留或 mock；文件为部分实现", "P1 规划/未实现"],
    ["自动化", "触发器、条件、动作、日志、重试、幂等", "提醒与回收规则偏硬编码", "P1 规划/未实现"],
    ["报表预测", "转化、阶段停留、业绩、回款、加权预测", "统计接口已实现基础能力，权限口径需统一", "P1 部分实现"],
    ["响应式/PWA", "查询、跟进、任务、阶段更新", "当前无 PWA", "P1 规划/未实现"],
    ["AI 辅助", "摘要、草稿、风险提示、自然语言报表", "没有模型接入和治理", "P2 规划/未实现"],
]

TRACE_ROWS = [
    ["REQ-P0-01", "认证与权限", "src/lib/auth.ts；src/lib/casl.ts", "官方安全角色/权限实践", "数据库用户、禁用账号拒绝、角色矩阵"],
    ["REQ-P0-02", "公海与配额", "src/app/api/public-pool/route.ts", "CRM 公海实践", "并发仅一人成功、配额准确"],
    ["REQ-P0-03", "订单与回款", "src/app/api/finance/payments/route.ts", "Prisma Transactions；CRM 回款实践", "金额边界、事务、并发一致性"],
    ["REQ-P0-04", "文件与密钥", "src/lib/fileStorage.ts；.env.local", "Next.js 数据访问与文件边界", "未授权下载拒绝、密钥扫描"],
    ["REQ-P1-01", "API 契约与输入", "src/app/api；34 个 route.ts", "Next.js Route Handlers；OpenAPI 实践", "逐路由快照、Zod/DTO、错误状态码"],
    ["REQ-P1-02", "审计与自动化", "src/app/api/reminders；src/lib", "Zoho/HubSpot 自动化实践", "规则启停、执行日志、重试、幂等"],
    ["REQ-P1-03", "移动与报表", "src/app/(dashboard)；src/app/api/statistics", "Salesforce Mobile；Pipeline Inspection", "PWA 查询跟进、权限下钻"],
    ["REQ-P2-01", "AI 辅助", "当前无模型接入", "Salesforce AI；Dynamics Copilot", "用户确认后写入、继承数据权限"],
]


def add_bullets(doc: Document, items: list[str]) -> None:
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.line_spacing = Pt(18)
        set_font(p.add_run(item), "宋体", 10.5)


def prevent_table_row_split(table) -> None:
    for row in table.rows:
        tr_pr = row._tr.get_or_add_trPr()
        cant_split = OxmlElement("w:cantSplit")
        cant_split.set(qn("w:val"), "true")
        tr_pr.append(cant_split)


def extract_docx_text(path: Path) -> str:
    source = Document(path)
    chunks = [paragraph.text for paragraph in source.paragraphs if paragraph.text.strip()]
    for table in source.tables:
        for row in table.rows:
            chunks.append(" | ".join(cell.text.replace("\n", " ") for cell in row.cells))
    return "\n".join(chunks)


def append_original_docx_body(doc: Document) -> tuple[int, int]:
    source = Document(ORIGINAL_DOCX)
    add_heading(doc, "附录 B 原始代码审查整改需求规格说明书", 1)
    body = doc.element.body
    for element in list(source.element.body):
        if element.tag == qn("w:sectPr"):
            continue
        body.append(copy.deepcopy(element))
    return len(source.paragraphs), len(source.tables)


def build_text() -> str:
    return """CRM系统代码市场调研规划完善版
编制日期：2026-08-20
文档状态：需求基线与规划文档；规划项不是当前已实现能力

一、结论摘要
当前项目最合适的主语言仍是 TypeScript。建议继续采用 TypeScript + Next.js + React + Prisma + MySQL 技术族，先把现有 Next.js 全栈代码整理为模块化单体；不立即整体迁移 Java、C#、Python 或 Go。
这不是对所有 CRM 项目的通用结论：从零建设大型企业 CRM 时，Java/Spring Boot 或 C#/ASP.NET Core 可能更适合；Python 更适合作为 AI/数据服务；Go 更适合作为高并发连接器和 Worker。
Next.js 15.4 与 React 19 是后续目标基线，当前代码仍是 Next.js 14 与 React 18，升级需要独立兼容验证。

二、当前系统与证据
1. 现有源码约 91 个 .ts/.tsx/.prisma 文件、约 15179 行，34 个 API Route Handler、20 个页面。
2. 33 个 API 文件直接访问 Prisma，33 个涉及认证，31 个涉及 CASL；源码约有 106 处 any。
3. Prisma schema 当前包含 User、Customer、Lead、FollowUp、Order、Payment、DailyReport、Task、Message、File、ContractArchive 等模型，但没有 tenantId/orgId。
4. Task、DailyReport、Order、收款删除存在接口/模型不一致或路由缺失；消息、用户、文件、设置存在 mock、只读或部分实现。
5. 当前不存在统一 service/repository/controller/dto/validator 分层、typed API client 或 OpenAPI 契约。

三、产品定位与主流程
定位：面向中小销售团队的销售型 CRM，不扩张为低代码平台、ERP 或完整 CPQ。
主流程：线索 → 客户/联系人 → 商机 → 报价/合同 → 订单 → 回款 → 活动与复盘。
角色：销售、销售主管、财务、管理员；功能权限与数据范围分离，数据范围覆盖本人、下属、部门、共享和全局。

四、市场能力与当前完成度
状态标签固定为：已实现、部分实现、模型预留、规划/未实现。已实现只表示源码存在可运行路径，不代表通过生产验收。
能力 | 市场基线 | 当前状态 | 规划优先级
""" + "\n".join(" | ".join(row) for row in CAPABILITY_ROWS) + """

五、技术选型复审
1. TypeScript + Next.js：当前项目成本最低，可保留 React/Ant Design 页面、Prisma schema、MySQL、NextAuth、CASL 和现有 API 路径。改进方向是抽 Service/Use Case、DTO/Zod、统一授权、事务、幂等和审计。
2. NestJS：当需要独立 API、队列、定时任务和多个客户端时，可作为 TypeScript 后端过渡；其队列和调度生态仍需 Redis、Worker 与独立运维。
3. Java + Spring Boot：适合大型企业后端、复杂审批、多组织、方法级授权和成熟 Java 运维体系，但需要重建认证、权限、ORM、迁移、部署和测试。
4. C# + ASP.NET Core：适合已有 Azure、Windows、Microsoft Identity 和 .NET 运维体系的组织；EF Core 事务和策略授权能力较完整，迁移成本与 Java 同级。
5. Python + Django/FastAPI：Django 适合后台管理，FastAPI 适合独立 API、AI 和数据服务；主 CRM 迁移需重建会话、权限、ORM 和类型约束。
6. Go：适合 Webhook、异步 Worker、连接器和高并发外围服务；主 CRM 的 RBAC、数据范围、工作流和后台管理需要大量自行组合。

六、推荐架构路线
近期：Next.js 页面与 BFF + 统一 Auth/Permission Service + Domain Service/Use Case + Prisma/MySQL。
中期：先冻结旧 API 契约，再按资源把服务层迁移到独立 TypeScript 后端；前端、数据库和对象存储优先复用。
长期：出现强制合规隔离、网络边界或统一企业 SSO 时立即评估后端拆分；多客户端、独立扩容、队列、成熟目标栈团队和单体规模瓶颈作为综合评估信号。触发后按团队、运维、合规和实测负载选择 PoC，不固定语言顺序。

七、分期需求
P0：认证数据源、权限与数据范围、公海认领并发、订单回款金额一致性、合同文件保护、密钥治理、构建阻断修复。
P1：Zod/DTO、API 契约快照、Prisma migration、审计日志、健康检查、结构化日志、有限自动化、报表口径、响应式/PWA、队列边界。
P2：确认式 AI 摘要、跟进草稿、风险提示和自然语言报表；默认不自动写入业务数据。
暂缓：多租户计费、完整 CPQ/ERP、电子签、原生双端离线同步、自主 Agent、平台级低代码。

八、工程验收要求
P0 验收：认证使用数据库用户且禁用账号被拒绝；销售/主管/财务/管理员权限矩阵通过；公海并发认领仅一人成功且配额准确；零值、负数、NaN、Infinity、超额收款被拒绝；未授权用户不能下载合同；密钥扫描无真实凭据。
P1 验收：34 个 Route Handler 形成方法、路径、请求、响应、状态码、错误和前端调用方快照；Zod/DTO 拒绝非法日期、枚举和分页；Prisma migration 覆盖 Decimal、枚举、Json、唯一约束和级联并完成 expand/contract、备份与回滚演练；文件旧对象访问、下载权限和签名 URL 回归通过；审计、健康检查、结构化日志、OpenAPI 和有限工作流日志可查询；长任务进入队列且不持有长事务。
版本验收：执行 next build；验证 NextAuth JWT/callback、登录态续期、受保护页面/API、CASL 数据范围、列表/详情/导出/报表下钻，升级前后关键业务结果一致。
P2/暂缓进入条件：P2 AI 依赖审计、数据脱敏、模型供应商、成本上限和用户确认写入；多租户依赖 tenantId/orgId 与隔离方案；原生离线依赖同步协议和冲突策略；低代码依赖对象元数据、脚本沙箱和生态治理。在依赖未满足前只保留规划，不标记为已实现。
负向状态：Task、DailyReport、Order、收款删除、消息、设置和 mock 模块必须保留“部分实现/模型预留/未实现”证据，不得在矩阵中标为已实现。

九、官方来源
""" + "\n".join(f"- {source}" for source in SOURCES) + """

十、需求追踪矩阵
每个需求编号同时指向代码证据、市场或技术来源和可观察验收项；P2 需求的验收只验证进入条件，不把规划能力当作当前功能。
需求编号 | 能力 | 代码证据 | 来源 | 验收摘要
""" + "\n".join(" | ".join(row) for row in TRACE_ROWS) + "\n"


def build_document() -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(filename=LOG_FILE, level=logging.INFO, encoding="utf-8", format="%(asctime)s %(levelname)s %(message)s")
    text = build_text()
    original_text = extract_docx_text(ORIGINAL_DOCX)
    merged_text = text + "\n\n===== 原始代码审查整改需求规格说明书 =====\n" + original_text + "\n"
    TXT_OUTPUT.write_text(merged_text, encoding="utf-8-sig", newline="\r\n")

    doc = Document()
    setup_styles(doc)
    header = doc.sections[0].header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_font(header.add_run("CRM 系统代码市场调研规划完善版"), "宋体", 9)
    add_page_number(doc.sections[0].footer.paragraphs[0])
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(72)
    set_font(title.add_run("CRM 系统代码市场调研规划完善版"), "黑体", 22, True)
    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(sub.add_run("代码整改基线、CRM 产品路线与技术选型复审"), "宋体", 12)
    add_table(doc, ["文档属性", "内容"], [["版本", "V2.0"], ["编制日期", date(2026, 8, 20).isoformat()], ["项目目录", str(ROOT)], ["文档状态", "需求基线与规划文档；规划项不是当前能力"]], [3.4, 12.4])
    doc.add_page_break()

    sections = {
        "1 结论摘要": ["当前项目最合适的主语言仍是 TypeScript。建议继续采用 TypeScript + Next.js + React + Prisma + MySQL 技术族，先整理为模块化单体，不立即整体迁移 Java、C#、Python 或 Go。", "这不是所有 CRM 项目的通用结论：从零建设大型企业 CRM 时，Java/Spring Boot 或 C#/ASP.NET Core 可能更适合；Python 更适合作为 AI/数据服务；Go 更适合作为高并发连接器和 Worker。", "Next.js 15.4 与 React 19 是后续目标基线，当前代码仍是 Next.js 14 与 React 18，升级需要独立兼容验证。"],
        "2 当前系统与证据": ["现有源码约 91 个 .ts/.tsx/.prisma 文件、约 15179 行，34 个 API Route Handler、20 个页面。33 个 API 文件直接访问 Prisma，33 个涉及认证，31 个涉及 CASL；源码约有 106 处 any。", "Task、DailyReport、Order、收款删除存在接口/模型不一致或路由缺失；消息、用户、文件、设置存在 mock、只读或部分实现。当前不存在统一 service/repository/controller/dto/validator 分层、typed API client 或 OpenAPI 契约。"],
        "3 产品定位与主流程": ["定位：面向中小销售团队的销售型 CRM，不扩张为低代码平台、ERP 或完整 CPQ。", "主流程：线索 → 客户/联系人 → 商机 → 报价/合同 → 订单 → 回款 → 活动与复盘。角色包括销售、销售主管、财务和管理员；功能权限与数据范围分离。"],
        "4 市场能力与当前完成度": [],
        "5 技术选型复审": ["TypeScript + Next.js 当前成本最低，可保留 React/Ant Design 页面、Prisma schema、MySQL、NextAuth、CASL 和现有 API 路径；改进方向是抽 Service/Use Case、DTO/Zod、统一授权、事务、幂等和审计。", "NestJS 适合作为未来独立 TypeScript 后端；Java/Spring Boot 与 C#/ASP.NET Core 适合企业级后端；Python 适合 AI/数据服务；Go 适合连接器和 Worker。候选选择必须以团队、运维、合规和实测负载为依据。"],
        "6 推荐架构路线": ["近期：Next.js 页面与 BFF + 统一 Auth/Permission Service + Domain Service/Use Case + Prisma/MySQL。", "中期：先冻结旧 API 契约，再按资源迁移服务层；前端、数据库和对象存储优先复用。", "长期：强制合规隔离、网络边界或统一企业 SSO 可立即触发拆分评估；其他信号综合判断。"],
        "7 分期需求": ["P0：认证、权限、数据范围、公海认领并发、订单回款一致性、文件保护、密钥治理。", "P1：Zod/DTO、API 契约快照、migration、审计、日志、健康检查、有限自动化、报表、响应式/PWA。", "P2：确认式 AI 辅助；暂缓多租户、CPQ/ERP、电子签、原生离线、自主 Agent 和低代码平台。"],
        "8 工程验收要求": [
            "P0 验收：认证使用数据库用户且禁用账号被拒绝；销售/主管/财务/管理员权限矩阵通过；公海并发认领仅一人成功且配额准确；零值、负数、NaN、Infinity、超额收款被拒绝；未授权用户不能下载合同；密钥扫描无真实凭据。",
            "P1 验收：34 个 Route Handler 形成方法、路径、请求、响应、状态码、错误和前端调用方快照；Zod/DTO 拒绝非法日期、枚举和分页；Prisma migration 覆盖 Decimal、枚举、Json、唯一约束和级联并完成 expand/contract、备份与回滚演练；文件旧对象访问、下载权限和签名 URL 回归通过；审计、健康检查、结构化日志、OpenAPI 和有限工作流日志可查询；长任务进入队列且不持有长事务。",
            "版本验收：执行 next build；验证 NextAuth JWT/callback、登录态续期、受保护页面/API、CASL 数据范围、列表/详情/导出/报表下钻，升级前后关键业务结果一致。",
            "P2/暂缓进入条件：AI 依赖审计、数据脱敏、模型供应商、成本上限和用户确认写入；多租户依赖 tenantId/orgId 与隔离方案；原生离线依赖同步协议和冲突策略；低代码依赖对象元数据、脚本沙箱和生态治理。依赖满足前保持规划状态。",
            "负向状态：Task、DailyReport、Order、收款删除、消息、设置和 mock 模块保留部分实现、模型预留或未实现证据。",
        ],
        "9 官方来源": ["市场与技术判断仅使用厂商官方产品页、框架官方文档和 Microsoft Learn；访问日期为 2026-08-20。"],
        "10 需求追踪矩阵": ["每个需求编号同时指向代码证据、市场或技术来源和可观察验收项；P2 需求的验收只验证进入条件，不把规划能力当作当前功能。"],
    }
    for heading, paragraphs in sections.items():
        add_heading(doc, heading, 1)
        for paragraph in paragraphs:
            add_body(doc, paragraph)
        if heading == "4 市场能力与当前完成度":
            add_table(doc, ["能力", "市场基线", "当前状态", "优先级"], [
                *CAPABILITY_ROWS,
            ], [3.0, 5.0, 5.2, 3.0])
            prevent_table_row_split(doc.tables[-1])
        if heading == "9 官方来源":
            add_bullets(doc, SOURCES)
        if heading == "10 需求追踪矩阵":
            add_table(doc, ["需求编号", "能力", "代码证据", "来源", "验收摘要"], TRACE_ROWS, [2.2, 2.8, 5.0, 3.7, 3.0])
            prevent_table_row_split(doc.tables[-1])
    original_paragraphs, original_tables = append_original_docx_body(doc)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    logging.info("生成 DOCX：%s", OUTPUT)
    logging.info("生成 TXT：%s", TXT_OUTPUT)
    logging.info("合并原始 DOCX：%s，原始段落=%d，原始表格=%d", ORIGINAL_DOCX, original_paragraphs, original_tables)
    logging.info("章节数=%d，能力条目=%d，需求编号=%d，P0/P1验收条目=%d，来源数=%d，合并 TXT 字数=%d", len(sections), len(CAPABILITY_ROWS), len(TRACE_ROWS), 4, len(SOURCES), len(merged_text))
    print(OUTPUT)
    print(TXT_OUTPUT)


if __name__ == "__main__":
    build_document()
