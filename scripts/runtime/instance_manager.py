from __future__ import annotations

import logging
import os
import subprocess
import time

from .instance_state import (
    ROOT,
    InstanceKind,
    InstanceRecord,
    inspect_instance,
    is_port_open,
    parse_instance_record,
    record_matches_config,
    remove_instance_files,
    write_instance_record,
)
from .process_identity import listening_process_ids, process_tree_ids, terminate_process_tree
from .profile_config import ProfileConfig, validate_profile_isolated


def _log_server_tail(logger: logging.Logger, config: ProfileConfig, line_count: int = 40) -> None:
    path = config.log_dir / "server.log"
    if not path.exists():
        logger.error("服务日志不存在: %s", path)
        return
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines()[-line_count:]:
        logger.error("[server] %s", line)


def _acquire_lock(config: ProfileConfig) -> None:
    record = InstanceRecord(os.getpid(), config.name, config.app_port, ROOT)
    try:
        write_instance_record(config.lock_file, record, exclusive=True)
    except FileExistsError as error:
        inspection = inspect_instance(config)
        if inspection.kind is InstanceKind.STALE and not is_port_open(config.app_host, config.app_port):
            remove_instance_files(config)
            try:
                write_instance_record(config.lock_file, record, exclusive=True)
                return
            except FileExistsError as retry_error:
                raise RuntimeError(f"{config.name} profile 启动锁正在被其他进程使用") from retry_error
        raise RuntimeError(
            f"{config.name} profile 已有实例，状态={inspection.kind.value}，PID={inspection.pid}"
        ) from error


def _prepare_start(logger: logging.Logger, config: ProfileConfig, *, current_pid: int) -> bool:
    try:
        lock_record = parse_instance_record(config.lock_file)
    except (OSError, UnicodeError, ValueError):
        lock_record = None
    if lock_record and lock_record.pid == current_pid and record_matches_config(lock_record, config):
        if is_port_open(config.app_host, config.app_port):
            logger.error(
                "拒绝启动 %s profile：端口 %s 已被进程 %s 占用",
                config.name,
                config.app_port,
                sorted(listening_process_ids(config.app_port)),
            )
            return False
        return True

    inspection = inspect_instance(config)
    if inspection.kind is InstanceKind.STARTING and inspection.pid == current_pid:
        return True
    if inspection.kind is InstanceKind.STOPPED:
        return True
    if inspection.kind is InstanceKind.STALE:
        if is_port_open(config.app_host, config.app_port):
            logger.error("实例状态=%s，且端口仍在监听: %s", inspection.kind.value, inspection.detail)
            return False
        logger.warning("清理%s profile 陈旧实例记录: %s", config.name, inspection.detail)
        remove_instance_files(config)
        return True
    logger.error(
        "拒绝启动 %s profile：状态=%s，PID=%s，端口进程=%s，%s",
        config.name,
        inspection.kind.value,
        inspection.pid,
        list(inspection.port_pids),
        inspection.detail,
    )
    return False


def start_server(logger: logging.Logger, config: ProfileConfig) -> int:
    try:
        validate_profile_isolated(config)
    except ValueError as error:
        logger.error("profile 运行目录校验失败: %s", error)
        return 2

    # 没有锁但有 PID 文件时，先处理已退出的残留记录；之后的排他锁负责并发保护。
    if config.pid_file.exists() and not config.lock_file.exists():
        inspection = inspect_instance(config)
        if inspection.kind is InstanceKind.STALE and not is_port_open(config.app_host, config.app_port):
            remove_instance_files(config)
        elif inspection.kind is InstanceKind.FOREIGN_PID and not is_port_open(
            config.app_host, config.app_port
        ):
            logger.warning("清理%s profile 外部 PID 残留记录，不终止外部进程: %s", config.name, inspection.detail)
            config.pid_file.unlink(missing_ok=True)
        elif inspection.kind is not InstanceKind.STOPPED:
            logger.error(
                "拒绝启动 %s profile：已有记录状态=%s，PID=%s，端口进程=%s，%s",
                config.name,
                inspection.kind.value,
                inspection.pid,
                list(inspection.port_pids),
                inspection.detail,
            )
            return 1
    try:
        _acquire_lock(config)
    except RuntimeError as error:
        logger.error("%s", error)
        return 1

    try:
        if not _prepare_start(logger, config, current_pid=os.getpid()):
            remove_instance_files(config)
            return 1

        from .manager import start_database

        if start_database(logger, config) != 0:
            remove_instance_files(config)
            return 1
        server_log_path = config.log_dir / "server.log"
        creation_flags = 0
        if os.name == "nt":
            creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
        npm_command = "npm.cmd" if os.name == "nt" else "npm"
        nextauth_url = os.environ.get(f"CRM_{config.name.upper()}_NEXTAUTH_URL", "")
        if not nextauth_url and config.name == "stable":
            nextauth_url = os.environ.get("NEXTAUTH_URL", "")
        nextauth_url = nextauth_url or f"http://{config.app_host}:{config.app_port}"
        process: subprocess.Popen[bytes] | None = None
        with server_log_path.open("a", encoding="utf-8") as server_log:
            process = subprocess.Popen(
                [npm_command, "run", "dev", "--", "--hostname", config.app_host, "--port", str(config.app_port)],
                cwd=ROOT,
                env={
                    **os.environ,
                    "CRM_PROFILE": config.name,
                    "CRM_UPLOAD_DIR": str(config.upload_dir),
                    "DATABASE_URL": config.database_url,
                    "NEXTAUTH_URL": nextauth_url,
                },
                stdout=server_log,
                stderr=subprocess.STDOUT,
                creationflags=creation_flags,
                start_new_session=os.name != "nt",
            )
        record = InstanceRecord(process.pid, config.name, config.app_port, ROOT)
        write_instance_record(config.lock_file, record)
        write_instance_record(config.pid_file, record)
    except (OSError, ValueError) as error:
        if "process" in locals() and process and process.poll() is None:
            terminate_process_tree(process.pid)
        remove_instance_files(config)
        logger.error("服务进程创建失败: %s", error)
        return 1

    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if is_port_open(config.app_host, config.app_port):
            owners = listening_process_ids(config.app_port)
            if owners and process_tree_ids(process.pid).isdisjoint(owners):
                logger.error("端口 %s 由其他进程监听: %s", config.app_port, sorted(owners))
                break
            logger.info("服务已启动，profile=%s，PID=%s，日志=%s", config.name, process.pid, server_log_path)
            return 0
        if process.poll() is not None:
            logger.error("服务进程提前退出，退出码=%s", process.returncode)
            _log_server_tail(logger, config)
            remove_instance_files(config)
            return process.returncode or 1
        time.sleep(0.5)
    logger.error("服务在 30 秒内未正确监听端口 %s", config.app_port)
    _log_server_tail(logger, config)
    if process.poll() is None:
        terminate_process_tree(process.pid)
    remove_instance_files(config)
    return 1


def stop_server(logger: logging.Logger, config: ProfileConfig) -> int:
    inspection = inspect_instance(config)
    if inspection.kind is InstanceKind.STOPPED:
        logger.info("%s profile 已停止", config.name)
        remove_instance_files(config)
        return 0
    if inspection.kind is InstanceKind.STALE:
        if is_port_open(config.app_host, config.app_port):
            logger.error("拒绝清理活动端口上的异常实例: %s", inspection.detail)
            return 1
        logger.warning("清理%s profile 实例残留: %s", config.name, inspection.detail)
        remove_instance_files(config)
        return 0
    if inspection.kind in {InstanceKind.CORRUPT, InstanceKind.FOREIGN_PID}:
        logger.error("拒绝处理无法确认归属的%s profile 实例: %s", config.name, inspection.detail)
        return 1
    if inspection.kind is InstanceKind.PORT_CONFLICT or inspection.pid is None:
        logger.error("拒绝停止未确认归属的端口进程: %s", inspection.detail)
        return 1
    terminate_process_tree(inspection.pid)
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline and is_port_open(config.app_host, config.app_port):
        time.sleep(0.25)
    if is_port_open(config.app_host, config.app_port):
        logger.error("进程树终止后端口 %s 仍在监听", config.app_port)
        return 1
    remove_instance_files(config)
    logger.info("%s profile 服务已停止，PID=%s", config.name, inspection.pid)
    return 0
