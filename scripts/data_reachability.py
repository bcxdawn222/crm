from __future__ import annotations

import os
import socket
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]


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


def main() -> int:
    host, port = _database_target()
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"数据库网络可达: {host}:{port}")
    except OSError as error:
        print(f"数据库不可达: {host}:{port}，{error}")
        return 1
    print("数据可达性深度检查尚未连接 Prisma；当前仅完成数据库网络层检查")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
