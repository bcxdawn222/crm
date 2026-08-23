from __future__ import annotations

import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from runtime.profile_config import get_profile_config


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

    print("runtime profile 隔离检查通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
