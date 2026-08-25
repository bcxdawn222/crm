from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from release_state import previous_promoted_artifact, read_state, write_state
ROOT = Path(__file__).resolve().parents[1]


class ReleaseAction(str, Enum):
    RELEASE = "release"
    PROMOTE = "promote"
    ROLLBACK = "rollback"
@dataclass(frozen=True)
class MigrationEntry:
    path: str
    sha256: str
@dataclass(frozen=True)
class ReleaseManifest:
    schema_version: int
    release_id: str
    profile: str
    version: str
    commit: str
    build_time_utc: str
    gate_status: str
    migration_entries: tuple[MigrationEntry, ...]
    included_paths: tuple[str, ...]
@dataclass(frozen=True)
class ReleaseArtifact:
    archive: Path
    checksum: str
    manifest: ReleaseManifest
def git_output(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        raise RuntimeError(f"Git 命令失败: git {' '.join(args)}: {result.stderr.strip()}")
    return result.stdout.strip()
def package_version() -> str:
    package_path = ROOT / "package.json"
    payload = json.loads(package_path.read_text(encoding="utf-8"))
    version = payload.get("version") if isinstance(payload, dict) else None
    if not isinstance(version, str) or not version.strip():
        raise RuntimeError("package.json 缺少有效 version")
    return version.strip()
def ensure_clean_worktree() -> None:
    if os.environ.get("CRM_ALLOW_DIRTY_RELEASE") == "1":
        return
    status = git_output("status", "--porcelain")
    if status:
        raise RuntimeError("工作区存在未提交改动，不能生成发布产物；请先提交或设置 CRM_ALLOW_DIRTY_RELEASE=1")
def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
def migration_entries() -> tuple[MigrationEntry, ...]:
    migration_root = ROOT / "prisma" / "migrations"
    entries: list[MigrationEntry] = []
    if not migration_root.is_dir():
        return ()
    for path in sorted(item for item in migration_root.rglob("*") if item.is_file()):
        entries.append(MigrationEntry(path.relative_to(ROOT).as_posix(), sha256_file(path)))
    return tuple(entries)
def release_paths(profile: str, release_id: str) -> tuple[Path, Path]:
    root = ROOT / ".build" / profile / "release"
    return root / release_id, root / f"{release_id}.zip"
def required_paths() -> tuple[Path, ...]:
    return (
        ROOT / ".next",
        ROOT / "next.config.js",
        ROOT / "package.json",
        ROOT / "package-lock.json",
        ROOT / "public",
        ROOT / "prisma" / "schema.prisma",
        ROOT / "prisma" / "migrations",
        ROOT / "scripts" / "manage.py",
        ROOT / "scripts" / "runtime",
        ROOT / "scripts" / "deploy",
    )
def included_files() -> tuple[Path, ...]:
    files: list[Path] = []
    for entry in required_paths():
        if not entry.exists():
            raise RuntimeError(f"发布所需路径不存在: {entry}")
        if entry.is_file():
            files.append(entry)
        else:
            files.extend(
                item
                for item in entry.rglob("*")
                if item.is_file() and ".next/cache" not in item.relative_to(ROOT).as_posix()
            )
    unique = {path.resolve(): path for path in files}
    return tuple(sorted(unique.values()))
def write_manifest(path: Path, manifest: ReleaseManifest) -> None:
    path.write_text(
        json.dumps(asdict(manifest), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
def write_checksum(path: Path, archive: Path) -> str:
    checksum = sha256_file(archive)
    path.write_text(f"{checksum}  {archive.name}\n", encoding="ascii")
    return checksum
def create_release(profile: str) -> ReleaseArtifact:
    ensure_clean_worktree()
    commit = git_output("rev-parse", "HEAD")
    version = os.environ.get("CRM_RELEASE_VERSION", "").strip() or package_version()
    release_id = f"{version}-{commit[:8]}"
    staging, archive = release_paths(profile, release_id)
    if staging.exists() or archive.exists():
        raise RuntimeError(f"发布产物已存在，拒绝覆盖: {archive}")
    staging.mkdir(parents=True, exist_ok=False)

    files = included_files()
    relative_paths = tuple(path.relative_to(ROOT).as_posix() for path in files)
    manifest = ReleaseManifest(
        schema_version=1,
        release_id=release_id,
        profile=profile,
        version=version,
        commit=commit,
        build_time_utc=datetime.now(timezone.utc).isoformat(),
        gate_status="passed",
        migration_entries=migration_entries(),
        included_paths=relative_paths,
    )
    try:
        for source in files:
            target = staging / source.relative_to(ROOT)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
        write_manifest(staging / "release-manifest.json", manifest)
        archive.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as handle:
            for source in sorted(item for item in staging.rglob("*") if item.is_file()):
                handle.write(source, source.relative_to(staging).as_posix())
        checksum = write_checksum(archive.with_suffix(".sha256"), archive)
        shutil.rmtree(staging)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        archive.unlink(missing_ok=True)
        archive.with_suffix(".sha256").unlink(missing_ok=True)
        raise
    print(f"发布产物已生成: {archive}")
    print(f"SHA256: {checksum}")
    print(f"版本: {manifest.version}，提交: {manifest.commit}，profile: {manifest.profile}")
    return ReleaseArtifact(archive, checksum, manifest)


def read_manifest(archive: Path) -> ReleaseManifest:
    if not archive.is_file():
        raise RuntimeError(f"发布产物不存在: {archive}")
    with zipfile.ZipFile(archive) as handle:
        try:
            payload = json.loads(handle.read("release-manifest.json"))
        except (KeyError, json.JSONDecodeError) as error:
            raise RuntimeError(f"发布产物缺少有效 release-manifest.json: {archive}") from error
    if not isinstance(payload, dict):
        raise RuntimeError("发布清单格式无效")
    migration_payload = payload.get("migration_entries")
    included_payload = payload.get("included_paths")
    if not isinstance(migration_payload, list) or not isinstance(included_payload, list):
        raise RuntimeError("发布清单缺少迁移或文件清单")
    migrations: list[MigrationEntry] = []
    for item in migration_payload:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str) or not isinstance(item.get("sha256"), str):
            raise RuntimeError("发布清单迁移项格式无效")
        migrations.append(MigrationEntry(item["path"], item["sha256"]))
    required_strings = ("release_id", "profile", "version", "commit", "build_time_utc", "gate_status")
    if any(not isinstance(payload.get(key), str) or not payload[key] for key in required_strings):
        raise RuntimeError("发布清单元数据不完整")
    return ReleaseManifest(
        schema_version=int(payload.get("schema_version", 0)),
        release_id=payload["release_id"],
        profile=payload["profile"],
        version=payload["version"],
        commit=payload["commit"],
        build_time_utc=payload["build_time_utc"],
        gate_status=payload["gate_status"],
        migration_entries=tuple(migrations),
        included_paths=tuple(item for item in included_payload if isinstance(item, str)),
    )


def latest_test_artifact() -> Path:
    candidates = sorted((ROOT / ".build" / "test" / "release").glob("*.zip"), key=lambda path: path.stat().st_mtime)
    if not candidates:
        raise RuntimeError("没有找到 test 发布产物")
    return candidates[-1]


def verify_artifact(archive: Path, expected_profile: str) -> ReleaseManifest:
    manifest = read_manifest(archive)
    if manifest.schema_version != 1:
        raise RuntimeError(f"不支持的发布清单版本: {manifest.schema_version}")
    if manifest.profile != expected_profile:
        raise RuntimeError(f"发布产物 profile={manifest.profile}，不符合要求 profile={expected_profile}")
    if manifest.gate_status != "passed":
        raise RuntimeError("发布产物未通过门禁")
    checksum_path = archive.with_suffix(".sha256")
    if not checksum_path.is_file():
        raise RuntimeError("发布产物缺少 SHA256 校验文件")
    checksum_parts = checksum_path.read_text(encoding="ascii").split()
    if len(checksum_parts) != 2 or len(checksum_parts[0]) != 64:
        raise RuntimeError("发布产物 SHA256 校验文件格式无效")
    expected = checksum_parts[0]
    actual = sha256_file(archive)
    if expected != actual:
        raise RuntimeError("发布产物 SHA256 校验失败")
    return manifest


def copy_transition(archive: Path, manifest: ReleaseManifest, transition: str) -> Path:
    target_root = ROOT / ".build" / "stable" / transition
    target_root.mkdir(parents=True, exist_ok=True)
    target = target_root / archive.name
    if target.exists():
        raise RuntimeError(f"目标产物已存在，拒绝覆盖: {target}")
    shutil.copy2(archive, target)
    shutil.copy2(archive.with_suffix(".sha256"), target.with_suffix(".sha256")) if archive.with_suffix(".sha256").is_file() else None
    record = target.with_suffix(".json")
    record.write_text(
        json.dumps(
            {
                "transition": transition,
                "releaseId": manifest.release_id,
                "sourceProfile": manifest.profile,
                "targetProfile": "stable",
                "commit": manifest.commit,
                "timeUtc": datetime.now(timezone.utc).isoformat(),
                "archive": target.name,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return target


def promote_release(archive: Path, manifest: ReleaseManifest) -> Path:
    target = copy_transition(archive, manifest, "promoted")
    state = read_state(ROOT)
    write_state(ROOT, manifest.release_id, state.current_release_id)
    return target


def rollback_release(archive: Path, manifest: ReleaseManifest) -> Path:
    state = read_state(ROOT)
    if not state.current_release_id or not state.previous_release_id:
        raise RuntimeError("stable 不存在可回滚的上一版本")
    if manifest.release_id != state.previous_release_id:
        raise RuntimeError(
            f"回滚目标必须是上一 stable 版本 {state.previous_release_id}，实际为 {manifest.release_id}"
        )
    target = copy_transition(archive, manifest, "rollback")
    write_state(ROOT, manifest.release_id, state.current_release_id)
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="CRM 发布产物、晋级和回滚管理")
    parser.add_argument("action", choices=[item.value for item in ReleaseAction])
    parser.add_argument("--profile", choices=("stable", "test"), default="test")
    parser.add_argument("--artifact", type=Path)
    args = parser.parse_args()
    try:
        if args.action == ReleaseAction.RELEASE.value:
            create_release(args.profile)
            return 0
        if args.action == ReleaseAction.PROMOTE.value:
            source = args.artifact or latest_test_artifact()
            manifest = verify_artifact(source, "test")
            target = promote_release(source, manifest)
            print(f"test 产物已晋级为当前 stable 版本: {target}")
            return 0
        source = args.artifact or previous_promoted_artifact(ROOT)
        manifest = verify_artifact(source, "test")
        target = rollback_release(source, manifest)
        print(f"stable 发布状态已回滚: {target}")
        return 0
    except (OSError, RuntimeError, ValueError, zipfile.BadZipFile) as error:
        print(f"发布操作失败: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
