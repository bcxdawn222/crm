from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class DatabaseTarget:
    host: str
    port: int
    username: str
    password: str
    database: str


def parse_database_url(value: str) -> DatabaseTarget:
    parsed = urlsplit(value.strip().strip('"').strip("'"))
    database = parsed.path.lstrip("/")
    if parsed.scheme not in {"mysql", "mariadb"} or not parsed.hostname or not database:
        raise ValueError("数据库连接不是有效的 MySQL/MariaDB 地址")
    return DatabaseTarget(
        host=parsed.hostname,
        port=parsed.port or 3306,
        username=unquote(parsed.username or ""),
        password=unquote(parsed.password or ""),
        database=database,
    )


def run_mysql(target: DatabaseTarget, sql: str, *, include_database: bool = True) -> str:
    executable = shutil.which("mariadb") or shutil.which("mysql")
    if executable is None:
        raise RuntimeError("未找到 mariadb 或 mysql 客户端")

    command = [
        executable,
        "--batch",
        "--skip-column-names",
        "--protocol=tcp",
        "-h",
        target.host,
        "-P",
        str(target.port),
        "-u",
        target.username,
    ]
    if include_database:
        command.append(target.database)
    command.extend(("-e", sql))

    environment = os.environ.copy()
    environment["MYSQL_PWD"] = target.password
    result = subprocess.run(
        command,
        cwd=ROOT,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"MySQL 命令失败，退出码 {result.returncode}")
    return result.stdout.strip()
