from __future__ import annotations

import urllib.request

from quality.crm_http import json_body, marker_mobile, multipart_form, request, require
from quality.data_flows.customer_transfer_support import convert_request
from runtime.mysql_client import parse_database_url, run_mysql


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def database_value(database_url: str, sql: str) -> str:
    return run_mysql(parse_database_url(database_url), sql)


def create_record(
    opener: urllib.request.OpenerDirector,
    base_url: str,
    marker: str,
    suffix: str,
    phone: str,
    request_id: str,
) -> str:
    result = request(
        opener,
        base_url,
        "/api/telemarketing",
        method="POST",
        payload={
            "name": f"电销 CRUD-{marker}-{suffix}",
            "company": "CRM test verification",
            "phone": phone,
            "position": "测试岗位",
            "industry": "软件服务",
            "source": "自动验收",
            "notes": "创建电销记录",
        },
        request_id=request_id,
    )
    body = json_body(result)
    require(result.status == 201 and body.get("success") is True, f"创建电销记录失败: {body}")
    require(result.headers.get("x-request-id") == request_id, "创建电销记录响应缺少请求号")
    return str(body["data"]["id"])


def run_telemarketing_crud_flow(
    database_url: str,
    base_url: str,
    opener: urllib.request.OpenerDirector,
    marker: str,
) -> None:
    record_ids: list[str] = []
    customer_ids: list[str] = []
    request_ids: list[str] = []

    try:
        create_id = f"telemarketing-crud-create-{marker}"
        request_ids.append(create_id)
        record_id = create_record(opener, base_url, marker, "editable", marker_mobile("134", marker), create_id)
        record_ids.append(record_id)

        update_id = f"telemarketing-crud-update-{marker}"
        request_ids.append(update_id)
        updated = request(
            opener,
            base_url,
            f"/api/telemarketing?id={record_id}",
            method="PUT",
            payload={
                "name": f"电销已更新-{marker}",
                "company": "CRM updated verification",
                "phone": marker_mobile("134", marker),
                "position": "更新岗位",
                "industry": "企业服务",
                "source": "接口验收",
                "notes": "编辑字段已持久化",
                "status": "CONNECTED",
                "isEffective": True,
            },
            request_id=update_id,
        )
        updated_body = json_body(updated)
        require(updated.status == 200 and updated_body.get("success") is True, "更新电销记录失败")
        require(updated.headers.get("x-request-id") == update_id, "更新电销记录响应缺少请求号")
        updated_row = database_value(
            database_url,
            "SELECT CONCAT_WS('|',name,company,position,industry,source,notes,status,isEffective) "
            f"FROM TelemarketingList WHERE id={sql_quote(record_id)}",
        )
        require(
            updated_row == (
                f"电销已更新-{marker}|CRM updated verification|更新岗位|企业服务|接口验收|编辑字段已持久化|CONNECTED|1"
            ),
            f"电销编辑字段未持久化: {updated_row}",
        )

        delete_id = f"telemarketing-crud-delete-{marker}"
        request_ids.append(delete_id)
        deleted = request(
            opener,
            base_url,
            f"/api/telemarketing?id={record_id}",
            method="DELETE",
            request_id=delete_id,
        )
        require(deleted.status == 200 and json_body(deleted).get("success") is True, "删除电销记录失败")
        require(database_value(
            database_url,
            f"SELECT COUNT(*) FROM TelemarketingList WHERE id={sql_quote(record_id)}",
        ) == "0", "电销记录删除后仍存在")

        trace_create_id = f"telemarketing-trace-create-{marker}"
        request_ids.append(trace_create_id)
        landline_id = f"telemarketing-crud-landline-{marker}"
        request_ids.append(landline_id)
        landline_phone = f"010-{int(marker[:8], 16) % 10 ** 8:08d}"
        landline_record_id = create_record(opener, base_url, marker, "landline", landline_phone, landline_id)
        record_ids.append(landline_record_id)
        require(
            database_value(
                database_url,
                f"SELECT phone FROM TelemarketingList WHERE id={sql_quote(landline_record_id)}",
            ) == landline_phone,
            "座机号码未按原样保存",
        )
        deleted_landline = request(
            opener,
            base_url,
            f"/api/telemarketing?id={landline_record_id}",
            method="DELETE",
            request_id=f"telemarketing-crud-landline-delete-{marker}",
        )
        request_ids.append(f"telemarketing-crud-landline-delete-{marker}")
        require(deleted_landline.status == 200, "座机电销记录删除失败")

        trace_id = create_record(opener, base_url, marker, "converted", marker_mobile("135", marker), trace_create_id)
        record_ids.append(trace_id)
        convert_id = f"telemarketing-trace-convert-{marker}"
        request_ids.append(convert_id)
        converted = convert_request(opener, base_url, trace_id, convert_id)
        converted_body = json_body(converted)
        require(converted.status == 201 and converted_body.get("success") is True, "电销转客户失败")
        customer_id = str(converted_body["data"]["customer"]["id"])
        customer_ids.append(customer_id)
        require(
            database_value(
                database_url,
                f"SELECT salesId FROM Customer WHERE id={sql_quote(customer_id)}",
            ) == database_value(
                database_url,
                f"SELECT salesId FROM TelemarketingList WHERE id={sql_quote(trace_id)}",
            ),
            "转化客户未归属名单负责人",
        )

        import_id = f"telemarketing-import-{marker}"
        request_ids.append(import_id)
        admin_username = database_value(database_url, "SELECT username FROM User WHERE username='admin' LIMIT 1")
        admin_id = database_value(database_url, "SELECT id FROM User WHERE username='admin' LIMIT 1")
        import_phone_a = marker_mobile("150", marker)
        import_phone_b = marker_mobile("151", marker)
        csv_body, csv_type = multipart_form(
            {},
            "file",
            "telemarketing.csv",
            (
                "姓名,公司,电话,销售\n"
                f"导入甲-{marker},公司A,{import_phone_a},{admin_username}\n"
                f"导入乙-{marker},公司B,{import_phone_b},{admin_username}\n"
            ).encode("utf-8-sig"),
            "text/csv",
        )
        imported = request(
            opener,
            base_url,
            "/api/telemarketing/import",
            method="POST",
            body=csv_body,
            content_type=csv_type,
            request_id=import_id,
        )
        imported_body = json_body(imported)
        require(imported.status == 201 and imported_body.get("success") is True, f"电销导入失败: {imported_body}")
        imported_ids = [str(value) for value in imported_body["data"]["ids"]]
        require(len(imported_ids) == 2, f"电销导入条数不正确: {imported_ids}")
        record_ids.extend(imported_ids)
        assigned = database_value(
            database_url,
            "SELECT COUNT(*) FROM TelemarketingList WHERE id IN ("
            f"{','.join(sql_quote(value) for value in imported_ids)}) AND salesId={sql_quote(admin_id)}",
        )
        require(assigned == "2", "导入名单未落到指定销售")

        blocked_delete_id = f"telemarketing-trace-delete-{marker}"
        request_ids.append(blocked_delete_id)
        blocked = request(
            opener,
            base_url,
            f"/api/telemarketing?id={trace_id}",
            method="DELETE",
            request_id=blocked_delete_id,
        )
        blocked_body = json_body(blocked)
        require(blocked.status == 409 and blocked_body.get("code") == "CONVERTED_RECORD", "已转客户电销可被删除")
        require(blocked.headers.get("x-request-id") == blocked_delete_id, "拒绝删除响应缺少请求号")
        require(database_value(
            database_url,
            f"SELECT COUNT(*) FROM TelemarketingList WHERE id={sql_quote(trace_id)} AND customerId={sql_quote(customer_id)}",
        ) == "1", "拒绝删除后电销来源关系丢失")

        audit_counts = database_value(
            database_url,
            "SELECT CONCAT_WS('|',"
            "SUM(reason='TELEMARKETING_CREATED'),SUM(reason='TELEMARKETING_UPDATED'),"
            "SUM(reason='TELEMARKETING_DELETED'),SUM(reason='TELEMARKETING_CONVERTED'),"
            "SUM(reason='TELEMARKETING_IMPORTED')) "
            f"FROM AuditEvent WHERE requestId IN ({','.join(sql_quote(value) for value in request_ids)})",
        )
        require(audit_counts == "3|1|2|1|1", f"电销 CRUD 审计数量异常: {audit_counts}")
        print("电销新增、编辑、删除、导入与转化追溯验收通过")
    finally:
        identifiers = request_ids + record_ids + customer_ids
        if identifiers:
            quoted = ",".join(sql_quote(value) for value in identifiers)
            database_value(
                database_url,
                f"DELETE FROM AuditEvent WHERE requestId IN ({quoted}) OR entityId IN ({quoted})",
            )
        for record_id in record_ids:
            database_value(database_url, f"DELETE FROM TelemarketingList WHERE id={sql_quote(record_id)}")
        for customer_id in customer_ids:
            database_value(database_url, f"DELETE FROM Customer WHERE id={sql_quote(customer_id)}")
        print("电销 CRUD test 夹具已清理")
