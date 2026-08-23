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


def process_command_lines(pid: int) -> list[str]:
    if not is_process_running(pid):
        return []
    if os.name == "nt":
        command = (
            "$all=@(Get-CimInstance Win32_Process); "
            "$queue=New-Object System.Collections.Generic.Queue[int]; "
            "$seen=@{}; "
            f"$queue.Enqueue({pid}); $seen[{pid}]=\$true; $lines=@(); "
            "while($queue.Count -gt 0){$current=$queue.Dequeue(); "
            "foreach($p in $all | Where-Object {$_.ParentProcessId -eq $current}){"
            "if(-not $seen.ContainsKey([int]$p.ProcessId)){ $seen[[int]$p.ProcessId]=\$true; "
            "$queue.Enqueue([int]$p.ProcessId); if($p.CommandLine){$lines += $p.CommandLine}}}}; "
            "$lines"
        )
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]
    command_path = Path(f"/proc/{pid}/cmdline")
    if not command_path.exists():
        return []
    return [command_path.read_bytes().replace(b"\x00", b" ").decode("utf-8", errors="replace").strip()]


def process_belongs_to_crm(pid: int) -> bool:
    command_line = "\n".join(process_command_lines(pid)).lower()
    root_text = str(ROOT).lower()
    return bool(
        command_line
        and root_text in command_line
        and ("next" in command_line or "npm" in command_line or "node" in command_line)
    )
