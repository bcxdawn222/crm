from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PAGE_ROOT = ROOT / "src" / "app" / "(dashboard)"


@dataclass(frozen=True)
class Finding:
    path: Path
    line: int
    message: str


def audit() -> list[Finding]:
    findings: list[Finding] = []
    for path in sorted(PAGE_ROOT.rglob("*.tsx")):
        lines = path.read_text(encoding="utf-8").splitlines()
        for index, line in enumerate(lines, start=1):
            if "mock" in line.lower():
                findings.append(Finding(path, index, "页面仍包含 mock 数据或 mock 标识"))
            if "message.info(`正在跟进客户" in line:
                findings.append(Finding(path, index, "跟进客户动作仅显示提示，未进入真实业务流程"))
    return findings


def main() -> int:
    findings = audit()
    if not findings:
        print("按钮静态审计通过")
        return 0
    for finding in findings:
        print(f"{finding.path.relative_to(ROOT)}:{finding.line}: {finding.message}")
    print(f"按钮静态审计发现 {len(findings)} 项，需要逐项登记或修复")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
