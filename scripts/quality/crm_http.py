from __future__ import annotations

import http.cookiejar
import json
import secrets
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Mapping


@dataclass(frozen=True)
class HttpResult:
    status: int
    headers: Mapping[str, str]
    body: bytes


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req: Any, fp: Any, code: int, msg: str, headers: Any, newurl: str):
        return None


def build_opener() -> urllib.request.OpenerDirector:
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),
        NoRedirectHandler(),
    )


def multipart_file(
    field_name: str,
    file_name: str,
    content: bytes,
    content_type: str,
) -> tuple[bytes, str]:
    boundary = f"----crm-flow-{secrets.token_hex(12)}"
    body = b"\r\n".join(
        (
            f"--{boundary}".encode("ascii"),
            (
                f'Content-Disposition: form-data; name="{field_name}"; '
                f'filename="{file_name}"'
            ).encode("utf-8"),
            f"Content-Type: {content_type}".encode("ascii"),
            b"",
            content,
            f"--{boundary}--".encode("ascii"),
            b"",
        )
    )
    return body, f"multipart/form-data; boundary={boundary}"


def request(
    opener: urllib.request.OpenerDirector,
    base_url: str,
    path: str,
    *,
    method: str = "GET",
    payload: object | None = None,
    form: Mapping[str, str] | None = None,
    body: bytes | None = None,
    content_type: str | None = None,
    request_id: str | None = None,
) -> HttpResult:
    headers: dict[str, str] = {}
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        content_type = "application/json"
    elif form is not None:
        body = urllib.parse.urlencode(form).encode("utf-8")
        content_type = "application/x-www-form-urlencoded"
    if content_type:
        headers["Content-Type"] = content_type
    if request_id:
        headers["x-request-id"] = request_id
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}{path}", data=body, method=method, headers=headers
    )
    try:
        with opener.open(req, timeout=30) as response:
            return HttpResult(response.status, response.headers, response.read())
    except urllib.error.HTTPError as error:
        return HttpResult(error.code, error.headers, error.read())


def json_body(result: HttpResult) -> dict[str, Any]:
    payload = json.loads(result.body.decode("utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("接口响应不是 JSON 对象")
    return payload


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def login(
    opener: urllib.request.OpenerDirector,
    base_url: str,
    username: str,
    password: str,
) -> dict[str, Any]:
    csrf = json_body(request(opener, base_url, "/api/auth/csrf"))
    token = csrf.get("csrfToken")
    require(isinstance(token, str) and bool(token), "CSRF token 获取失败")
    result = request(
        opener,
        base_url,
        "/api/auth/callback/credentials",
        method="POST",
        form={
            "csrfToken": token,
            "username": username,
            "password": password,
            "redirect": "false",
            "callbackUrl": f"{base_url}/",
        },
    )
    require(result.status in {200, 302, 303}, f"登录失败，HTTP {result.status}")
    session = json_body(request(opener, base_url, "/api/auth/session"))
    user = session.get("user")
    require(isinstance(user, dict), "登录后没有获得有效 session")
    return user
