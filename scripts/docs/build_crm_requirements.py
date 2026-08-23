from __future__ import annotations

import logging
from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION_START
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs" / "CRM系统代码审查整改需求规格说明书.docx"
LOG_FILE = ROOT / "logs" / "crm_requirements_document.log"
BLACK = RGBColor(0, 0, 0)
GRAY = RGBColor(89, 89, 89)
LIGHT_GRAY = "E7E6E6"


def set_font(run, name: str, size: float, bold: bool = False, color=BLACK) -> None:
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd")) or OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    if shd.getparent() is None:
        tc_pr.append(shd)


def set_cell_margins(cell, top=90, start=110, bottom=90, end=110) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for edge, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{edge}")) or OxmlElement(f"w:{edge}")
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")
        if node.getparent() is None:
            tc_mar.append(node)


def set_repeat_table_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run("第 ")
    set_font(run, "宋体", 9)
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    paragraph._p.append(fld)
    run = paragraph.add_run(" 页")
    set_font(run, "宋体", 9)


def setup_styles(doc: Document) -> None:
    section = doc.sections[0]
    section.page_width, section.page_height = Cm(21), Cm(29.7)
    section.top_margin = section.bottom_margin = Cm(2.54)
    section.left_margin = section.right_margin = Cm(2.54)
    section.header_distance, section.footer_distance = Cm(1.25), Cm(1.25)

    normal = doc.styles["Normal"]
    normal.font.name, normal.font.size = "宋体", Pt(10.5)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
    normal.font.color.rgb = BLACK
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    normal.paragraph_format.line_spacing = Pt(20)
    normal.paragraph_format.space_after = Pt(0)

    for name, size, before, after in (
        ("Heading 1", 16, 14, 8),
        ("Heading 2", 14, 12, 6),
        ("Heading 3", 12, 8, 4),
    ):
        style = doc.styles[name]
        style.font.name, style.font.size, style.font.bold = "黑体", Pt(size), True
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "黑体")
        style.font.color.rgb = BLACK
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.line_spacing = Pt(20)
        style.paragraph_format.keep_with_next = True


def add_heading(doc: Document, text: str, level: int) -> None:
    doc.add_heading(text, level=level)


def add_body(doc: Document, text: str, bold_prefix: str | None = None) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0.74)
    if bold_prefix and text.startswith(bold_prefix):
        r1 = p.add_run(bold_prefix)
        set_font(r1, "宋体", 10.5, True)
        r2 = p.add_run(text[len(bold_prefix):])
        set_font(r2, "宋体", 10.5)
    else:
        set_font(p.add_run(text), "宋体", 10.5)


def add_table(doc: Document, headers: list[str], rows: list[list[str]], widths: list[float]) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.style = "Table Grid"
    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.width = Cm(widths[i])
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_shading(cell, LIGHT_GRAY)
        set_cell_margins(cell)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        set_font(p.add_run(header), "黑体", 9, True)
    set_repeat_table_header(table.rows[0])
    for row in rows:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            cells[i].width = Cm(widths[i])
            cells[i].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cells[i])
            p = cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT if i > 1 else WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.line_spacing = Pt(15)
            set_font(p.add_run(value), "宋体", 8.5)
    doc.add_paragraph()


def add_requirement(doc: Document, req: dict[str, str]) -> None:
    add_heading(doc, f"{req['id']} {req['title']}", 2)
    add_table(doc, ["属性", "内容"], [["优先级", req["priority"]], ["依据", req["evidence"]]], [3.1, 12.7])
    add_body(doc, "需求说明：" + req["description"], "需求说明：")
    add_body(doc, "验收标准：" + req["acceptance"], "验收标准：")


def build_document() -> None:
    logging.basicConfig(filename=LOG_FILE, level=logging.INFO, encoding="utf-8", format="%(asctime)s %(levelname)s %(message)s")
    logging.info("开始生成 CRM 整改需求规格说明书")
    doc = Document()
    setup_styles(doc)

    header = doc.sections[0].header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_font(header.add_run("CRM 系统代码审查整改需求规格说明书"), "宋体", 9, color=GRAY)
    add_page_number(doc.sections[0].footer.paragraphs[0])

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(72)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(p.add_run("CRM 系统代码审查整改需求规格说明书"), "黑体", 22, True)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(p.add_run("基于现有 Next.js、Prisma、NextAuth 与 CASL 实现的整改需求"), "宋体", 12, color=GRAY)
    doc.add_paragraph()
    add_table(doc, ["文档属性", "内容"], [["版本", "V1.0"], ["编制日期", date(2026, 8, 20).isoformat()], ["项目目录", str(ROOT)], ["文档状态", "代码审查后整改基线"]], [3.4, 12.4])
    add_body(doc, "说明：本文档依据当前工作区源码静态审查结果编制。由于项目依赖尚未安装，构建、类型检查与 lint 的最终结果标记为待验证。")
    doc.add_page_break()

    add_heading(doc, "1 文档目的与范围", 1)
    add_body(doc, "本文档将代码审查发现的问题转化为可实施、可验收、可追踪的整改需求，用于后续排期、开发、测试和交付验收。整改对象为 CRM 系统的认证、授权、客户管理、公海池、订单收款、合同文件、运行脚本、日志、测试和代码结构。")
    add_body(doc, "本次范围以现有代码行为为依据，不把尚未实现的能力描述为已完成。页面视觉重设计、全新业务模块和生产部署架构不在本轮核心范围内；如实施过程中触发框架版本升级，应作为独立阶段验证。")

    add_heading(doc, "2 当前系统理解", 1)
    add_body(doc, "系统采用 Next.js App Router 同时承载页面与 API，Prisma 连接 MySQL，NextAuth Credentials Provider 负责登录与 JWT 会话，CASL 将权限码映射为操作能力，数据权限模块递归查询上下级关系。前端使用 React、TypeScript 与 Ant Design，合同备案文件当前保存到 public/uploads/contracts，并保留 OSS 工具代码。")
    add_table(doc, ["层次", "当前实现", "主要位置"], [
        ["认证", "硬编码演示账号写入 JWT", str(ROOT / "src/lib/auth.ts")],
        ["页面授权", "middleware 按路径检查权限码", str(ROOT / "src/middleware.ts")],
        ["API 授权", "各 route 内调用 CASL", str(ROOT / "src/app/api")],
        ["数据范围", "本人、下属、管理员、财务过滤", str(ROOT / "src/lib/data-permission.ts")],
        ["持久化", "Prisma + MySQL", str(ROOT / "prisma/schema.prisma")],
        ["文件", "本地 public 目录与 OSS 工具并存", str(ROOT / "src/lib/fileStorage.ts")],
    ], [2.5, 5.0, 8.3])

    add_heading(doc, "3 审查依据与问题摘要", 1)
    add_table(doc, ["编号", "问题摘要", "等级", "代码依据"], [
        ["F-01", "登录用户 ID 与标准 seed 的 UUID 方案不一致", "P0", f"{ROOT / 'src/lib/auth.ts'}:7-78；{ROOT / 'prisma/seed.ts'}:247-278"],
        ["F-02", "客户、订单写接口的数据范围校验分散且存在缺口", "P0", f"{ROOT / 'src/app/api/customers/[id]/archive/route.ts'}:18-46；{ROOT / 'src/app/api/finance/orders/[id]/route.ts'}:116-119"],
        ["F-03", "管理员 manage/all 规则未在权限模型中建立", "P0", f"{ROOT / 'src/lib/casl.ts'}:3-20,229-240；合同接口使用 ability.can('manage','all')"],
        ["F-04", "公海池每日认领统计字段在认领后被清空", "P0", f"{ROOT / 'src/app/api/public-pool/route.ts'}:145-167,217-227"],
        ["F-05", "收款金额缺少正数、有限值与并发一致性约束", "P0", f"{ROOT / 'src/app/api/finance/payments/route.ts'}:129-179"],
        ["F-06", "上传文件位于 public 目录，图片扩展名还被 middleware 排除", "P0", f"{ROOT / 'src/lib/fileStorage.ts'}:4-28；{ROOT / 'src/middleware.ts'} matcher"],
        ["F-07", "环境文件包含数据库密码和固定密钥", "P0", f"{ROOT / '.env.local'}:4-11"],
        ["F-08", "API 输入普遍依赖 any、parseFloat 和直接 new Date", "P1", f"{ROOT / 'src/app/api'}"],
        ["F-09", "缺少统一日志文件输出及标准 Run & Debug 入口", "P1", f"{ROOT / 'scripts'}；{ROOT / 'package.json'}:5-14"],
        ["F-10", "页面文件达到 556 至 704 行，超出项目约定", "P2", f"{ROOT / 'src/app/(dashboard)/customers/page.tsx'} 等"],
    ], [1.3, 5.0, 1.2, 8.3])

    add_heading(doc, "4 整改需求", 1)
    requirements = [
        {"id":"REQ-01","title":"统一认证数据源","priority":"P0","evidence":f"{ROOT / 'src/lib/auth.ts'}；{ROOT / 'prisma/seed.ts'}","description":"登录认证改为读取数据库用户，校验 bcrypt 密码、用户状态、角色和权限。会话中的 userId 必须来自数据库主键，移除运行时硬编码账号依赖。","acceptance":"标准 seed 后可使用数据库账号登录；JWT userId 在 User 表存在；INACTIVE 与 LOCKED 账号登录被拒绝；不存在两套相互冲突的用户初始化流程。"},
        {"id":"REQ-02","title":"统一权限模型与管理员能力","priority":"P0","evidence":f"{ROOT / 'src/lib/casl.ts'}；合同备案相关 API","description":"定义唯一的权限码、动作和资源类型来源。管理员采用明确的 manage/all 规则或统一的管理员判定函数，前端、middleware 与 API 使用同一语义。","acceptance":"管理员可访问其应有的合同查看、预览、下载和删除操作；未知权限码默认拒绝；权限单元测试覆盖四类角色和无角色用户。"},
        {"id":"REQ-03","title":"集中数据范围授权","priority":"P0","evidence":f"{ROOT / 'src/lib/data-permission.ts'}；客户与订单详情 API","description":"建立可复用的数据范围策略，统一表达本人、下属团队、全局只读和全局管理。读取、更新、归档、转移、删除、下单和合同操作均在数据库查询条件中合并范围约束。","acceptance":"销售仅操作本人数据；主管仅操作本人及下属数据；财务权限按业务动作限制；越权 ID 返回 403 或 404；所有写接口具备对应回归测试。"},
        {"id":"REQ-04","title":"修复公海池认领与配额","priority":"P0","evidence":f"{ROOT / 'src/app/api/public-pool/route.ts'}；{ROOT / 'src/app/api/public-pool/quota/route.ts'}","description":"新增独立认领记录或 claimedAt 字段，配额统计以认领事件为准。配额检查与客户认领在同一事务内完成，并以 isPublic=true 作为条件更新，避免重复认领。","acceptance":"同一客户并发认领仅一人成功；每日次数准确累加；达到上限后请求被拒绝；管理员角色判断使用小写数据库角色或统一枚举。"},
        {"id":"REQ-05","title":"保证收款与订单金额一致性","priority":"P0","evidence":f"{ROOT / 'src/app/api/finance/payments/route.ts'}；{ROOT / 'src/app/api/finance/orders/[id]/route.ts'}","description":"金额输入采用十进制定点校验，要求大于零且为有限值。收款创建、订单余额校验和金额更新采用事务与条件更新；合同金额不得低于已收金额。","acceptance":"零值、负数、NaN、Infinity、超额收款和合同金额低于已收金额均返回 400；并发收款后 paidAmount + unpaidAmount 始终等于 contractAmount。"},
        {"id":"REQ-06","title":"建立 API 输入模型","priority":"P1","evidence":f"{ROOT / 'src/app/api'} 中的 request.json、parseInt、parseFloat 与 any","description":"为请求体、查询参数、枚举、日期和分页建立 Zod 强类型模型。分页默认值和上限统一，错误响应使用稳定错误码。","acceptance":"业务 API 不再直接信任未解析 JSON；page 大于等于 1，pageSize 设置合理上限；非法日期和枚举返回 400；核心 API 不使用未经批准的 any。"},
        {"id":"REQ-07","title":"保护合同文件与上传边界","priority":"P0","evidence":f"{ROOT / 'src/lib/fileStorage.ts'}；{ROOT / 'src/app/api/customers/[id]/contract-archives/route.ts'}","description":"受保护合同文件移出 public 静态目录，通过鉴权 API 流式返回或使用短时 OSS 签名地址。上传同时校验扩展名、MIME、文件签名、大小和规范化文件名。","acceptance":"未登录用户持有文件路径时也取不到文件；PNG/JPG 合同不绕过鉴权；伪造 MIME、路径穿越文件名和超限文件被拒绝；删除备案同步处理存储文件。"},
        {"id":"REQ-08","title":"密钥与错误信息治理","priority":"P0","evidence":f"{ROOT / '.env.local'}；多个 API 返回 error.message","description":"轮换数据库密码、NEXTAUTH_SECRET 和加密密钥；仓库及交付包仅保留脱敏示例。客户端错误不返回数据库、堆栈或本机路径，详细异常写入文件日志并携带 requestId。","acceptance":"交付扫描不出现真实密码或固定生产密钥；500 响应只包含通用信息和 requestId；服务端日志可通过 requestId 定位完整异常。"},
        {"id":"REQ-09","title":"统一初始化与数据迁移","priority":"P1","evidence":f"{ROOT / 'prisma/seed.ts'}；{ROOT / 'create-demo-users.ts'}；多个 seed 脚本","description":"确定唯一 seed 入口，角色、权限、演示用户和层级关系使用幂等初始化。可能清空业务数据的脚本标记为开发专用并加入显式确认参数。","acceptance":"连续执行两次 seed 结果一致；不会因为用户 ID 策略导致外键错误；默认运行流程不会清空已有业务数据。"},
        {"id":"REQ-10","title":"补齐 Run、Debug 与文件日志","priority":"P1","evidence":f"{ROOT / 'scripts'} 当前仅有 auto-public-pool.ts","description":"在 scripts 目录提供 start、stop、test、build、seed 和 export 的 .py 与 .sh 入口，Windows 默认使用当前 Python 解释器组织 npm 命令。应用日志统一写入 logs 目录并按日期或大小滚动。","acceptance":"通过 python scripts\\manage.py start|stop|test|build 可执行标准流程；对应 shell 入口行为一致；失败时返回非零错误码并在 logs 产生记录。"},
        {"id":"REQ-11","title":"建立自动化质量门禁","priority":"P1","evidence":f"{ROOT / 'package.json'} 缺少 test 脚本；本次 build/lint 因依赖缺失未成功执行","description":"补齐单元测试、API 集成测试和关键角色 E2E 测试，测试重点覆盖认证、权限矩阵、公海池并发、收款一致性和合同下载。构建前必须完成依赖安装与 Prisma Client 生成。","acceptance":"scripts 测试入口依次执行类型检查、lint、单元测试和构建；P0 场景均有回归用例；测试报告写入 logs 或标准测试报告目录。"},
        {"id":"REQ-12","title":"拆分大文件并强化类型边界","priority":"P2","evidence":f"{ROOT / 'src/app/(dashboard)/customers/page.tsx'} 为 704 行，其他多个页面超过 500 行","description":"把页面拆为查询 hooks、表格列、表单、弹窗和领域类型模块；API 使用 Prisma 输入类型和显式 DTO，删除重复映射与无意义透传。","acceptance":"动态语言代码文件尽量控制在 300 行以内；目录每层尽量不超过 8 个文件；新增代码无循环依赖，重复权限与映射逻辑有唯一实现。"},
        {"id":"REQ-13","title":"技术栈基线适配","priority":"P1","evidence":f"{ROOT / 'package.json'}:34-37 当前为 Next.js 14 与 React 18","description":"在安全与数据一致性整改稳定后，单独评估并实施 Next.js 15.4、React 19 的兼容升级。升级按依赖逐项验证，不与核心业务修复混合提交。","acceptance":"升级前后关键业务回归一致；阅读迁移说明并记录破坏性变更；锁文件与构建产物由标准脚本验证。"},
    ]
    for req in requirements:
        add_requirement(doc, req)

    add_heading(doc, "5 非功能性需求", 1)
    add_table(doc, ["类别", "要求", "验收指标"], [
        ["安全性", "认证、授权、文件访问和密钥采用拒绝优先策略", "核心越权用例全部通过；交付物密钥扫描无有效凭据"],
        ["可靠性", "资金、认领、版本更新等多步骤写操作保持原子性", "故障或并发场景下无部分写入与金额不平"],
        ["性能", "分页受控，批量导入避免逐条无界请求，列表消除 N+1", "pageSize 有上限；1000 行导入采用批处理；合同版本统计不按列表逐项查询"],
        ["可维护性", "权限、DTO、错误模型和数据范围集中管理", "重复实现减少；文件长度与目录规模符合项目约定"],
        ["可观测性", "日志写入 logs，错误具有 requestId 和上下文", "关键操作、拒绝和异常可按 requestId 追踪"],
        ["兼容性", "Windows、Linux/macOS 均有脚本入口", "Python 与 shell 入口执行相同检查并返回一致错误码"],
    ], [2.2, 7.4, 6.4])

    add_heading(doc, "6 实施优先级与里程碑", 1)
    add_table(doc, ["阶段", "范围", "退出条件"], [
        ["阶段一：安全与一致性", "REQ-01 至 REQ-05、REQ-07、REQ-08", "认证与权限回归通过；资金和认领并发测试通过；密钥已轮换"],
        ["阶段二：工程化", "REQ-06、REQ-09 至 REQ-11", "标准脚本、日志、输入模型和质量门禁可重复执行"],
        ["阶段三：结构优化", "REQ-12", "大文件拆分完成，类型边界清晰，行为回归一致"],
        ["阶段四：版本升级", "REQ-13", "Next.js 15.4 与 React 19 构建、测试及手工验证通过"],
    ], [3.2, 6.2, 6.6])

    add_heading(doc, "7 验收与追踪要求", 1)
    add_body(doc, "每项需求应建立需求编号、代码提交、测试用例和验证证据之间的映射。P0 需求全部完成且回归通过后，项目才进入功能扩展阶段。验收记录至少包括执行日期、环境、数据库版本、Node.js 版本、命令、结果、日志完整路径和必要截图。")
    add_body(doc, "本次静态审查未形成构建通过结论。验证时应先安装锁文件依赖、生成 Prisma Client，再通过 scripts 目录的统一入口执行类型检查、lint、测试和生产构建。")

    add_heading(doc, "附录 A 审查与文档技能说明", 1)
    add_body(doc, "本需求文档使用 code-review-and-quality 的正确性、可读性、架构、安全和性能五轴审查方法整理；使用 doc 文档生成流程完成 DOCX 结构与渲染检查；使用 thesis-docx-norm-repair 的实现一致性原则，确保需求均可追溯到实际代码或明确标记为待验证。find-skills 搜索未返回更专门的 SRS 技能，因此未引入额外技能依赖。")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    logging.info("文档生成完成：%s", OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build_document()
