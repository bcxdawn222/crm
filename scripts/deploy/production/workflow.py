from __future__ import annotations

import shlex
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from release import verify_artifact
from deploy.production.remote import RemoteClient


REMOTE_CACHE = "/root/.cache/crm-deploy"
REMOTE_WORKER = f"{REMOTE_CACHE}/remote_release.sh"


def quoted(value: str | Path) -> str:
    return shlex.quote(str(value))


def install_worker(client: RemoteClient) -> None:
    client.run(f"install -d -m 700 {REMOTE_CACHE}", stream=False)
    source = Path(__file__).with_name("remote_release.sh")
    client.upload(source, REMOTE_WORKER)
    client.run(f"chmod 700 {REMOTE_WORKER}", stream=False)


def audit(client: RemoteClient) -> Path:
    install_worker(client)
    result = client.run(f"bash {REMOTE_WORKER} audit", stream=False)
    timestamp = datetime.now().astimezone()
    report_path = ROOT / "discuss" / f"线上部署漂移报告-{timestamp:%Y-%m-%d}.md"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    findings: list[str] = []
    if "LISTENER_LOOPBACK=false" in result.stdout:
        findings.append("- 应用仍监听所有网卡的 3000 端口，尚未收敛到 127.0.0.1。")
    if "NGINX_CONNECTION_MAP=false" in result.stdout:
        findings.append("- Nginx 仍固定发送 Connection upgrade，没有按 Upgrade 请求动态设置。")
    if "ROLLBACK_LOG_HANDLES=0" not in result.stdout:
        findings.append("- Nginx 仍持有旧回滚目录日志句柄，需要 reload 并 reopen。")
    if "MANAGER=systemd-direct" not in result.stdout:
        findings.append("- 当前 systemd 仍包装 PM2，存在两层进程管理配置源。")
    if not findings:
        findings.append("- 未发现上述已登记的部署漂移。")
    report_path.write_text(
        "# 线上部署漂移报告\n\n"
        f"生成时间：{timestamp.isoformat()}\n\n"
        "## 发现\n\n"
        + "\n".join(findings)
        + "\n\n## 脱敏原始证据\n\n```text\n"
        + result.stdout.strip()
        + "\n```\n",
        encoding="utf-8",
    )
    print(f"线上部署漂移报告: {report_path}")
    return report_path


def upload_artifact(client: RemoteClient, artifact: Path) -> tuple[str, str]:
    manifest = verify_artifact(artifact, "test")
    checksum = artifact.with_suffix(".sha256")
    client.run("install -d -m 755 /www/wwwroot/crm-releases/incoming", stream=False)
    remote_archive = f"/www/wwwroot/crm-releases/incoming/{artifact.name}"
    remote_checksum = f"/www/wwwroot/crm-releases/incoming/{checksum.name}"
    client.upload(artifact, remote_archive)
    client.upload(checksum, remote_checksum)
    install_worker(client)
    return remote_archive, manifest.release_id


def stage(client: RemoteClient, artifact: Path) -> str:
    manifest = verify_artifact(artifact, "test")
    remote_archive, release_id = upload_artifact(client, artifact)
    command = " ".join((
        "bash",
        REMOTE_WORKER,
        "stage",
        quoted(remote_archive),
        quoted(manifest.release_id),
        quoted(manifest.commit),
        quoted(manifest.version),
    ))
    client.run(command)
    return release_id


def deploy(client: RemoteClient, artifact: Path) -> str:
    release_id = stage(client, artifact)
    client.run(f"bash {REMOTE_WORKER} deploy {quoted(release_id)}")
    return release_id


def rollback(client: RemoteClient) -> None:
    install_worker(client)
    client.run(f"bash {REMOTE_WORKER} rollback")
