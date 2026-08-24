from __future__ import annotations

import os
import socket
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))


@dataclass(frozen=True)
class QualityCheck:
    label: str
    sql: str


REQUIRED_TABLES = (
    "User", "Role", "Permission", "UserRole", "RolePermission", "Customer",
    "FollowUp", "Lead", "Order", "Payment", "File", "Message",
    "ContractArchive", "AuditEvent", "SystemSetting",
)

RELATION_CHECKS = (
    QualityCheck("孤立用户角色", "SELECT COUNT(*) FROM UserRole ur LEFT JOIN User u ON u.id=ur.userId LEFT JOIN Role r ON r.id=ur.roleId WHERE u.id IS NULL OR r.id IS NULL"),
    QualityCheck("孤立角色权限", "SELECT COUNT(*) FROM RolePermission rp LEFT JOIN Role r ON r.id=rp.roleId LEFT JOIN Permission p ON p.id=rp.permissionId WHERE r.id IS NULL OR p.id IS NULL"),
    QualityCheck("孤立客户销售", "SELECT COUNT(*) FROM Customer c LEFT JOIN User u ON u.id=c.salesId WHERE u.id IS NULL"),
    QualityCheck("孤立跟进客户或销售", "SELECT COUNT(*) FROM FollowUp f LEFT JOIN Customer c ON c.id=f.customerId LEFT JOIN User u ON u.id=f.salesId WHERE c.id IS NULL OR u.id IS NULL"),
    QualityCheck("孤立线索客户或销售", "SELECT COUNT(*) FROM `Lead` l LEFT JOIN Customer c ON c.id=l.customerId LEFT JOIN User u ON u.id=l.salesId WHERE c.id IS NULL OR u.id IS NULL"),
    QualityCheck("孤立订单客户或销售", "SELECT COUNT(*) FROM `Order` o LEFT JOIN Customer c ON c.id=o.customerId LEFT JOIN User u ON u.id=o.salesId WHERE c.id IS NULL OR u.id IS NULL"),
    QualityCheck("孤立回款订单或操作人", "SELECT COUNT(*) FROM Payment p LEFT JOIN `Order` o ON o.id=p.orderId LEFT JOIN User u ON u.id=p.operatorId WHERE o.id IS NULL OR u.id IS NULL"),
    QualityCheck("孤立文件上传人", "SELECT COUNT(*) FROM File f LEFT JOIN User u ON u.id=f.uploadedBy WHERE u.id IS NULL"),
    QualityCheck("孤立消息发送人或接收人", "SELECT COUNT(*) FROM Message m LEFT JOIN User s ON s.id=m.senderId LEFT JOIN User r ON r.id=m.receiverId WHERE s.id IS NULL OR r.id IS NULL"),
    QualityCheck("孤立合同客户或归档人", "SELECT COUNT(*) FROM ContractArchive ca LEFT JOIN Customer c ON c.id=ca.customerId LEFT JOIN User u ON u.id=ca.archivedBy WHERE c.id IS NULL OR u.id IS NULL"),
    QualityCheck("异常订单金额", "SELECT COUNT(*) FROM `Order` WHERE contractAmount < 0 OR paidAmount < 0 OR unpaidAmount < 0 OR paidAmount > contractAmount OR unpaidAmount <> contractAmount - paidAmount"),
    QualityCheck("负回款", "SELECT COUNT(*) FROM Payment WHERE amount <= 0"),
)


def _database_url() -> str:
    value = os.environ.get("DATABASE_URL", "").strip()
    if value:
        return value.strip('"').strip("'")
    for env_path in (ROOT / ".env.local", ROOT / ".env"):
        if not env_path.is_file():
            continue
        for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
            line = raw_line.strip()
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise ValueError("未找到有效的 DATABASE_URL，无法执行数据可达性检查")


def _database_target() -> tuple[str, int]:
    parsed = urlsplit(_database_url())
    if parsed.scheme not in {"mysql", "mariadb"} or not parsed.hostname:
        raise ValueError("未找到有效的 MySQL/MariaDB 数据库地址")
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


def _run_mysql(sql: str) -> str:
    from runtime.mysql_client import parse_database_url, run_mysql

    return run_mysql(parse_database_url(_database_url()), sql)


def _check_required_tables() -> int:
    names = ",".join(f"'{name}'" for name in REQUIRED_TABLES)
    rows = _run_mysql(
        "SELECT table_name FROM information_schema.tables "
        f"WHERE table_schema=DATABASE() AND table_name IN ({names}) ORDER BY table_name"
    )
    found = {name.lower() for name in rows.splitlines()} if rows else set()
    missing = [name for name in REQUIRED_TABLES if name.lower() not in found]
    if missing:
        print(f"缺少业务表或迁移未执行: {', '.join(missing)}")
        return 1
    print(f"核心业务表检查通过: {len(REQUIRED_TABLES)} 张")
    return 0


def _print_table_counts() -> None:
    for table in REQUIRED_TABLES:
        value = _run_mysql(f"SELECT COUNT(*) FROM `{table}`") or "0"
        print(f"数据量 {table}: {value}")


def _check_relations() -> int:
    for check in RELATION_CHECKS:
        value = _run_mysql(check.sql) or "0"
        print(f"数据质量 {check.label}: {value}")
        if value != "0":
            print(f"数据质量检查失败: {check.label}={value}")
            return 1
    return 0


def main() -> int:
    host, port = _database_target()
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"数据库网络可达: {host}:{port}")
    except OSError as error:
        print(f"数据库不可达: {host}:{port}，{error}")
        return 1
    if _run_prisma_probe() != 0:
        return 1
    if _check_required_tables() != 0:
        return 1
    _print_table_counts()
    return _check_relations()


if __name__ == "__main__":
    raise SystemExit(main())
