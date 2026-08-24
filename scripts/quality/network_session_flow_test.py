from __future__ import annotations

import os
import sys
import time


sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from quality.crm_http import build_opener, json_body, login, request, require
from runtime.mysql_client import parse_database_url, run_mysql


BASE_URL = os.environ.get("CRM_TEST_BASE_URL", "http://localhost:3001")
USERNAME = os.environ.get("CRM_SMOKE_USERNAME", "admin")
PASSWORD = os.environ.get("CRM_SMOKE_PASSWORD", "123456")


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> int:
    if os.environ.get("CRM_PROFILE") != "test":
        print("拒绝执行：network-session-flow 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2

    marker = os.environ.get("CRM_NETWORK_TEST_MARKER", "").strip()
    wait_text = os.environ.get("CRM_SESSION_EXPIRY_WAIT_SECONDS", "").strip()
    require(marker or wait_text, "至少配置 CRM_NETWORK_TEST_MARKER 或 CRM_SESSION_EXPIRY_WAIT_SECONDS")
    database_url = os.environ.get("CRM_TEST_DATABASE_URL") or os.environ.get("DATABASE_URL", "")
    target = parse_database_url(database_url)
    require(target.database.lower().endswith("_test"), "network-session-flow 只允许 test 数据库")

    if wait_text:
        require(wait_text.isdigit(), "CRM_SESSION_EXPIRY_WAIT_SECONDS 必须是正整数")
        wait_seconds = int(wait_text)
        require(wait_seconds >= 60, "自然过期验收至少等待 60 秒")
        opener = build_opener()
        login(opener, BASE_URL, USERNAME, PASSWORD)
        print(f"已登录，开始真实空闲等待 {wait_seconds} 秒")
        time.sleep(wait_seconds)
        expired = request(opener, BASE_URL, "/api/daily-reports?page=1&pageSize=1")
        require(expired.status == 401, f"会话空闲后应返回 401，实际为 {expired.status}")
        payload = json_body(expired)
        require(payload.get("error") == "登录状态已过期", "会话过期错误信息不符合中间件契约")
        request_id = payload.get("requestId")
        require(isinstance(request_id, str) and bool(request_id), "会话过期响应缺少 requestId")
        require(expired.headers.get("x-request-id") == request_id, "响应头和响应体 requestId 不一致")
        print("真实空闲后的 JSON 401 与 requestId 验收通过")

    if marker:
        require(marker.startswith("SESSION-DRAFT-"), "CRM_NETWORK_TEST_MARKER 格式不合法")
        marker_sql = sql_quote(marker)
        try:
            count = run_mysql(target, f"SELECT COUNT(*) FROM DailyReport WHERE content={marker_sql}")
            require(count == "1", f"双击提交应只产生 1 条日报，实际为 {count}")
            print("会话恢复后的双击提交数据库计数通过: 1")
        finally:
            run_mysql(target, f"DELETE FROM DailyReport WHERE content={marker_sql}")
            remaining = run_mysql(target, f"SELECT COUNT(*) FROM DailyReport WHERE content={marker_sql}")
            require(remaining == "0", "network-session-flow 日报夹具清理失败")
            print("network-session-flow 日报夹具已清理")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"网络与会话验收失败: {error}", file=sys.stderr)
        raise SystemExit(1)
