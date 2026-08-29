from __future__ import annotations

import datetime as dt
import json
import os
import shlex
import sys
from dataclasses import dataclass, fields
from pathlib import Path
from typing import Mapping
from urllib.parse import urlsplit
from uuid import uuid4

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from deploy.production.remote import RemoteClient, RemoteSettings
from quality.crm_http import build_opener, json_body, login, request, require


PROFILE = os.environ.get("CRM_PROFILE", "stable")
BASE_URL = os.environ.get("CRM_PRODUCTION_BASE_URL", "").rstrip("/")
USERNAME = os.environ.get("CRM_SMOKE_USERNAME", "admin")
PASSWORD = os.environ.get("CRM_SMOKE_PASSWORD", "")
ACKNOWLEDGEMENT = "crm-sales-sop-completion"
REMOTE_PROBE = "/root/.cache/crm-deploy/production_sop_data_probe.py"


@dataclass
class FixtureIds:
    telemarketing: str | None = None
    customer: str | None = None
    follow_up: str | None = None
    order: str | None = None
    payment: str | None = None

    def complete(self) -> bool:
        return all(getattr(self, item.name) for item in fields(self))

    def command_arguments(self, marker: str, request_ids: list[str]) -> str:
        arguments: list[str] = ["--marker", marker]
        for item in fields(self):
            value = getattr(self, item.name)
            if value:
                arguments.extend((f"--{item.name.replace('_', '-')}-id", value))
        arguments.extend(("--request-ids", ",".join(request_ids)))
        return " ".join(shlex.quote(value) for value in arguments)


def object_value(value: object, label: str) -> Mapping[str, object]:
    require(isinstance(value, dict), f"{label} 不是对象")
    return value


def text_value(value: object, label: str) -> str:
    require(isinstance(value, str) and bool(value), f"{label} 缺失")
    return value


def response_data(path: str, *, opener, method: str = "GET", payload: object | None = None, request_id: str | None = None):
    result = request(opener, BASE_URL, path, method=method, payload=payload, request_id=request_id)
    body = json_body(result)
    require(body.get("success") is True, f"{path} 失败: HTTP {result.status} {body}")
    return object_value(body.get("data"), f"{path} data")


def remote_probe(client: RemoteClient, action: str, arguments: str = "") -> str:
    command = (
        "CRM_ENV_PATH=/www/wwwroot/crm-system/.env "
        f"python3 {shlex.quote(REMOTE_PROBE)} {shlex.quote(action)} {arguments}"
    ).strip()
    return client.run(command, stream=False).stdout.strip()


def install_probe(client: RemoteClient) -> None:
    source = ROOT / "scripts" / "deploy" / "production" / "sop_data_probe.py"
    client.run("install -d -m 700 /root/.cache/crm-deploy", stream=False)
    client.upload(source, REMOTE_PROBE)
    client.run(f"chmod 700 {shlex.quote(REMOTE_PROBE)}", stream=False)


def create_backup(client: RemoteClient) -> str:
    command = """bash -lc '
before=$(find /root/crm-backups -maxdepth 1 -type f -name "*.sql.gz" -printf "%p\\n" 2>/dev/null | sort | tail -n1)
systemctl start crm-db-backup.service
after=$(find /root/crm-backups -maxdepth 1 -type f -name "*.sql.gz" -printf "%p\\n" | sort | tail -n1)
test -n "$after" && test "$after" != "${before:-}"
gzip -t "$after"
printf "%s\\n" "$after"
'"""
    return client.run(command, stream=False).stdout.strip()


def validate_environment() -> None:
    if PROFILE != "stable":
        raise RuntimeError("production-sop-smoke 只允许 CRM_PROFILE=stable")
    if os.environ.get("CRM_PRODUCTION_WRITE_ACK") != ACKNOWLEDGEMENT:
        raise RuntimeError(f"必须设置 CRM_PRODUCTION_WRITE_ACK={ACKNOWLEDGEMENT}")
    parsed = urlsplit(BASE_URL)
    if parsed.scheme != "https" or not parsed.hostname or parsed.hostname in {"127.0.0.1", "localhost"}:
        raise RuntimeError("CRM_PRODUCTION_BASE_URL 必须是线上 HTTPS 地址")
    if not PASSWORD:
        raise RuntimeError("未配置 CRM_SMOKE_PASSWORD")


def create_fixture(marker: str, ids: FixtureIds, request_ids: list[str]) -> None:
    opener = build_opener()
    login(opener, BASE_URL, USERNAME, PASSWORD)

    request_id = f"prod-sop-telemarketing-{marker}"
    request_ids.append(request_id)
    telemarketing = response_data(
        "/api/telemarketing",
        opener=opener,
        method="POST",
        request_id=request_id,
        payload={
            "name": f"线上验收客户-{marker}",
            "company": "CRM production acceptance",
            "phone": f"139{marker[:8]}",
            "source": "PRODUCTION_ACCEPTANCE",
            "notes": f"线上受控验收 {marker}，完成后自动清理",
        },
    )
    ids.telemarketing = text_value(telemarketing.get("id"), "电销记录 ID")

    request_id = f"prod-sop-convert-{marker}"
    request_ids.append(request_id)
    converted = response_data(
        "/api/telemarketing/convert",
        opener=opener,
        method="POST",
        request_id=request_id,
        payload={"telemarketingId": ids.telemarketing, "level": "POTENTIAL", "source": "OTHER"},
    )
    ids.customer = text_value(object_value(converted.get("customer"), "转化客户").get("id"), "客户 ID")

    request_id = f"prod-sop-follow-{marker}"
    request_ids.append(request_id)
    follow_up = response_data(
        f"/api/customers/{ids.customer}/follow-ups",
        opener=opener,
        method="POST",
        request_id=request_id,
        payload={
            "type": "PHONE",
            "content": f"线上发布受控验收 {marker}",
            "result": "同意合作",
            "nextAction": "创建验收订单并登记首款",
            "nextFollowUpAt": (dt.datetime.now() + dt.timedelta(days=3)).isoformat(),
        },
    )
    ids.follow_up = text_value(follow_up.get("id"), "跟进 ID")

    request_id = f"prod-sop-cooperate-{marker}"
    request_ids.append(request_id)
    cooperating = response_data(
        "/api/customers/cooperating",
        opener=opener,
        method="POST",
        request_id=request_id,
        payload={
            "customerId": ids.customer,
            "contractStartDate": dt.date.today().isoformat(),
            "contractEndDate": (dt.date.today() + dt.timedelta(days=365)).isoformat(),
            "contractAmount": 12000,
        },
    )
    require(cooperating.get("status") == "COOPERATING", "客户没有转为已合作")

    request_id = f"prod-sop-cooperate-update-{marker}"
    request_ids.append(request_id)
    response_data(
        f"/api/customers/cooperating?id={ids.customer}",
        opener=opener,
        method="PUT",
        request_id=request_id,
        payload={"cooperationNotes": "线上受控验收"},
    )

    request_id = f"prod-sop-order-{marker}"
    request_ids.append(request_id)
    order = response_data(
        "/api/finance/orders",
        opener=opener,
        method="POST",
        request_id=request_id,
        payload={
            "customerId": ids.customer,
            "contractNo": f"PROD-{marker}",
            "contractAmount": 12000,
            "currency": "CNY",
            "signDate": dt.date.today().isoformat(),
            "remarks": f"线上受控验收 {marker}",
        },
    )
    ids.order = text_value(order.get("id"), "订单 ID")

    request_id = f"prod-sop-payment-{marker}"
    request_ids.append(request_id)
    payment = response_data(
        "/api/finance/payments",
        opener=opener,
        method="POST",
        request_id=request_id,
        payload={
            "orderId": ids.order,
            "amount": 3000,
            "paymentMethod": "BANK_TRANSFER",
            "paymentDate": dt.date.today().isoformat(),
            "remarks": f"线上受控验收 {marker}",
        },
    )
    ids.payment = text_value(payment.get("id"), "回款 ID")

    detail = response_data(f"/api/customers/{ids.customer}", opener=opener)
    follow_ups = detail.get("followUps")
    orders = detail.get("orders")
    require(isinstance(follow_ups, list) and any(item.get("id") == ids.follow_up for item in follow_ups if isinstance(item, dict)), "线上详情缺少跟进")
    require(isinstance(orders, list) and any(item.get("id") == ids.order for item in orders if isinstance(item, dict)), "线上详情缺少订单")


def main() -> int:
    validate_environment()
    marker = uuid4().hex[:12]
    ids = FixtureIds()
    request_ids: list[str] = []
    before_snapshot = after_snapshot = ""
    backup_path = ""
    cleanup_error: Exception | None = None
    with RemoteClient(RemoteSettings.from_environment()) as client:
        install_probe(client)
        backup_path = create_backup(client)
        before_snapshot = remote_probe(client, "snapshot")
        try:
            create_fixture(marker, ids, request_ids)
            require(ids.complete(), "线上验收夹具 ID 不完整")
            arguments = ids.command_arguments(marker, request_ids)
            remote_probe(client, "inspect", arguments)
        finally:
            if request_ids:
                arguments = ids.command_arguments(marker, request_ids)
                try:
                    remote_probe(client, "cleanup", arguments)
                    remote_probe(client, "assert-clean", arguments)
                except Exception as error:
                    cleanup_error = error
            after_snapshot = remote_probe(client, "snapshot")
            client.run(f"rm -f {shlex.quote(REMOTE_PROBE)}", stream=False)
    if cleanup_error is not None:
        raise RuntimeError(f"线上验收数据清理失败: {cleanup_error}") from cleanup_error
    require(before_snapshot == after_snapshot, f"线上业务快照前后不一致: before={before_snapshot} after={after_snapshot}")
    print(f"线上销售 SOP 受控验收通过，标记={marker}")
    print(f"写前备份={backup_path}")
    print("线上验收记录、审计记录和远程探针均已清理，业务快照前后一致")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"线上销售 SOP 受控验收失败: {error}", file=sys.stderr)
        raise SystemExit(1)
