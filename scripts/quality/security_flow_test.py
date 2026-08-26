from __future__ import annotations

import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from quality.crm_http import build_opener, json_body, multipart_file, request, require
from runtime.mysql_client import parse_database_url, run_mysql


def set_cookie_values(headers: object) -> list[str]:
    getter = getattr(headers, "get_all", None)
    return list(getter("Set-Cookie") or []) if callable(getter) else []


def login_and_check_cookie(base_url: str, username: str, password: str):
    opener = build_opener()
    csrf = json_body(request(opener, base_url, "/api/auth/csrf"))
    token = csrf.get("csrfToken")
    require(isinstance(token, str) and bool(token), "CSRF token 获取失败")
    callback = request(
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
    require(callback.status in {200, 302, 303}, f"登录失败，HTTP {callback.status}")
    cookies = "\n".join(set_cookie_values(callback.headers)).lower()
    require("httponly" in cookies, "认证 Cookie 缺少 HttpOnly")
    require("samesite=lax" in cookies or "samesite=strict" in cookies, "认证 Cookie 缺少 SameSite")
    session = json_body(request(opener, base_url, "/api/auth/session"))
    require(isinstance(session.get("user"), dict), "登录后没有有效 session")
    return opener


def check_headers(base_url: str) -> None:
    result = request(build_opener(), base_url, "/login")
    require(result.status == 200, f"登录页 HTTP {result.status}")
    lowered = {key.lower(): value for key, value in result.headers.items()}
    require("frame-ancestors 'none'" in lowered.get("content-security-policy", ""), "CSP 缺少 frame-ancestors")
    require(lowered.get("x-content-type-options") == "nosniff", "缺少 nosniff")
    require(lowered.get("x-frame-options") == "DENY", "缺少 X-Frame-Options")
    require(bool(lowered.get("referrer-policy")), "缺少 Referrer-Policy")


def check_request_guards(opener, base_url: str) -> None:
    cross_origin = request(
        opener,
        base_url,
        "/api/settings",
        method="PUT",
        payload={"systemName": "blocked"},
        headers={"Origin": "https://attacker.invalid", "Sec-Fetch-Site": "cross-site"},
    )
    require(cross_origin.status == 403, f"跨站写请求未被拒绝，HTTP {cross_origin.status}")
    require(json_body(cross_origin).get("error") == "请求来源校验失败", "跨站拒绝响应不正确")

    malformed = request(
        opener,
        base_url,
        "/api/settings",
        method="PUT",
        body=b"{",
        content_type="application/json",
    )
    require(malformed.status == 400, f"非法 JSON 未返回 400，HTTP {malformed.status}")
    require(b"stack" not in malformed.body.lower(), "错误响应泄露 stack")

    invalid_id = request(build_opener(), base_url, "/api/health", request_id="bad request id")
    returned_id = invalid_id.headers.get("x-request-id", "")
    require(bool(returned_id) and returned_id != "bad request id", "非法 requestId 未被替换")


def check_input_validation(opener, base_url: str) -> None:
    invalid_date_paths = (
        "/api/daily-reports?page=1&pageSize=1&startDate=not-a-date&endDate=2026-01-01",
        "/api/daily-leads?page=1&pageSize=1&startDate=not-a-date&endDate=2026-01-01",
        "/api/finance/payments?page=1&pageSize=1&startDate=not-a-date&endDate=2026-01-01",
        "/api/finance/reports/summary?startDate=not-a-date&endDate=2026-01-01",
    )
    for path in invalid_date_paths:
        result = request(opener, base_url, path)
        require(result.status == 400, f"非法日期未返回 400: {path} HTTP {result.status}")

    reversed_range = request(
        opener,
        base_url,
        "/api/daily-reports?page=1&pageSize=1&startDate=2026-02-02&endDate=2026-02-01",
    )
    require(reversed_range.status == 400, "倒序日期范围未返回 400")

    invalid_report = request(
        opener,
        base_url,
        "/api/daily-reports",
        method="POST",
        payload={"reportDate": "2026-02-31", "content": "输入校验测试"},
    )
    require(invalid_report.status == 400, "日报接口非法日期未返回 400")

    malformed_task = request(
        opener,
        base_url,
        "/api/tasks",
        method="POST",
        body=b"{",
        content_type="application/json",
    )
    require(malformed_task.status == 400, f"任务接口非法 JSON 未返回 400，HTTP {malformed_task.status}")

    invalid_task_date = request(
        opener,
        base_url,
        "/api/tasks",
        method="POST",
        payload={
            "title": "输入校验测试",
            "assigneeId": "00000000-0000-0000-0000-000000000000",
            "dueDate": "not-a-date",
        },
    )
    require(invalid_task_date.status == 400, "任务接口非法截止日期未返回 400")


def check_upload_guards(opener, base_url: str, database_url: str) -> None:
    body, content_type = multipart_file("file", "fake.pdf", b"not-a-pdf", "application/pdf")
    mismatch = request(
        opener,
        base_url,
        "/api/files",
        method="POST",
        body=body,
        content_type=content_type,
    )
    require(mismatch.status == 400, f"伪造 PDF 未返回 400，HTTP {mismatch.status}")
    require("内容与扩展名不一致" in str(json_body(mismatch).get("error")), "伪造文件错误不明确")

    traversal_body, traversal_type = multipart_file(
        "file", "../escape.pdf", b"%PDF-1.4\n%%EOF", "application/pdf"
    )
    traversal = request(
        opener,
        base_url,
        "/api/files",
        method="POST",
        body=traversal_body,
        content_type=traversal_type,
    )
    require(traversal.status == 400, f"路径文件名未返回 400，HTTP {traversal.status}")

    target = parse_database_url(database_url)
    count = run_mysql(target, "SELECT COUNT(*) FROM File;")
    require(count == "0", f"安全上传测试残留 File 记录: {count}")


def main() -> int:
    if os.environ.get("CRM_PROFILE") != "test":
        print("security-flow 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2
    database_url = os.environ.get("DATABASE_URL", "")
    target = parse_database_url(database_url)
    if not target.database.lower().endswith("_test"):
        print("security-flow 拒绝连接非 test 数据库", file=sys.stderr)
        return 2
    base_url = os.environ.get("CRM_TEST_BASE_URL", "http://127.0.0.1:3001")
    username = os.environ.get("CRM_SMOKE_USERNAME", "admin")
    password = os.environ.get("CRM_SMOKE_PASSWORD", "123456")
    check_headers(base_url)
    opener = login_and_check_cookie(base_url, username, password)
    check_request_guards(opener, base_url)
    check_input_validation(opener, base_url)
    check_upload_guards(opener, base_url, database_url)
    print("安全 HTTP 验收通过：响应头、Cookie、同源写校验、错误脱敏、requestId、上传签名和路径均符合要求")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
