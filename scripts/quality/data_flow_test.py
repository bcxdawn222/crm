from __future__ import annotations

import datetime as dt
import os
import sys
import urllib.request
from uuid import uuid4


sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from quality.crm_http import build_opener, json_body, login, request, require
from quality.data_flows.customer_extension import run_customer_extension_flow
from runtime.mysql_client import parse_database_url, run_mysql


PROFILE = os.environ.get("CRM_PROFILE", "stable")
BASE_URL = os.environ.get(
    "CRM_BASE_URL",
    f"http://127.0.0.1:{3001 if PROFILE == 'test' else 3000}",
).rstrip("/")
USERNAME = os.environ.get("CRM_SMOKE_USERNAME", "admin")
PASSWORD = os.environ.get("CRM_SMOKE_PASSWORD", "123456")


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def database_value(database_url: str, sql: str) -> str:
    return run_mysql(parse_database_url(database_url), sql)


def main() -> int:
    if PROFILE != "test":
        print("拒绝执行：data-flow 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2

    database_url = os.environ.get("DATABASE_URL", "")
    target = parse_database_url(database_url)
    marker = uuid4().hex[:12]
    phone = f"139{marker[:8]}"
    customer_id: str | None = None
    follow_up_id: str | None = None
    order_id: str | None = None
    payment_id: str | None = None

    try:
        opener = build_opener()
        login(opener, BASE_URL, USERNAME, PASSWORD)

        customer_request_id = f"data-flow-customer-{marker}"
        customer_result = request(
            opener,
            BASE_URL,
            "/api/customers",
            method="POST",
            payload={
                "name": f"数据链路客户-{marker}",
                "company": "CRM test verification",
                "phone": phone,
                "email": f"data-flow-{marker}@example.com",
                "category": "潜在客户",
                "source": "OTHER",
                "notes": "仅用于 test 数据链路验收",
            },
            request_id=customer_request_id,
        )
        customer = json_body(customer_result)
        require(customer.get("success") is True, f"客户创建失败: {customer}")
        customer_id = str(customer["data"]["id"])
        require(
            customer_result.headers.get("x-request-id") == customer_request_id,
            "客户响应缺少 x-request-id",
        )

        customer_detail = json_body(request(opener, BASE_URL, f"/api/customers/{customer_id}"))
        require(customer_detail.get("success") is True, "客户创建后无法读取详情")
        require(customer_detail["data"]["phone"] == phone, "客户详情未返回刚写入的电话")

        follow_up_request_id = f"data-flow-follow-up-{marker}"
        follow_up_result = request(
            opener,
            BASE_URL,
            f"/api/customers/{customer_id}/follow-ups",
            method="POST",
            payload={
                "type": "PHONE",
                "content": "已电话沟通，客户确认继续推进",
                "result": "客户有明确意向",
                "nextAction": "发送方案并再次联系",
                "nextFollowUpAt": (dt.date.today() + dt.timedelta(days=3)).isoformat(),
            },
            request_id=follow_up_request_id,
        )
        follow_up = json_body(follow_up_result)
        require(follow_up.get("success") is True, f"跟进记录创建失败: {follow_up}")
        follow_up_id = str(follow_up["data"]["id"])
        require(
            follow_up_result.headers.get("x-request-id") == follow_up_request_id,
            "跟进响应缺少 x-request-id",
        )

        order_request_id = f"data-flow-order-{marker}"
        order_result = request(
            opener,
            BASE_URL,
            "/api/finance/orders",
            method="POST",
            payload={
                "customerId": customer_id,
                "contractNo": f"TEST-{marker}",
                "contractAmount": 1000,
                "currency": "CNY",
                "signDate": dt.date.today().isoformat(),
                "remarks": "仅用于 test 数据链路验收",
            },
            request_id=order_request_id,
        )
        order = json_body(order_result)
        require(order.get("success") is True, f"订单创建失败: {order}")
        order_id = str(order["data"]["id"])
        require(
            order_result.headers.get("x-request-id") == order_request_id,
            "订单响应缺少 x-request-id",
        )

        payment_request_id = f"data-flow-payment-{marker}"
        payment_result = request(
            opener,
            BASE_URL,
            "/api/finance/payments",
            method="POST",
            payload={
                "orderId": order_id,
                "amount": 250,
                "paymentMethod": "BANK_TRANSFER",
                "paymentDate": dt.date.today().isoformat(),
                "remarks": "仅用于 test 数据链路验收",
            },
            request_id=payment_request_id,
        )
        payment = json_body(payment_result)
        require(payment.get("success") is True, f"回款创建失败: {payment}")
        payment_id = str(payment["data"]["id"])
        require(
            payment_result.headers.get("x-request-id") == payment_request_id,
            "回款响应缺少 x-request-id",
        )

        order_row = database_value(
            database_url,
            f"SELECT contractAmount, paidAmount, unpaidAmount FROM `Order` WHERE id={sql_quote(order_id)}",
        )
        require(order_row == "1000.00\t250.00\t750.00", f"订单金额核对失败: {order_row}")
        customer_row = database_value(
            database_url,
            f"SELECT COUNT(*) FROM Customer WHERE id={sql_quote(customer_id)} AND phone={sql_quote(phone)}",
        )
        require(customer_row == "1", "数据库未找到刚创建的客户")
        audit_row = database_value(
            database_url,
            "SELECT COUNT(*) FROM AuditEvent WHERE entityId IN "
            f"({sql_quote(customer_id)},{sql_quote(follow_up_id)},{sql_quote(order_id)},{sql_quote(payment_id)})",
        )
        require(audit_row == "4", f"审计事件数量异常: {audit_row}")
        follow_up_row = database_value(
            database_url,
            f"SELECT COUNT(*) FROM FollowUp WHERE id={sql_quote(follow_up_id)} AND customerId={sql_quote(customer_id)}",
        )
        require(follow_up_row == "1", "数据库未找到刚创建的跟进记录")
        run_customer_extension_flow(database_url, BASE_URL, opener, marker, USERNAME, PASSWORD)
        print(
            "业务数据核对通过，开始清理 test 夹具: "
            f"customer={customer_id}, followUp={follow_up_id}, order={order_id}, payment={payment_id}"
        )
        return 0
    finally:
        entity_ids = [value for value in (customer_id, follow_up_id, order_id, payment_id) if value]
        cleanup = [
            f"DELETE FROM AuditEvent WHERE entityId IN ({','.join(sql_quote(value) for value in entity_ids)})"
        ] if entity_ids else []
        cleanup.extend(
            f"DELETE FROM {table} WHERE id={sql_quote(value)}"
            for table, value in (
                ("`Payment`", payment_id),
                ("`Order`", order_id),
                ("`FollowUp`", follow_up_id),
                ("`Customer`", customer_id),
            )
            if value
        )
        for sql in cleanup:
            database_value(database_url, sql)
        if customer_id or order_id or payment_id:
            print("test 数据链路夹具已清理")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"数据链路验收失败: {error}", file=sys.stderr)
        raise SystemExit(1)
