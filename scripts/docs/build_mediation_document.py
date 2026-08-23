from __future__ import annotations

import logging
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

from build_crm_customer_requirements import (
    add_page_break,
    configure_document,
    set_cell_shading,
    set_run,
    set_table_geometry,
)
from sales_simple_document_data import (
    ACCEPTANCE_SCENARIOS,
    BUSINESS_RULES,
    FIELD_APPENDIX,
    GOALS,
    MODULES,
    NON_FUNCTIONAL,
    OUT_OF_SCOPE,
    ROLES,
    STATUS_RULES,
    Module,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs" / "销售客户管理与跟进系统需求文档（基于现有系统雏形）.docx"
LOG_FILE = ROOT / "logs" / "sales_crm_document.log"

ACCENT = "3F665F"
ACCENT_LIGHT = "E8EFED"
GRAY = "F3F3F1"
WHITE = "FFFFFF"
TEXT = RGBColor(38, 38, 38)
MUTED = RGBColor(96, 96, 96)


def setup_logging() -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"), logging.StreamHandler()],
    )


def repeat_header(row) -> None:
    element = OxmlElement("w:tblHeader")
    element.set(qn("w:val"), "true")
    row._tr.get_or_add_trPr().append(element)


def add_text(
    doc: Document,
    text: str,
    *,
    size: float = 10.5,
    bold: bool = False,
    color: RGBColor = TEXT,
    after: float = 6,
    align=None,
):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(after)
    paragraph.paragraph_format.line_spacing = 1.3
    if align is not None:
        paragraph.alignment = align
    set_run(paragraph.add_run(text), size=size, bold=bold, color=color)
    return paragraph


def add_heading(doc: Document, text: str, level: int = 1) -> None:
    paragraph = doc.add_paragraph(style=f"Heading {level}")
    paragraph.paragraph_format.keep_with_next = True
    paragraph.paragraph_format.space_before = Pt(14 if level == 1 else 9)
    paragraph.paragraph_format.space_after = Pt(6)
    color = RGBColor.from_string(ACCENT) if level == 1 else TEXT
    set_run(paragraph.add_run(text), size=15 if level == 1 else 11.5, bold=True, color=color)


def add_bullets(doc: Document, items: tuple[str, ...]) -> None:
    for item in items:
        paragraph = doc.add_paragraph(style="List Bullet")
        paragraph.paragraph_format.left_indent = Inches(0.34)
        paragraph.paragraph_format.first_line_indent = Inches(-0.17)
        paragraph.paragraph_format.space_after = Pt(3)
        set_run(paragraph.add_run(item), size=10.2)


def add_numbered(doc: Document, items: tuple[str, ...]) -> None:
    num_id = _new_numbering_instance(doc)
    for item in items:
        paragraph = doc.add_paragraph(style="List Number")
        paragraph.paragraph_format.left_indent = Inches(0.38)
        paragraph.paragraph_format.first_line_indent = Inches(-0.2)
        paragraph.paragraph_format.space_after = Pt(4)
        num_pr = paragraph._p.get_or_add_pPr().find(qn("w:numPr"))
        if num_pr is None:
            num_pr = OxmlElement("w:numPr")
            paragraph._p.get_or_add_pPr().append(num_pr)
        ilvl = OxmlElement("w:ilvl")
        ilvl.set(qn("w:val"), "0")
        num = OxmlElement("w:numId")
        num.set(qn("w:val"), str(num_id))
        num_pr.append(ilvl)
        num_pr.append(num)
        set_run(paragraph.add_run(item), size=10.2)


def _new_numbering_instance(doc: Document) -> int:
    numbering = doc.part.numbering_part.element
    abstract_id = None
    for abstract in numbering.findall(qn("w:abstractNum")):
        for level in abstract.findall(qn("w:lvl")):
            num_fmt = level.find(qn("w:numFmt"))
            lvl_text = level.find(qn("w:lvlText"))
            if (num_fmt is not None and num_fmt.get(qn("w:val")) == "decimal" and
                    lvl_text is not None and lvl_text.get(qn("w:val")) == "%1."):
                abstract_id = abstract.get(qn("w:abstractNumId"))
                break
        if abstract_id is not None:
            break
    if abstract_id is None:
        abstract_id = "0"
    existing = [int(item.get(qn("w:numId"))) for item in numbering.findall(qn("w:num"))]
    num_id = max(existing or [0]) + 1
    num = OxmlElement("w:num")
    num.set(qn("w:numId"), str(num_id))
    abstract_ref = OxmlElement("w:abstractNumId")
    abstract_ref.set(qn("w:val"), str(abstract_id))
    num.append(abstract_ref)
    level_override = OxmlElement("w:lvlOverride")
    level_override.set(qn("w:ilvl"), "0")
    start_override = OxmlElement("w:startOverride")
    start_override.set(qn("w:val"), "1")
    level_override.append(start_override)
    num.append(level_override)
    numbering.append(num)
    return num_id


def add_table(
    doc: Document,
    headers: tuple[str, ...],
    rows: tuple[tuple[str, ...], ...],
    widths: list[int],
    *,
    dark_header: bool = False,
    font_size: float = 9.2,
    keep_rows: bool = True,
    keep_table_together: bool = False,
) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    fill = ACCENT if dark_header else ACCENT_LIGHT
    for cell, label in zip(table.rows[0].cells, headers):
        cell.text = label
        set_cell_shading(cell, fill)
        for run in cell.paragraphs[0].runs:
            color = RGBColor.from_string(WHITE) if dark_header else TEXT
            set_run(run, size=font_size, bold=True, color=color)
    repeat_header(table.rows[0])
    for row_values in rows:
        cells = table.add_row().cells
        for index, (cell, value) in enumerate(zip(cells, row_values)):
            cell.text = value
            for run in cell.paragraphs[0].runs:
                set_run(run, size=font_size, bold=index == 0)
    set_table_geometry(table, widths)
    if keep_rows:
        for row in table.rows:
            row._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))
    if keep_table_together:
        for row in table.rows[:-1]:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    paragraph.paragraph_format.keep_with_next = True


def add_title_page(doc: Document) -> None:
    add_text(doc, "销售客户管理与跟进系统需求文档", size=22, bold=True, after=7)
    add_text(doc, "基于现有 CRM 系统雏形和数据库字段整理", size=12, color=MUTED, after=22)
    add_table(doc, ("文档信息", "内容"), (
        ("文档用途", "说明客户录入、资料维护、跟进提醒、合作信息和基础统计需求"),
        ("适用对象", "销售团队负责人、销售主管、财务人员、项目负责人和开发测试人员"),
        ("整理依据", "现有系统页面、Prisma 数据模型、已实现接口和业务模块"),
        ("整理日期", "2026年8月20日"),
        ("文档版本", "V1.1"),
    ), [2100, 7260])
    add_heading(doc, "文档说明", 1)
    add_text(doc, "这份文档根据现有系统功能和客户反馈整理，重点说明已合作客户录入、客户资料维护、日常跟进、下次联系提醒和基础统计。不采用需求确认表形式，也不把系统扩展成复杂的销售预测或 ERP 平台。")
    add_heading(doc, "目录", 1)
    add_numbered(doc, (
        "项目背景、建设目标和适用范围",
        "使用角色、权限原则和客户跟进流程",
        "六个客户管理模块的功能需求和字段说明",
        "业务规则、状态流转和数据关系",
        "基础统计、非功能要求和验收标准",
        "本期不包含内容及现有系统字段附录",
    ))


def add_overview(doc: Document) -> None:
    add_page_break(doc)
    add_heading(doc, "1. 项目概述", 1)
    add_heading(doc, "1.1 项目背景", 2)
    add_text(doc, "现有系统已经具备用户权限、客户主档、负责人、跟进记录、下次联系提醒、任务、文件、合同备案、订单和收款等模块。客户反馈表明，实际使用重点是把已合作客户录入系统，并持续记录客户跟进情况。")
    add_text(doc, "因此本期以客户主档和跟进记录为主线：销售录入客户资料，维护合作状态，记录每次联系内容和结果，安排下一次联系；主管查看团队客户和长期未跟进情况。订单、合同和收款继续作为客户的关联资料保留。")
    add_heading(doc, "1.2 建设目标", 2)
    add_bullets(doc, GOALS)
    add_heading(doc, "1.3 本期范围", 2)
    add_text(doc, "本期覆盖用户权限、客户录入、客户资料、合作信息、销售跟进、下次联系提醒、任务协同、合同文件、订单回款查看和基础统计。电销名单、销售线索和公海池可以沿用现有功能，但不是本期客户使用的重点。")
    add_heading(doc, "1.4 使用对象", 2)
    add_table(doc, ("角色", "主要工作"), ROLES, [2500, 6860], keep_rows=True)


def add_flow_and_rules(doc: Document) -> None:
    add_heading(doc, "2. 客户管理流程与基本规则", 1)
    add_heading(doc, "2.1 日常使用流程", 2)
    add_numbered(doc, (
        "录入客户：直接新增已合作客户或需要继续维护的客户，填写联系人、电话和负责人。",
        "补充资料：维护公司、地址、行业、来源、标签、合作状态和合作备注。",
        "记录跟进：每次电话、微信、邮件、拜访或会议后填写联系内容和客户反馈。",
        "安排下次联系：填写下次联系时间和计划，形成今日、即将到期和逾期提醒。",
        "维护合作情况：记录合同起止时间、合同金额、回访频率和下次回访时间。",
        "处理内部事项：使用现有通用任务功能安排团队事项，销售主管查看团队客户和跟进情况。",
        "查看关联资料：查看客户关联的合同备案、订单和回款。",
        "查询和统计：按负责人、状态、来源和最近跟进时间查询客户。",
    ))
    add_heading(doc, "2.2 基本业务规则", 2)
    add_table(doc, ("规则", "说明"), BUSINESS_RULES, [2100, 7260])
    add_heading(doc, "2.3 数据查看原则", 2)
    add_bullets(doc, (
        "销售人员默认查看本人负责的客户、跟进记录和任务。",
        "销售主管查看本人及下属人员的客户、跟进、任务、日报和基础统计。",
        "财务人员查看订单、收款、发票、合同金额和必要的客户基础信息。",
        "系统管理员负责账号、角色、权限和配置，不默认查看全部客户沟通正文。",
        "客户列表、详情和合同文件访问使用现有数据权限。",
    ))
    add_heading(doc, "2.4 字段来源说明", 2)
    add_table(doc, ("标记", "含义"), (
        ("现有字段", "当前 Prisma 数据模型中已经定义，可直接保存。"),
        ("计算展示", "不单独保存，根据现有日期、状态或关联记录计算。"),
        ("建议补充", "当前模型尚未定义，需客户确认后另行开发；本版字段表不列入此类内容。"),
    ), [2100, 7260])


def add_module(doc: Document, module: Module, number: int) -> None:
    add_heading(doc, f"{number}. {module.name}", 1)
    add_text(doc, module.purpose)
    add_text(doc, f"主要使用人员：{module.users}", bold=True, color=MUTED)
    add_heading(doc, f"{number}.1 功能需求", 2)
    requirement_rows = tuple(
        (req.code, req.title, req.description, req.rule, req.priority)
        for req in module.requirements
    )
    add_table(
        doc,
        ("编号", "功能", "需求说明", "业务规则", "优先级"),
        requirement_rows,
        [1150, 1650, 2920, 2740, 900],
        dark_header=True,
        font_size=8.6,
        keep_table_together=True,
    )
    add_heading(doc, f"{number}.2 主要字段", 2)
    field_rows = tuple((row.field, row.meaning, row.required, row.source) for row in module.fields)
    add_table(
        doc,
        ("字段", "用途", "填写要求", "来源"),
        field_rows,
        [2800, 3460, 1700, 1400],
        font_size=8.8,
        keep_table_together=True,
    )
    add_heading(doc, f"{number}.3 状态或分类", 2)
    add_text(doc, module.statuses, bold=True)


def add_status_and_quality(doc: Document, number: int) -> None:
    add_heading(doc, f"{number}. 状态、数据与质量要求", 1)
    add_heading(doc, f"{number}.1 状态流转", 2)
    add_table(doc, ("业务对象", "状态流转"), STATUS_RULES, [2200, 7160])
    add_heading(doc, f"{number}.2 主要数据关系", 2)
    add_bullets(doc, (
        "客户可以直接录入，也可以从现有电销名单或销售线索转入，转入后保留来源和原始记录。",
        "一条客户主档关联一名销售负责人，可关联一名运营负责人，并拥有多条跟进记录、订单和合同备案。",
        "现有任务为通用内部任务，当前 Prisma 模型未建立任务与客户的正式外键关系。",
        "一张订单关联一个客户，可以拥有多条回款记录。",
        "一份合同备案关联一个客户，可以形成多个历史版本，但同一时间只有一个最新版本。",
        "用户、角色和权限共同决定模块访问及数据查看范围。",
    ))
    add_heading(doc, f"{number}.3 非功能要求", 2)
    add_table(doc, ("类别", "要求"), NON_FUNCTIONAL, [2200, 7160])


def add_acceptance(doc: Document, number: int) -> None:
    add_heading(doc, f"{number}. 验收要求", 1)
    add_text(doc, "验收以实际业务操作为主，不只检查页面是否存在。测试数据需要覆盖普通人员、主管、财务人员和管理员，并验证不同角色看到的数据范围。")
    add_heading(doc, f"{number}.1 核心验收场景", 2)
    add_table(doc, ("编号", "场景", "通过标准"), ACCEPTANCE_SCENARIOS, [1100, 2100, 6160], dark_header=True)
    add_heading(doc, f"{number}.2 验收资料", 2)
    add_bullets(doc, (
        "可运行的系统版本和数据库初始化说明。",
        "管理员、销售主管、销售人员、运营人员和财务人员测试账号。",
        "已合作客户、普通客户、跟进、提醒、通用任务、合同、订单和回款测试数据。",
        "本需求文档中所有“必须”和“重要”需求的测试记录。",
        "已知限制、暂未实现内容和后续版本计划。",
    ))
    add_heading(doc, f"{number}.3 本期不包含", 2)
    add_bullets(doc, OUT_OF_SCOPE)


def add_appendix(doc: Document, number: int) -> None:
    add_heading(doc, f"{number}. 附录：现有系统字段对应", 1)
    add_text(doc, "以下字段来自当前系统数据库模型，用于开发时核对。销售页面应使用统一业务名称，并保留现有数据关系和权限约束。", color=MUTED)
    add_table(doc, ("现有数据模型", "主要字段"), FIELD_APPENDIX, [2700, 6660], font_size=8.8)


def build() -> None:
    doc = Document()
    configure_document(
        doc,
        header_text="销售客户管理与跟进系统需求文档",
        footer_text="基于现有系统雏形整理 | V1.1",
    )
    add_title_page(doc)
    add_overview(doc)
    add_flow_and_rules(doc)
    for index, module in enumerate(MODULES, start=3):
        if module.code in {"M02", "M04", "M05"}:
            add_page_break(doc)
        add_module(doc, module, index)
    next_number = 3 + len(MODULES)
    add_status_and_quality(doc, next_number)
    add_acceptance(doc, next_number + 1)
    add_appendix(doc, next_number + 2)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    logging.info("Generated mediation requirements document: %s", OUTPUT)


if __name__ == "__main__":
    setup_logging()
    build()
