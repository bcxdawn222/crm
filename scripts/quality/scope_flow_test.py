from __future__ import annotations

import os
import sys
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


def database_value(database_url: str, sql: str) -> str:
    return run_mysql(parse_database_url(database_url), sql)


def main() -> int:
    if PROFILE != "test":
        print("拒绝执行：scope-flow 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2

    database_url = os.environ.get("DATABASE_URL", "")
    marker = uuid4().hex[:12]
    role_id = str(uuid4())
    role_permission_id = str(uuid4())
    opener = build_opener()
    admin_user_id: str | None = None
    restricted_user_id: str | None = None
    customer_id: str | None = None
    request_ids: list[str] = []

    try:
        login(opener, BASE_URL, USERNAME, PASSWORD)
        permission_id = database_value(
            database_url,
            "SELECT id FROM Permission WHERE code='customer:view'",
        )
        require(bool(permission_id), "未找到 customer:view 权限")
        role_name = f"scope_quality_{marker}"
        database_value(
            database_url,
            "INSERT INTO Role (id, name, displayName, description, createdAt, updatedAt) VALUES "
            f"({sql_quote(role_id)}, {sql_quote(role_name)}, '范围验收受限角色', '仅用于 test 数据范围验收', NOW(3), NOW(3))",
        )
        database_value(
            database_url,
            "INSERT INTO RolePermission (id, roleId, permissionId, createdAt) VALUES "
            f"({sql_quote(role_permission_id)}, {sql_quote(role_id)}, {sql_quote(permission_id)}, NOW(3))",
        )

        user_request_id = f"scope-flow-user-{marker}"
        request_ids.append(user_request_id)
        password = f"Scope-{marker}!"
        user_result = request(
            opener,
            BASE_URL,
            "/api/users",
            method="POST",
            payload={
                "username": f"scope_flow_{marker}",
                "email": f"scope-flow-{marker}@example.com",
                "password": password,
                "realName": f"范围验收用户-{marker}",
                "roleIds": [role_id],
            },
            request_id=user_request_id,
        )
        created_user = json_body(user_result)
        require(user_result.status == 201 and created_user.get("success") is True, f"受限用户创建失败: {created_user}")
        restricted_user_id = str(created_user["data"]["id"])

        customer_request_id = f"scope-flow-customer-{marker}"
        request_ids.append(customer_request_id)
        customer_result = request(
            opener,
            BASE_URL,
            "/api/customers",
            method="POST",
            payload={
                "name": f"范围隔离客户-{marker}",
                "phone": f"137{marker[:8]}",
                "source": "OTHER",
                "notes": "仅用于 test 数据范围验收",
            },
            request_id=customer_request_id,
        )
        created_customer = json_body(customer_result)
        require(customer_result.status == 200 and created_customer.get("success") is True, f"范围验收客户创建失败: {created_customer}")
        customer_id = str(created_customer["data"]["id"])
        admin_user_id = str(created_customer["data"]["salesId"])

        restricted_opener = build_opener()
        login(restricted_opener, BASE_URL, f"scope_flow_{marker}", password)
        list_result = request(restricted_opener, BASE_URL, "/api/customers?page=1&pageSize=20")
        listed = json_body(list_result)
        require(list_result.status == 200 and listed.get("success") is True, f"受限用户客户列表读取失败: {listed}")
        rows = listed.get("data", {}).get("list") if isinstance(listed.get("data"), dict) else None
        require(isinstance(rows, list) and all(row.get("id") != customer_id for row in rows if isinstance(row, dict)), "受限用户可以看到范围外客户")

        detail_result = request(restricted_opener, BASE_URL, f"/api/customers/{customer_id}")
        require(detail_result.status == 403, "受限用户可以通过详情 API 读取范围外客户")
        print("受限角色客户列表与详情数据范围验收通过")
        return 0
    finally:
        if request_ids:
            database_value(
                database_url,
                f"DELETE FROM AuditEvent WHERE requestId IN ({','.join(sql_quote(value) for value in request_ids)})",
            )
        if customer_id:
            database_value(database_url, f"DELETE FROM AuditEvent WHERE entityId={sql_quote(customer_id)}")
            database_value(database_url, f"DELETE FROM Customer WHERE id={sql_quote(customer_id)}")
        if restricted_user_id:
            database_value(database_url, f"DELETE FROM AuditEvent WHERE entityId={sql_quote(restricted_user_id)}")
            database_value(database_url, f"DELETE FROM User WHERE id={sql_quote(restricted_user_id)}")
        database_value(database_url, f"DELETE FROM RolePermission WHERE id={sql_quote(role_permission_id)}")
        database_value(database_url, f"DELETE FROM Role WHERE id={sql_quote(role_id)}")
        if customer_id or restricted_user_id:
            remaining = database_value(
                database_url,
                f"SELECT (SELECT COUNT(*) FROM Customer WHERE id={sql_quote(customer_id or '')}) "
                f"+ (SELECT COUNT(*) FROM User WHERE id={sql_quote(restricted_user_id or '')})",
            )
            require(remaining == "0", "数据范围验收夹具清理失败")
        print("scope-flow test 夹具已清理")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"数据范围验收失败: {error}", file=sys.stderr)
        raise SystemExit(1)
