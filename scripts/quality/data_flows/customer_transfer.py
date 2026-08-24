from __future__ import annotations

import urllib.request
from concurrent.futures import ThreadPoolExecutor

from quality.crm_http import build_opener, json_body, login, request, require
from quality.data_flows.customer_transfer_support import (
    UserPayload,
    convert_request,
    create_telemarketing,
    create_user,
    database_value,
    sql_quote,
)


def run_customer_transfer_flow(
    database_url: str,
    base_url: str,
    admin_opener: urllib.request.OpenerDirector,
    marker: str,
) -> None:
    raw_password = "123456Aa"
    role_rows = database_value(
        database_url,
        "SELECT name,id FROM Role WHERE name IN ('sales','sales_manager') ORDER BY name",
    ).splitlines()
    roles = dict(row.split("\t", 1) for row in role_rows)
    require(set(roles) == {"sales", "sales_manager"}, "销售角色夹具不完整")

    user_ids: list[str] = []
    telemarketing_ids: list[str] = []
    customer_ids: list[str] = []
    request_ids: list[str] = []
    phone = f"136{marker[:8]}"

    try:
        manager_request = f"transfer-user-manager-{marker}"
        request_ids.append(manager_request)
        manager_id = create_user(
            admin_opener,
            base_url,
            UserPayload(
                username=f"mgr_{marker}",
                email=f"mgr_{marker}@example.com",
                password=raw_password,
                realName=f"测试主管-{marker}",
                department="销售部",
                position="销售主管",
                managerId=None,
                roleIds=[roles["sales_manager"]],
            ),
            manager_request,
        )
        user_ids.append(manager_id)

        sales_ids: list[str] = []
        for suffix in ("a", "b"):
            user_request = f"transfer-user-{suffix}-{marker}"
            request_ids.append(user_request)
            user_id = create_user(
                admin_opener,
                base_url,
                UserPayload(
                    username=f"sales_{suffix}_{marker}",
                    email=f"sales_{suffix}_{marker}@example.com",
                    password=raw_password,
                    realName=f"测试销售{suffix.upper()}-{marker}",
                    department="销售部",
                    position="销售",
                    managerId=manager_id,
                    roleIds=[roles["sales"]],
                ),
                user_request,
            )
            sales_ids.append(user_id)
            user_ids.append(user_id)
        sales_a_id, sales_b_id = sales_ids

        outsider_request = f"transfer-user-outsider-{marker}"
        request_ids.append(outsider_request)
        outsider_id = create_user(
            admin_opener,
            base_url,
            UserPayload(
                username=f"outside_{marker}",
                email=f"outside_{marker}@example.com",
                password=raw_password,
                realName=f"越权销售-{marker}",
                department="其他销售组",
                position="销售",
                managerId=None,
                roleIds=[roles["sales"]],
            ),
            outsider_request,
        )
        user_ids.append(outsider_id)

        manager_opener = build_opener()
        sales_a_openers = [build_opener(), build_opener()]
        login(manager_opener, base_url, f"mgr_{marker}", raw_password)
        for current in sales_a_openers:
            login(current, base_url, f"sales_a_{marker}", raw_password)

        telemarketing_id = create_telemarketing(
            sales_a_openers[0],
            base_url,
            marker,
            phone,
            "primary",
        )
        telemarketing_ids.append(telemarketing_id)
        convert_id = f"telemarketing-convert-{marker}"
        request_ids.append(convert_id)
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(
                lambda current: convert_request(
                    current,
                    base_url,
                    telemarketing_id,
                    convert_id,
                ),
                sales_a_openers,
            ))
        require(sorted(result.status for result in results) == [200, 201], "电销并发转化状态不正确")
        payloads = [json_body(result) for result in results]
        converted_ids = {str(payload["data"]["customer"]["id"]) for payload in payloads}
        require(len(converted_ids) == 1, "电销并发转化生成了多个客户")
        customer_id = converted_ids.pop()
        customer_ids.append(customer_id)
        require(all(result.headers.get("x-request-id") == convert_id for result in results), "转化响应缺少请求号")

        duplicate_source_id = create_telemarketing(
            sales_a_openers[0],
            base_url,
            marker,
            phone,
            "duplicate",
        )
        telemarketing_ids.append(duplicate_source_id)
        duplicate_convert_id = f"telemarketing-duplicate-{marker}"
        request_ids.append(duplicate_convert_id)
        duplicate_result = convert_request(
            sales_a_openers[0],
            base_url,
            duplicate_source_id,
            duplicate_convert_id,
        )
        duplicate_payload = json_body(duplicate_result)
        require(duplicate_result.status == 409, "重复电话转化未被拒绝")
        require(duplicate_payload.get("code") == "CUSTOMER_PHONE_EXISTS", "重复电话错误码不正确")

        options = json_body(request(
            manager_opener,
            base_url,
            "/api/customers/transfer-options",
        ))
        option_ids = {str(item["id"]) for item in options.get("data", [])}
        require({manager_id, sales_a_id, sales_b_id}.issubset(option_ids), "主管目标销售列表不完整")
        require(outsider_id not in option_ids, "目标销售列表越过主管团队范围")

        transfer_to_b = f"customer-transfer-b-{marker}"
        request_ids.append(transfer_to_b)
        transfer_payload = {"targetSalesId": sales_b_id, "reason": "测试转移给销售 B"}
        first_transfer = json_body(request(
            manager_opener,
            base_url,
            f"/api/customers/{customer_id}/transfer",
            method="POST",
            payload=transfer_payload,
            request_id=transfer_to_b,
        ))
        require(first_transfer.get("success") is True and first_transfer.get("replayed") is False, "首次客户转移失败")
        replay_transfer = json_body(request(
            manager_opener,
            base_url,
            f"/api/customers/{customer_id}/transfer",
            method="POST",
            payload=transfer_payload,
            request_id=transfer_to_b,
        ))
        require(replay_transfer.get("replayed") is True, "客户转移重复请求未返回原结果")

        request_conflict = request(
            manager_opener,
            base_url,
            f"/api/customers/{customer_id}/transfer",
            method="POST",
            payload={"targetSalesId": sales_a_id},
            request_id=transfer_to_b,
        )
        require(request_conflict.status == 409, "相同请求号修改目标销售未被拒绝")

        denied = request(
            sales_a_openers[0],
            base_url,
            f"/api/customers/{customer_id}/transfer",
            method="POST",
            payload={"targetSalesId": sales_a_id},
        )
        require(denied.status == 403, "普通销售可以直接转移客户")

        transfer_to_a = f"customer-transfer-a-{marker}"
        request_ids.append(transfer_to_a)
        returned = json_body(request(
            manager_opener,
            base_url,
            f"/api/customers/{customer_id}/transfer",
            method="POST",
            payload={"targetSalesId": sales_a_id, "reason": "测试双向转回销售 A"},
            request_id=transfer_to_a,
        ))
        require(returned.get("success") is True and returned["data"]["salesId"] == sales_a_id, "客户双向转回失败")

        database_row = database_value(
            database_url,
            "SELECT CONCAT_WS('|',c.salesId,t.customerId,t.status,t.isEffective) "
            "FROM Customer c JOIN TelemarketingList t ON t.customerId=c.id "
            f"WHERE c.id={sql_quote(customer_id)}",
        )
        require(database_row == f"{sales_a_id}|{customer_id}|CONVERTED|1", "转化与转移数据库状态不正确")
        customer_count = database_value(
            database_url,
            f"SELECT COUNT(*) FROM Customer WHERE phone={sql_quote(phone)}",
        )
        require(customer_count == "1", "重复电话转化生成了多条客户")
        audit_counts = database_value(
            database_url,
            "SELECT CONCAT_WS('|',"
            f"SUM(reason='TELEMARKETING_CONVERTED'),SUM(reason='CUSTOMER_TRANSFERRED')) "
            "FROM AuditEvent WHERE requestId IN "
            f"({','.join(sql_quote(value) for value in request_ids)})",
        )
        require(audit_counts == "1|2", f"转化或转移审计数量异常: {audit_counts}")
        print("电销转客户与客户双向转移链路验收通过")
    finally:
        identifiers = request_ids + user_ids + telemarketing_ids + customer_ids
        if identifiers:
            quoted = ",".join(sql_quote(value) for value in identifiers)
            database_value(
                database_url,
                f"DELETE FROM AuditEvent WHERE requestId IN ({quoted}) "
                f"OR actorId IN ({quoted}) OR entityId IN ({quoted})",
            )
        if telemarketing_ids:
            database_value(
                database_url,
                f"DELETE FROM TelemarketingList WHERE id IN ({','.join(sql_quote(value) for value in telemarketing_ids)})",
            )
        if customer_ids:
            database_value(
                database_url,
                f"DELETE FROM Customer WHERE id IN ({','.join(sql_quote(value) for value in customer_ids)})",
            )
        for user_id in reversed(user_ids):
            database_value(database_url, f"DELETE FROM User WHERE id={sql_quote(user_id)}")
        print("电销转化与客户转移 test 夹具已清理")
