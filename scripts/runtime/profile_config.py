from __future__ import annotations

import os
from uuid import uuid4
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class ProfileConfig:
    name: str
    app_host: str
    app_port: int
    database_url: str
    database_host: str
    database_port: int
    upload_dir: Path
    log_dir: Path
    pid_file: Path
    lock_file: Path
    build_dir: Path


def _read_env_value(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if value:
        return value.strip('"').strip("'")

    return _read_file_env_value(name)


def _read_file_env_value(name: str) -> str:
    for env_path in (ROOT / ".env.local", ROOT / ".env"):
        if not env_path.is_file():
            continue
        for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, raw_value = line.split("=", 1)
            if key.strip() == name:
                return raw_value.strip().strip('"').strip("'")
    return ""


def _stable_database_url() -> str:
    return (
        os.environ.get("CRM_STABLE_DATABASE_URL", "").strip()
        or _read_file_env_value("CRM_STABLE_DATABASE_URL")
        or _read_file_env_value("DATABASE_URL")
    )


def _required_database_url(profile_name: str) -> str:
    if profile_name == "stable":
        value = _stable_database_url()
    else:
        value = _read_env_value("CRM_TEST_DATABASE_URL")
        stable_value = _stable_database_url()
        if not value:
            raise ValueError("test profile 必须配置 CRM_TEST_DATABASE_URL，不能复用稳定版数据库")
        if stable_value and value == stable_value:
            raise ValueError("CRM_TEST_DATABASE_URL 不能与稳定版 DATABASE_URL 相同")
    if not value:
        raise ValueError(f"{profile_name} profile 未配置数据库连接")
    return value


def get_profile_config(name: str) -> ProfileConfig:
    profile_name = name.strip().lower()
    if profile_name not in {"stable", "test"}:
        raise ValueError("profile 只能是 stable 或 test")

    database_url = _required_database_url(profile_name)
    parsed = urlsplit(database_url)
    if parsed.scheme not in {"mysql", "mariadb"} or not parsed.hostname:
        raise ValueError(f"{profile_name} profile 的数据库连接不是有效的 MySQL/MariaDB 地址")

    default_app_port = 3000 if profile_name == "stable" else 3001
    port_value = os.environ.get(f"CRM_{profile_name.upper()}_PORT", str(default_app_port))
    try:
        app_port = int(port_value)
    except ValueError as error:
        raise ValueError(f"CRM_{profile_name.upper()}_PORT 必须是数字") from error
    if not 1 <= app_port <= 65535:
        raise ValueError(f"CRM_{profile_name.upper()}_PORT 必须在 1 到 65535 之间")
    other_name = "test" if profile_name == "stable" else "stable"
    other_default = 3001 if other_name == "test" else 3000
    other_port_value = os.environ.get(f"CRM_{other_name.upper()}_PORT", str(other_default))
    try:
        other_port = int(other_port_value)
    except ValueError as error:
        raise ValueError(f"CRM_{other_name.upper()}_PORT 必须是数字") from error
    if app_port == other_port:
        raise ValueError("stable 与 test profile 不能使用相同应用端口")

    profile_root = ROOT / ".runtime" / profile_name
    log_dir = ROOT / "logs" / profile_name
    return ProfileConfig(
        name=profile_name,
        app_host=os.environ.get(f"CRM_{profile_name.upper()}_HOST", "127.0.0.1"),
        app_port=app_port,
        database_url=database_url,
        database_host=parsed.hostname,
        database_port=parsed.port or 3306,
        upload_dir=Path(os.environ.get(f"CRM_{profile_name.upper()}_UPLOAD_DIR", str(ROOT / "storage" / profile_name))),
        log_dir=log_dir,
        pid_file=profile_root / "server.pid",
        lock_file=profile_root / "server.lock",
        build_dir=ROOT / ".build" / profile_name,
    )


def validate_profile_isolated(config: ProfileConfig) -> None:
    directories = (config.log_dir, config.upload_dir, config.pid_file.parent, config.build_dir)
    for directory in directories:
        try:
            directory.mkdir(parents=True, exist_ok=True)
        except OSError as error:
            raise ValueError(f"运行目录不可用: {directory}: {error}") from error
    if config.name == "test":
        stable_url = _stable_database_url()
        if stable_url and stable_url == config.database_url:
            raise ValueError("test profile 与 stable profile 使用了相同数据库连接")
    for directory in directories:
        probe = directory / f".crm-write-probe-{uuid4().hex}"
        try:
            with probe.open("x", encoding="ascii") as handle:
                handle.write("ok")
        except OSError as error:
            raise ValueError(f"运行目录不可写: {directory}: {error}") from error
        finally:
            probe.unlink(missing_ok=True)
