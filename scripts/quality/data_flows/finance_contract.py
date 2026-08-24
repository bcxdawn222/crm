from __future__ import annotations

import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from quality.crm_http import (
    HttpResult,
    build_opener,
    json_body,
    login,
    multipart_form,
    request,
    require,
)
from runtime.mysql_client import parse_database_url, run_mysql


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def database_value(database_url: str, sql: str) -> str:
    return run_mysql(parse_database_url(database_url), sql)


def archive_request(
    opener: urllib.request.OpenerDirector,
    base_url: str,
    customer_id: str,
    contract_name: str,
    file_name: str,
    content: bytes,
    request_id: str,
) -> HttpResult:
    body, content_type = multipart_form(
        {
            "contractName": contract_name,
            "contractType": "SALES",
            "signDate": "2026-08-24",
            "effectiveDate": "2026-08-24",
            "expiryDate": "2027-08-24",
            "contractAmount": "1000",
            "remarks": "仅用于 test 合同版本验收",
        },
        "file",
        file_name,
        content,
        "application/pdf",
    )
    return request(
        opener,
        base_url,
        f"/api/customers/{customer_id}/contract-archives",
        method="POST",
        body=body,
        content_type=content_type,
        request_id=request_id,
    )


def run_finance_contract_flow(
    root: Path,
    database_url: str,
    base_url: str,
    opener: urllib.request.OpenerDirector,
    marker: str,
    customer_id: str,
    username: str,
    password: str,
) -> None:
    contract_name = f"数据链路合同-{marker}"
    request_ids: list[str] = []
    archive_ids: list[str] = []
    stored_keys: list[str] = []
    first_content = f"%PDF-1.4\ncontract-v1-{marker}".encode("utf-8")
    second_content = f"%PDF-1.4\ncontract-v2-{marker}".encode("utf-8")
    customer_dir = root / "storage" / "test" / "contracts" / customer_id

    try:
        invalid_id = f"data-flow-contract-invalid-{marker}"
        request_ids.append(invalid_id)
        invalid_body, invalid_type = multipart_form(
            {
                "contractName": contract_name,
                "contractType": "SALES",
            },
            "file",
            f"contract-invalid-{marker}.exe",
            b"invalid-contract-content",
            "application/octet-stream",
        )
        invalid_upload = request(
            opener,
            base_url,
            f"/api/customers/{customer_id}/contract-archives",
            method="POST",
            body=invalid_body,
            content_type=invalid_type,
            request_id=invalid_id,
        )
        require(invalid_upload.status == 400, "非法合同文件没有被拒绝")
        require(invalid_upload.headers.get("x-request-id") == invalid_id, "非法合同响应缺少请求号")
        require(
            database_value(
                database_url,
                f"SELECT COUNT(*) FROM ContractArchive WHERE requestId={sql_quote(invalid_id)}",
            ) == "0",
            "非法合同上传留下了元数据",
        )
        require(
            database_value(
                database_url,
                f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(invalid_id)}",
            ) == "0",
            "非法合同上传写入了成功审计",
        )
        require(not customer_dir.exists() or not list(customer_dir.glob("*")), "非法合同上传留下了文件")

        concurrent_id = f"data-flow-contract-v1-{marker}"
        request_ids.append(concurrent_id)
        openers = [build_opener(), build_opener()]
        for current in openers:
            login(current, base_url, username, password)

        def upload_first(index: int) -> HttpResult:
            return archive_request(
                openers[index],
                base_url,
                customer_id,
                contract_name,
                f"contract-v1-{marker}.pdf",
                first_content,
                concurrent_id,
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(upload_first, range(2)))
        require(sorted(result.status for result in results) == [200, 201], "合同并发重复提交结果不正确")
        payloads = [json_body(result) for result in results]
        require(len({str(payload["data"]["id"]) for payload in payloads}) == 1, "合同重复提交返回了不同记录")

        first_row = database_value(
            database_url,
            "SELECT CONCAT_WS('|', id, ossKey, version, isLatest) FROM ContractArchive "
            f"WHERE requestId={sql_quote(concurrent_id)}",
        )
        first_id, first_key, first_version, first_latest = first_row.split("|")
        archive_ids.append(first_id)
        stored_keys.append(first_key)
        require(first_version == "1" and first_latest == "1", "首个合同版本状态不正确")
        first_audit = database_value(
            database_url,
            f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(concurrent_id)} "
            "AND reason='CONTRACT_ARCHIVED'",
        )
        require(first_audit == "1", "合同重复提交产生了多条成功审计")
        require(len(list(customer_dir.glob("*"))) == 1, "合同重复提交留下了多余文件")

        second_idempotency = f"data-flow-contract-v2-{marker}"
        request_ids.append(second_idempotency)
        second_result = archive_request(
            opener,
            base_url,
            customer_id,
            contract_name,
            f"contract-v2-{marker}.pdf",
            second_content,
            second_idempotency,
        )
        second_payload = json_body(second_result)
        require(second_result.status == 201 and second_payload.get("success") is True, "合同第二版本上传失败")
        second_id = str(second_payload["data"]["id"])
        archive_ids.append(second_id)
        second_key = database_value(
            database_url,
            f"SELECT ossKey FROM ContractArchive WHERE id={sql_quote(second_id)}",
        )
        stored_keys.append(second_key)
        version_rows = database_value(
            database_url,
            "SELECT CONCAT_WS(':', version, isLatest, IFNULL(parentArchiveId,'')) FROM ContractArchive "
            f"WHERE customerId={sql_quote(customer_id)} AND contractName={sql_quote(contract_name)} ORDER BY version",
        ).splitlines()
        require(version_rows == ["1:0:", f"2:1:{first_id}"], f"合同版本链不正确: {version_rows}")

        versions = json_body(request(opener, base_url, f"/api/contract-archives/{second_id}/versions"))
        require([item["version"] for item in versions.get("data", [])] == [2, 1], "合同版本接口返回不正确")
        download_id = f"data-flow-contract-download-{marker}"
        request_ids.append(download_id)
        download = request(
            opener,
            base_url,
            f"/api/contract-archives/{second_id}/download",
            request_id=download_id,
        )
        require(download.status == 200 and download.body == second_content, "合同下载内容不正确")

        preview_id = f"data-flow-contract-preview-{marker}"
        request_ids.append(preview_id)
        preview = json_body(request(
            opener,
            base_url,
            f"/api/contract-archives/{second_id}/preview",
            request_id=preview_id,
        ))
        require(preview.get("data", {}).get("previewUrl", "").endswith("?inline=1"), "合同预览地址不正确")

        delete_second_id = f"data-flow-contract-delete-v2-{marker}"
        request_ids.append(delete_second_id)
        deleted_second = request(
            opener,
            base_url,
            f"/api/contract-archives/{second_id}",
            method="DELETE",
            request_id=delete_second_id,
        )
        require(json_body(deleted_second).get("success") is True, "删除最新合同版本失败")
        promoted = database_value(
            database_url,
            f"SELECT isLatest FROM ContractArchive WHERE id={sql_quote(first_id)}",
        )
        require(promoted == "1", "删除最新版本后旧版本未恢复为当前版本")
        require(not (customer_dir / Path(second_key).name).exists(), "删除合同版本后文件仍存在")

        delete_first_id = f"data-flow-contract-delete-v1-{marker}"
        request_ids.append(delete_first_id)
        deleted_first = request(
            opener,
            base_url,
            f"/api/contract-archives/{first_id}",
            method="DELETE",
            request_id=delete_first_id,
        )
        require(json_body(deleted_first).get("success") is True, "删除首个合同版本失败")
        require(database_value(
            database_url,
            f"SELECT COUNT(*) FROM ContractArchive WHERE customerId={sql_quote(customer_id)}",
        ) == "0", "合同版本元数据未清理")
        require(not customer_dir.exists() or not list(customer_dir.glob("*")), "合同文件未全部清理")
        deletion_audits = database_value(
            database_url,
            "SELECT COUNT(*) FROM AuditEvent "
            f"WHERE requestId IN ({sql_quote(delete_second_id)},{sql_quote(delete_first_id)}) "
            "AND reason='CONTRACT_ARCHIVE_DELETED' AND beforeData IS NOT NULL",
        )
        require(deletion_audits == "2", "合同删除后审计快照不完整")

        missing_delete_id = f"data-flow-contract-delete-missing-{marker}"
        request_ids.append(missing_delete_id)
        missing_delete = request(
            opener,
            base_url,
            f"/api/contract-archives/{first_id}",
            method="DELETE",
            request_id=missing_delete_id,
        )
        require(missing_delete.status == 404, "重复删除合同没有返回不存在")
        require(missing_delete.headers.get("x-request-id") == missing_delete_id, "合同删除失败响应缺少请求号")
        require(
            database_value(
                database_url,
                f"SELECT COUNT(*) FROM AuditEvent WHERE requestId={sql_quote(missing_delete_id)}",
            ) == "0",
            "合同删除失败写入了成功审计",
        )
        print("订单、回款幂等与合同版本链路验收通过")
    finally:
        if archive_ids:
            database_value(
                database_url,
                f"DELETE FROM AuditEvent WHERE entityId IN ({','.join(sql_quote(value) for value in archive_ids)})",
            )
            for archive_id in reversed(archive_ids):
                database_value(database_url, f"DELETE FROM ContractArchive WHERE id={sql_quote(archive_id)}")
        if request_ids:
            database_value(
                database_url,
                f"DELETE FROM AuditEvent WHERE requestId IN ({','.join(sql_quote(value) for value in request_ids)})",
            )
        for key in stored_keys:
            path = root / "storage" / "test" / "contracts" / Path(key)
            if path.exists():
                path.unlink()
        print("合同版本 test 夹具已清理")
