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
from mediation_requirements_data import (
    ACCEPTANCE_SCENARIOS,
    FIELD_APPENDIX,
    PENDING_ITEMS,
    ROLE_CONFIRMATIONS,
    WORKFLOW_STAGES,
    ConfirmItem,
    WorkflowStage,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs" / "调解业务管理系统需求确认书（基于现有系统雏形）.docx"
LOG_FILE = ROOT / "logs" / "mediation_requirements_document.log"

ACCENT = "3F665F"
ACCENT_LIGHT = "E8EFED"
GRAY = "F4F4F2"
PENDING = "FFF4D6"
WHITE = "FFFFFF"
TEXT = RGBColor(38, 38, 38)
MUTED = RGBColor(98, 98, 98)


def setup_logging() -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"), logging.StreamHandler()],
    )


def set_repeat_table_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    table_header = OxmlElement("w:tblHeader")
    table_header.set(qn("w:val"), "true")
    tr_pr.append(table_header)


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
    paragraph.paragraph_format.line_spacing = 1.28
    if align is not None:
        paragraph.alignment = align
    set_run(paragraph.add_run(text), size=size, bold=bold, color=color)
    return paragraph


def add_heading(doc: Document, text: str, level: int = 1) -> None:
    paragraph = doc.add_paragraph(style=f"Heading {level}")
    paragraph.paragraph_format.keep_with_next = True
    paragraph.paragraph_format.space_before = Pt(13 if level == 1 else 9)
    paragraph.paragraph_format.space_after = Pt(6)
    color = RGBColor.from_string(ACCENT) if level == 1 else TEXT
    size = 15 if level == 1 else 11.5
    set_run(paragraph.add_run(text), size=size, bold=True, color=color)


def add_bullet_list(doc: Document, items: tuple[str, ...]) -> None:
    for item in items:
        paragraph = doc.add_paragraph(style="List Bullet")
        paragraph.paragraph_format.left_indent = Inches(0.32)
        paragraph.paragraph_format.first_line_indent = Inches(-0.17)
        paragraph.paragraph_format.space_after = Pt(3)
        set_run(paragraph.add_run(item), size=10.2)


def add_basic_info(doc: Document) -> None:
    rows = (
        ("客户单位", "________________________________"),
        ("参会人员", "________________________________"),
        ("会议日期", "_______年_____月_____日"),
        ("本次确认范围", "系统现有字段怎样用于调解业务，以及本期需要增加哪些字段"),
    )
    table = doc.add_table(rows=0, cols=2)
    table.style = "Table Grid"
    for label, value in rows:
        cells = table.add_row().cells
        cells[0].text = label
        cells[1].text = value
        set_cell_shading(cells[0], GRAY)
        for index, cell in enumerate(cells):
            for run in cell.paragraphs[0].runs:
                set_run(run, size=10, bold=index == 0)
    set_table_geometry(table, [1900, 7460])


def add_confirm_table(doc: Document, items: tuple[ConfirmItem, ...]) -> None:
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    headers = ("需要客户确认", "本次选择或修改")
    for cell, label in zip(table.rows[0].cells, headers):
        cell.text = label
        set_cell_shading(cell, ACCENT_LIGHT)
        for run in cell.paragraphs[0].runs:
            set_run(run, size=9.6, bold=True)
    set_repeat_table_header(table.rows[0])
    for item in items:
        cells = table.add_row().cells
        cells[0].text = item.label
        cells[1].text = f"□ {item.options.replace(' / ', '    □ ')}\n补充：________________________________"
        for index, cell in enumerate(cells):
            for run in cell.paragraphs[0].runs:
                set_run(run, size=9.3, bold=index == 0)
    set_table_geometry(table, [3300, 6060])


def add_workflow_stage(doc: Document, stage: WorkflowStage) -> None:
    add_heading(doc, stage.title, 2)
    add_text(doc, stage.current_process, after=4)
    label = doc.add_paragraph()
    label.paragraph_format.space_after = Pt(2)
    set_run(label.add_run("系统中已有："), size=9.5, bold=True, color=MUTED)
    set_run(label.add_run(stage.current_fields), size=9.5, color=MUTED)
    add_confirm_table(doc, stage.confirm_items)


def add_pending_table(doc: Document) -> None:
    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    headers = ("事项", "系统现在的情况", "客户本次决定")
    for cell, label in zip(table.rows[0].cells, headers):
        cell.text = label
        set_cell_shading(cell, ACCENT)
        cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in cell.paragraphs[0].runs:
            set_run(run, size=9.4, bold=True, color=RGBColor.from_string(WHITE))
    set_repeat_table_header(table.rows[0])
    for item in PENDING_ITEMS:
        cells = table.add_row().cells
        decision = item.decision.replace(" / ", "    □ ")
        values = (item.topic, item.current_state, f"□ {decision}\n说明：________________")
        for index, (cell, value) in enumerate(zip(cells, values)):
            cell.text = value
            if index == 2:
                set_cell_shading(cell, PENDING)
            for run in cell.paragraphs[0].runs:
                set_run(run, size=9.1, bold=index == 0)
    set_table_geometry(table, [1900, 3900, 3560])


def add_role_table(doc: Document) -> None:
    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    headers = ("角色名称", "现有权限可覆盖的工作", "客户确认")
    for cell, label in zip(table.rows[0].cells, headers):
        cell.text = label
        set_cell_shading(cell, ACCENT_LIGHT)
        for run in cell.paragraphs[0].runs:
            set_run(run, size=9.5, bold=True)
    for role, scope in ROLE_CONFIRMATIONS:
        cells = table.add_row().cells
        values = (role, scope, "□ 保留  □ 改名  □ 不设置")
        for index, (cell, value) in enumerate(zip(cells, values)):
            cell.text = value
            for run in cell.paragraphs[0].runs:
                set_run(run, size=9.2, bold=index == 0)
    set_table_geometry(table, [2200, 4900, 2260])


def add_open_issues(doc: Document) -> None:
    table = doc.add_table(rows=4, cols=4)
    table.style = "Table Grid"
    headers = ("还需确认的事项", "当前意见", "由谁决定", "确认日期")
    for cell, label in zip(table.rows[0].cells, headers):
        cell.text = label
        set_cell_shading(cell, GRAY)
        for run in cell.paragraphs[0].runs:
            set_run(run, size=9.2, bold=True)
    for row in table.rows[1:]:
        for cell in row.cells:
            cell.text = "\n"
    set_table_geometry(table, [2700, 3060, 1800, 1800])


def add_field_appendix(doc: Document) -> None:
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    for cell, label in zip(table.rows[0].cells, ("现有数据模块", "数据库中已经存在的主要字段")):
        cell.text = label
        set_cell_shading(cell, ACCENT_LIGHT)
        for run in cell.paragraphs[0].runs:
            set_run(run, size=9.4, bold=True)
    set_repeat_table_header(table.rows[0])
    for module, fields in FIELD_APPENDIX:
        cells = table.add_row().cells
        cells[0].text = module
        cells[1].text = fields
        for index, cell in enumerate(cells):
            for run in cell.paragraphs[0].runs:
                set_run(run, size=8.9, bold=index == 0)
    set_table_geometry(table, [2600, 6760])


def build() -> None:
    doc = Document()
    configure_document(
        doc,
        header_text="调解业务管理系统需求确认单",
        footer_text="客户沟通稿 | 根据现有系统字段整理",
    )
    add_text(doc, "调解业务管理系统需求确认单", size=22, bold=True, after=5)
    add_text(doc, "用于开会逐项确认，可直接在 Word 中勾选和修改", size=11, color=MUTED, after=14)
    add_basic_info(doc)
    add_heading(doc, "这次主要确认什么", 1)
    add_bullet_list(doc, (
        "现有 CRM 模块换成调解业务名称后，哪些继续使用。",
        "现有字段分别记录什么，页面上的叫法是否需要调整。",
        "现有系统没有的调解字段，哪些纳入本期，哪些暂缓。",
        "客户意见以本文件中的勾选、补充说明和最后签字为准。",
    ))
    add_heading(doc, "系统现有办理顺序", 1)
    add_text(doc, "登记线索 → 建立主档 → 分派负责人 → 记录联系和调解过程 → 登记协议及费用 → 结案归档", bold=True)
    add_text(doc, "下面按这个顺序确认。文中只写系统目前已有的字段；标为“新增”的事项，在客户确认后再进入开发范围。", color=MUTED)

    add_page_break(doc)
    add_heading(doc, "按办理过程逐项确认", 1)
    for stage in WORKFLOW_STAGES:
        add_workflow_stage(doc, stage)

    add_heading(doc, "现有系统没有独立字段的事项", 1)
    add_text(doc, "这些事项需要客户明确选择。选择“新增”才列入本期开发；选择“复用”时，需要在说明中写明复用哪个现有字段。")
    add_pending_table(doc)
    add_heading(doc, "角色和查看范围", 1)
    add_role_table(doc)

    add_heading(doc, "本期范围和验收方式", 1)
    add_text(doc, "本期范围以本文件中勾选为“保留”或“新增”的内容为准。没有勾选、仍写“待定”、或选择“暂缓/不需要”的事项，不计入本期交付。")
    add_heading(doc, "验收时按以下实际操作检查", 2)
    add_bullet_list(doc, ACCEPTANCE_SCENARIOS)
    add_heading(doc, "还需会后确认的事项", 2)
    add_open_issues(doc)
    add_heading(doc, "双方确认", 1)
    add_text(doc, "客户代表：________________    日期：_______年_____月_____日", after=12)
    add_text(doc, "项目方代表：______________    日期：_______年_____月_____日")

    add_page_break(doc)
    add_heading(doc, "附录：现有系统字段清单", 1)
    add_text(doc, "本清单用于核对系统雏形，不要求客户逐项填写。正文中的业务名称和本期选择优先于本附录。", color=MUTED)
    add_field_appendix(doc)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    logging.info("Generated mediation requirements document: %s", OUTPUT)


if __name__ == "__main__":
    setup_logging()
    build()
