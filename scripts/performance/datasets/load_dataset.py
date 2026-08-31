from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))

from runtime.mysql_client import DatabaseTarget, parse_database_url, run_mysql
from runtime.profile_config import get_profile_config


PREFIX = "load-dataset-v1"


@dataclass(frozen=True)
class DatasetScale:
    customers: int = 5000
    telemarketing: int = 3000
    follow_ups_per_customer: int = 3
    leads: int = 2500
    orders: int = 2000
    daily_reports: int = 180
    messages: int = 2000
    tasks: int = 2000
    files: int = 500
    contracts: int = 1000
    audits: int = 5000


@dataclass(frozen=True)
class DatasetResult:
    generated_at: str
    elapsed_seconds: float
    actor_id: str
    counts: DatasetScale
    payments: int


def quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def insert_rows(
    target: DatabaseTarget,
    table: str,
    columns: tuple[str, ...],
    rows: list[str],
) -> None:
    for index in range(0, len(rows), 50):
        batch = rows[index:index + 50]
        run_mysql(target, f"INSERT INTO {table} ({','.join(columns)}) VALUES {','.join(batch)}")


def cleanup(target: DatabaseTarget) -> None:
    pattern = quote(f"{PREFIX}-%")
    for table in (
        "AuditEvent", "Payment", "ContractArchive", "`Order`", "`Lead`", "FollowUp",
        "TelemarketingList", "DailyReport", "Message", "Task", "File", "Customer",
    ):
        run_mysql(target, f"DELETE FROM {table} WHERE id LIKE {pattern}")


def customer_rows(scale: DatasetScale, actor_id: str) -> list[str]:
    rows: list[str] = []
    sources = ("WEBSITE", "REFERRAL", "ADVERTISEMENT", "EXHIBITION", "COLD_CALL", "SOCIAL_MEDIA", "OTHER")
    levels = ("VIP", "IMPORTANT", "NORMAL", "POTENTIAL")
    for index in range(scale.customers):
        cooperating = index % 5 == 0
        public = index % 10 == 7
        status = "COOPERATING" if cooperating else "INACTIVE" if public else "ACTIVE"
        contract = f"{10000 + (index % 200) * 500:.2f}" if cooperating else "NULL"
        contract_start = "DATE_SUB(NOW(3), INTERVAL 90 DAY)" if cooperating else "NULL"
        contract_end = f"DATE_ADD(NOW(3), INTERVAL {15 + index % 720} DAY)" if cooperating else "NULL"
        public_entered = f"DATE_SUB(NOW(3), INTERVAL {index % 45} DAY)" if public else "NULL"
        public_reason = quote("LOAD_TEST") if public else "NULL"
        rows.append(
            f"({quote(f'{PREFIX}-customer-{index:05d}')},{quote(f'测试客户{index:05d}')},"
            f"{quote(f'测试企业{index % 500:03d}')},{quote(f'138{index:08d}')},"
            f"{quote(f'customer{index:05d}@test.local')},{quote(sources[index % len(sources)])},"
            f"{quote(levels[index % len(levels)])},{quote(status)},{quote(actor_id)},"
            f"{str(public).upper()},DATE_SUB(NOW(3), INTERVAL {index % 365} DAY),NOW(3),"
            f"DATE_SUB(NOW(3), INTERVAL {index % 60} DAY),DATE_ADD(NOW(3), INTERVAL {index % 30} DAY),"
            f"{contract_start},{contract_end},{contract},{public_entered},"
            f"{public_reason},"
            f"{quote('性能测试数据，禁止作为正式业务记录')})"
        )
    return rows


def related_rows(scale: DatasetScale, actor_id: str) -> tuple[list[str], ...]:
    telemarketing: list[str] = []
    follow_ups: list[str] = []
    leads: list[str] = []
    orders: list[str] = []
    payments: list[str] = []
    contracts: list[str] = []
    for index in range(scale.telemarketing):
        status = ("PENDING", "CONNECTED", "NOT_ANSWERED", "CALLBACK", "FOLLOW_UP")[index % 5]
        telemarketing.append(
            f"({quote(f'{PREFIX}-tele-{index:05d}')},{quote(f'电销客户{index:05d}')},"
            f"{quote(f'电销企业{index % 400:03d}')},{quote(f'137{index:08d}')},{quote(status)},"
            f"{index % 6},{quote(actor_id)},DATE_SUB(NOW(3), INTERVAL {index % 180} DAY),NOW(3))"
        )
    for customer_index in range(scale.customers):
        customer_id = f"{PREFIX}-customer-{customer_index:05d}"
        for offset in range(scale.follow_ups_per_customer):
            item = customer_index * scale.follow_ups_per_customer + offset
            follow_ups.append(
                f"({quote(f'{PREFIX}-follow-{item:06d}')},{quote(customer_id)},{quote(actor_id)},"
                f"{quote(('PHONE', 'VISIT', 'WECHAT')[offset % 3])},{quote(f'第{offset + 1}次销售跟进')},"
                f"{quote('已沟通')},{quote('继续跟进')},'COMPLETED',"
                f"DATE_SUB(NOW(3), INTERVAL {(item % 90) + 1} DAY),NOW(3))"
            )
    for index in range(scale.leads):
        leads.append(
            f"({quote(f'{PREFIX}-lead-{index:05d}')},{quote(f'{PREFIX}-customer-{index:05d}')},"
            f"{quote(f'销售线索{index:05d}')},{quote(f'测试企业{index % 500:03d}')},'WEBSITE',"
            f"{quote(('HOT', 'WARM', 'COLD')[index % 3])},{quote(('NEW', 'CONTACTED', 'QUALIFIED')[index % 3])},"
            f"{5000 + index % 100 * 1000},{quote(actor_id)},DATE_SUB(NOW(3), INTERVAL {index % 180} DAY),NOW(3))"
        )
    for index in range(scale.orders):
        customer_index = (index * 5) % scale.customers
        contract_amount = 20000 + (index % 100) * 1000
        payment_parts = 2 if index % 2 == 0 else 1
        paid_amount = contract_amount * payment_parts // 4
        order_id = f"{PREFIX}-order-{index:05d}"
        orders.append(
            f"({quote(order_id)},{quote(f'LOAD-ORD-{index:06d}')},"
            f"{quote(f'{PREFIX}-customer-{customer_index:05d}')},{quote(actor_id)},"
            f"{quote(f'LOAD-CONTRACT-{index:06d}')},{contract_amount},{paid_amount},"
            f"{contract_amount - paid_amount},'CNY',{quote(('PENDING', 'CONFIRMED', 'COMPLETED')[index % 3])},"
            f"DATE_SUB(NOW(3), INTERVAL {index % 365} DAY),DATE_SUB(NOW(3), INTERVAL {index % 365} DAY),NOW(3))"
        )
        for part in range(payment_parts):
            payment_index = len(payments)
            payments.append(
                f"({quote(f'{PREFIX}-payment-{payment_index:05d}')},{quote(f'LOAD-PAY-{payment_index:06d}')},"
                f"{quote(order_id)},{contract_amount // 4},'BANK_TRANSFER',"
                f"DATE_SUB(NOW(3), INTERVAL {(index + part) % 365} DAY),{quote(actor_id)},"
                f"DATE_SUB(NOW(3), INTERVAL {(index + part) % 365} DAY),NOW(3))"
            )
    for index in range(scale.contracts):
        customer_index = (index * 5) % scale.customers
        contracts.append(
            f"({quote(f'{PREFIX}-archive-{index:05d}')},{quote(f'LOAD-ARCH-{index:06d}')},"
            f"{quote(f'{PREFIX}-customer-{customer_index:05d}')},1,TRUE,"
            f"{quote(f'测试合同{index:05d}')},'SALES',DATE_SUB(NOW(3), INTERVAL 90 DAY),"
            f"DATE_ADD(NOW(3), INTERVAL {275 + index % 365} DAY),{20000 + index % 100 * 1000},"
            f"{quote(f'load-contract-{index:05d}.pdf')},{quote(f'https://test.local/{PREFIX}/{index}.pdf')},"
            f"{quote(f'{PREFIX}/{index}.pdf')},1024,'pdf',{quote(f'{index:064x}')},{quote(actor_id)},NOW(3),NOW(3),NOW(3))"
        )
    return telemarketing, follow_ups, leads, orders, payments, contracts


def office_rows(scale: DatasetScale, actor_id: str) -> tuple[list[str], ...]:
    reports = [
        f"({quote(f'{PREFIX}-report-{index:04d}')},{quote(actor_id)},{quote(f'销售日报{index:04d}')},"
        f"{quote('客户跟进与订单推进')},DATE_SUB(CURDATE(), INTERVAL {index} DAY),"
        f"{quote(('DRAFT', 'SUBMITTED', 'REVIEWED')[index % 3])},NOW(3),NOW(3))"
        for index in range(scale.daily_reports)
    ]
    messages = [
        f"({quote(f'{PREFIX}-message-{index:05d}')},{quote(actor_id)},{quote(actor_id)},'NOTIFICATION',"
        f"{quote(f'测试消息{index:05d}')},{quote('性能测试消息内容')},{str(index % 3 == 0).upper()},"
        f"DATE_SUB(NOW(3), INTERVAL {index % 90} DAY))"
        for index in range(scale.messages)
    ]
    tasks = [
        f"({quote(f'{PREFIX}-task-{index:05d}')},{quote(f'销售任务{index:05d}')},"
        f"{quote(('LOW', 'MEDIUM', 'HIGH', 'URGENT')[index % 4])},"
        f"{quote(('TODO', 'IN_PROGRESS', 'COMPLETED')[index % 3])},{quote(actor_id)},{quote(actor_id)},"
        f"DATE_ADD(NOW(3), INTERVAL {index % 60} DAY),NOW(3),NOW(3))"
        for index in range(scale.tasks)
    ]
    files = [
        f"({quote(f'{PREFIX}-file-{index:04d}')},{quote(f'test-{index:04d}.txt')},"
        f"{quote(f'test-{index:04d}.txt')},{quote(f'/api/files/{PREFIX}-{index:04d}')},"
        f"{quote(f'performance/{PREFIX}-{index:04d}.txt')},1024,'text/plain','DOCUMENT',"
        f"{quote(actor_id)},NOW(3),NOW(3))"
        for index in range(scale.files)
    ]
    audits = [
        f"({quote(f'{PREFIX}-audit-{index:05d}')},{quote(actor_id)},'CREATE','Customer',"
        f"{quote(f'{PREFIX}-customer-{index % scale.customers:05d}')},'LOAD_DATASET',"
        f"{quote(f'{PREFIX}-request-{index:05d}')},DATE_SUB(NOW(3), INTERVAL {index % 365} DAY))"
        for index in range(scale.audits)
    ]
    return reports, messages, tasks, files, audits


def create_dataset(target: DatabaseTarget, actor_id: str, scale: DatasetScale) -> int:
    insert_rows(target, "Customer", (
        "id", "name", "company", "phone", "email", "source", "level", "status", "salesId",
        "isPublic", "createdAt", "updatedAt", "lastFollowUpAt", "nextFollowUpAt",
        "contractStartDate", "contractEndDate", "contractAmount", "publicPoolEnteredAt",
        "publicPoolReason", "notes",
    ), customer_rows(scale, actor_id))
    telemarketing, follow_ups, leads, orders, payments, contracts = related_rows(scale, actor_id)
    insert_rows(target, "TelemarketingList", ("id", "name", "company", "phone", "status", "callTimes", "salesId", "createdAt", "updatedAt"), telemarketing)
    insert_rows(target, "FollowUp", ("id", "customerId", "salesId", "type", "content", "result", "nextAction", "status", "createdAt", "updatedAt"), follow_ups)
    insert_rows(target, "`Lead`", ("id", "customerId", "name", "company", "source", "level", "status", "estimatedValue", "salesId", "createdAt", "updatedAt"), leads)
    insert_rows(target, "`Order`", ("id", "orderNo", "customerId", "salesId", "contractNo", "contractAmount", "paidAmount", "unpaidAmount", "currency", "status", "signDate", "createdAt", "updatedAt"), orders)
    insert_rows(target, "Payment", ("id", "paymentNo", "orderId", "amount", "paymentMethod", "paymentDate", "operatorId", "createdAt", "updatedAt"), payments)
    insert_rows(target, "ContractArchive", ("id", "archiveNo", "customerId", "version", "isLatest", "contractName", "contractType", "signDate", "expiryDate", "contractAmount", "fileName", "ossUrl", "ossKey", "fileSize", "fileType", "fileHash", "archivedBy", "archivedAt", "createdAt", "updatedAt"), contracts)
    reports, messages, tasks, files, audits = office_rows(scale, actor_id)
    insert_rows(target, "DailyReport", ("id", "userId", "title", "content", "reportDate", "status", "createdAt", "updatedAt"), reports)
    insert_rows(target, "Message", ("id", "senderId", "receiverId", "type", "title", "content", "isRead", "createdAt"), messages)
    insert_rows(target, "Task", ("id", "title", "priority", "status", "assigneeId", "creatorId", "endDate", "createdAt", "updatedAt"), tasks)
    insert_rows(target, "File", ("id", "name", "originalName", "url", "path", "size", "mimeType", "category", "uploadedBy", "createdAt", "updatedAt"), files)
    insert_rows(target, "AuditEvent", ("id", "actorId", "action", "entityType", "entityId", "reason", "requestId", "createdAt"), audits)
    return len(payments)


def main() -> int:
    if os.environ.get("CRM_PROFILE") != "test":
        raise RuntimeError("load-dataset 只允许 CRM_PROFILE=test")
    profile = get_profile_config("test")
    target = parse_database_url(profile.database_url)
    if not target.database.lower().endswith("_test"):
        raise RuntimeError("load-dataset 只允许名称以 _test 结尾的数据库")
    actor_id = run_mysql(target, "SELECT id FROM User WHERE username='admin' LIMIT 1")
    if not actor_id:
        raise RuntimeError("测试库缺少 admin，请先执行 seed")
    scale = DatasetScale()
    started = time.monotonic()
    cleanup(target)
    try:
        payments = create_dataset(target, actor_id, scale)
    except Exception:
        cleanup(target)
        raise
    result = DatasetResult(
        generated_at=datetime.now(timezone.utc).isoformat(),
        elapsed_seconds=round(time.monotonic() - started, 2),
        actor_id=actor_id,
        counts=scale,
        payments=payments,
    )
    report = ROOT / "logs" / "test" / "load-dataset-summary.json"
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(asdict(result), ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")
    print(f"全模块测试数据已生成，耗时 {result.elapsed_seconds:.2f} 秒")
    print(f"数据摘要: {report}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"全模块测试数据生成失败: {error}", file=sys.stderr)
        raise SystemExit(1)
