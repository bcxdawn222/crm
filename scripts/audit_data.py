from __future__ import annotations

import argparse
import hashlib
import logging
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / "logs"
MIGRATION_PATTERN = re.compile(r"^\d{14}_[A-Za-z0-9_]+$")


@dataclass(frozen=True)
class DatabaseTarget:
    host: str
    port: int
    username: str
    password: str
    database: str


def configure_logger() -> logging.Logger:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / f"audit-data-{datetime.now():%Y%m%d-%H%M%S}.log"
    logger = logging.getLogger("crm-audit-data")
    logger.handlers.clear()
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    for handler in (logging.FileHandler(path, encoding="utf-8"), logging.StreamHandler(sys.stdout)):
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.info("日志文件: %s", path)
    return logger


def read_database_target() -> DatabaseTarget:
    env_path = ROOT / ".env.local"
    for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.startswith("DATABASE_URL="):
            continue
        value = line.split("=", 1)[1].strip().strip('"').strip("'")
        parsed = urlsplit(value)
        if parsed.scheme not in {"mysql", "mariadb"} or not parsed.path:
            raise RuntimeError("DATABASE_URL 不是有效的 MariaDB/MySQL 地址")
        return DatabaseTarget(
            parsed.hostname or "127.0.0.1",
            parsed.port or 3306,
            unquote(parsed.username or ""),
            unquote(parsed.password or ""),
            parsed.path.lstrip("/"),
        )
    raise RuntimeError(f"未在 {env_path} 中找到 DATABASE_URL")


def run_sql(target: DatabaseTarget, sql: str) -> str:
    executable = shutil.which("mariadb") or shutil.which("mysql")
    if executable is None:
        raise RuntimeError("未找到 mariadb 或 mysql 客户端，无法执行只读检查")
    environment = os.environ.copy()
    environment["MYSQL_PWD"] = target.password
    result = subprocess.run(
        [executable, "--batch", "--skip-column-names", "--protocol=tcp", "-h", target.host,
         "-P", str(target.port), "-u", target.username, target.database, "-e", sql],
        cwd=ROOT, env=environment, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"数据库检查失败，退出码 {result.returncode}")
    return result.stdout.strip()


def check_migrations(logger: logging.Logger) -> int:
    paths = sorted((ROOT / "prisma" / "migrations").iterdir())
    names = [path.name for path in paths if path.is_dir()]
    invalid = [name for name in names if not MIGRATION_PATTERN.match(name)]
    if invalid:
        logger.error("迁移目录名不符合约定: %s", ", ".join(invalid))
        return 1
    if names != sorted(names):
        logger.error("迁移目录无法按时间顺序排序")
        return 1
    logger.info("迁移文件检查通过: %s 个目录", len(names))
    return 0


def check_backups(logger: logging.Logger) -> int:
    backup_dir = Path(os.environ.get("CRM_BACKUP_DIR", str(ROOT / "backups")))
    archives = sorted(backup_dir.glob("*.sql.gz"), key=lambda path: path.stat().st_mtime, reverse=True)
    if not archives:
        logger.warning("未找到本地备份文件，仅完成迁移和数据库只读检查")
        return 0
    for archive in archives[:5]:
        if archive.stat().st_size == 0:
            logger.error("备份文件为空: %s", archive)
            return 1
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        logger.info("备份完整性通过: %s sha256=%s", archive, digest)
    return 0


def check_database(logger: logging.Logger) -> int:
    target = read_database_target()
    migration_table = run_sql(
        target,
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '_prisma_migrations'",
    )
    if migration_table != "1":
        logger.error("未找到 Prisma 迁移状态表 _prisma_migrations")
        return 1

    applied = {
        name
        for name in run_sql(
            target,
            "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name",
        ).splitlines()
        if name
    }
    local = {
        path.name
        for path in (ROOT / "prisma" / "migrations").iterdir()
        if path.is_dir()
    }
    pending = sorted(local - applied)
    if pending:
        logger.error("数据库存在未执行迁移: %s", ", ".join(pending))
        return 1
    logger.info("数据库迁移状态通过: 已应用 %s 个迁移", len(applied))

    checks = {
        "AuditEvent表": "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'AuditEvent'",
        "孤立客户销售": "SELECT COUNT(*) FROM Customer c LEFT JOIN User u ON u.id = c.salesId WHERE u.id IS NULL",
        "孤立订单客户": "SELECT COUNT(*) FROM `Order` o LEFT JOIN Customer c ON c.id = o.customerId WHERE c.id IS NULL",
        "负回款": "SELECT COUNT(*) FROM Payment WHERE amount <= 0",
    }
    for label, sql in checks.items():
        value = run_sql(target, sql)
        logger.info("%s: %s", label, value or "0")
        if label != "AuditEvent表" and value not in {"", "0"}:
            logger.error("数据质量检查发现问题: %s=%s", label, value)
            return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="CRM 只读数据、迁移和备份检查")
    parser.add_argument("--skip-db", action="store_true", help="跳过数据库连接检查")
    args = parser.parse_args()
    logger = configure_logger()
    try:
        result = check_migrations(logger)
        if result != 0:
            return result
        result = check_backups(logger)
        if result != 0:
            return result
        if not args.skip_db:
            result = check_database(logger)
            if result != 0:
                return result
        logger.info("审计检查完成")
        return 0
    except Exception as error:
        logger.exception("审计检查失败: %s", error)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
