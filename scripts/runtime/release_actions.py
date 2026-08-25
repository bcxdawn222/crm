from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path
from typing import Callable, Sequence

from .profile_config import ProfileConfig


RunSequence = Callable[[Sequence[tuple[str, Sequence[str]]], logging.Logger], int]


def run_release_action(
    action: str,
    profile: ProfileConfig,
    artifact: str | None,
    logger: logging.Logger,
    run_sequence: RunSequence,
    root: Path,
) -> int:
    if action == "release":
        return run_sequence(
            (
                ("typecheck", (sys.executable, str(root / "scripts" / "manage.py"), "typecheck", "--profile", profile.name)),
                ("build", (sys.executable, str(root / "scripts" / "manage.py"), "build", "--profile", profile.name)),
                ("release", (sys.executable, str(root / "scripts" / "release.py"), "release", "--profile", profile.name)),
            ),
            logger,
        )
    if profile.name != "stable":
        logger.error("%s 只允许 --profile stable", action)
        return 2
    command = [sys.executable, str(root / "scripts" / "release.py"), action]
    if artifact:
        command.extend(("--artifact", artifact))
    return run_sequence(((action, tuple(command)),), logger)
