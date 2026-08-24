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


def permission_codes(user: object) -> set[str]:
    require(isinstance(user, dict), "会话用户数据不正确")
    values = user.get("permissions")
    require(isinstance(values, list), "会话权限数据不正确")
    return {str(value) for value in values}


def main() -> int:
    if PROFILE != "test":
        print("拒绝执行：role-flow 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2

    database_url = os.environ.get("DATABASE_URL", "")
    marker = uuid4().hex[:12]
    opener = build_opener()
    login(opener, BASE_URL, USERNAME, PASSWORD)
    role_id: str | None = None
    user_id: str | None = None
    role_changed = False
    request_ids: list[str] = []
    original_display_name = ""
    original_description: str | None = None
    original_permission_ids: list[str] = []

    try:
        role_payload = json_body(request(opener, BASE_URL, "/api/roles?includePermissions=true"))
        role_rows = role_payload.get("data")
        available = role_payload.get("availablePermissions")
        require(isinstance(role_rows, list) and isinstance(available, list), "角色或权限列表响应不正确")
        role = next((row for row in role_rows if isinstance(row, dict) and row.get("name") == "sales"), None)
        require(isinstance(role, dict), "未找到普通销售角色")
        admin_role = next((row for row in role_rows if isinstance(row, dict) and row.get("name") == "admin"), None)
        require(isinstance(admin_role, dict), "未找到管理员角色")
        role_id = str(role["id"])
        original_display_name = str(role["displayName"])
        description_value = role.get("description")
        original_description = str(description_value) if description_value is not None else None
        permission_id_values = role.get("permissionIds")
        permission_code_values = role.get("permissions")
        require(isinstance(permission_id_values, list) and isinstance(permission_code_values, list), "角色权限数据不正确")
        original_permission_ids = [str(value) for value in permission_id_values]
        original_permission_codes = {str(value) for value in permission_code_values}
        added_permission = next(
            (
                row for row in available
                if isinstance(row, dict) and str(row.get("code")) not in original_permission_codes
            ),
            None,
        )
        require(isinstance(added_permission, dict), "没有可用于增量验收的权限")
        added_permission_id = str(added_permission["id"])
        added_permission_code = str(added_permission["code"])

        admin_permission_values = admin_role.get("permissionIds")
        require(isinstance(admin_permission_values, list) and len(admin_permission_values) > 1, "管理员权限数据不正确")
        admin_guard_request_id = f"role-flow-admin-guard-{marker}"
        request_ids.append(admin_guard_request_id)
        admin_guard_result = request(
            opener,
            BASE_URL,
            f"/api/roles/{admin_role['id']}",
            method="PATCH",
            payload={"permissionIds": [str(value) for value in admin_permission_values[:-1]]},
            request_id=admin_guard_request_id,
        )
        require(admin_guard_result.status == 400, "管理员角色允许移除权限")
        require(admin_guard_result.headers.get("x-request-id") == admin_guard_request_id, "管理员保护响应缺少 x-request-id")

        username = f"role_flow_{marker}"
        raw_password = f"Role-{marker}!"
        create_request_id = f"role-flow-user-{marker}"
        request_ids.append(create_request_id)
        created_result = request(
            opener,
            BASE_URL,
            "/api/users",
            method="POST",
            payload={
                "username": username,
                "email": f"role-flow-{marker}@example.com",
                "password": raw_password,
                "realName": f"角色验收用户-{marker}",
                "roleIds": [role_id],
            },
            request_id=create_request_id,
        )
        created = json_body(created_result)
        require(created_result.status == 201 and created.get("success") is True, f"创建角色验收用户失败: {created}")
        created_user = created.get("data")
        require(isinstance(created_user, dict), "创建角色验收用户响应不正确")
        user_id = str(created_user["id"])

        user_opener = build_opener()
        initial_user = login(user_opener, BASE_URL, username, raw_password)
        require(added_permission_code not in permission_codes(initial_user), "测试权限原本已存在于用户会话")
        forbidden_request_id = f"role-flow-forbidden-{marker}"
        request_ids.append(forbidden_request_id)
        forbidden_result = request(
            user_opener,
            BASE_URL,
            f"/api/roles/{role_id}",
            method="PATCH",
            payload={"displayName": original_display_name},
            request_id=forbidden_request_id,
        )
        require(forbidden_result.status == 403, "普通销售可以绕过页面修改角色")
        require(forbidden_result.headers.get("x-request-id") == forbidden_request_id, "越权响应缺少 x-request-id")

        update_request_id = f"role-flow-update-{marker}"
        request_ids.append(update_request_id)
        updated_result = request(
            opener,
            BASE_URL,
            f"/api/roles/{role_id}",
            method="PATCH",
            payload={
                "displayName": f"{original_display_name}-验收",
                "description": original_description,
                "permissionIds": [*original_permission_ids, added_permission_id],
            },
            request_id=update_request_id,
        )
        updated = json_body(updated_result)
        require(updated.get("success") is True, f"角色更新失败: {updated}")
        require(updated_result.headers.get("x-request-id") == update_request_id, "角色更新响应缺少 x-request-id")
        role_changed = True

        existing_session = json_body(request(user_opener, BASE_URL, "/api/auth/session"))
        require(
            added_permission_code not in permission_codes(existing_session.get("user")),
            "旧会话在未重新登录时获得了新增权限",
        )
        refreshed_user = login(build_opener(), BASE_URL, username, raw_password)
        require(added_permission_code in permission_codes(refreshed_user), "重新登录后未获得新增权限")
        audit_count = database_value(
            database_url,
            f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(update_request_id)} AND action='ROLE_UPDATED'",
        )
        require(audit_count == "1", "角色更新审计事件缺失")
        rejected_audit_count = database_value(
            database_url,
            "SELECT COUNT(*) FROM AuditEvent WHERE requestId IN "
            f"({sql_quote(admin_guard_request_id)},{sql_quote(forbidden_request_id)})",
        )
        require(rejected_audit_count == "0", "被拒绝的角色修改产生了审计成功记录")

        restore_request_id = f"role-flow-restore-{marker}"
        request_ids.append(restore_request_id)
        restored_result = request(
            opener,
            BASE_URL,
            f"/api/roles/{role_id}",
            method="PATCH",
            payload={
                "displayName": original_display_name,
                "description": original_description,
                "permissionIds": original_permission_ids,
            },
            request_id=restore_request_id,
        )
        require(json_body(restored_result).get("success") is True, "角色原值恢复失败")
        role_changed = False
        restored_count = database_value(
            database_url,
            f"SELECT COUNT(*) FROM RolePermission WHERE roleId={sql_quote(role_id)}",
        )
        require(restored_count == str(len(original_permission_ids)), "角色权限数量未恢复")
        print("角色权限与重新登录生效链路验收通过")
        return 0
    finally:
        if role_changed and role_id:
            restore_request_id = f"role-flow-finally-restore-{marker}"
            request_ids.append(restore_request_id)
            result = request(
                opener,
                BASE_URL,
                f"/api/roles/{role_id}",
                method="PATCH",
                payload={
                    "displayName": original_display_name,
                    "description": original_description,
                    "permissionIds": original_permission_ids,
                },
                request_id=restore_request_id,
            )
            require(json_body(result).get("success") is True, "异常路径角色恢复失败")
        if request_ids:
            database_value(
                database_url,
                f"DELETE FROM AuditEvent WHERE requestId IN ({','.join(sql_quote(value) for value in request_ids)})",
            )
        if user_id:
            database_value(database_url, f"DELETE FROM AuditEvent WHERE entityId={sql_quote(user_id)}")
            database_value(database_url, f"DELETE FROM User WHERE id={sql_quote(user_id)}")
            require(database_value(database_url, f"SELECT COUNT(*) FROM User WHERE id={sql_quote(user_id)}") == "0", "角色验收用户清理失败")
        print("role-flow test 夹具已清理")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"角色管理数据链路验收失败: {error}", file=sys.stderr)
        raise SystemExit(1)
