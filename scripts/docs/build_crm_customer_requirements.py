from __future__ import annotations

import logging
from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

from crm_customer_requirements_data import (
    ACCEPTANCE, ATTACHMENTS, BUSINESS_RULES, CONFIRMATION, CUSTOMERS,
    EXTRA_FEATURES, FINANCE, FOLLOW_UP, GUIDANCE, PROJECT_INFO, QUALITY,
    REPORTS, ROLES, SCOPE,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs" / "CRM系统客户需求确认书（可修改版）.docx"
LOG_FILE = ROOT / "logs" / "crm_customer_requirements_document.log"

NAVY = "244A64"
BLUE = "2E74B5"
LIGHT_BLUE = "EAF2F8"
LIGHT_GRAY = "F3F5F7"
YELLOW = "FFF2CC"
WHITE = "FFFFFF"
TEXT = RGBColor(34, 34, 34)
MUTED = RGBColor(92, 101, 110)


def setup_logging() -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"), logging.StreamHandler()],
    )


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_width(cell, width_dxa: int) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(width_dxa))
    tc_w.set(qn("w:type"), "dxa")


def set_table_geometry(table, widths: list[int]) -> None:
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths)))
    tbl_w.set(qn("w:type"), "dxa")
    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), "120")
    tbl_ind.set(qn("w:type"), "dxa")
    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(width))
        grid.append(col)
    for row in table.rows:
        for cell, width in zip(row.cells, widths):
            set_cell_width(cell, width)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tc_mar = cell._tc.get_or_add_tcPr().find(qn("w:tcMar"))
            if tc_mar is None:
                tc_mar = OxmlElement("w:tcMar")
                cell._tc.get_or_add_tcPr().append(tc_mar)
            for side, value in (("top", 55), ("bottom", 55), ("start", 120), ("end", 120)):
                item = OxmlElement(f"w:{side}")
                item.set(qn("w:w"), str(value))
                item.set(qn("w:type"), "dxa")
                tc_mar.append(item)


def set_run(run, size: float = 10.5, bold: bool = False, color: RGBColor = TEXT) -> None:
    run.font.name = "Arial"
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Arial")
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), "Arial")
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    run.font.size = Pt(size)
    run.bold = bold
    run.font.color.rgb = color


def add_text(doc: Document, text: str, *, bold: bool = False, color: RGBColor = TEXT,
             size: float = 10.5, after: float = 6, align=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.25
    if align is not None:
        p.alignment = align
    set_run(p.add_run(text), size=size, bold=bold, color=color)
    return p


def add_heading(doc: Document, text: str, level: int = 1) -> None:
    p = doc.add_paragraph(style=f"Heading {level}")
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_before = Pt(14 if level == 1 else 10)
    p.paragraph_format.space_after = Pt(7 if level == 1 else 5)
    set_run(p.add_run(text), size=16 if level == 1 else 12.5, bold=True,
            color=RGBColor.from_string(BLUE if level == 1 else NAVY))


def add_page_break(doc: Document) -> None:
    doc.add_page_break()


def add_info_table(doc: Document, rows: list[tuple[str, str]]) -> None:
    table = doc.add_table(rows=0, cols=2)
    table.style = "Table Grid"
    for label, value in rows:
        cells = table.add_row().cells
        cells[0].text = label
        cells[1].text = value
        set_cell_shading(cells[0], LIGHT_BLUE)
        set_cell_shading(cells[1], YELLOW)
        for index, cell in enumerate(cells):
            for run in cell.paragraphs[0].runs:
                set_run(run, size=10, bold=index == 0)
    set_table_geometry(table, [2200, 7160])


def add_requirements_table(doc: Document, items: list[tuple[str, str, str]]) -> None:
    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    headers = ["功能与需求说明", "客户选择", "客户修改/备注"]
    for cell, text in zip(table.rows[0].cells, headers):
        cell.text = text
        set_cell_shading(cell, NAVY)
        for run in cell.paragraphs[0].runs:
            set_run(run, size=9.5, bold=True, color=RGBColor(255, 255, 255))
        cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    for name, desc, choice in items:
        cells = table.add_row().cells
        cells[0].text = ""
        first = cells[0].paragraphs[0]
        set_run(first.add_run(f"{name}："), size=9.3, bold=True)
        set_run(first.add_run(desc), size=9.3)
        values = [choice, "请填写"]
        for index, (cell, value) in enumerate(zip(cells[1:], values), start=1):
            cell.text = value
            if index in (1, 2):
                set_cell_shading(cell, YELLOW)
            for run in cell.paragraphs[0].runs:
                set_run(run, size=9.1)
    set_table_geometry(table, [5460, 2300, 1600])


def add_checklist(doc: Document, items: list[str]) -> None:
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.left_indent = Inches(0.38)
        p.paragraph_format.first_line_indent = Inches(-0.19)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.2
        set_run(p.add_run(item), size=10.2)


def configure_document(
    doc: Document,
    header_text: str = "CRM 系统客户需求确认书",
    footer_text: str = "客户确认稿 | 可直接在 Word 中修改",
) -> None:
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.82)
    section.bottom_margin = Inches(0.78)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Arial"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    normal.font.size = Pt(10.5)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25
    for level in (1, 2):
        style = styles[f"Heading {level}"]
        style.font.name = "Arial"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_run(header.add_run(header_text), size=8.5, color=MUTED)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_run(footer.add_run(footer_text), size=8.5, color=MUTED)


def build() -> None:
    doc = Document()
    configure_document(doc)
    add_text(doc, "CRM SYSTEM REQUIREMENTS", size=9.5, bold=True, color=RGBColor.from_string(BLUE), after=4)
    add_text(doc, "CRM 系统客户需求确认书", size=27, bold=True,
             color=RGBColor.from_string(NAVY), after=8)
    add_text(doc, "用于客户确认、修改功能范围与交付要求", size=13, color=MUTED, after=18)
    add_info_table(doc, PROJECT_INFO)
    add_heading(doc, "填写说明", 1)
    add_checklist(doc, GUIDANCE)

    add_page_break(doc)
    add_heading(doc, "1. 项目目标", 1)
    add_text(doc, "建设一套面向销售团队的 CRM 系统，集中管理客户、跟进、合同、订单和回款，帮助销售人员记录工作，帮助管理人员查看进展，帮助财务人员核对回款。")
    add_heading(doc, "2. 本期范围", 1)
    add_info_table(doc, SCOPE)
    add_heading(doc, "3. 用户角色与权限", 1)
    add_requirements_table(doc, ROLES)

    add_page_break(doc)
    add_heading(doc, "4. 客户与销售管理", 1)
    add_requirements_table(doc, CUSTOMERS)
    add_heading(doc, "5. 跟进与任务", 1)
    add_requirements_table(doc, FOLLOW_UP)

    add_page_break(doc)
    add_heading(doc, "6. 合同、订单与回款", 1)
    add_requirements_table(doc, FINANCE)
    add_heading(doc, "需要客户确认的业务规则", 2)
    add_info_table(doc, BUSINESS_RULES)

    add_page_break(doc)
    add_heading(doc, "7. 统计、消息与文件", 1)
    add_requirements_table(doc, REPORTS)
    add_heading(doc, "8. 客户希望增加的功能", 1)
    add_info_table(doc, EXTRA_FEATURES)

    add_page_break(doc)
    add_heading(doc, "9. 基本质量要求", 1)
    add_requirements_table(doc, QUALITY)
    add_heading(doc, "10. 交付与验收", 1)
    add_checklist(doc, ACCEPTANCE)
    add_heading(doc, "11. 本期默认不包含", 1)
    add_text(doc, "除非在本文件中另行确认，本期默认不包含：财务总账、进销存、复杂审批平台、电子签章、呼叫中心、原生手机 App、多租户计费、AI 自动决策和第三方系统深度集成。", color=MUTED)

    add_page_break(doc)
    add_heading(doc, "12. 最终确认", 1)
    add_text(doc, "请在修改完成后确认以下内容。未填写或标记“待确认”的项目，在开发前仍需双方补充确认。")
    add_info_table(doc, CONFIRMATION)
    add_heading(doc, "附件清单", 1)
    add_checklist(doc, ATTACHMENTS)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    logging.info("Generated customer requirements document: %s", OUTPUT)


if __name__ == "__main__":
    setup_logging()
    build()
