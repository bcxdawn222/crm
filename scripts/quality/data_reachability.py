from __future__ import annotations

import os
import socket
import subprocess
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[2]


def _database_target() -> tuple[str, int]:
    value = os.environ.get("DATABASE_URL", "")
    for env_path in (ROOT / ".env.local", ROOT / ".env"):
        if value or not env_path.is_file():
            continue
        for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
            line = raw_line.strip()
            if line.startswith("DATABASE_URL="):
                value = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
    parsed = urlsplit(value)
    if parsed.scheme not in {"mysql", "mariadb"} or not parsed.hostname:
        raise ValueError("未找到有效的 DATABASE_URL，无法执行数据可达性检查")
    return parsed.hostname, parsed.port or 3306


def _run_prisma_probe() -> int:
    executable = "npx.cmd" if os.name == "nt" else "npx"
    result = subprocess.run(
        [executable, "prisma", "db", "execute", "--stdin", "--schema", str(ROOT / "prisma" / "schema.prisma")],
        cwd=ROOT,
        env=os.environ.copy(),
        input="SELECT 1;\n",
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode == 0:
        print("Prisma 数据库探针通过: SELECT 1")
        return 0
    details = (result.stderr or result.stdout).strip().splitlines()
    safe_details = " | ".join(details[-4:]) if details else "未返回错误详情"
    print(f"Prisma 数据库探针失败，退出码={result.returncode}: {safe_details}")
    return 1


def main() -> int:
    host, port = _database_target()
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"数据库网络可达: {host}:{port}")
    except OSError as error:
        print(f"数据库不可达: {host}:{port}，{error}")
        return 1
    return _run_prisma_probe()


if __name__ == "__main__":
    raise SystemExit(main())
