from __future__ import annotations

import datetime as dt
import urllib.request
from dataclasses import dataclass, field

from quality.crm_http import HttpResult, json_body, multipart_file, request, require
from quality.data_flows.import_concurrency import verify_concurrent_import
from runtime.mysql_client import parse_database_url, run_mysql


@dataclass
class FlowState:
    database_url: str
    base_url: str
    opener: urllib.request.OpenerDirector
    marker: str
    customer_ids: list[str] = field(default_factory=list)
    request_ids: list[str] = field(default_factory=list)


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def database_value(database_url: str, sql: str) -> str:
    return run_mysql(parse_database_url(database_url), sql)


def import_request(state: FlowState, content: str, file_name: str, request_id: str) -> HttpResult:
    body, content_type = multipart_file(
        "file",
        file_name,
        content.encode("utf-8-sig"),
        "text/csv",
    )
    state.request_ids.append(request_id)
    return request(
        state.opener,
        state.base_url,
        "/api/customers/import",
        method="POST",
        body=body,
        content_type=content_type,
        request_id=request_id,
    )


def customer_ids_by_marker(state: FlowState) -> list[str]:
    rows = database_value(
        state.database_url,
        "SELECT id FROM Customer WHERE notes=" + sql_quote(f"data-flow-extension-{state.marker}"),
    )
    return [row for row in rows.splitlines() if row]


def verify_import(state: FlowState) -> None:
    csv_content = (
        "姓名,公司,电话,邮箱,分类,来源,备注\n"
        f"导入客户甲-{state.marker},测试公司,137{state.marker[:8]},import-a-{state.marker}@example.com,潜在客户,网站,data-flow-extension-{state.marker}\n"
        f"导入客户乙-{state.marker},测试公司,138{state.marker[:8]},import-b-{state.marker}@example.com,普通客户,转介绍,data-flow-extension-{state.marker}\n"
    )
    success_request_id = f"data-flow-import-{state.marker}"
    success_result = import_request(state, csv_content, "customers.csv", success_request_id)
    success = json_body(success_result)
    require(success_result.status == 201 and success.get("success") is True, f"客户导入失败: {success}")
    require(success.get("data", {}).get("count") == 2, "客户导入数量不正确")
    require(success_result.headers.get("x-request-id") == success_request_id, "导入响应缺少 x-request-id")

    imported_ids = customer_ids_by_marker(state)
    require(len(imported_ids) == 2, "数据库中的导入客户数量不正确")
    state.customer_ids.extend(imported_ids)
    audit_count = database_value(
        state.database_url,
        f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(success_request_id)} "
        "AND action='IMPORT' AND entityType='CustomerImport'",
    )
    require(audit_count == "1", "客户导入审计缺失")

    repeat_request_id = f"data-flow-import-repeat-{state.marker}"
    repeat_result = import_request(state, csv_content, "customers.csv", repeat_request_id)
    require(repeat_result.status == 409, "重复导入没有被拒绝")
    repeat_body = json_body(repeat_result)
    require(repeat_body.get("requestId") == repeat_request_id, "重复导入错误体缺少 requestId")
    require(repeat_result.headers.get("x-request-id") == repeat_request_id, "重复导入响应缺少 x-request-id")
    require(len(customer_ids_by_marker(state)) == 2, "重复导入生成了重复客户")
    repeat_audit = database_value(
        state.database_url,
        f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(repeat_request_id)}",
    )
    require(repeat_audit == "0", "被拒绝的重复导入产生了成功审计")

    invalid_note = f"invalid-import-{state.marker}"
    invalid_csv = (
        "姓名,电话,备注\n"
        f"合法但应回滚-{state.marker},136{state.marker[:8]},{invalid_note}\n"
        f"缺电话客户-{state.marker},,{invalid_note}\n"
    )
    invalid_request_id = f"data-flow-import-invalid-{state.marker}"
    invalid_result = import_request(state, invalid_csv, "invalid.csv", invalid_request_id)
    require(invalid_result.status == 400, "包含非法行的导入没有整批拒绝")
    invalid_body = json_body(invalid_result)
    require(invalid_body.get("requestId") == invalid_request_id, "非法导入错误体缺少 requestId")
    require(invalid_result.headers.get("x-request-id") == invalid_request_id, "非法导入响应缺少 x-request-id")
    partial_count = database_value(
        state.database_url,
        f"SELECT COUNT(*) FROM Customer WHERE notes={sql_quote(invalid_note)}",
    )
    require(partial_count == "0", "失败导入留下了半批客户数据")


def verify_cooperating_update(state: FlowState) -> None:
    create_request_id = f"data-flow-coop-create-{state.marker}"
    state.request_ids.append(create_request_id)
    create_result = request(
        state.opener,
        state.base_url,
        "/api/customers",
        method="POST",
        payload={
            "name": f"合作客户-{state.marker}",
            "company": "合作验收公司",
            "phone": f"135{state.marker[:8]}",
            "email": f"coop-{state.marker}@example.com",
            "category": "重要客户",
            "source": "OTHER",
            "notes": f"data-flow-extension-{state.marker}",
        },
        request_id=create_request_id,
    )
    created = json_body(create_result)
    require(create_result.status == 200 and created.get("success") is True, f"合作客户夹具创建失败: {created}")
    customer_id = str(created["data"]["id"])
    state.customer_ids.append(customer_id)

    today = dt.date.today()
    mark_request_id = f"data-flow-coop-mark-{state.marker}"
    state.request_ids.append(mark_request_id)
    mark_result = request(
        state.opener,
        state.base_url,
        "/api/customers/cooperating",
        method="POST",
        payload={
            "customerId": customer_id,
            "contractStartDate": today.isoformat(),
            "contractEndDate": (today + dt.timedelta(days=365)).isoformat(),
            "contractAmount": 12000,
        },
        request_id=mark_request_id,
    )
    require(mark_result.status == 200 and json_body(mark_result).get("success") is True, "标记合作客户失败")
    duplicate_mark_request_id = f"data-flow-coop-mark-repeat-{state.marker}"
    state.request_ids.append(duplicate_mark_request_id)
    duplicate_mark = request(
        state.opener,
        state.base_url,
        "/api/customers/cooperating",
        method="POST",
        payload={"customerId": customer_id},
        request_id=duplicate_mark_request_id,
    )
    require(duplicate_mark.status == 409, "重复标记合作客户没有被拒绝")

    update_request_id = f"data-flow-coop-update-{state.marker}"
    state.request_ids.append(update_request_id)
    update_result = request(
        state.opener,
        state.base_url,
        f"/api/customers/cooperating?id={customer_id}",
        method="PUT",
        payload={
            "contractAmount": 13500.5,
            "renewalReminderDays": 45,
            "lastVisitAt": today.isoformat(),
            "nextVisitAt": (today + dt.timedelta(days=14)).isoformat(),
            "visitFrequency": "MONTHLY",
            "cooperationNotes": f"合作信息验收-{state.marker}",
        },
        request_id=update_request_id,
    )
    updated = json_body(update_result)
    require(update_result.status == 200 and updated.get("success") is True, f"合作客户更新失败: {updated}")
    require(update_result.headers.get("x-request-id") == update_request_id, "合作客户更新缺少 x-request-id")

    listing = json_body(request(
        state.opener,
        state.base_url,
        f"/api/customers/cooperating?keyword={state.marker}&page=1&pageSize=10",
    ))
    listed_ids = [str(item["id"]) for item in listing.get("data", {}).get("list", [])]
    require(customer_id in listed_ids, "合作客户更新后无法从列表重新读取")
    stored = database_value(
        state.database_url,
        "SELECT status, contractAmount, renewalReminderDays, visitFrequency, cooperationNotes "
        f"FROM Customer WHERE id={sql_quote(customer_id)}",
    )
    require(
        stored == f"COOPERATING\t13500.50\t45\tMONTHLY\t合作信息验收-{state.marker}",
        f"合作客户数据库值不正确: {stored}",
    )
    audit_count = database_value(
        state.database_url,
        f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(update_request_id)} "
        "AND reason='COOPERATING_CUSTOMER_UPDATED'",
    )
    require(audit_count == "1", "合作客户更新审计缺失")

    rejected_request_id = f"data-flow-coop-invalid-{state.marker}"
    state.request_ids.append(rejected_request_id)
    rejected = request(
        state.opener,
        state.base_url,
        f"/api/customers/cooperating?id={customer_id}",
        method="PUT",
        payload={
            "contractEndDate": (today - dt.timedelta(days=1)).isoformat(),
        },
        request_id=rejected_request_id,
    )
    require(rejected.status == 400, "非法合同日期没有被拒绝")
    require(rejected.headers.get("x-request-id") == rejected_request_id, "非法合作客户更新缺少 x-request-id")
    rejected_audit = database_value(
        state.database_url,
        f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(rejected_request_id)}",
    )
    require(rejected_audit == "0", "被拒绝的合作客户更新产生了成功审计")


def cleanup(state: FlowState) -> None:
    if state.request_ids:
        database_value(
            state.database_url,
            "DELETE FROM AuditEvent WHERE requestId IN "
            f"({','.join(sql_quote(value) for value in state.request_ids)})",
        )
    if state.customer_ids:
        database_value(
            state.database_url,
            "DELETE FROM Customer WHERE id IN "
            f"({','.join(sql_quote(value) for value in state.customer_ids)})",
        )
    database_value(
        state.database_url,
        f"DELETE FROM Customer WHERE notes IN ({sql_quote(f'data-flow-extension-{state.marker}')},"
        f"{sql_quote(f'invalid-import-{state.marker}')},"
        f"{sql_quote(f'concurrent-import-{state.marker}')})",
    )
    residual = database_value(
        state.database_url,
        f"SELECT COUNT(*) FROM Customer WHERE notes IN ({sql_quote(f'data-flow-extension-{state.marker}')},"
        f"{sql_quote(f'invalid-import-{state.marker}')},"
        f"{sql_quote(f'concurrent-import-{state.marker}')})",
    )
    require(residual == "0", "客户扩展流程夹具清理不完整")


def run_customer_extension_flow(
    database_url: str,
    base_url: str,
    opener: urllib.request.OpenerDirector,
    marker: str,
    username: str,
    password: str,
) -> None:
    state = FlowState(database_url, base_url, opener, marker)
    try:
        verify_import(state)
        verify_concurrent_import(
            database_url,
            base_url,
            marker,
            username,
            password,
            state.customer_ids,
            state.request_ids,
        )
        verify_cooperating_update(state)
        print("客户导入与合作客户更新链路验收通过")
    finally:
        cleanup(state)
        print("客户导入与合作客户更新夹具已清理")
