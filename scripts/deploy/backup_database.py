from __future__ import annotations

import gzip
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(os.environ.get("CRM_APP_ROOT", "/www/wwwroot/crm-system"))
ENV_PATH = Path(os.environ.get("CRM_ENV_PATH", str(ROOT / ".env")))
BACKUP_DIR = Path(os.environ.get("CRM_BACKUP_DIR", "/root/crm-backups"))
LOG_PATH = Path(
    os.environ.get("CRM_BACKUP_LOG", str(ROOT / "logs" / "database-backup.log"))
)
RETENTION_DAYS = int(os.environ.get("CRM_BACKUP_RETENTION_DAYS", "14"))


@dataclass(frozen=True)
class DatabaseTarget:
    host: str
    port: int
    username: str
    password: str
    database: str


def configure_logger() -> logging.Logger:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("crm-database-backup")
    logger.handlers.clear()
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

    file_handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
    file_handler.setFormatter(formatter)
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)
    return logger


def read_database_target() -> DatabaseTarget:
    for raw_line in ENV_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        if not raw_line.startswith("DATABASE_URL="):
            continue
        value = raw_line.split("=", 1)[1].strip().strip('"').strip("'")
        parsed = urlsplit(value)
        database = parsed.path.lstrip("/")
        if parsed.scheme not in {"mysql", "mariadb"} or not database:
            raise RuntimeError("DATABASE_URL 不是有效的 MariaDB/MySQL 地址")
        return DatabaseTarget(
            host=parsed.hostname or "127.0.0.1",
            port=parsed.port or 3306,
            username=unquote(parsed.username or ""),
            password=unquote(parsed.password or ""),
            database=database,
        )
    raise RuntimeError(f"未在 {ENV_PATH} 中找到 DATABASE_URL")


def create_backup(target: DatabaseTarget, logger: logging.Logger) -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.chmod(0o700)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = BACKUP_DIR / f"{target.database}-{timestamp}.sql.gz"
    temporary_path = backup_path.with_suffix(".sql.gz.tmp")
    environment = os.environ.copy()
    environment["MYSQL_PWD"] = target.password
    command = [
        "mariadb-dump",
        "--protocol=tcp",
        "-h",
        target.host,
        "-P",
        str(target.port),
        "-u",
        target.username,
        "--single-transaction",
        "--quick",
        "--routines",
        "--events",
        "--triggers",
        "--hex-blob",
        "--no-tablespaces",
        target.database,
    ]

    try:
        with temporary_path.open("wb") as raw_output:
            with gzip.GzipFile(fileobj=raw_output, mode="wb", compresslevel=9) as compressed:
                with tempfile.TemporaryFile() as error_output:
                    process = subprocess.Popen(
                        command,
                        env=environment,
                        stdout=subprocess.PIPE,
                        stderr=error_output,
                    )
                    assert process.stdout is not None
                    shutil.copyfileobj(process.stdout, compressed, length=1024 * 1024)
                    process.stdout.close()
                    return_code = process.wait()
                    error_output.seek(0)
                    error = error_output.read().decode("utf-8", errors="replace").strip()
        if return_code != 0:
            raise RuntimeError(f"mariadb-dump 失败，退出码 {return_code}: {error}")
        with gzip.open(temporary_path, "rb") as archive:
            while archive.read(1024 * 1024):
                pass
        temporary_path.replace(backup_path)
        backup_path.chmod(0o600)
    finally:
        temporary_path.unlink(missing_ok=True)
    logger.info("数据库备份完成: %s，大小=%s", backup_path, backup_path.stat().st_size)
    return backup_path


def remove_expired_backups(logger: logging.Logger) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    removed = 0
    for backup_path in BACKUP_DIR.glob("*.sql.gz"):
        modified = datetime.fromtimestamp(backup_path.stat().st_mtime, timezone.utc)
        if modified >= cutoff:
            continue
        backup_path.unlink()
        removed += 1
    logger.info("过期备份清理完成: 保留天数=%s，删除数量=%s", RETENTION_DAYS, removed)


def ensure_capacity() -> None:
    usage = shutil.disk_usage(BACKUP_DIR.parent if BACKUP_DIR.parent.exists() else Path("/"))
    if usage.free < 512 * 1024 * 1024:
        raise RuntimeError("可用磁盘空间少于 512 MB，停止备份")


def main() -> int:
    logger = configure_logger()
    try:
        ensure_capacity()
        target = read_database_target()
        create_backup(target, logger)
        remove_expired_backups(logger)
        return 0
    except Exception as error:
        logger.exception("数据库备份失败: %s", error)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
