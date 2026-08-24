from __future__ import annotations

import urllib.request
from typing import TypedDict

from quality.crm_http import HttpResult, json_body, request, require
from runtime.mysql_client import parse_database_url, run_mysql


class UserPayload(TypedDict):
    username: str
    email: str
    password: str
    realName: str
    department: str
    position: str
    managerId: str | None
    roleIds: list[str]


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def database_value(database_url: str, sql: str) -> str:
    return run_mysql(parse_database_url(database_url), sql)


def create_user(
    opener: urllib.request.OpenerDirector,
    base_url: str,
    payload: UserPayload,
    request_id: str,
) -> str:
    result = request(
        opener,
        base_url,
        "/api/users",
        method="POST",
        payload=payload,
        request_id=request_id,
    )
    body = json_body(result)
    require(result.status == 201 and body.get("success") is True, f"创建测试用户失败: {body}")
    return str(body["data"]["id"])


def create_telemarketing(
    opener: urllib.request.OpenerDirector,
    base_url: str,
    marker: str,
    phone: str,
    suffix: str,
) -> str:
    result = request(
        opener,
        base_url,
        "/api/telemarketing",
        method="POST",
        payload={
            "name": f"电销转化客户-{marker}-{suffix}",
            "company": "CRM test verification",
            "phone": phone,
            "industry": "软件服务",
            "notes": f"telemarketing-transfer-{marker}",
        },
    )
    body = json_body(result)
    require(result.status in {200, 201} and body.get("success") is True, f"创建电销记录失败: {body}")
    return str(body["data"]["id"])


def convert_request(
    opener: urllib.request.OpenerDirector,
    base_url: str,
    telemarketing_id: str,
    request_id: str,
) -> HttpResult:
    return request(
        opener,
        base_url,
        "/api/telemarketing/convert",
        method="POST",
        payload={
            "telemarketingId": telemarketing_id,
            "level": "POTENTIAL",
            "source": "COLD_CALL",
            "notes": "仅用于 test 电销转化验收",
        },
        request_id=request_id,
    )
