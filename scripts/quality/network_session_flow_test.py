from __future__ import annotations

import os
import sys


sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from quality.crm_http import require
from runtime.mysql_client import parse_database_url, run_mysql


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> int:
    if os.environ.get("CRM_PROFILE") != "test":
        print("拒绝执行：network-session-flow 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2

    marker = os.environ.get("CRM_NETWORK_TEST_MARKER", "").strip()
    require(marker.startswith("SESSION-DRAFT-"), "缺少合法的 CRM_NETWORK_TEST_MARKER")
    database_url = os.environ.get("CRM_TEST_DATABASE_URL") or os.environ.get("DATABASE_URL", "")
    target = parse_database_url(database_url)
    require(target.database.lower().endswith("_test"), "network-session-flow 只允许 test 数据库")

    marker_sql = sql_quote(marker)
    try:
        count = run_mysql(target, f"SELECT COUNT(*) FROM DailyReport WHERE content={marker_sql}")
        require(count == "1", f"双击提交应只产生 1 条日报，实际为 {count}")
        print("会话恢复后的双击提交数据库计数通过: 1")
        return 0
    finally:
        run_mysql(target, f"DELETE FROM DailyReport WHERE content={marker_sql}")
        remaining = run_mysql(target, f"SELECT COUNT(*) FROM DailyReport WHERE content={marker_sql}")
        require(remaining == "0", "network-session-flow 日报夹具清理失败")
        print("network-session-flow 日报夹具已清理")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"网络与会话验收失败: {error}", file=sys.stderr)
        raise SystemExit(1)
