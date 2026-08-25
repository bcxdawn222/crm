from __future__ import annotations

import socket
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from .process_identity import (
    is_process_running,
    listening_process_ids,
    process_belongs_to_crm,
    process_tree_ids,
)
from .profile_config import ProfileConfig


ROOT = Path(__file__).resolve().parents[2]


class InstanceKind(str, Enum):
    STOPPED = "stopped"
    RUNNING = "running"
    STARTING = "starting"
    STALE = "stale"
    FOREIGN_PID = "foreign_pid"
    PORT_CONFLICT = "port_conflict"
    CORRUPT = "corrupt"


@dataclass(frozen=True)
class InstanceRecord:
    pid: int
    profile: str
    port: int
    root: Path


@dataclass(frozen=True)
class InstanceInspection:
    kind: InstanceKind
    pid: int | None
    port_pids: tuple[int, ...]
    detail: str


def is_port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def parse_instance_record(path: Path) -> InstanceRecord:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="strict").splitlines():
        key, separator, value = line.partition("=")
        if not separator or not key or key in values:
            raise ValueError(f"实例文件格式损坏: {path}")
        values[key] = value
    if set(values) != {"pid", "profile", "port", "root"}:
        raise ValueError(f"实例文件字段不完整: {path}")
    if not values["pid"].isdigit() or not values["port"].isdigit():
        raise ValueError(f"实例文件 PID 或端口无效: {path}")
    return InstanceRecord(
        pid=int(values["pid"]),
        profile=values["profile"],
        port=int(values["port"]),
        root=Path(values["root"]).resolve(),
    )


def record_matches_config(record: InstanceRecord, config: ProfileConfig) -> bool:
    return record.profile == config.name and record.port == config.app_port and record.root == ROOT.resolve()


def record_text(record: InstanceRecord) -> str:
    return f"pid={record.pid}\nprofile={record.profile}\nport={record.port}\nroot={record.root}\n"


def write_instance_record(path: Path, record: InstanceRecord, *, exclusive: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if exclusive:
        with path.open("x", encoding="utf-8") as handle:
            handle.write(record_text(record))
        return
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(record_text(record), encoding="utf-8")
    temporary.replace(path)


def remove_instance_files(config: ProfileConfig) -> None:
    config.pid_file.unlink(missing_ok=True)
    config.lock_file.unlink(missing_ok=True)


def _read_records(config: ProfileConfig) -> tuple[InstanceRecord | None, InstanceRecord | None]:
    pid_record = parse_instance_record(config.pid_file) if config.pid_file.exists() else None
    lock_record = parse_instance_record(config.lock_file) if config.lock_file.exists() else None
    for record in (pid_record, lock_record):
        if record and not record_matches_config(record, config):
            raise ValueError("实例文件与当前 profile、端口或项目目录不匹配")
    if pid_record and lock_record and pid_record != lock_record:
        raise ValueError("PID 文件与锁文件记录不一致")
    return pid_record, lock_record


def inspect_instance(config: ProfileConfig) -> InstanceInspection:
    port_open = is_port_open(config.app_host, config.app_port)
    port_pids = tuple(sorted(listening_process_ids(config.app_port))) if port_open else ()
    try:
        pid_record, lock_record = _read_records(config)
    except (OSError, UnicodeError, ValueError) as error:
        return InstanceInspection(InstanceKind.CORRUPT, None, port_pids, str(error))
    record = pid_record or lock_record
    if record is None:
        kind = InstanceKind.PORT_CONFLICT if port_open else InstanceKind.STOPPED
        detail = "端口已被未登记进程占用" if port_open else "没有实例记录"
        return InstanceInspection(kind, None, port_pids, detail)
    if not is_process_running(record.pid):
        kind = InstanceKind.PORT_CONFLICT if port_open else InstanceKind.STALE
        detail = "记录进程已退出，但端口仍被占用" if port_open else "实例记录已陈旧"
        return InstanceInspection(kind, record.pid, port_pids, detail)
    if not process_belongs_to_crm(record.pid, port=config.app_port):
        return InstanceInspection(InstanceKind.FOREIGN_PID, record.pid, port_pids, "PID 已被其他进程复用")
    if not port_open:
        return InstanceInspection(InstanceKind.STARTING, record.pid, (), "CRM 进程存在，端口尚未监听")
    if port_pids and process_tree_ids(record.pid).isdisjoint(port_pids):
        return InstanceInspection(InstanceKind.PORT_CONFLICT, record.pid, port_pids, "监听端口不属于记录进程树")
    return InstanceInspection(InstanceKind.RUNNING, record.pid, port_pids, "CRM 实例正常运行")
