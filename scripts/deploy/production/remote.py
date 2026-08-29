from __future__ import annotations

import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import paramiko


@dataclass(frozen=True)
class RemoteSettings:
    host: str
    port: int
    username: str
    password: str | None
    key_path: str | None

    @classmethod
    def from_environment(cls) -> "RemoteSettings":
        host = os.environ.get("CRM_DEPLOY_HOST", "").strip()
        password = os.environ.get("CRM_DEPLOY_PASSWORD") or None
        key_path = os.environ.get("CRM_DEPLOY_KEY_PATH") or None
        if not host:
            raise RuntimeError("未配置 CRM_DEPLOY_HOST")
        if not password and not key_path:
            raise RuntimeError("未配置 CRM_DEPLOY_KEY_PATH 或 CRM_DEPLOY_PASSWORD")
        return cls(
            host=host,
            port=int(os.environ.get("CRM_DEPLOY_PORT", "22")),
            username=os.environ.get("CRM_DEPLOY_USER", "root"),
            password=password,
            key_path=key_path,
        )


@dataclass(frozen=True)
class CommandResult:
    exit_code: int
    stdout: str
    stderr: str


class RemoteClient:
    def __init__(self, settings: RemoteSettings) -> None:
        self.settings = settings
        self.client = paramiko.SSHClient()

    def __enter__(self) -> "RemoteClient":
        self.client.load_system_host_keys()
        self.client.set_missing_host_key_policy(paramiko.RejectPolicy())
        self.client.connect(
            self.settings.host,
            port=self.settings.port,
            username=self.settings.username,
            password=self.settings.password,
            key_filename=self.settings.key_path,
            timeout=30,
            auth_timeout=30,
            banner_timeout=30,
        )
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        self.client.close()

    def run(self, command: str, *, timeout_seconds: int = 1800, stream: bool = True) -> CommandResult:
        _, stdout, stderr = self.client.exec_command(command, get_pty=False)
        channel = stdout.channel
        out_chunks: list[bytes] = []
        error_chunks: list[bytes] = []
        deadline = time.monotonic() + timeout_seconds
        while not channel.exit_status_ready() or channel.recv_ready() or channel.recv_stderr_ready():
            if time.monotonic() >= deadline:
                channel.close()
                raise RuntimeError(f"远程命令超过 {timeout_seconds} 秒")
            if channel.recv_ready():
                chunk = channel.recv(65536)
                out_chunks.append(chunk)
                if stream:
                    sys.stdout.write(chunk.decode("utf-8", errors="replace"))
                    sys.stdout.flush()
            if channel.recv_stderr_ready():
                chunk = channel.recv_stderr(65536)
                error_chunks.append(chunk)
                if stream:
                    sys.stderr.write(chunk.decode("utf-8", errors="replace"))
                    sys.stderr.flush()
            if not channel.recv_ready() and not channel.recv_stderr_ready():
                time.sleep(0.05)
        result = CommandResult(
            exit_code=channel.recv_exit_status(),
            stdout=b"".join(out_chunks).decode("utf-8", errors="replace"),
            stderr=b"".join(error_chunks).decode("utf-8", errors="replace"),
        )
        if result.exit_code != 0:
            raise RuntimeError(f"远程命令失败，退出码 {result.exit_code}")
        return result

    def upload(self, source: Path, destination: str) -> None:
        if not source.is_file():
            raise RuntimeError(f"待上传文件不存在: {source}")
        with self.client.open_sftp() as sftp:
            sftp.put(str(source), destination)
