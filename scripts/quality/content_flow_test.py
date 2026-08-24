from __future__ import annotations

import os
import sys
from pathlib import Path
from uuid import uuid4


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

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


def multipart_file(filename: str, mime_type: str, content: bytes) -> tuple[bytes, str]:
    boundary = f"----crm-{uuid4().hex}"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {mime_type}\r\n\r\n"
    ).encode("utf-8") + content + f"\r\n--{boundary}--\r\n".encode("ascii")
    return body, f"multipart/form-data; boundary={boundary}"


def seed_messages(database_url: str, user_id: str, marker: str) -> list[str]:
    message_ids = [str(uuid4()) for _ in range(3)]
    values = ",".join(
        "(" + ",".join((
            sql_quote(message_id),
            sql_quote(user_id),
            sql_quote(user_id),
            "'NOTIFICATION'",
            sql_quote(f"数据链路消息-{marker}-{index}"),
            sql_quote(f"仅用于 test 消息验收 {index}"),
            "0",
            "NOW()",
        )) + ")"
        for index, message_id in enumerate(message_ids, start=1)
    )
    database_value(
        database_url,
        "INSERT INTO Message (id,senderId,receiverId,type,title,content,isRead,createdAt) VALUES " + values,
    )
    return message_ids


def main() -> int:
    if PROFILE != "test":
        print("拒绝执行：content-flow 只允许 CRM_PROFILE=test", file=sys.stderr)
        return 2

    database_url = os.environ.get("DATABASE_URL", "")
    marker = uuid4().hex[:12]
    opener = build_opener()
    user = login(opener, BASE_URL, USERNAME, PASSWORD)
    user_id = str(user["id"])
    file_id: str | None = None
    file_path: Path | None = None
    message_ids: list[str] = []
    request_ids: list[str] = []

    try:
        content = f"CRM test file {marker}".encode("utf-8")
        upload_body, content_type = multipart_file(f"data-flow-{marker}.pdf", "application/pdf", content)
        upload_request_id = f"content-flow-file-upload-{marker}"
        upload = request(
            opener,
            BASE_URL,
            "/api/files",
            method="POST",
            body=upload_body,
            content_type=content_type,
            request_id=upload_request_id,
        )
        upload_payload = json_body(upload)
        require(upload.status == 201 and upload_payload.get("success") is True, f"文件上传失败: {upload_payload}")
        require(upload.headers.get("x-request-id") == upload_request_id, "文件上传响应缺少 x-request-id")
        file_id = str(upload_payload["data"]["id"])
        stored_key = database_value(database_url, f"SELECT path FROM File WHERE id={sql_quote(file_id)}")
        file_path = ROOT / "storage" / "test" / Path(stored_key)
        require(file_path.is_file(), "上传文件未写入 test 存储目录")

        download = request(opener, BASE_URL, f"/api/files/{file_id}")
        require(download.status == 200 and download.body == content, "文件下载内容与上传内容不一致")
        require(database_value(database_url, f"SELECT downloadCount FROM File WHERE id={sql_quote(file_id)}") == "1", "文件下载次数未更新")

        message_ids = seed_messages(database_url, user_id, marker)
        messages = json_body(request(opener, BASE_URL, "/api/messages?page=1&pageSize=50"))
        returned_ids = {str(item["id"]) for item in messages["data"]["list"]}
        require(set(message_ids).issubset(returned_ids), "消息列表未返回 test 夹具")

        read_request_id = f"content-flow-message-read-{marker}"
        request_ids.append(read_request_id)
        read_result = request(opener, BASE_URL, f"/api/messages/{message_ids[0]}", method="PATCH", request_id=read_request_id)
        require(json_body(read_result).get("success") is True, "单条消息已读失败")
        require(read_result.headers.get("x-request-id") == read_request_id, "单条已读响应缺少 x-request-id")

        all_request_id = f"content-flow-message-read-all-{marker}"
        request_ids.append(all_request_id)
        all_result = request(opener, BASE_URL, "/api/messages/read-all", method="POST", request_id=all_request_id)
        require(json_body(all_result).get("success") is True, "全部已读失败")
        require(all_result.headers.get("x-request-id") == all_request_id, "全部已读响应缺少 x-request-id")

        delete_message_request_id = f"content-flow-message-delete-{marker}"
        request_ids.append(delete_message_request_id)
        delete_message = request(opener, BASE_URL, f"/api/messages/{message_ids[2]}", method="DELETE", request_id=delete_message_request_id)
        require(json_body(delete_message).get("success") is True, "消息删除失败")
        require(delete_message.headers.get("x-request-id") == delete_message_request_id, "消息删除响应缺少 x-request-id")
        require(database_value(database_url, f"SELECT COUNT(*) FROM Message WHERE id IN ({','.join(sql_quote(value) for value in message_ids)}) AND isRead=1") == "2", "消息已读状态不正确")
        message_audit_actions = database_value(
            database_url,
            "SELECT GROUP_CONCAT(action ORDER BY action SEPARATOR ',') FROM AuditEvent WHERE requestId IN "
            f"({','.join(sql_quote(value) for value in request_ids)})",
        )
        require(
            message_audit_actions == "MESSAGE_DELETED,MESSAGE_READ,MESSAGE_READ_ALL",
            f"消息审计动作异常: {message_audit_actions}",
        )

        delete_file_request_id = f"content-flow-file-delete-{marker}"
        delete_file = request(opener, BASE_URL, f"/api/files/{file_id}", method="DELETE", request_id=delete_file_request_id)
        require(json_body(delete_file).get("success") is True, "文件删除失败")
        require(delete_file.headers.get("x-request-id") == delete_file_request_id, "文件删除响应缺少 x-request-id")
        require(database_value(database_url, f"SELECT COUNT(*) FROM File WHERE id={sql_quote(file_id)}") == "0", "文件元数据未删除")
        require(not file_path.exists(), "文件删除后磁盘对象仍存在")
        file_audit_actions = database_value(
            database_url,
            "SELECT GROUP_CONCAT(action ORDER BY action SEPARATOR ',') FROM AuditEvent "
            f"WHERE entityId={sql_quote(file_id)} AND requestId IN "
            f"({sql_quote(upload_request_id)},{sql_quote(delete_file_request_id)})",
        )
        require(file_audit_actions == "FILE_DELETED,FILE_UPLOADED", f"文件审计动作异常: {file_audit_actions}")
        print("文件与消息数据链路验收通过")
        return 0
    finally:
        if file_id:
            database_value(database_url, f"DELETE FROM AuditEvent WHERE entityId={sql_quote(file_id)}")
            database_value(database_url, f"DELETE FROM File WHERE id={sql_quote(file_id)}")
            require(database_value(database_url, f"SELECT COUNT(*) FROM File WHERE id={sql_quote(file_id)}") == "0", "文件夹具清理失败")
        if file_path and file_path.exists():
            file_path.unlink()
        if file_path:
            require(not file_path.exists(), "测试文件清理失败")
        if message_ids:
            database_value(database_url, f"DELETE FROM AuditEvent WHERE requestId IN ({','.join(sql_quote(value) for value in request_ids)})")
            database_value(database_url, f"DELETE FROM Message WHERE id IN ({','.join(sql_quote(value) for value in message_ids)})")
            require(
                database_value(
                    database_url,
                    f"SELECT COUNT(*) FROM Message WHERE id IN ({','.join(sql_quote(value) for value in message_ids)})",
                ) == "0",
                "消息夹具清理失败",
            )
        print("content-flow test 夹具已清理")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"文件与消息数据链路验收失败: {error}", file=sys.stderr)
        raise SystemExit(1)
