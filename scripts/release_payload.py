from __future__ import annotations

from pathlib import Path


CUSTOMER_GUIDE_NAME = "CRM系统客户运行说明.txt"
MAINTENANCE_DOCS = (
    "docs/CRM按钮契约清单.md",
    "docs/CRM页面与交互验收清单.md",
    "docs/CRM系统维护与发布回滚手册.md",
    "docs/CRM稳定版发布清单.md",
)


def required_paths(root: Path) -> tuple[Path, ...]:
    return (
        root / ".next",
        root / ".env.example",
        root / "next-env.d.ts",
        root / "next.config.mjs",
        root / "package.json",
        root / "package-lock.json",
        root / "public",
        root / "src",
        root / "tsconfig.json",
        root / "prisma" / "schema.prisma",
        root / "prisma" / "migrations",
        root / "scripts" / "manage.py",
        root / "scripts" / "manage.sh",
        root / "scripts" / "release.py",
        root / "scripts" / "release_state.py",
        root / "scripts" / "release_payload.py",
        root / "scripts" / "cli",
        root / "scripts" / "runtime",
        root / "scripts" / "deploy",
        root / CUSTOMER_GUIDE_NAME,
        *(root / path for path in MAINTENANCE_DOCS),
    )


def is_release_file(path: Path, root: Path) -> bool:
    relative = path.relative_to(root)
    relative_path = relative.as_posix()
    if ".next/cache" in relative_path or relative_path.startswith("public/uploads/"):
        return False
    return "__pycache__" not in relative.parts and path.suffix not in {".pyc", ".pyo"}


def included_files(root: Path) -> tuple[Path, ...]:
    files: list[Path] = []
    for entry in required_paths(root):
        if not entry.exists():
            raise RuntimeError(f"发布所需路径不存在: {entry}")
        if entry.is_file():
            files.append(entry)
        else:
            files.extend(item for item in entry.rglob("*") if item.is_file() and is_release_file(item, root))
    unique = {path.resolve(): path for path in files}
    return tuple(sorted(unique.values()))
