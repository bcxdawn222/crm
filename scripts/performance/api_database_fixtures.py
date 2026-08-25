from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from runtime.mysql_client import DatabaseTarget, run_mysql


@dataclass(frozen=True)
class PerformanceFixture:
    marker: str
    prefix: str
    customer_count: int


def quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def insert_rows(target: DatabaseTarget, table: str, columns: tuple[str, ...], rows: list[str]) -> None:
    if not rows:
        return
    for index in range(0, len(rows), 50):
        batch = rows[index:index + 50]
        run_mysql(target, f"INSERT INTO {table} ({','.join(columns)}) VALUES {','.join(batch)}")


def _create_performance_fixture(
    target: DatabaseTarget,
    actor_id: str,
    fixture: PerformanceFixture,
) -> PerformanceFixture:
    marker = fixture.marker
    prefix = fixture.prefix
    customers: list[str] = []
    orders: list[str] = []
    payments: list[str] = []
    follow_ups: list[str] = []
    messages: list[str] = []
    files: list[str] = []
    audits: list[str] = []

    for index in range(120):
        customer_id = f"{prefix}-customer-{index:03d}"
        is_public = "TRUE" if index % 4 == 0 else "FALSE"
        status = "'INACTIVE'" if index % 4 == 0 else "'COOPERATING'" if index % 10 == 1 else "'ACTIVE'"
        last_follow_up = "NULL" if index % 3 == 0 else f"DATE_SUB(NOW(3), INTERVAL {index % 45} DAY)"
        contract_end = f"DATE_ADD(NOW(3), INTERVAL {(index % 40) - 5} DAY)"
        next_visit = f"DATE_ADD(NOW(3), INTERVAL {index % 10} DAY)"
        entered_at = f"DATE_SUB(NOW(3), INTERVAL {index % 30} DAY)" if index % 4 == 0 else "NULL"
        reason = "'RULE_1'" if index % 4 == 0 else "NULL"
        customers.append(
            f"({quote(customer_id)},{quote(f'性能客户-{index:03d}')},{quote(f'公司-{index % 15:02d}')},"
            f"{quote(f'13988{index:06d}')},'WEBSITE','POTENTIAL',{status},{quote(actor_id)},{is_public},"
            f"DATE_SUB(NOW(3), INTERVAL {index % 60} DAY),NOW(3),{last_follow_up},{contract_end},{next_visit},"
            f"{entered_at},{reason})"
        )
        if index < 40:
            order_id = f"{prefix}-order-{index:03d}"
            order_status = ("PENDING", "CONFIRMED", "COMPLETED")[index % 3]
            orders.append(
                f"({quote(order_id)},{quote(f'PERF-{marker}-{index:03d}')},{quote(customer_id)},{quote(actor_id)},"
                f"{1000 + index * 25},{500 + index * 10},{quote(order_status)},"
                f"DATE_SUB(NOW(3), INTERVAL {index % 30} DAY),NOW(3))"
            )
            if index < 20:
                payments.append(
                    f"({quote(f'{prefix}-payment-{index:03d}')},{quote(f'PAY-{marker}-{index:03d}')},"
                    f"{quote(order_id)},{100 + index * 5},'BANK_TRANSFER',"
                    f"DATE_SUB(NOW(3), INTERVAL {index % 20} DAY),{quote(actor_id)},NOW(3),NOW(3))"
                )
        if index < 30:
            follow_ups.append(
                f"({quote(f'{prefix}-follow-{index:03d}')},{quote(customer_id)},{quote(actor_id)},'PHONE',"
                f"{quote('性能验收计划跟进')},'PLANNED',DATE_ADD(NOW(3), INTERVAL {index % 7} DAY),NOW(3),NOW(3))"
            )

    for index in range(60):
        messages.append(
            f"({quote(f'{prefix}-message-{index:03d}')},{quote(actor_id)},{quote(actor_id)},"
            f"{quote(f'性能验收消息-{index:03d}')},FALSE,DATE_SUB(NOW(3), INTERVAL {index % 20} DAY))"
        )
    for index in range(30):
        files.append(
            f"({quote(f'{prefix}-file-{index:03d}')},{quote(f'perf-{index:03d}.txt')},"
            f"{quote(f'perf-{index:03d}.txt')},{quote(f'/api/files/{prefix}-{index:03d}')},"
            f"{quote(f'performance/{prefix}-{index:03d}.txt')},128,'text/plain','DOCUMENT',"
            f"{quote(actor_id)},NOW(3),NOW(3))"
        )
    for index in range(30):
        audits.append(
            f"({quote(f'{prefix}-audit-{index:03d}')},{quote(actor_id)},'CLAIM','Customer',"
            f"{quote(f'{prefix}-customer-{index * 4:03d}')},'PUBLIC_POOL_CLAIM',{quote(marker)},"
            f"DATE_SUB(NOW(3), INTERVAL {index % 30} DAY))"
        )

    insert_rows(target, "Customer", (
        "id", "name", "company", "phone", "source", "level", "status", "salesId", "isPublic",
        "createdAt", "updatedAt", "lastFollowUpAt", "contractEndDate", "nextVisitAt",
        "publicPoolEnteredAt", "publicPoolReason",
    ), customers)
    insert_rows(target, "`Order`", (
        "id", "orderNo", "customerId", "salesId", "contractAmount", "unpaidAmount", "status",
        "createdAt", "updatedAt",
    ), orders)
    insert_rows(target, "Payment", (
        "id", "paymentNo", "orderId", "amount", "paymentMethod", "paymentDate", "operatorId",
        "createdAt", "updatedAt",
    ), payments)
    insert_rows(target, "FollowUp", (
        "id", "customerId", "salesId", "type", "content", "status", "nextFollowUpAt", "createdAt", "updatedAt",
    ), follow_ups)
    insert_rows(target, "Message", (
        "id", "senderId", "receiverId", "content", "isRead", "createdAt",
    ), messages)
    insert_rows(target, "File", (
        "id", "name", "originalName", "url", "path", "size", "mimeType", "category", "uploadedBy",
        "createdAt", "updatedAt",
    ), files)
    insert_rows(target, "AuditEvent", (
        "id", "actorId", "action", "entityType", "entityId", "reason", "requestId", "createdAt",
    ), audits)
    return fixture


def cleanup_performance_fixture(target: DatabaseTarget, fixture: PerformanceFixture) -> None:
    pattern = quote(f"{fixture.prefix}%")
    marker = quote(fixture.marker)
    for sql in (
        f"DELETE FROM AuditEvent WHERE requestId={marker}",
        f"DELETE FROM Payment WHERE id LIKE {pattern}",
        f"DELETE FROM `Order` WHERE id LIKE {pattern}",
        f"DELETE FROM FollowUp WHERE id LIKE {pattern}",
        f"DELETE FROM File WHERE id LIKE {pattern}",
        f"DELETE FROM Message WHERE id LIKE {pattern}",
        f"DELETE FROM Customer WHERE id LIKE {pattern}",
    ):
        run_mysql(target, sql)


def create_performance_fixture(target: DatabaseTarget, actor_id: str) -> PerformanceFixture:
    marker = uuid4().hex[:12]
    fixture = PerformanceFixture(marker=marker, prefix=f"perf-{marker}", customer_count=120)
    try:
        return _create_performance_fixture(target, actor_id, fixture)
    except Exception:
        cleanup_performance_fixture(target, fixture)
        raise
