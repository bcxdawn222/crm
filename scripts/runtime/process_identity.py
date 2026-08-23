from __future__ import annotations

import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


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


def process_command_line(pid: int) -> str:
    if not is_process_running(pid):
        return ""
    if os.name == "nt":
        command = (
            "$p=Get-CimInstance Win32_Process -Filter "
            f"'ProcessId = {pid}'; if ($p) {{ $p.CommandLine }}"
        )
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return result.stdout.strip()
    command_path = Path(f"/proc/{pid}/cmdline")
    if not command_path.exists():
        return ""
    return command_path.read_bytes().replace(b"\x00", b" ").decode("utf-8", errors="replace").strip()


def process_belongs_to_crm(pid: int) -> bool:
    command_line = process_command_line(pid).lower()
    root_text = str(ROOT).lower()
    return bool(
        command_line
        and root_text in command_line
        and ("next" in command_line or "npm" in command_line or "node" in command_line)
    )
