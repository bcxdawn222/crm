from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
API_ROOT = ROOT / "src" / "app" / "api"
DIRECT_500 = re.compile(r"status\s*:\s*500")
ERROR_MESSAGE = re.compile(r"\berror\.message\b")
SENSITIVE_RESPONSE = re.compile(
    r"(?:DATABASE_URL|mysql://|postgres(?:ql)?://|file:///|\\\\Users\\|[A-Za-z]:\\\\Users\\|error\.stack)"
)


@dataclass(frozen=True)
class Finding:
    path: Path
    line: int
    message: str


def line_number(source: str, offset: int) -> int:
    return source.count("\n", 0, offset) + 1


def audit_error_messages(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    lines = source.splitlines()
    for index, line in enumerate(lines):
        if not ERROR_MESSAGE.search(line):
            continue
        guard = "\n".join(lines[max(0, index - 12):index + 1])
        if "instanceof" not in guard:
            findings.append(
                Finding(path, index + 1, "error.message 未受明确业务异常类型保护")
            )
    return findings


def audit() -> list[Finding]:
    findings: list[Finding] = []
    for path in sorted(API_ROOT.rglob("route.ts")):
        source = path.read_text(encoding="utf-8")
        if "console.error" in source:
            findings.append(
                Finding(path, line_number(source, source.index("console.error")), "禁止直接 console.error")
            )
        for match in DIRECT_500.finditer(source):
            findings.append(
                Finding(path, line_number(source, match.start()), "500 响应必须使用 serverErrorResponse")
            )
        if "catch (error)" in source and "serverErrorResponse" not in source:
            findings.append(
                Finding(path, line_number(source, source.index("catch (error)")), "未知异常未进入 serverErrorResponse")
            )
        for match in SENSITIVE_RESPONSE.finditer(source):
            findings.append(
                Finding(path, line_number(source, match.start()), "响应代码包含敏感连接、路径或堆栈信息")
            )
        findings.extend(audit_error_messages(path, source))
    return findings


def main() -> int:
    findings = audit()
    if not findings:
        print("服务端治理静态检查通过")
        return 0
    for finding in findings:
        print(f"{finding.path.relative_to(ROOT)}:{finding.line}: {finding.message}")
    print(f"服务端治理静态检查发现 {len(findings)} 项")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
