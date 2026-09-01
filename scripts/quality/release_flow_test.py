from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import zipfile
from dataclasses import asdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

import release
from release_state import read_state


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def checksum(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    path.with_suffix(".sha256").write_text(f"{digest}  {path.name}\n", encoding="ascii")
    return digest


def check_deploy_templates() -> None:
    nginx = (ROOT / "scripts" / "deploy" / "nginx-crm-system.conf").read_text(encoding="utf-8")
    require("proxy_pass http://127.0.0.1:3000" in nginx, "Nginx 缺少 stable 入口")
    require("proxy_pass http://127.0.0.1:3001" in nginx, "Nginx 缺少 test 入口")
    require("X-CRM-Profile stable" in nginx and "X-CRM-Profile test" in nginx, "Nginx 未显式标记 profile")
    environment = (ROOT / ".env.example").read_text(encoding="utf-8")
    require("mysql://root:" not in environment, ".env.example 仍包含固定数据库账号")
    require("<stable 数据库连接>" in environment and "<test 数据库连接>" in environment, "环境模板未区分 stable/test")


def check_release_payload_contract() -> None:
    included = {path.relative_to(ROOT).as_posix() for path in release.required_paths()}
    require("prisma/schema.prisma" in included, "发布包缺少 Prisma schema，无法在服务器生成 Client")
    require("next.config.mjs" in included, "发布包缺少 Next.js ESM 运行配置")
    require("scripts/cli" in included, "发布包缺少 manage.py 的 CLI 依赖")
    require("scripts/runtime" in included, "发布包缺少 manage.py 的运行时依赖")
    require("scripts/release.py" in included, "发布包缺少发布管理脚本")
    require("src" in included and "tsconfig.json" in included, "发布包缺少 check 所需源码或类型配置")
    require("CRM系统客户运行说明.txt" in included, "发布包缺少客户运行说明")
    require("docs/CRM系统维护与发布回滚手册.md" in included, "发布包缺少维护手册")
    files = release.included_files()
    require(all("__pycache__" not in path.parts for path in files), "发布包仍包含 __pycache__")
    require(all(path.suffix not in {".pyc", ".pyo"} for path in files), "发布包仍包含 Python 缓存文件")
    require(
        all(not path.relative_to(ROOT).as_posix().startswith("public/uploads/") for path in files),
        "发布包仍包含 public/uploads 中的上传文件",
    )


def check_browser_recovery_contract() -> None:
    login_page = (ROOT / "src" / "app" / "(auth)" / "login" / "page.tsx").read_text(encoding="utf-8")
    require("window.location.replace(getSafeCallbackPath())" in login_page, "登录成功未使用可靠的整页跳转")
    require("router.refresh()" not in login_page, "登录成功仍同时触发客户端刷新")
    client = (ROOT / "src" / "lib" / "http" / "client.ts").read_text(encoding="utf-8")
    require("await waitBeforeRetry(attempt)" in client, "GET 瞬时失败重试前没有等待")
    remote_release = (ROOT / "scripts" / "deploy" / "production" / "remote_release.sh").read_text(encoding="utf-8")
    require("--ignore-existing" in remote_release, "发布切换未保留上一版本的静态资源")
    require('"$CURRENT/.next/static/" "$release_dir/.next/static/"' in remote_release, "静态资源保留路径不正确")
    require("native-static-files.txt" in remote_release, "发布脚本没有限制历史静态资源的继承范围")


def write_artifact(root: Path, release_id: str, commit: str) -> tuple[Path, release.ReleaseManifest]:
    archive = root / ".build" / "test" / "release" / f"{release_id}.zip"
    archive.parent.mkdir(parents=True, exist_ok=True)
    manifest = release.ReleaseManifest(
        schema_version=1,
        release_id=release_id,
        profile="test",
        version="1.0.0",
        commit=commit,
        build_time_utc="2026-08-25T00:00:00+00:00",
        gate_status="passed",
        migration_entries=(release.MigrationEntry("prisma/migrations/001/migration.sql", "b" * 64),),
        included_paths=("package.json", "release-manifest.json"),
    )
    with zipfile.ZipFile(archive, "w") as handle:
        handle.writestr("release-manifest.json", json.dumps(asdict(manifest)))
    checksum(archive)
    return archive, manifest


def main() -> int:
    check_deploy_templates()
    check_release_payload_contract()
    check_browser_recovery_contract()
    with tempfile.TemporaryDirectory(prefix="crm-release-flow-") as directory:
        root = Path(directory)
        previous_root = release.ROOT
        release.ROOT = root
        try:
            first_archive, first_manifest = write_artifact(root, "1.0.0-first", "a" * 40)
            second_archive, second_manifest = write_artifact(root, "1.0.0-second", "c" * 40)
            loaded = release.verify_artifact(first_archive, "test")
            require(loaded.release_id == first_manifest.release_id, "发布清单读取失败")
            first_promoted = release.promote_release(first_archive, loaded)
            release.promote_release(second_archive, second_manifest)
            promoted_state = read_state(root)
            require(promoted_state.current_release_id == second_manifest.release_id, "第二次 promote 未成为当前版本")
            require(promoted_state.previous_release_id == first_manifest.release_id, "promote 未保留上一版本")
            rollback = release.rollback_release(first_promoted, first_manifest)
            require(rollback.is_file(), "rollback 未复制历史产物")
            require(rollback.with_suffix(".json").is_file(), "rollback 未写入转换记录")
            rollback_state = read_state(root)
            require(rollback_state.current_release_id == first_manifest.release_id, "rollback 未切回上一版本")
            require(rollback_state.previous_release_id == second_manifest.release_id, "rollback 未保留回滚前版本")

            first_archive.with_suffix(".sha256").unlink()
            try:
                release.verify_artifact(first_archive, "test")
            except RuntimeError as error:
                require("缺少 SHA256" in str(error), "缺少校验文件时未返回明确错误")
            else:
                raise RuntimeError("缺少 SHA256 的产物未被拒绝")

            first_archive.with_suffix(".sha256").write_text("\n", encoding="ascii")
            try:
                release.verify_artifact(first_archive, "test")
            except RuntimeError as error:
                require("格式无效" in str(error), "空校验文件未返回明确错误")
            else:
                raise RuntimeError("空 SHA256 文件未被拒绝")

            checksum(first_archive)
            first_archive.with_suffix(".sha256").write_text("0" * 64 + f"  {first_archive.name}\n", encoding="ascii")
            try:
                release.verify_artifact(first_archive, "test")
            except RuntimeError as error:
                require("SHA256" in str(error), "损坏校验未返回明确错误")
            else:
                raise RuntimeError("损坏校验未被拒绝")
        finally:
            release.ROOT = previous_root
    print("release/promote/rollback/校验流程通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
