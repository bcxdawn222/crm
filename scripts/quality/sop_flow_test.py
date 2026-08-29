from __future__ import annotations

import datetime as dt
import os
import sys
from collections.abc import Mapping
from uuid import uuid4

sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from quality.crm_http import build_opener, json_body, login, request, require
from runtime.mysql_client import parse_database_url, run_mysql


PROFILE = os.environ.get("CRM_PROFILE", "stable")
BASE_URL = os.environ.get("CRM_BASE_URL", "http://127.0.0.1:3001").rstrip("/")
USERNAME = os.environ.get("CRM_SMOKE_USERNAME", "admin")
PASSWORD = os.environ.get("CRM_SMOKE_PASSWORD", "123456")


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def database_value(sql: str) -> str:
    return run_mysql(parse_database_url(os.environ["DATABASE_URL"]), sql)


def object_value(value: object, label: str) -> Mapping[str, object]:
    require(isinstance(value, dict), f"{label} 不是对象")
    return value


def text_value(value: object, label: str) -> str:
    require(isinstance(value, str) and bool(value), f"{label} 缺失")
    return value


def response_data(path: str, *, opener, method: str = "GET", payload: object | None = None, request_id: str | None = None):
    result = request(opener, BASE_URL, path, method=method, payload=payload, request_id=request_id)
    body = json_body(result)
    require(body.get("success") is True, f"{path} 失败: HTTP {result.status} {body}")
    return result, object_value(body.get("data"), f"{path} data")


def main() -> int:
    if PROFILE != "test":
        print("拒绝执行：sop-flow 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2

    marker = uuid4().hex[:12]
    request_ids: list[str] = []
    entity_ids: list[str] = []
    telemarketing_id = customer_id = follow_up_id = order_id = payment_id = None
    try:
        first_opener = build_opener()
        second_opener = build_opener()
        login(first_opener, BASE_URL, USERNAME, PASSWORD)
        login(second_opener, BASE_URL, USERNAME, PASSWORD)

        telemarketing_request_id = f"sop-telemarketing-{marker}"
        request_ids.append(telemarketing_request_id)
        _, telemarketing = response_data(
            "/api/telemarketing",
            opener=first_opener,
            method="POST",
            request_id=telemarketing_request_id,
            payload={
                "name": f"SOP验收客户-{marker}",
                "company": "CRM SOP test",
                "phone": f"138{marker[:8]}",
                "source": "SOP_TEST",
                "notes": "仅用于 test 销售 SOP 验收",
            },
        )
        telemarketing_id = text_value(telemarketing.get("id"), "电销记录 ID")
        entity_ids.append(telemarketing_id)

        convert_request_id = f"sop-convert-{marker}"
        request_ids.append(convert_request_id)
        _, converted = response_data(
            "/api/telemarketing/convert",
            opener=first_opener,
            method="POST",
            request_id=convert_request_id,
            payload={"telemarketingId": telemarketing_id, "level": "POTENTIAL", "source": "OTHER"},
        )
        customer = object_value(converted.get("customer"), "转化客户")
        customer_id = text_value(customer.get("id"), "客户 ID")
        entity_ids.append(customer_id)

        follow_request_id = f"sop-follow-{marker}"
        request_ids.append(follow_request_id)
        _, follow_up = response_data(
            f"/api/customers/{customer_id}/follow-ups",
            opener=first_opener,
            method="POST",
            request_id=follow_request_id,
            payload={
                "type": "PHONE",
                "content": "客户确认合作并要求安排签约",
                "result": "同意合作",
                "nextAction": "创建订单并登记首款",
                "nextFollowUpAt": (dt.datetime.now() + dt.timedelta(days=3)).isoformat(),
            },
        )
        follow_up_id = text_value(follow_up.get("id"), "跟进 ID")
        entity_ids.append(follow_up_id)

        invalid_id = f"sop-cooperate-invalid-{marker}"
        request_ids.append(invalid_id)
        invalid = request(
            first_opener,
            BASE_URL,
            "/api/customers/cooperating",
            method="POST",
            request_id=invalid_id,
            payload={"customerId": customer_id},
        )
        require(invalid.status == 400, "缺少合同到期日期没有被拒绝")

        cooperate_id = f"sop-cooperate-{marker}"
        request_ids.append(cooperate_id)
        _, cooperating = response_data(
            "/api/customers/cooperating",
            opener=first_opener,
            method="POST",
            request_id=cooperate_id,
            payload={
                "customerId": customer_id,
                "contractStartDate": dt.date.today().isoformat(),
                "contractEndDate": (dt.date.today() + dt.timedelta(days=365)).isoformat(),
                "contractAmount": 12000,
            },
        )
        require(cooperating.get("status") == "COOPERATING", "客户没有转为已合作")

        candidates = json_body(request(
            first_opener,
            BASE_URL,
            f"/api/customers?orderEligible=true&page=1&pageSize=20&keyword={marker}",
        ))
        candidate_data = object_value(candidates.get("data"), "订单候选 data")
        candidate_list = candidate_data.get("list")
        require(isinstance(candidate_list, list), "订单候选列表缺失")
        require(any(isinstance(item, dict) and item.get("id") == customer_id for item in candidate_list), "已合作客户未进入订单候选")

        order_request_id = f"sop-order-{marker}"
        request_ids.append(order_request_id)
        _, order = response_data(
            "/api/finance/orders",
            opener=first_opener,
            method="POST",
            request_id=order_request_id,
            payload={
                "customerId": customer_id,
                "contractNo": f"SOP-{marker}",
                "contractAmount": 12000,
                "currency": "CNY",
                "signDate": dt.date.today().isoformat(),
                "remarks": "test SOP order",
            },
        )
        order_id = text_value(order.get("id"), "订单 ID")
        entity_ids.append(order_id)

        payment_request_id = f"sop-payment-{marker}"
        request_ids.append(payment_request_id)
        _, payment = response_data(
            "/api/finance/payments",
            opener=first_opener,
            method="POST",
            request_id=payment_request_id,
            payload={
                "orderId": order_id,
                "amount": 3000,
                "paymentMethod": "BANK_TRANSFER",
                "paymentDate": dt.date.today().isoformat(),
                "remarks": "test SOP payment",
            },
        )
        payment_id = text_value(payment.get("id"), "回款 ID")
        entity_ids.append(payment_id)

        for opener in (first_opener, second_opener):
            _, detail = response_data(f"/api/customers/{customer_id}", opener=opener)
            follow_ups = detail.get("followUps")
            orders = detail.get("orders")
            require(isinstance(follow_ups, list) and any(isinstance(item, dict) and item.get("id") == follow_up_id for item in follow_ups), "详情缺少完整跟进")
            require(isinstance(orders, list) and any(isinstance(item, dict) and item.get("id") == order_id for item in orders), "详情缺少最近订单")

        for path in ("/api/statistics/sales-overview", "/api/statistics/trend?period=30d", "/api/statistics/funnel", "/api/reminders"):
            body = json_body(request(first_opener, BASE_URL, path))
            require(body.get("success") is True, f"统计或提醒接口失败: {path} {body}")

        order_amounts = database_value(f"SELECT contractAmount,paidAmount,unpaidAmount FROM `Order` WHERE id={sql_quote(order_id)}")
        require(order_amounts == "12000.00\t3000.00\t9000.00", f"订单金额不一致: {order_amounts}")
        audit_reasons = database_value(
            "SELECT reason FROM AuditEvent WHERE requestId IN "
            f"({','.join(sql_quote(value) for value in request_ids)}) ORDER BY reason"
        ).splitlines()
        expected = {"TELEMARKETING_CREATED", "TELEMARKETING_CONVERTED", "FOLLOW_UP_CREATED", "CUSTOMER_MARKED_COOPERATING", "ORDER_CREATED", "PAYMENT_CREATED"}
        require(expected.issubset(set(audit_reasons)), f"SOP 审计不完整: {audit_reasons}")
        require(database_value(f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(invalid_id)}") == "0", "失败合作请求写入了成功审计")

        if os.environ.get("CRM_SOP_EXPECT_FAILURE") == "1":
            raise RuntimeError("按 CRM_SOP_EXPECT_FAILURE 要求制造验收失败")
        print("销售 SOP 验收通过：电销转客户、详情、跟进、转已合作、建单、回款、提醒、统计、双会话和审计一致")
        return 0
    finally:
        if request_ids:
            database_value(f"DELETE FROM AuditEvent WHERE requestId IN ({','.join(sql_quote(value) for value in request_ids)})")
        if payment_id:
            database_value(f"DELETE FROM Payment WHERE id={sql_quote(payment_id)}")
        if order_id:
            database_value(f"DELETE FROM `Order` WHERE id={sql_quote(order_id)}")
        if follow_up_id:
            database_value(f"DELETE FROM FollowUp WHERE id={sql_quote(follow_up_id)}")
        if telemarketing_id:
            database_value(f"DELETE FROM TelemarketingList WHERE id={sql_quote(telemarketing_id)}")
        if customer_id:
            database_value(f"DELETE FROM Customer WHERE id={sql_quote(customer_id)}")
        if entity_ids:
            database_value(f"DELETE FROM AuditEvent WHERE entityId IN ({','.join(sql_quote(value) for value in entity_ids)})")
        print("销售 SOP test 夹具已清理")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"销售 SOP 验收失败: {error}", file=sys.stderr)
        raise SystemExit(1)
