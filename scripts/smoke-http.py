from __future__ import annotations

import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Mapping, TypedDict, cast


BASE_URL = os.environ.get("CRM_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
USERNAME = os.environ.get("CRM_SMOKE_USERNAME", "admin")
PASSWORD = os.environ.get("CRM_SMOKE_PASSWORD", "123456")


class SessionUser(TypedDict):
    id: str
    roles: list[str]
    permissions: list[str]


class SessionPayload(TypedDict, total=False):
    user: SessionUser


@dataclass(frozen=True)
class HttpResult:
    status: int
    url: str
    headers: Mapping[str, str]
    body: bytes


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Mapping[str, str],
        newurl: str,
    ) -> None:
        return None


def build_opener(cookie_jar: http.cookiejar.CookieJar) -> urllib.request.OpenerDirector:
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cookie_jar),
        NoRedirectHandler(),
    )


def request(
    opener: urllib.request.OpenerDirector,
    path: str,
    *,
    method: str = "GET",
    form: Mapping[str, str] | None = None,
) -> HttpResult:
    data = urllib.parse.urlencode(form).encode("utf-8") if form else None
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/x-www-form-urlencoded"} if form else {},
    )
    try:
        with opener.open(req, timeout=30) as response:
            return HttpResult(
                status=response.status,
                url=response.url,
                headers=response.headers,
                body=response.read(),
            )
    except urllib.error.HTTPError as error:
        return HttpResult(
            status=error.code,
            url=error.url,
            headers=error.headers,
            body=error.read(),
        )


def read_json(result: HttpResult) -> object:
    return json.loads(result.body.decode("utf-8"))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def get_csrf(opener: urllib.request.OpenerDirector) -> str:
    result = request(opener, "/api/auth/csrf")
    require(result.status == 200, f"CSRF 接口状态异常: {result.status}")
    payload = read_json(result)
    require(isinstance(payload, dict), "CSRF 响应不是对象")
    token = payload.get("csrfToken")
    require(isinstance(token, str) and bool(token), "CSRF 响应缺少 csrfToken")
    return token


def login(opener: urllib.request.OpenerDirector, username: str, password: str) -> HttpResult:
    csrf_token = get_csrf(opener)
    return request(
        opener,
        "/api/auth/callback/credentials",
        method="POST",
        form={
            "csrfToken": csrf_token,
            "username": username,
            "password": password,
            "redirect": "false",
            "callbackUrl": f"{BASE_URL}/",
        },
    )


def get_session(opener: urllib.request.OpenerDirector) -> object:
    result = request(opener, "/api/auth/session")
    require(result.status == 200, f"Session 接口状态异常: {result.status}")
    return read_json(result)


def assert_api_success(opener: urllib.request.OpenerDirector, path: str) -> None:
    result = request(opener, path)
    require(result.status == 200, f"{path} 返回 {result.status}")
    payload = read_json(result)
    require(isinstance(payload, dict), f"{path} 响应不是对象")
    require(payload.get("success") is True, f"{path} 未返回 success=true")


def main() -> int:
    anonymous = build_opener(http.cookiejar.CookieJar())
    login_page = request(anonymous, "/login")
    require(login_page.status == 200, f"登录页返回 {login_page.status}")

    protected = request(anonymous, "/api/customers")
    require(protected.status in {302, 307, 308}, "未登录访问客户接口没有被重定向")
    require("/login" in protected.headers.get("location", ""), "未登录重定向目标不是登录页")

    invalid = build_opener(http.cookiejar.CookieJar())
    login(invalid, USERNAME, f"{PASSWORD}-invalid")
    invalid_session = get_session(invalid)
    require(
        invalid_session is None
        or (isinstance(invalid_session, dict) and "user" not in invalid_session),
        "错误密码意外获得登录 session",
    )

    authenticated = build_opener(http.cookiejar.CookieJar())
    login_result = login(authenticated, USERNAME, PASSWORD)
    require(login_result.status in {200, 302, 303}, f"登录回调返回 {login_result.status}")
    session_payload = get_session(authenticated)
    require(isinstance(session_payload, dict), f"数据库账号 {USERNAME} 登录失败")
    session = cast(SessionPayload, session_payload)
    user = session.get("user")
    require(isinstance(user, dict), f"数据库账号 {USERNAME} 登录失败")
    require(isinstance(user.get("id"), str) and bool(user["id"]), "Session 缺少用户 ID")
    require(isinstance(user.get("roles"), list), "Session 缺少 roles 数组")
    require(isinstance(user.get("permissions"), list), "Session 缺少 permissions 数组")

    for path in (
        "/api/customers?page=1&pageSize=1",
        "/api/customers/renewal-reminders",
        "/api/public-pool?page=1&pageSize=1",
        "/api/public-pool/quota",
        "/api/finance/payments?page=1&pageSize=1",
    ):
        assert_api_success(authenticated, path)

    print(f"HTTP 冒烟测试通过: 用户={USERNAME}, 基础地址={BASE_URL}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"HTTP 冒烟测试失败: {error}", file=sys.stderr)
        raise SystemExit(1)
