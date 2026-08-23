from __future__ import annotations

from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[2]
DOCX = ROOT / "docs" / "销售客户管理与跟进系统需求文档（基于现有系统雏形）.docx"
TXT = ROOT / "docs" / "销售客户管理与跟进系统需求文档（基于现有系统雏形）.txt"


def export() -> None:
    doc = Document(DOCX)
    lines: list[str] = []
    for block in doc.element.body.iterchildren():
        if block.tag.endswith("}p"):
            text = "".join(node.text or "" for node in block.iter() if node.tag.endswith("}t")).strip()
            if text:
                lines.append(text)
        elif block.tag.endswith("}tbl"):
            lines.append("")
            for row in block.iterchildren():
                if not row.tag.endswith("}tr"):
                    continue
                cells: list[str] = []
                for cell in row.iterchildren():
                    if cell.tag.endswith("}tc"):
                        value = "".join(node.text or "" for node in cell.iter() if node.tag.endswith("}t"))
                        cells.append(value.strip())
                lines.append(" | ".join(cells))
            lines.append("")
    TXT.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8-sig", newline="")
    print(TXT)


if __name__ == "__main__":
    export()
