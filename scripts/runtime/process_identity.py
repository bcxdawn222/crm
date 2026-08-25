from __future__ import annotations

import json
import os
import shutil
import signal
import subprocess
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class ProcessEntry:
    pid: int
    parent_pid: int
    command_line: str


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


def is_process_running(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        try:
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
        except OSError:
            return False
        return result.returncode == 0 and f'"{pid}"' in result.stdout
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _windows_processes() -> tuple[ProcessEntry, ...]:
    command = (
        "Get-CimInstance Win32_Process | "
        "Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress"
    )
    try:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except OSError:
        return ()
    if result.returncode != 0 or not result.stdout.strip():
        return ()
    try:
        payload: object = json.loads(result.stdout)
    except json.JSONDecodeError:
        return ()
    rows = payload if isinstance(payload, list) else [payload]
    entries: list[ProcessEntry] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        pid = row.get("ProcessId")
        parent_pid = row.get("ParentProcessId")
        if not isinstance(pid, int) or not isinstance(parent_pid, int):
            continue
        command_line = row.get("CommandLine")
        entries.append(ProcessEntry(pid, parent_pid, command_line if isinstance(command_line, str) else ""))
    return tuple(entries)


def _posix_processes() -> tuple[ProcessEntry, ...]:
    try:
        result = subprocess.run(
            ["ps", "-eo", "pid=,ppid=,args="],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except OSError:
        return ()
    entries: list[ProcessEntry] = []
    for line in result.stdout.splitlines():
        parts = line.strip().split(maxsplit=2)
        if len(parts) < 2 or not parts[0].isdigit() or not parts[1].isdigit():
            continue
        entries.append(ProcessEntry(int(parts[0]), int(parts[1]), parts[2] if len(parts) == 3 else ""))
    return tuple(entries)


def process_entries() -> tuple[ProcessEntry, ...]:
    return _windows_processes() if os.name == "nt" else _posix_processes()


def process_tree_ids(pid: int) -> set[int]:
    entries = process_entries()
    children: dict[int, list[int]] = {}
    for entry in entries:
        children.setdefault(entry.parent_pid, []).append(entry.pid)
    result = {pid}
    queue = [pid]
    while queue:
        current = queue.pop(0)
        for child in children.get(current, []):
            if child not in result:
                result.add(child)
                queue.append(child)
    return result


def process_command_lines(pid: int) -> list[str]:
    entries = process_entries()
    tree = process_tree_ids(pid)
    return [entry.command_line for entry in entries if entry.pid in tree and entry.command_line]


def listening_process_ids(port: int) -> set[int]:
    if os.name == "nt":
        command = (
            f"@(Get-NetTCPConnection -State Listen -LocalPort {port} -ErrorAction SilentlyContinue | "
            "Select-Object -ExpandProperty OwningProcess -Unique)"
        )
        try:
            result = subprocess.run(
                ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
        except OSError:
            return set()
        return {int(line.strip()) for line in result.stdout.splitlines() if line.strip().isdigit()}
    lsof = shutil.which("lsof")
    if not lsof:
        return set()
    try:
        result = subprocess.run(
            [lsof, "-t", f"-iTCP:{port}", "-sTCP:LISTEN"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except OSError:
        return set()
    return {int(line.strip()) for line in result.stdout.splitlines() if line.strip().isdigit()}


def process_belongs_to_crm(pid: int, *, port: int | None = None) -> bool:
    command_line = "\n".join(process_command_lines(pid)).lower()
    if not command_line or str(ROOT).lower() not in command_line:
        return False
    if "manage.py" in command_line and " start " in f" {command_line} ":
        return True
    if not any(runtime in command_line for runtime in ("next", "npm", "node")):
        return False
    return port is None or str(port) in command_line
