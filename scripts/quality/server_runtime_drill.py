from __future__ import annotations

import os
import socket
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from quality.crm_http import build_opener, json_body, login, request, require
from runtime.mysql_client import parse_database_url
from runtime.process_identity import terminate_process_tree


USERNAME = os.environ.get("CRM_SMOKE_USERNAME", "admin")
PASSWORD = os.environ.get("CRM_SMOKE_PASSWORD", "123456")
SERVER_LOG = ROOT / "logs" / "test" / "server-runtime-drill.log"


@dataclass(frozen=True)
class RunningServer:
    process: subprocess.Popen[bytes]
    base_url: str
    port: int


def available_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def port_open(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            return True
    except OSError:
        return False


def start_server(database_url: str, storage_path: Path) -> RunningServer:
    port = available_port()
    base_url = f"http://127.0.0.1:{port}"
    environment: Mapping[str, str] = {
        **os.environ,
        "CRM_PROFILE": "test",
        "CRM_UPLOAD_DIR": str(storage_path),
        "DATABASE_URL": database_url,
        "AUTH_TRUST_HOST": "true",
        "AUTH_URL": base_url,
        "NEXTAUTH_URL": base_url,
        "CRM_TEST_NEXTAUTH_URL": base_url,
        "PORT": str(port),
    }
    npm = "npm.cmd" if os.name == "nt" else "npm"
    SERVER_LOG.parent.mkdir(parents=True, exist_ok=True)
    log_handle = SERVER_LOG.open("a", encoding="utf-8")
    creation_flags = 0
    if os.name == "nt":
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
    try:
        process = subprocess.Popen(
            [npm, "run", "start", "--", "--hostname", "127.0.0.1", "--port", str(port)],
            cwd=ROOT,
            env=environment,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            creationflags=creation_flags,
            start_new_session=os.name != "nt",
        )
    finally:
        log_handle.close()
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if port_open(port):
            return RunningServer(process, base_url, port)
        if process.poll() is not None:
            raise RuntimeError(f"演练服务提前退出，退出码={process.returncode}，日志={SERVER_LOG}")
        time.sleep(0.25)
    terminate_process_tree(process.pid)
    raise RuntimeError(f"演练服务未在 30 秒内启动，日志={SERVER_LOG}")


def stop_server(server: RunningServer) -> None:
    if server.process.poll() is None:
        terminate_process_tree(server.process.pid)
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline and port_open(server.port):
        time.sleep(0.2)
    require(not port_open(server.port), f"演练端口未释放: {server.port}")


def health(server: RunningServer, path: str = "/api/health") -> tuple[int, Mapping[str, object]]:
    result = request(build_opener(), server.base_url, path)
    return result.status, json_body(result)


def run_healthy_and_restart(database_url: str, storage_path: Path) -> None:
    first = start_server(database_url, storage_path)
    try:
        status, payload = health(first)
        require(status == 200 and payload.get("database") == "reachable", "健康检查未通过")
        opener = build_opener()
        login(opener, first.base_url, USERNAME, PASSWORD)
        deep = request(opener, first.base_url, "/api/health?deep=1")
        deep_payload = json_body(deep)
        require(deep.status == 200 and deep_payload.get("storage") == "reachable", "深度健康检查未通过")
        require(deep_payload.get("migrations") == "current", "深度健康检查迁移状态不正确")
        first_pid = first.process.pid
    finally:
        stop_server(first)

    second = start_server(database_url, storage_path)
    try:
        status, payload = health(second)
        require(status == 200 and second.process.pid != first_pid, "服务重启演练未产生新进程")
        require(payload.get("profile") == "test", "重启后 profile 不正确")
    finally:
        stop_server(second)
    print("健康检查与服务重启演练通过")


def run_database_failure(storage_path: Path) -> None:
    unreachable = "mysql://health_probe:invalid@127.0.0.1:1/crm_unreachable_test"
    server = start_server(unreachable, storage_path)
    try:
        status, payload = health(server)
        require(status == 503, f"数据库不可达应返回 503，实际为 {status}")
        require(payload.get("database") == "unreachable", "数据库不可达状态未暴露给健康检查")
    finally:
        stop_server(server)
    print("数据库不可达演练通过")


def run_storage_failure(database_url: str, missing_path: Path) -> None:
    server = start_server(database_url, missing_path)
    try:
        opener = build_opener()
        login(opener, server.base_url, USERNAME, PASSWORD)
        result = request(opener, server.base_url, "/api/health?deep=1")
        payload = json_body(result)
        require(result.status == 503, f"存储不可达应返回 503，实际为 {result.status}")
        require(payload.get("storage") == "unreachable", "存储不可达状态未暴露给深度检查")
    finally:
        stop_server(server)
    print("存储不可达演练通过")


def main() -> int:
    require(os.environ.get("CRM_PROFILE") == "test", "server-runtime-drill 只允许 test profile")
    require((ROOT / ".next" / "BUILD_ID").is_file(), "缺少生产构建，请先执行 build --profile test")
    database_url = os.environ.get("CRM_TEST_DATABASE_URL") or os.environ.get("DATABASE_URL", "")
    target = parse_database_url(database_url)
    require(target.database.lower().endswith("_test"), "server-runtime-drill 只允许 test 数据库")
    with tempfile.TemporaryDirectory(prefix="crm-server-drill-") as directory:
        root = Path(directory)
        storage = root / "storage"
        storage.mkdir()
        run_healthy_and_restart(database_url, storage)
        run_database_failure(storage)
        run_storage_failure(database_url, root / "missing-storage")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"服务端运行演练失败: {error}", file=sys.stderr)
        raise SystemExit(1)
