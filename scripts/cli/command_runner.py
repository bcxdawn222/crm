from __future__ import annotations

import logging
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Sequence

from runtime.profile_config import ProfileConfig


@dataclass(frozen=True)
class CommandResult:
    name: str
    return_code: int


def configure_logger(action: str, profile: ProfileConfig) -> logging.Logger:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    profile.log_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    log_path = profile.log_dir / f"manage-{action}-{timestamp}.log"
    logger = logging.getLogger("crm-manage")
    logger.handlers.clear()
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setFormatter(formatter)
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)
    logger.info("日志文件: %s", log_path)
    return logger


def run_command(
    name: str,
    command: Sequence[str],
    logger: logging.Logger,
    root: Path,
) -> CommandResult:
    executable_command = list(command)
    if os.name == "nt" and executable_command[0] in {"npm", "npx"}:
        executable_command[0] = f"{executable_command[0]}.cmd"
    logger.info("执行 %s: %s", name, " ".join(executable_command))
    child_env = os.environ.copy()
    child_env.setdefault("PYTHONIOENCODING", "utf-8")
    process = subprocess.Popen(
        executable_command,
        cwd=root,
        env=child_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert process.stdout is not None
    for line in process.stdout:
        logger.info("[%s] %s", name, line.rstrip())
    return_code = process.wait()
    logger.info("%s 退出码: %s", name, return_code)
    return CommandResult(name=name, return_code=return_code)


def run_sequence(
    commands: Sequence[tuple[str, Sequence[str]]],
    logger: logging.Logger,
    root: Path,
) -> int:
    for name, command in commands:
        result = run_command(name, command, logger, root)
        if result.return_code != 0:
            return result.return_code
    return 0
