from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class ReleaseChannelState:
    current_release_id: str | None
    previous_release_id: str | None
    updated_at_utc: str


def state_path(root: Path) -> Path:
    return root / ".build" / "stable" / "channel-state.json"


def read_state(root: Path) -> ReleaseChannelState:
    path = state_path(root)
    if not path.is_file():
        return ReleaseChannelState(None, None, datetime.now(timezone.utc).isoformat())
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("stable 发布状态格式无效")
    current = payload.get("current_release_id")
    previous = payload.get("previous_release_id")
    updated = payload.get("updated_at_utc")
    if current is not None and not isinstance(current, str):
        raise RuntimeError("stable 当前版本状态无效")
    if previous is not None and not isinstance(previous, str):
        raise RuntimeError("stable 上一版本状态无效")
    if not isinstance(updated, str):
        raise RuntimeError("stable 发布时间状态无效")
    return ReleaseChannelState(current, previous, updated)


def write_state(root: Path, current: str, previous: str | None) -> None:
    path = state_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    state = ReleaseChannelState(current, previous, datetime.now(timezone.utc).isoformat())
    temporary.write_text(json.dumps(asdict(state), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def previous_promoted_artifact(root: Path) -> Path:
    state = read_state(root)
    if not state.previous_release_id:
        raise RuntimeError("stable 不存在可回滚的上一版本")
    archive = root / ".build" / "stable" / "promoted" / f"{state.previous_release_id}.zip"
    if not archive.is_file():
        raise RuntimeError(f"上一 stable 发布产物不存在: {archive}")
    return archive
