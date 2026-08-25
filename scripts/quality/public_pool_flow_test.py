from __future__ import annotations

import json
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
        print("拒绝执行：public-pool-flow 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2

    database_url = os.environ.get("DATABASE_URL", "")
    marker = uuid4().hex[:12]
    opener = build_opener()
    admin = login(opener, BASE_URL, USERNAME, PASSWORD)
    actor_id = str(admin["id"])
    customer_id: str | None = None
    auto_customer_id: str | None = None
    request_ids: list[str] = []

    try:
        create_request_id = f"public-pool-create-{marker}"
        request_ids.append(create_request_id)
        create_result = request(
            opener,
            BASE_URL,
            "/api/customers",
            method="POST",
            payload={
                "name": f"公海链路客户-{marker}",
                "phone": f"138{marker[:8]}",
                "source": "OTHER",
                "notes": "仅用于 test 公海链路验收",
            },
            request_id=create_request_id,
        )
        created = json_body(create_result)
        require(create_result.status == 200 and created.get("success") is True, f"创建公海验收客户失败: {created}")
        customer_id = str(created["data"]["id"])
        original_sales_id = str(created["data"]["salesId"])

        archive_request_id = f"public-pool-archive-{marker}"
        request_ids.append(archive_request_id)
        archive_result = request(
            opener,
            BASE_URL,
            f"/api/customers/{customer_id}/archive",
            method="POST",
            payload={"reason": "QUALITY_ACCEPTANCE"},
            request_id=archive_request_id,
        )
        archived = json_body(archive_result)
        require(archive_result.status == 200 and archived.get("success") is True, f"客户进入公海失败: {archived}")
        require(archive_result.headers.get("x-request-id") == archive_request_id, "进入公海响应缺少 x-request-id")
        require(archived["data"]["isPublic"] is True, "客户进入公海后状态不正确")
        require(archived["data"]["originalSalesId"] == original_sales_id, "客户原销售未保留")

        archive_conflict = request(
            opener,
            BASE_URL,
            f"/api/customers/{customer_id}/archive",
            method="POST",
            payload={"reason": "QUALITY_ACCEPTANCE"},
        )
        require(archive_conflict.status == 409, "重复进入公海未被拒绝")

        claim_request_id = f"public-pool-claim-{marker}"
        request_ids.append(claim_request_id)
        claim_result = request(
            opener,
            BASE_URL,
            "/api/customers/transfer",
            method="POST",
            payload={"customerId": customer_id},
            request_id=claim_request_id,
        )
        claimed = json_body(claim_result)
        require(claim_result.status == 200 and claimed.get("success") is True, f"每日客资认领失败: {claimed}")
        require(claim_result.headers.get("x-request-id") == claim_request_id, "认领响应缺少 x-request-id")
        require(claimed["data"]["isPublic"] is False, "认领后客户仍在公海")
        require(claimed["data"]["salesId"] == original_sales_id, "认领后销售归属不正确")

        duplicate_claim = request(
            opener,
            BASE_URL,
            "/api/public-pool/claim",
            method="POST",
            payload={"customerId": customer_id},
        )
        duplicate_payload = json_body(duplicate_claim)
        require(duplicate_claim.status == 409, "重复认领未被拒绝")
        require(duplicate_payload.get("code") == "ALREADY_CLAIMED", "重复认领错误码不正确")

        row = database_value(
            database_url,
            "SELECT isPublic, status, salesId, originalSalesId, publicPoolReason, publicPoolHistory "
            f"FROM Customer WHERE id={sql_quote(customer_id)}",
        )
        parts = row.split("\t", 5)
        require(len(parts) == 6, "公海客户数据库数据不完整")
        expected_status = ["0", "ACTIVE", original_sales_id, original_sales_id, "QUALITY_ACCEPTANCE"]
        require(parts[:5] == expected_status, "公海客户最终状态不正确")
        history = json.loads(parts[5])
        history_types = [item.get("type") for item in history] if isinstance(history, list) else []
        require(history_types == ["ARCHIVED", "CLAIMED"], "公海流转历史不正确")
        audits = database_value(
            database_url,
            "SELECT GROUP_CONCAT(action ORDER BY action SEPARATOR ',') FROM AuditEvent "
            f"WHERE requestId IN ({sql_quote(archive_request_id)},{sql_quote(claim_request_id)})",
        )
        require(audits == "ARCHIVE_TO_PUBLIC_POOL,CLAIM", f"公海审计动作不正确: {audits}")

        auto_customer_id = str(uuid4())
        database_value(
            database_url,
            "INSERT INTO Customer "
            "(id,name,phone,source,level,status,salesId,isPublic,createdAt,updatedAt,lastFollowUpAt) VALUES "
            f"({sql_quote(auto_customer_id)},{sql_quote(f'自动回收客户-{marker}')},"
            f"{sql_quote(f'137{marker[:8]}')},'OTHER','POTENTIAL','ACTIVE',{sql_quote(actor_id)},0,"
            "DATE_SUB(NOW(3), INTERVAL 120 DAY),NOW(3),DATE_SUB(NOW(3), INTERVAL 100 DAY))",
        )
        auto_request_id = f"public-pool-auto-{marker}"
        request_ids.append(auto_request_id)
        auto_result = request(
            opener,
            BASE_URL,
            "/api/public-pool/auto-move",
            method="POST",
            request_id=auto_request_id,
        )
        auto_payload = json_body(auto_result)
        require(auto_result.status == 200 and auto_payload.get("success") is True, f"自动回收失败: {auto_payload}")
        auto_details = auto_payload.get("data", {}).get("details", [])
        moved_ids = {str(item.get("customerId")) for item in auto_details if isinstance(item, dict)}
        require(auto_customer_id in moved_ids, "自动回收结果未包含目标客户")
        auto_row = database_value(
            database_url,
            "SELECT isPublic,status,publicPoolReason,JSON_UNQUOTE(JSON_EXTRACT(publicPoolHistory,'$[0].reason')) "
            f"FROM Customer WHERE id={sql_quote(auto_customer_id)}",
        )
        require(auto_row == "1\tINACTIVE\tRULE_1\tRULE_1", f"自动回收数据库状态不正确: {auto_row}")
        auto_audit = database_value(
            database_url,
            "SELECT action FROM AuditEvent "
            f"WHERE requestId={sql_quote(auto_request_id)} AND entityId={sql_quote(auto_customer_id)}",
        )
        require(auto_audit == "AUTO_MOVE_TO_PUBLIC_POOL", "自动回收审计缺失")
        print("客户进入公海、认领、自动回收与重复操作保护验收通过")
        return 0
    finally:
        if request_ids:
            database_value(
                database_url,
                f"DELETE FROM AuditEvent WHERE requestId IN ({','.join(sql_quote(value) for value in request_ids)})",
            )
        if customer_id:
            database_value(database_url, f"DELETE FROM AuditEvent WHERE entityId={sql_quote(customer_id)}")
            database_value(database_url, f"DELETE FROM Customer WHERE id={sql_quote(customer_id)}")
            remaining = database_value(database_url, f"SELECT COUNT(*) FROM Customer WHERE id={sql_quote(customer_id)}")
            require(remaining == "0", "公海验收客户清理失败")
        if auto_customer_id:
            database_value(database_url, f"DELETE FROM AuditEvent WHERE entityId={sql_quote(auto_customer_id)}")
            database_value(database_url, f"DELETE FROM Customer WHERE id={sql_quote(auto_customer_id)}")
        print("public-pool-flow test 夹具已清理")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"公海数据链路验收失败: {error}", file=sys.stderr)
        raise SystemExit(1)
