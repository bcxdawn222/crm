from __future__ import annotations

import os
import sys

import paramiko


def write_output(value: str, *, error: bool = False) -> None:
    stream = sys.stderr if error else sys.stdout
    encoding = stream.encoding or "utf-8"
    safe_value = value.encode(encoding, errors="replace").decode(encoding)
    stream.write(safe_value)
    stream.flush()


def main() -> int:
    host = os.environ["CRM_DEPLOY_HOST"]
    username = os.environ.get("CRM_DEPLOY_USER", "root")
    password = os.environ.get("CRM_DEPLOY_PASSWORD")
    key_path = os.environ.get("CRM_DEPLOY_KEY_PATH")
    command = sys.stdin.read()
    if not command.strip():
        print("未提供远程命令", file=sys.stderr)
        return 2
    if not password and not key_path:
        print("未配置 CRM_DEPLOY_KEY_PATH 或 CRM_DEPLOY_PASSWORD", file=sys.stderr)
        return 2

    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    try:
        client.connect(
            host,
            port=int(os.environ.get("CRM_DEPLOY_PORT", "22")),
            username=username,
            password=password,
            key_filename=key_path,
            timeout=30,
            auth_timeout=30,
            banner_timeout=30,
        )
        _, stdout, stderr = client.exec_command(command, get_pty=True)
        for line in iter(stdout.readline, ""):
            write_output(line)
        error_output = stderr.read().decode("utf-8", errors="replace")
        if error_output:
            write_output(error_output, error=True)
        return stdout.channel.recv_exit_status()
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
