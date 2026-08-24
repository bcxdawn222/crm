from __future__ import annotations

import urllib.request
from concurrent.futures import ThreadPoolExecutor

from quality.crm_http import HttpResult, build_opener, login, multipart_file, request, require
from runtime.mysql_client import parse_database_url, run_mysql


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def database_value(database_url: str, sql: str) -> str:
    return run_mysql(parse_database_url(database_url), sql)


def verify_concurrent_import(
    database_url: str,
    base_url: str,
    marker: str,
    username: str,
    password: str,
    tracked_customer_ids: list[str],
    tracked_request_ids: list[str],
) -> None:
    note = f"concurrent-import-{marker}"
    csv_content = (
        "姓名,电话,邮箱,备注\n"
        f"并发导入甲-{marker},132{marker[:8]},concurrent-a-{marker}@example.com,{note}\n"
        f"并发导入乙-{marker},133{marker[:8]},concurrent-b-{marker}@example.com,{note}\n"
    )
    openers = [build_opener(), build_opener()]
    for opener in openers:
        login(opener, base_url, username, password)
    request_ids = [
        f"data-flow-import-concurrent-a-{marker}",
        f"data-flow-import-concurrent-b-{marker}",
    ]
    tracked_request_ids.extend(request_ids)

    def send(index: int) -> HttpResult:
        body, content_type = multipart_file(
            "file",
            "concurrent.csv",
            csv_content.encode("utf-8-sig"),
            "text/csv",
        )
        return request(
            openers[index],
            base_url,
            "/api/customers/import",
            method="POST",
            body=body,
            content_type=content_type,
            request_id=request_ids[index],
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(send, range(2)))
    require(sorted(result.status for result in results) == [201, 409], "并发重复导入结果不符合预期")

    rows = database_value(
        database_url,
        f"SELECT id FROM Customer WHERE notes={sql_quote(note)} ORDER BY id",
    )
    customer_ids = [row for row in rows.splitlines() if row]
    require(len(customer_ids) == 2, "并发重复导入生成了重复或缺失客户")
    tracked_customer_ids.extend(customer_ids)
    audit_count = database_value(
        database_url,
        "SELECT COUNT(*) FROM AuditEvent WHERE requestId IN "
        f"({','.join(sql_quote(value) for value in request_ids)}) AND action='IMPORT'",
    )
    require(audit_count == "1", "并发重复导入产生了多条成功审计")
