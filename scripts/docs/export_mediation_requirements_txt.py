from __future__ import annotations

from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[2]
DOCX = ROOT / "docs" / "调解业务管理系统需求确认书（基于现有系统雏形）.docx"
TXT = ROOT / "docs" / "调解业务管理系统需求确认书（基于现有系统雏形）.txt"


def export() -> None:
    doc = Document(DOCX)
    lines: list[str] = []
    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        if text:
            lines.append(text)
    for table in doc.tables:
        lines.append("")
        for row in table.rows:
            lines.append(" | ".join(cell.text.replace("\n", " ").strip() for cell in row.cells))
        lines.append("")
    TXT.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8-sig", newline="")
    print(TXT)


if __name__ == "__main__":
    export()
