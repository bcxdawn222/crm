from __future__ import annotations

import os
import sys
from dataclasses import dataclass
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
SETTING_KEYS = ("systemName", "companyName")


@dataclass(frozen=True)
class StoredSetting:
    id: str
    key: str
    value_hex: str
    updated_by: str | None
    created_at: str
    updated_at: str


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def database_value(database_url: str, sql: str) -> str:
    return run_mysql(parse_database_url(database_url), sql)


def read_original_settings(database_url: str) -> list[StoredSetting]:
    rows = database_value(
        database_url,
        "SELECT CONCAT_WS('\\t', id, `key`, HEX(value), IFNULL(updatedBy, '__NULL__'), "
        "DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s.%f'), DATE_FORMAT(updatedAt, '%Y-%m-%d %H:%i:%s.%f')) "
        "FROM SystemSetting WHERE `key` IN ('systemName','companyName') ORDER BY `key`",
    )
    if not rows:
        return []
    settings: list[StoredSetting] = []
    for row in rows.splitlines():
        parts = row.split("\t")
        require(len(parts) == 6, "系统设置原始数据格式不正确")
        settings.append(
            StoredSetting(
                id=parts[0],
                key=parts[1],
                value_hex=parts[2],
                updated_by=None if parts[3] == "__NULL__" else parts[3],
                created_at=parts[4],
                updated_at=parts[5],
            )
        )
    return settings


def restore_settings(database_url: str, original: list[StoredSetting]) -> None:
    database_value(database_url, "DELETE FROM SystemSetting WHERE `key` IN ('systemName','companyName')")
    for setting in original:
        updated_by = "NULL" if setting.updated_by is None else sql_quote(setting.updated_by)
        database_value(
            database_url,
            "INSERT INTO SystemSetting (id, `key`, value, updatedBy, createdAt, updatedAt) VALUES "
            f"({sql_quote(setting.id)}, {sql_quote(setting.key)}, CONVERT(0x{setting.value_hex} USING utf8mb4), "
            f"{updated_by}, {sql_quote(setting.created_at)}, {sql_quote(setting.updated_at)})",
        )


def main() -> int:
    if PROFILE != "test":
        print("拒绝执行：settings-flow 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2

    database_url = os.environ.get("DATABASE_URL", "")
    marker = uuid4().hex[:12]
    original = read_original_settings(database_url)
    request_ids: list[str] = []
    opener = build_opener()

    try:
        unauthenticated = request(build_opener(), BASE_URL, "/api/settings")
        unauthenticated_payload = json_body(unauthenticated)
        require(
            unauthenticated.status == 401
            and isinstance(unauthenticated_payload.get("requestId"), str),
            "未登录 API 没有返回带 requestId 的 401",
        )
        login(opener, BASE_URL, USERNAME, PASSWORD)
        initial_result = request(opener, BASE_URL, "/api/settings")
        initial = json_body(initial_result)
        require(initial_result.status == 200 and initial.get("success") is True, "读取系统设置失败")
        require(isinstance(initial.get("data"), dict), "系统设置响应不正确")

        rejected_request_id = f"settings-flow-rejected-{marker}"
        request_ids.append(rejected_request_id)
        rejected_result = request(
            opener,
            BASE_URL,
            "/api/settings",
            method="PUT",
            payload={
                "systemName": f"CRM验收-{marker}",
                "companyName": f"验收公司-{marker}",
                "databasePassword": "不允许保存",
            },
            request_id=rejected_request_id,
        )
        require(rejected_result.status == 400, "系统设置接受了非白名单字段")

        update_request_id = f"settings-flow-update-{marker}"
        request_ids.append(update_request_id)
        expected = {
            "systemName": f"CRM验收-{marker}",
            "companyName": f"验收公司-{marker}",
        }
        update_result = request(
            opener,
            BASE_URL,
            "/api/settings",
            method="PUT",
            payload=expected,
            request_id=update_request_id,
        )
        updated = json_body(update_result)
        require(update_result.status == 200 and updated.get("data") == expected, "系统设置更新失败")
        require(update_result.headers.get("x-request-id") == update_request_id, "设置更新响应缺少 x-request-id")
        reloaded = json_body(request(opener, BASE_URL, "/api/settings"))
        require(reloaded.get("data") == expected, "系统设置重新读取后不一致")

        for key in SETTING_KEYS:
            stored_hex = database_value(
                database_url,
                f"SELECT HEX(value) FROM SystemSetting WHERE `key`={sql_quote(key)}",
            )
            require(bytes.fromhex(stored_hex).decode("utf-8") == expected[key], f"{key} 数据库值不正确")
        audit_count = database_value(
            database_url,
            f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(update_request_id)} "
            "AND action='SETTINGS_UPDATED' AND entityType='SystemSetting'",
        )
        require(audit_count == "1", "系统设置更新审计缺失")
        rejected_audit_count = database_value(
            database_url,
            f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(rejected_request_id)}",
        )
        require(rejected_audit_count == "0", "被拒绝的设置请求产生了成功审计")
        print("系统设置持久化与审计链路验收通过")
        return 0
    finally:
        if request_ids:
            database_value(
                database_url,
                f"DELETE FROM AuditEvent WHERE requestId IN ({','.join(sql_quote(value) for value in request_ids)})",
            )
        restore_settings(database_url, original)
        require(read_original_settings(database_url) == original, "系统设置原始数据恢复失败")
        print("settings-flow test 夹具已清理")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"系统设置数据链路验收失败: {error}", file=sys.stderr)
        raise SystemExit(1)
