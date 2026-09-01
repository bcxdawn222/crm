from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
PAGE_ROOT = ROOT / "src" / "app" / "(dashboard)"
AUTH_ROOT = ROOT / "src" / "app" / "(auth)"
COMPONENT_ROOT = ROOT / "src" / "components"
WRITE_METHOD = re.compile(r"method\s*:\s*['\"](?:POST|PUT|PATCH|DELETE)['\"]")
SUBMIT_BUTTON = re.compile(r"<Button\b(?:(?!</Button>).)*htmlType\s*=\s*['\"]submit['\"](?:(?!</Button>).)*</Button>", re.DOTALL)
FORM_MODAL = re.compile(r"<Modal\b(?:(?!>).)*onOk\s*=\s*\{\(\)\s*=>\s*form\.submit\(\)\}(?:(?!>).)*>", re.DOTALL)
REQUIRED_RULE = re.compile(r"\brequired\s*:\s*(?!false\b)|^\s*required\s*$", re.MULTILINE)


@dataclass(frozen=True)
class Finding:
    path: Path
    line: int
    message: str


def audit() -> list[Finding]:
    findings: list[Finding] = []
    source_paths = sorted((*PAGE_ROOT.rglob("*.tsx"), *AUTH_ROOT.rglob("*.tsx"), *COMPONENT_ROOT.rglob("*.tsx")))
    for path in source_paths:
        source = path.read_text(encoding="utf-8")
        lines = source.splitlines()
        for index, line in enumerate(lines, start=1):
            if "mock" in line.lower():
                findings.append(Finding(path, index, "页面仍包含 mock 数据或 mock 标识"))
            if "message.info(`正在跟进客户" in line:
                findings.append(Finding(path, index, "跟进客户动作仅显示提示，未进入真实业务流程"))
            if "fetch(" in line and "apiRequest" not in line:
                findings.append(Finding(path, index, "业务页面仍直接使用 fetch，未进入统一请求层"))
        for match in WRITE_METHOD.finditer(source):
            line = source.count("\n", 0, match.start()) + 1
            nearby = source[match.start():match.start() + 700]
            if "requestKey:" not in nearby:
                findings.append(Finding(path, line, "写请求缺少 requestKey 重复动作保护"))
        for match in SUBMIT_BUTTON.finditer(source):
            if "loading=" not in match.group(0):
                line = source.count("\n", 0, match.start()) + 1
                findings.append(Finding(path, line, "提交按钮缺少 loading 状态"))
        for match in FORM_MODAL.finditer(source):
            if "confirmLoading=" not in match.group(0):
                line = source.count("\n", 0, match.start()) + 1
                findings.append(Finding(path, line, "表单弹窗缺少 confirmLoading 状态"))
        for match in REQUIRED_RULE.finditer(source):
            line = source.count("\n", 0, match.start()) + 1
            findings.append(Finding(path, line, "表单仍包含必填规则或必填标记"))
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
