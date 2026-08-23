from __future__ import annotations

import logging
import os
import signal
import socket
import subprocess
import time
from pathlib import Path

from .profile_config import ProfileConfig, validate_profile_isolated


ROOT = Path(__file__).resolve().parents[2]
MYSQL_PID_FILE = ROOT / "logs" / "mysql.pid"
MYSQL_SERVER_LOG = ROOT / "logs" / "mysql-server.log"
DATABASE_HOST = "127.0.0.1"
DATABASE_PORT = 3306
MYSQL_SERVICE_NAME = os.environ.get("CRM_MYSQL_SERVICE", "MySQL")
MYSQL_BINARY = os.environ.get("CRM_MYSQL_BIN", "")
MYSQL_CONFIG = os.environ.get("CRM_MYSQL_CONFIG", "")


def is_process_running(pid: int) -> bool:
    if os.name == "nt":
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return result.returncode == 0 and f'"{pid}"' in result.stdout
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def is_port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def terminate_process_tree(pid: int) -> None:
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return
    os.killpg(pid, signal.SIGTERM)


def _log_server_tail(logger: logging.Logger, config: ProfileConfig, line_count: int = 40) -> None:
    path = config.log_dir / "server.log"
    if not path.exists():
        logger.error("服务日志不存在: %s", path)
        return
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    for line in lines[-line_count:]:
        logger.error("[server] %s", line)


def start_database_direct(logger: logging.Logger, host: str, port: int) -> int:
    if not MYSQL_BINARY:
        logger.error("未配置 CRM_MYSQL_BIN，不能使用本地 MySQL 进程启动模式")
        return 2
    binary = Path(MYSQL_BINARY)
    if not binary.is_file():
        logger.error("MySQL 可执行文件不存在: %s", binary)
        return 2
    if MYSQL_PID_FILE.exists():
        pid_text = MYSQL_PID_FILE.read_text(encoding="ascii", errors="ignore").strip()
        if pid_text.isdigit() and is_process_running(int(pid_text)):
            logger.info("本地 MySQL 进程已在运行，PID=%s", pid_text)
            return 0 if is_port_open(host, port) else 1
        MYSQL_PID_FILE.unlink(missing_ok=True)

    MYSQL_SERVER_LOG.parent.mkdir(parents=True, exist_ok=True)
    server_log = MYSQL_SERVER_LOG.open("a", encoding="utf-8")
    creation_flags = 0
    if os.name == "nt":
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
    command = [str(binary)]
    if MYSQL_CONFIG:
        config_path = Path(MYSQL_CONFIG)
        if not config_path.is_file():
            server_log.close()
            logger.error("MySQL 配置文件不存在: %s", config_path)
            return 2
        command.append(f"--defaults-file={config_path}")
    command.append("--console")
    process = subprocess.Popen(
        command,
        cwd=binary.parent,
        stdout=server_log,
        stderr=subprocess.STDOUT,
        creationflags=creation_flags,
        start_new_session=os.name != "nt",
    )
    server_log.close()
    MYSQL_PID_FILE.write_text(str(process.pid), encoding="ascii")
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if is_port_open(host, port):
            logger.info("本地 MySQL 已启动，PID=%s，日志=%s", process.pid, MYSQL_SERVER_LOG)
            return 0
        if process.poll() is not None:
            logger.error("本地 MySQL 提前退出，退出码=%s", process.returncode)
            MYSQL_PID_FILE.unlink(missing_ok=True)
            return process.returncode or 1
        time.sleep(0.5)
    logger.error("本地 MySQL 在 30 秒内未监听端口 %s，日志=%s", port, MYSQL_SERVER_LOG)
    terminate_process_tree(process.pid)
    MYSQL_PID_FILE.unlink(missing_ok=True)
    return 1


def stop_database_direct(logger: logging.Logger) -> int:
    if not MYSQL_PID_FILE.exists():
        logger.warning("未找到本地 MySQL PID 文件: %s", MYSQL_PID_FILE)
        return 0 if not is_port_open(DATABASE_HOST, DATABASE_PORT) else 1
    pid_text = MYSQL_PID_FILE.read_text(encoding="ascii", errors="ignore").strip()
    if not pid_text.isdigit():
        logger.error("本地 MySQL PID 文件内容无效: %s", MYSQL_PID_FILE)
        return 1
    pid = int(pid_text)
    if is_process_running(pid):
        terminate_process_tree(pid)
        logger.info("本地 MySQL 已停止，PID=%s", pid)
    MYSQL_PID_FILE.unlink(missing_ok=True)
    return 0


def start_database(logger: logging.Logger, config: ProfileConfig) -> int:
    if is_port_open(config.database_host, config.database_port):
        logger.info("数据库端口已就绪: %s:%s", config.database_host, config.database_port)
        return 0
    if os.environ.get("CRM_MYSQL_DIRECT") == "1":
        return start_database_direct(logger, config.database_host, config.database_port)
    if os.name != "nt":
        logger.error("数据库端口未监听，请先启动 MySQL: %s:%s", config.database_host, config.database_port)
        return 1

    logger.info("启动 Windows 服务: %s", MYSQL_SERVICE_NAME)
    result = subprocess.run(
        ["sc.exe", "start", MYSQL_SERVICE_NAME],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    output = (result.stdout or result.stderr).strip()
    if output:
        logger.info("[mysql-service] %s", output)
    if result.returncode != 0:
        logger.error("MySQL 服务启动失败，服务名=%s，退出码=%s", MYSQL_SERVICE_NAME, result.returncode)
        return result.returncode
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if is_port_open(config.database_host, config.database_port):
            logger.info("数据库已启动: %s:%s", config.database_host, config.database_port)
            return 0
        time.sleep(0.5)
    logger.error("MySQL 服务已请求启动，但 30 秒内端口 %s 未就绪", config.database_port)
    return 1


def _release_lock(config: ProfileConfig) -> None:
    config.lock_file.unlink(missing_ok=True)


def _acquire_lock(config: ProfileConfig, pid: int) -> None:
    try:
        handle = config.lock_file.open("x", encoding="utf-8")
    except FileExistsError as error:
        raise RuntimeError(f"{config.name} profile 已有实例锁: {config.lock_file}") from error
    with handle:
        handle.write(f"pid={pid}\nprofile={config.name}\nport={config.app_port}\nroot={ROOT}\n")


def start_server(logger: logging.Logger, config: ProfileConfig) -> int:
    validate_profile_isolated(config)
    database_result = start_database(logger, config)
    if database_result != 0:
        return database_result
    if config.pid_file.exists():
        pid_text = config.pid_file.read_text(encoding="ascii", errors="ignore").strip()
        if pid_text.isdigit() and is_process_running(int(pid_text)):
            logger.error("%s profile 服务已在运行，PID=%s", config.name, pid_text)
            return 1
        config.pid_file.unlink(missing_ok=True)
        _release_lock(config)
    if is_port_open(config.app_host, config.app_port):
        logger.error("端口 %s 已被占用，无法确认该进程属于当前项目", config.app_port)
        return 1

    server_log_path = config.log_dir / "server.log"
    server_log = server_log_path.open("a", encoding="utf-8")
    creation_flags = 0
    if os.name == "nt":
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
    npm_command = "npm.cmd" if os.name == "nt" else "npm"
    process = subprocess.Popen(
        [npm_command, "run", "dev", "--", "--hostname", config.app_host, "--port", str(config.app_port)],
        cwd=ROOT,
        env={
            **os.environ,
            "CRM_PROFILE": config.name,
            "CRM_UPLOAD_DIR": str(config.upload_dir),
            "DATABASE_URL": config.database_url,
        },
        stdout=server_log,
        stderr=subprocess.STDOUT,
        creationflags=creation_flags,
        start_new_session=os.name != "nt",
    )
    server_log.close()
    _acquire_lock(config, process.pid)
    config.pid_file.write_text(str(process.pid), encoding="ascii")
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if is_port_open(config.app_host, config.app_port):
            logger.info("服务已启动，profile=%s，PID=%s，日志=%s", config.name, process.pid, server_log_path)
            return 0
        if process.poll() is not None:
            logger.error("服务进程提前退出，退出码=%s", process.returncode)
            _log_server_tail(logger, config)
            config.pid_file.unlink(missing_ok=True)
            _release_lock(config)
            return process.returncode or 1
        time.sleep(0.5)
    logger.error("服务在 30 秒内未监听端口 %s", config.app_port)
    _log_server_tail(logger, config)
    terminate_process_tree(process.pid)
    config.pid_file.unlink(missing_ok=True)
    _release_lock(config)
    return 1


def stop_server(logger: logging.Logger, config: ProfileConfig) -> int:
    if not config.pid_file.exists():
        logger.error("未找到 %s profile PID 文件: %s", config.name, config.pid_file)
        return 1
    pid_text = config.pid_file.read_text(encoding="ascii").strip()
    if not pid_text.isdigit():
        logger.error("PID 文件内容无效: %s", config.pid_file)
        return 1
    pid = int(pid_text)
    if is_process_running(pid):
        terminate_process_tree(pid)
        logger.info("%s profile 服务已停止，PID=%s", config.name, pid)
    config.pid_file.unlink(missing_ok=True)
    _release_lock(config)
    return 0
