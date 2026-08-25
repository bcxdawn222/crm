from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from runtime.manager import _acquire_lock, _release_lock
from runtime.profile_config import ProfileConfig, get_profile_config


def main() -> int:
    stable = get_profile_config("stable")
    if stable.name != "stable" or stable.app_port == 0:
        print("stable profile 基础配置无效")
        return 1

    previous = os.environ.get("CRM_TEST_DATABASE_URL")
    os.environ["CRM_TEST_DATABASE_URL"] = stable.database_url
    try:
        get_profile_config("test")
    except ValueError:
        pass
    else:
        print("test profile 未拒绝稳定版数据库连接")
        return 1
    finally:
        if previous is None:
            os.environ.pop("CRM_TEST_DATABASE_URL", None)
        else:
            os.environ["CRM_TEST_DATABASE_URL"] = previous

    with tempfile.TemporaryDirectory(prefix="crm-runtime-check-") as directory:
        root = Path(directory)
        config = ProfileConfig(
            name="test",
            app_host="127.0.0.1",
            app_port=3301,
            database_url="mysql://test:test@127.0.0.1:3307/crm_test",
            database_host="127.0.0.1",
            database_port=3307,
            auth_url="http://127.0.0.1:3301",
            auth_secret="runtime-check-secret-32-characters-minimum",
            upload_dir=root / "storage",
            log_dir=root / "logs",
            pid_file=root / "server.pid",
            lock_file=root / "server.lock",
            build_dir=root / "build",
        )
        config.lock_file.parent.mkdir(parents=True, exist_ok=True)
        _acquire_lock(config, os.getpid())
        try:
            try:
                _acquire_lock(config, os.getpid())
            except RuntimeError:
                pass
            else:
                print("同 profile 第二次加锁未被拒绝")
                return 1
        finally:
            _release_lock(config)

    print("runtime profile 隔离检查通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
