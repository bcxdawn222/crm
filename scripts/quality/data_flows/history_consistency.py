from __future__ import annotations

import urllib.request

from quality.crm_http import json_body, request, require
from runtime.mysql_client import parse_database_url, run_mysql


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def database_value(database_url: str, sql: str) -> str:
    return run_mysql(parse_database_url(database_url), sql)


def run_history_consistency_flow(
    database_url: str,
    base_url: str,
    opener: urllib.request.OpenerDirector,
    marker: str,
    customer_id: str,
    follow_up_id: str,
    order_id: str,
    payment_id: str,
) -> None:
    rejected_payment_id = f"data-flow-payment-rejected-{marker}"
    delete_customer_id = f"data-flow-customer-delete-{marker}"
    repeat_delete_id = f"data-flow-customer-delete-repeat-{marker}"

    try:
        rejected = request(
            opener,
            base_url,
            "/api/finance/payments",
            method="POST",
            payload={
                "orderId": order_id,
                "amount": 751,
                "paymentMethod": "BANK_TRANSFER",
                "paymentDate": "2026-08-24",
                "remarks": "仅用于 test 失败写入验收",
            },
            request_id=rejected_payment_id,
        )
        rejected_body = json_body(rejected)
        require(rejected.status == 400, "超额回款没有被拒绝")
        require(rejected_body.get("code") == "AMOUNT_EXCEEDS_UNPAID", "超额回款错误码不正确")
        require(rejected.headers.get("x-request-id") == rejected_payment_id, "超额回款响应缺少请求号")
        require(
            database_value(
                database_url,
                f"SELECT COUNT(*) FROM Payment WHERE requestId={sql_quote(rejected_payment_id)}",
            ) == "0",
            "失败回款留下了付款记录",
        )
        unchanged_order = database_value(
            database_url,
            f"SELECT CONCAT_WS('|',paidAmount,unpaidAmount) FROM `Order` WHERE id={sql_quote(order_id)}",
        )
        require(unchanged_order == "250.00|750.00", "失败回款修改了订单金额")
        require(
            database_value(
                database_url,
                f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(rejected_payment_id)}",
            ) == "0",
            "失败回款写入了成功审计",
        )

        deleted = request(
            opener,
            base_url,
            f"/api/customers/{customer_id}",
            method="DELETE",
            request_id=delete_customer_id,
        )
        require(deleted.status == 200 and json_body(deleted).get("success") is True, "客户软删除失败")
        require(deleted.headers.get("x-request-id") == delete_customer_id, "客户软删除响应缺少请求号")
        history_row = database_value(
            database_url,
            "SELECT CONCAT_WS('|',c.status,COUNT(DISTINCT f.id),COUNT(DISTINCT o.id),"
            "COUNT(DISTINCT p.id)) FROM Customer c "
            "LEFT JOIN FollowUp f ON f.customerId=c.id "
            "LEFT JOIN `Order` o ON o.customerId=c.id "
            "LEFT JOIN Payment p ON p.orderId=o.id "
            f"WHERE c.id={sql_quote(customer_id)} GROUP BY c.id,c.status",
        )
        require(history_row == "INACTIVE|1|1|1", f"客户软删除破坏了业务历史: {history_row}")
        require(
            database_value(
                database_url,
                "SELECT COUNT(*) FROM AuditEvent "
                f"WHERE requestId={sql_quote(delete_customer_id)} "
                "AND reason='CUSTOMER_SOFT_DELETED' AND beforeData IS NOT NULL AND afterData IS NOT NULL",
            ) == "1",
            "客户软删除审计快照不完整",
        )
        require(
            database_value(
                database_url,
                f"SELECT COUNT(*) FROM Payment WHERE id={sql_quote(payment_id)} AND orderId={sql_quote(order_id)}",
            ) == "1",
            "客户软删除后回款无法追溯",
        )
        require(
            database_value(
                database_url,
                f"SELECT COUNT(*) FROM FollowUp WHERE id={sql_quote(follow_up_id)} AND customerId={sql_quote(customer_id)}",
            ) == "1",
            "客户软删除后跟进无法追溯",
        )
        repeated = request(
            opener,
            base_url,
            f"/api/customers/{customer_id}",
            method="DELETE",
            request_id=repeat_delete_id,
        )
        repeated_body = json_body(repeated)
        require(repeated.status == 409, "重复软删除客户没有被拒绝")
        require(repeated_body.get("code") == "CUSTOMER_ALREADY_INACTIVE", "重复软删除错误码不正确")
        require(repeated.headers.get("x-request-id") == repeat_delete_id, "重复软删除响应缺少请求号")
        require(
            database_value(
                database_url,
                f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(repeat_delete_id)}",
            ) == "0",
            "重复软删除写入了成功审计",
        )
        print("失败回款与客户软删除历史追溯验收通过")
    finally:
        database_value(
            database_url,
            "DELETE FROM AuditEvent WHERE requestId IN "
            f"({sql_quote(rejected_payment_id)},{sql_quote(repeat_delete_id)})",
        )
