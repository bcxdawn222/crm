from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit
from uuid import UUID


ENV_PATH = Path(os.environ.get("CRM_ENV_PATH", "/www/wwwroot/crm-system/.env"))
REQUEST_ID_PATTERN = re.compile(r"^[a-z0-9-]{1,100}$")


@dataclass(frozen=True)
class DatabaseTarget:
    host: str
    port: int
    username: str
    password: str
    database: str


@dataclass(frozen=True)
class FixtureIds:
    telemarketing: str | None
    customer: str | None
    follow_up: str | None
    order: str | None
    payment: str | None

    @classmethod
    def from_args(cls, args: argparse.Namespace) -> "FixtureIds":
        values = cls(
            telemarketing=args.telemarketing_id,
            customer=args.customer_id,
            follow_up=args.follow_up_id,
            order=args.order_id,
            payment=args.payment_id,
        )
        for value in asdict(values).values():
            if value:
                UUID(value)
        return values

    def require_complete(self) -> None:
        if not all(asdict(self).values()):
            raise ValueError("inspect 要求提供全部验收夹具 ID")


@dataclass(frozen=True)
class Snapshot:
    telemarketing_count: int
    customer_count: int
    follow_up_count: int
    order_count: int
    payment_count: int
    audit_count: int
    contract_total: str
    paid_total: str
    payment_total: str


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


def run_sql(target: DatabaseTarget, sql: str) -> str:
    environment = os.environ.copy()
    environment["MYSQL_PWD"] = target.password
    result = subprocess.run(
        [
            "mariadb",
            "--batch",
            "--skip-column-names",
            "--protocol=tcp",
            "-h",
            target.host,
            "-P",
            str(target.port),
            "-u",
            target.username,
            target.database,
            "-e",
            sql,
        ],
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"数据库命令失败，退出码 {result.returncode}: {result.stderr.strip()}")
    return result.stdout.strip()


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def snapshot(target: DatabaseTarget) -> Snapshot:
    sql = """
SELECT
  (SELECT COUNT(*) FROM TelemarketingList),
  (SELECT COUNT(*) FROM Customer),
  (SELECT COUNT(*) FROM FollowUp),
  (SELECT COUNT(*) FROM `Order`),
  (SELECT COUNT(*) FROM Payment),
  (SELECT COUNT(*) FROM AuditEvent),
  COALESCE((SELECT SUM(contractAmount) FROM `Order`), 0),
  COALESCE((SELECT SUM(paidAmount) FROM `Order`), 0),
  COALESCE((SELECT SUM(amount) FROM Payment), 0)
"""
    values = run_sql(target, sql).split("\t")
    if len(values) != 9:
        raise RuntimeError(f"线上数据快照列数不正确: {len(values)}")
    return Snapshot(
        telemarketing_count=int(values[0]),
        customer_count=int(values[1]),
        follow_up_count=int(values[2]),
        order_count=int(values[3]),
        payment_count=int(values[4]),
        audit_count=int(values[5]),
        contract_total=values[6],
        paid_total=values[7],
        payment_total=values[8],
    )


def request_ids(args: argparse.Namespace) -> tuple[str, ...]:
    values = tuple(value for value in args.request_ids.split(",") if value)
    if not values or any(not REQUEST_ID_PATTERN.fullmatch(value) for value in values):
        raise ValueError("request IDs 格式不正确")
    return values


def marker_value(args: argparse.Namespace) -> str:
    marker = args.marker.strip()
    if not re.fullmatch(r"[a-f0-9]{12}", marker):
        raise ValueError("marker 格式不正确")
    return marker


def inspect_fixture(target: DatabaseTarget, ids: FixtureIds, requests: tuple[str, ...]) -> None:
    ids.require_complete()
    customer = run_sql(
        target,
        "SELECT status,contractAmount,cooperationNotes FROM Customer "
        f"WHERE id={sql_text(ids.customer)}",
    )
    if customer != "COOPERATING\t12000.00\t线上受控验收":
        raise RuntimeError(f"合作客户数据不一致: {customer}")
    order = run_sql(
        target,
        "SELECT contractAmount,paidAmount,unpaidAmount FROM `Order` "
        f"WHERE id={sql_text(ids.order)}",
    )
    if order != "12000.00\t3000.00\t9000.00":
        raise RuntimeError(f"订单金额不一致: {order}")
    reasons = set(run_sql(
        target,
        "SELECT reason FROM AuditEvent WHERE requestId IN "
        f"({','.join(sql_text(value) for value in requests)})",
    ).splitlines())
    expected = {
        "TELEMARKETING_CREATED",
        "TELEMARKETING_CONVERTED",
        "FOLLOW_UP_CREATED",
        "CUSTOMER_MARKED_COOPERATING",
        "COOPERATING_CUSTOMER_UPDATED",
        "ORDER_CREATED",
        "PAYMENT_CREATED",
    }
    if not expected.issubset(reasons):
        raise RuntimeError(f"线上审计事件不完整: {sorted(reasons)}")


def cleanup_fixture(target: DatabaseTarget, ids: FixtureIds, requests: tuple[str, ...], marker: str) -> None:
    entity_ids = tuple(value for value in asdict(ids).values() if value)
    entity_filter = (
        f" OR entityId IN ({','.join(sql_text(value) for value in entity_ids)})"
        if entity_ids
        else ""
    )
    sql = f"""
START TRANSACTION;
DELETE FROM AuditEvent WHERE requestId IN ({','.join(sql_text(value) for value in requests)})
  OR RIGHT(requestId, 12)={sql_text(marker)}{entity_filter};
DELETE FROM Payment WHERE remarks={sql_text(f'线上受控验收 {marker}')};
DELETE FROM `Order` WHERE contractNo={sql_text(f'PROD-{marker}')};
DELETE FROM FollowUp WHERE content={sql_text(f'线上发布受控验收 {marker}')};
DELETE FROM TelemarketingList WHERE name={sql_text(f'线上验收客户-{marker}')};
DELETE FROM Customer WHERE name={sql_text(f'线上验收客户-{marker}')};
COMMIT;
"""
    run_sql(target, sql)


def assert_no_residue(target: DatabaseTarget, marker: str) -> None:
    sql = f"""
SELECT
  (SELECT COUNT(*) FROM TelemarketingList WHERE name={sql_text(f'线上验收客户-{marker}')}),
  (SELECT COUNT(*) FROM Customer WHERE name={sql_text(f'线上验收客户-{marker}')}),
  (SELECT COUNT(*) FROM FollowUp WHERE content={sql_text(f'线上发布受控验收 {marker}')}),
  (SELECT COUNT(*) FROM `Order` WHERE contractNo={sql_text(f'PROD-{marker}')}),
  (SELECT COUNT(*) FROM Payment WHERE remarks={sql_text(f'线上受控验收 {marker}')}),
  (SELECT COUNT(*) FROM AuditEvent WHERE RIGHT(requestId, 12)={sql_text(marker)})
"""
    values = run_sql(target, sql).split("\t")
    if values != ["0", "0", "0", "0", "0", "0"]:
        raise RuntimeError(f"线上验收数据仍有残留: {values}")


def add_fixture_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--marker", required=True)
    parser.add_argument("--telemarketing-id")
    parser.add_argument("--customer-id")
    parser.add_argument("--follow-up-id")
    parser.add_argument("--order-id")
    parser.add_argument("--payment-id")
    parser.add_argument("--request-ids", required=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="CRM 线上 SOP 数据核验与精确清理")
    subparsers = parser.add_subparsers(dest="action", required=True)
    subparsers.add_parser("snapshot")
    for action in ("inspect", "cleanup", "assert-clean"):
        add_fixture_arguments(subparsers.add_parser(action))
    args = parser.parse_args()
    target = read_database_target()
    if args.action == "snapshot":
        print(json.dumps(asdict(snapshot(target)), ensure_ascii=False, sort_keys=True))
        return 0
    ids = FixtureIds.from_args(args)
    requests = request_ids(args)
    marker = marker_value(args)
    if args.action == "inspect":
        inspect_fixture(target, ids, requests)
    elif args.action == "cleanup":
        cleanup_fixture(target, ids, requests, marker)
    else:
        assert_no_residue(target, marker)
    print(json.dumps({"action": args.action, "status": "ok"}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError) as error:
        print(f"线上 SOP 数据探针失败: {error}", file=sys.stderr)
        raise SystemExit(1)
