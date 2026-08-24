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
        print("拒绝执行：user-flow 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2

    database_url = os.environ.get("DATABASE_URL", "")
    marker = uuid4().hex[:12]
    username = f"user_flow_{marker}"
    email = f"user-flow-{marker}@example.com"
    raw_password = f"Flow-{marker}!"
    opener = build_opener()
    admin = login(opener, BASE_URL, USERNAME, PASSWORD)
    admin_id = str(admin["id"])
    user_id: str | None = None
    request_ids: list[str] = []

    try:
        roles = json_body(request(opener, BASE_URL, "/api/roles"))
        role_rows = roles.get("data")
        require(isinstance(role_rows, list) and len(role_rows) >= 2, "角色列表不足，无法执行用户验收")
        assignable_roles = [row for row in role_rows if isinstance(row, dict) and row.get("name") != "admin"]
        require(len(assignable_roles) >= 2, "至少需要两个非管理员角色")
        first_role_id = str(assignable_roles[0]["id"])
        second_role_id = str(assignable_roles[1]["id"])

        create_request_id = f"user-flow-create-{marker}"
        request_ids.append(create_request_id)
        create_payload = {
            "username": username,
            "email": email,
            "password": raw_password,
            "realName": f"验收用户-{marker}",
            "phone": "13900000000",
            "department": "测试部门",
            "position": "测试专员",
            "managerId": admin_id,
            "roleIds": [first_role_id],
        }
        created_result = request(
            opener,
            BASE_URL,
            "/api/users",
            method="POST",
            payload=create_payload,
            request_id=create_request_id,
        )
        created = json_body(created_result)
        require(created_result.status == 201 and created.get("success") is True, f"创建用户失败: {created}")
        require(created_result.headers.get("x-request-id") == create_request_id, "创建用户响应缺少 x-request-id")
        created_user = created.get("data")
        require(isinstance(created_user, dict), "创建用户响应缺少数据")
        require("password" not in created_user, "创建用户响应泄露密码字段")
        user_id = str(created_user["id"])

        duplicate_request_id = f"user-flow-duplicate-{marker}"
        duplicate_result = request(
            opener,
            BASE_URL,
            "/api/users",
            method="POST",
            payload=create_payload,
            request_id=duplicate_request_id,
        )
        duplicate = json_body(duplicate_result)
        require(duplicate_result.status == 409, f"重复用户未返回 409: {duplicate}")
        require(duplicate_result.headers.get("x-request-id") == duplicate_request_id, "重复用户响应缺少 x-request-id")
        require(
            database_value(database_url, f"SELECT COUNT(*) FROM User WHERE username={sql_quote(username)}") == "1",
            "重复创建生成了额外用户",
        )

        update_request_id = f"user-flow-update-{marker}"
        request_ids.append(update_request_id)
        updated_result = request(
            opener,
            BASE_URL,
            f"/api/users/{user_id}",
            method="PATCH",
            payload={"realName": f"已更新-{marker}", "department": "销售一部", "roleIds": [second_role_id]},
            request_id=update_request_id,
        )
        updated = json_body(updated_result)
        require(updated.get("success") is True, f"更新用户失败: {updated}")
        require(updated_result.headers.get("x-request-id") == update_request_id, "更新用户响应缺少 x-request-id")

        disable_request_id = f"user-flow-disable-{marker}"
        request_ids.append(disable_request_id)
        disabled_result = request(
            opener,
            BASE_URL,
            f"/api/users/{user_id}",
            method="PATCH",
            payload={"status": "INACTIVE"},
            request_id=disable_request_id,
        )
        disabled = json_body(disabled_result)
        require(disabled.get("success") is True, f"停用用户失败: {disabled}")
        require(disabled_result.headers.get("x-request-id") == disable_request_id, "停用用户响应缺少 x-request-id")

        listed = json_body(request(opener, BASE_URL, "/api/users?includeInactive=true"))
        listed_rows = listed.get("data")
        require(isinstance(listed_rows, list), "用户列表响应不正确")
        listed_user = next((row for row in listed_rows if isinstance(row, dict) and row.get("id") == user_id), None)
        require(isinstance(listed_user, dict), "用户列表未返回已停用用户")
        require("password" not in listed_user, "用户列表泄露密码字段")
        require(listed_user.get("status") == "INACTIVE", "用户列表状态未同步")

        user_row = database_value(
            database_url,
            f"SELECT status,(password={sql_quote(raw_password)}) FROM User WHERE id={sql_quote(user_id)}",
        )
        require(user_row == "INACTIVE\t0", f"用户状态或密码存储异常: {user_row}")
        role_row = database_value(
            database_url,
            f"SELECT roleId FROM UserRole WHERE userId={sql_quote(user_id)}",
        )
        require(role_row == second_role_id, f"用户角色替换失败: {role_row}")
        audit_actions = database_value(
            database_url,
            "SELECT GROUP_CONCAT(action ORDER BY action SEPARATOR ',') FROM AuditEvent WHERE requestId IN "
            f"({','.join(sql_quote(value) for value in request_ids)})",
        )
        require(audit_actions == "USER_CREATED,USER_DISABLED,USER_UPDATED", f"用户审计动作异常: {audit_actions}")
        print("用户管理数据链路验收通过")
        return 0
    finally:
        if user_id:
            database_value(database_url, f"DELETE FROM AuditEvent WHERE entityId={sql_quote(user_id)}")
            database_value(database_url, f"DELETE FROM User WHERE id={sql_quote(user_id)}")
            require(database_value(database_url, f"SELECT COUNT(*) FROM User WHERE id={sql_quote(user_id)}") == "0", "用户夹具清理失败")
        print("user-flow test 夹具已清理")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"用户管理数据链路验收失败: {error}", file=sys.stderr)
        raise SystemExit(1)
