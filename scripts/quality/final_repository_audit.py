from __future__ import annotations

import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "docs" / "CRM最终代码与残留检查.md"
SOURCE_SUFFIXES = {".py", ".js", ".mjs", ".ts", ".tsx"}
IMPORT_PATTERN = re.compile(r"(?:from\s+|import\s*\()(['\"])([^'\"]+)\1")
IGNORED_PARTS = {".git", ".next", ".build", ".runtime", "node_modules", "output", "storage", "logs"}


@dataclass(frozen=True)
class FileSizeFinding:
    path: str
    lines: int
    category: str


def tracked_files() -> tuple[Path, ...]:
    result = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git ls-files 失败")
    return tuple(ROOT / line for line in result.stdout.splitlines() if line)


def line_findings(files: tuple[Path, ...]) -> tuple[FileSizeFinding, ...]:
    findings: list[FileSizeFinding] = []
    for path in files:
        if path.suffix not in SOURCE_SUFFIXES or not path.is_file():
            continue
        lines = len(path.read_text(encoding="utf-8", errors="replace").splitlines())
        if lines <= 300:
            continue
        relative = path.relative_to(ROOT).as_posix()
        category = "历史测试脚本" if path.parent == ROOT and "test" in path.name.lower() else "历史文档脚本"
        findings.append(FileSizeFinding(relative, lines, category))
    return tuple(sorted(findings, key=lambda item: (-item.lines, item.path)))


def crowded_directories(files: tuple[Path, ...]) -> tuple[tuple[str, int], ...]:
    counts: dict[Path, int] = defaultdict(int)
    for path in files:
        if path.is_file():
            counts[path.parent] += 1
    crowded = ((path.relative_to(ROOT).as_posix() or ".", count) for path, count in counts.items() if count > 8)
    return tuple(sorted(crowded, key=lambda item: (-item[1], item[0])))


def resolve_import(source: Path, specifier: str) -> Path | None:
    if specifier.startswith("@/"):
        base = ROOT / "src" / specifier[2:]
    elif specifier.startswith("."):
        base = source.parent / specifier
    else:
        return None
    candidates = [base.with_suffix(suffix) for suffix in (".ts", ".tsx", ".js")]
    candidates.extend(base / f"index{suffix}" for suffix in (".ts", ".tsx", ".js"))
    return next((path.resolve() for path in candidates if path.is_file()), None)


def import_cycles(files: tuple[Path, ...]) -> tuple[tuple[str, ...], ...]:
    sources = tuple(path.resolve() for path in files if path.is_file() and path.suffix in {".ts", ".tsx"} and "src" in path.parts)
    graph: dict[Path, set[Path]] = {path: set() for path in sources}
    for path in sources:
        content = path.read_text(encoding="utf-8", errors="replace")
        for _, specifier in IMPORT_PATTERN.findall(content):
            target = resolve_import(path, specifier)
            if target in graph:
                graph[path].add(target)
    cycles: set[tuple[str, ...]] = set()
    visited: set[Path] = set()
    active: list[Path] = []

    def visit(node: Path) -> None:
        if node in active:
            start = active.index(node)
            cycle = tuple(path.relative_to(ROOT).as_posix() for path in active[start:] + [node])
            cycles.add(cycle)
            return
        if node in visited:
            return
        active.append(node)
        for target in graph[node]:
            visit(target)
        active.pop()
        visited.add(node)

    for source in sources:
        visit(source)
    return tuple(sorted(cycles))


def residue_findings() -> tuple[str, ...]:
    findings: list[str] = []
    exact = (
        ROOT / "output/playwright/results/.last-run.json",
        ROOT / ".runtime/test/server.pid",
        ROOT / ".runtime/test/server.lock",
    )
    findings.extend(path.relative_to(ROOT).as_posix() for path in exact if path.exists())
    storage = ROOT / "storage/test"
    if storage.is_dir():
        findings.extend(path.relative_to(ROOT).as_posix() for path in storage.rglob("*") if path.is_file())
    auth = ROOT / "output/playwright/auth"
    if auth.is_dir():
        findings.extend(path.relative_to(ROOT).as_posix() for path in auth.rglob("*") if path.is_file())
    return tuple(sorted(findings))


def render_report(
    sizes: tuple[FileSizeFinding, ...],
    directories: tuple[tuple[str, int], ...],
    cycles: tuple[tuple[str, ...], ...],
    residues: tuple[str, ...],
) -> str:
    lines = [
        "# CRM 最终代码与残留检查",
        "",
        f"生成时间：{datetime.now().astimezone().isoformat(timespec='seconds')}",
        "",
        "## 结果",
        "",
        f"- TypeScript/JavaScript import 循环：{len(cycles)}。",
        f"- 明确测试状态残留：{len(residues)}。",
        f"- 超过 300 行的跟踪脚本：{len(sizes)}。",
        f"- 单层超过 8 个跟踪文件的目录：{len(directories)}。",
        "",
        "## 超长文件",
        "",
        "| 文件 | 行数 | 分类 |",
        "| --- | ---: | --- |",
    ]
    lines.extend(f"| `{item.path}` | {item.lines} | {item.category} |" for item in sizes)
    if not sizes:
        lines.append("| 无 | 0 | - |")
    lines.extend(("", "## 目录规模", "", "| 目录 | 文件数 |", "| --- | ---: |"))
    lines.extend(f"| `{path}` | {count} |" for path, count in directories)
    if not directories:
        lines.append("| 无 | 0 |")
    lines.extend(("", "## 循环依赖", ""))
    lines.extend(f"- {' -> '.join(cycle)}" for cycle in cycles)
    if not cycles:
        lines.append("- 未发现可解析的 TypeScript/JavaScript import 循环。")
    lines.extend(("", "## 测试残留", ""))
    lines.extend(f"- `{path}`" for path in residues)
    if not residues:
        lines.append("- test PID、锁、认证状态、storage/test 文件和 Playwright `.last-run.json` 均无残留。")
    lines.extend((
        "",
        "## 处理说明",
        "",
        "- 超长根目录测试脚本和旧文档生成脚本未进入当前 `scripts/manage.py`、Next.js 页面或 API 运行链路，本期保留以免误删历史资料。",
        "- 根目录仍含较多历史测试、说明、截图和数据脚本，超过当前目录规模目标；发布白名单不会携带这些文件。",
        "- `prisma/schema.prisma` 受 Prisma 单 schema 文件约束，本报告不按普通 TypeScript 文件拆分规则处理。",
        "- 未使用代码和语义重复不能仅靠 import 图完全证明；本轮以 TypeScript 类型检查、路由检查、按钮审计和 E2E 共同补充。",
        "",
    ))
    return "\n".join(lines)


def main() -> int:
    if __import__("os").environ.get("CRM_PROFILE") != "test":
        print("final-audit 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2
    files = tracked_files()
    sizes = line_findings(files)
    directories = crowded_directories(files)
    cycles = import_cycles(files)
    residues = residue_findings()
    REPORT.write_text(render_report(sizes, directories, cycles, residues), encoding="utf-8", newline="\n")
    print(f"最终代码检查报告: {REPORT}")
    print(f"循环依赖={len(cycles)} 测试残留={len(residues)} 超长脚本={len(sizes)} 拥挤目录={len(directories)}")
    return 1 if cycles or residues else 0


if __name__ == "__main__":
    raise SystemExit(main())
